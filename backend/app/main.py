from datetime import datetime, timezone

from botocore.exceptions import ClientError
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import get_users_table
from .models import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    TokenResponse,
    UpdateMeRequest,
    UserResponse,
)
from .security import create_access_token, decode_token, hash_password, verify_password

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _user_from_item(item: dict) -> UserResponse:
    return UserResponse(
        role=item["role"],
        email=item["email"],
        full_name=item["full_name"],
        is_active=item.get("is_active", True),
        created_at=datetime.fromisoformat(item["created_at"]),
        updated_at=datetime.fromisoformat(item["updated_at"]),
    )


def _token_payload(authorization: str | None) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = authorization.split(" ", maxsplit=1)[1].strip()
    try:
        return decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc


@app.get(f"{settings.api_v1_prefix}/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


@app.get(f"{settings.api_v1_prefix}/branding")
def branding() -> dict[str, str]:
    return {
        "name": "GramSaarthi",
        "tagline": "Modern village governance intelligence",
        "description": "A clean, public-facing digital experience for GramSaarthi.",
    }


@app.post(f"{settings.api_v1_prefix}/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: RegisterRequest):
    table = get_users_table()
    now = datetime.now(timezone.utc).isoformat()
    email = _normalize_email(payload.email)

    item = {
        "role": payload.role.value,
        "email": email,
        "full_name": payload.full_name.strip(),
        "password_hash": hash_password(payload.password),
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }

    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(#r) AND attribute_not_exists(#e)",
            ExpressionAttributeNames={"#r": "role", "#e": "email"},
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code == "ConditionalCheckFailedException":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists for this role")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to register user") from exc

    return _user_from_item(item)


@app.post(f"{settings.api_v1_prefix}/auth/login", response_model=TokenResponse)
def login_user(payload: LoginRequest):
    table = get_users_table()
    email = _normalize_email(payload.email)

    response = table.get_item(Key={"role": payload.role.value, "email": email})
    item = response.get("Item")

    if not item or not verify_password(payload.password, item.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not item.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is inactive")

    token = create_access_token(role=item["role"], email=item["email"])
    return TokenResponse(access_token=token)


@app.get(f"{settings.api_v1_prefix}/auth/me", response_model=UserResponse)
def get_me(authorization: str | None = Header(default=None)):
    payload = _token_payload(authorization)
    table = get_users_table()

    response = table.get_item(Key={"role": payload["role"], "email": payload["email"]})
    item = response.get("Item")
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return _user_from_item(item)


@app.put(f"{settings.api_v1_prefix}/auth/me", response_model=UserResponse)
def update_me(update: UpdateMeRequest, authorization: str | None = Header(default=None)):
    payload = _token_payload(authorization)
    table = get_users_table()

    update_expr_parts = ["updated_at = :updated_at"]
    expr_attr_vals = {":updated_at": datetime.now(timezone.utc).isoformat()}
    if update.full_name:
        update_expr_parts.append("full_name = :full_name")
        expr_attr_vals[":full_name"] = update.full_name.strip()

    if update.password:
        update_expr_parts.append("password_hash = :password_hash")
        expr_attr_vals[":password_hash"] = hash_password(update.password)

    if len(update_expr_parts) == 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")

    try:
        response = table.update_item(
            Key={"role": payload["role"], "email": payload["email"]},
            UpdateExpression="SET " + ", ".join(update_expr_parts),
            ExpressionAttributeValues=expr_attr_vals,
            ConditionExpression="attribute_exists(#r) AND attribute_exists(#e)",
            ReturnValues="ALL_NEW",
            ExpressionAttributeNames={"#r": "role", "#e": "email"},
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code == "ConditionalCheckFailedException":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user") from exc

    return _user_from_item(response["Attributes"])


@app.delete(f"{settings.api_v1_prefix}/auth/me", response_model=MessageResponse)
def delete_me(authorization: str | None = Header(default=None)):
    payload = _token_payload(authorization)
    table = get_users_table()

    try:
        table.delete_item(
            Key={"role": payload["role"], "email": payload["email"]},
            ConditionExpression="attribute_exists(#r) AND attribute_exists(#e)",
            ExpressionAttributeNames={"#r": "role", "#e": "email"},
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code == "ConditionalCheckFailedException":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete user") from exc

    return MessageResponse(message="User deleted successfully")

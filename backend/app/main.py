import hashlib
from datetime import datetime, timezone

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_ROLES = {"District Admin", "Rural User", "Panchayat Officer"}


class RegisterRequest(BaseModel):
    name: str
    login_id: str
    password: str
    role: str


class LoginRequest(BaseModel):
    login_id: str
    password: str
    role: str


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _get_users_table():
    dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
    return dynamodb.Table(settings.dynamodb_users_table)


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


@app.post(f"{settings.api_v1_prefix}/auth/register")
def register_user(payload: RegisterRequest) -> dict[str, str]:
    login_id = payload.login_id.lower().strip()
    role = payload.role.strip()

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role selected")

    if "@" not in login_id or "." not in login_id:
        raise HTTPException(status_code=400, detail="Invalid login ID format")

    if len(payload.password) < 4:
        raise HTTPException(
            status_code=400, detail="Password must be at least 4 characters"
        )

    users_table = _get_users_table()
    key = {settings.dynamodb_users_pk_name: role, settings.dynamodb_users_sk_name: login_id}

    try:
        existing_user = users_table.get_item(Key=key)
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Unable to read users table") from exc

    if existing_user.get("Item") is not None:
        raise HTTPException(status_code=409, detail="Login ID already registered for this role")

    item = {
        settings.dynamodb_users_pk_name: role,
        settings.dynamodb_users_sk_name: login_id,
        "name": payload.name.strip(),
        "password_hash": _hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        users_table.put_item(Item=item)
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Unable to save registration") from exc

    return {
        "message": "Registration successful",
        "name": item["name"],
        "login_id": login_id,
        "role": role,
    }


@app.post(f"{settings.api_v1_prefix}/auth/login")
def login_user(payload: LoginRequest) -> dict[str, str]:
    login_id = payload.login_id.lower().strip()
    role = payload.role.strip()

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role selected")

    if "@" not in login_id or "." not in login_id:
        raise HTTPException(status_code=400, detail="Invalid login ID format")

    users_table = _get_users_table()
    key = {settings.dynamodb_users_pk_name: role, settings.dynamodb_users_sk_name: login_id}

    try:
        response = users_table.get_item(Key=key)
    except (ClientError, BotoCoreError) as exc:
        raise HTTPException(status_code=500, detail="Unable to read users table") from exc

    user = response.get("Item")

    if user is None:
        raise HTTPException(status_code=404, detail="User not found for selected role")

    if _hash_password(payload.password) != user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "message": "Login successful",
        "name": user["name"],
        "login_id": login_id,
        "role": role,
    }

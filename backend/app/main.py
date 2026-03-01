import hashlib

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

ALLOWED_ROLES = {"citizen", "volunteer", "admin"}
users_db: dict[str, dict[str, str]] = {}


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str


class LoginRequest(BaseModel):
    email: str
    password: str
    role: str


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


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
    email = payload.email.lower().strip()
    role = payload.role.lower().strip()

    if role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role selected")

    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")

    if len(payload.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

    if email in users_db:
        raise HTTPException(status_code=409, detail="Email already registered")

    users_db[email] = {
        "name": payload.name.strip(),
        "email": email,
        "password_hash": _hash_password(payload.password),
        "role": role,
    }

    return {
        "message": "Registration successful",
        "name": users_db[email]["name"],
        "email": email,
        "role": role,
    }


@app.post(f"{settings.api_v1_prefix}/auth/login")
def login_user(payload: LoginRequest) -> dict[str, str]:
    email = payload.email.lower().strip()
    role = payload.role.lower().strip()
    user = users_db.get(email)

    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")

    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if role != user["role"]:
        raise HTTPException(status_code=401, detail="Role does not match this account")

    if _hash_password(payload.password) != user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "message": "Login successful",
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
    }

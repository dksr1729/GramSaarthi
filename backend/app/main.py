from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field


app = FastAPI(title='Users CRUD API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    city: Optional[str] = Field(default='')


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    email: Optional[EmailStr] = None
    city: Optional[str] = None


class User(BaseModel):
    id: str
    name: str
    email: EmailStr
    city: str
    createdAt: str


USERS: dict[str, User] = {}


def _find_user_by_email(email: str) -> Optional[User]:
    for user in USERS.values():
        if user.email.lower() == email.lower():
            return user
    return None


@app.get('/api/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/api/users', response_model=list[User])
def list_users() -> list[User]:
    return sorted(USERS.values(), key=lambda user: user.createdAt, reverse=True)


@app.post('/api/users', response_model=User, status_code=201)
def create_user(payload: UserCreate) -> User:
    if _find_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail='Email already exists')

    user = User(
        id=uuid4().hex[:10],
        name=payload.name.strip(),
        email=payload.email,
        city=(payload.city or '').strip(),
        createdAt=datetime.now(timezone.utc).isoformat(),
    )
    USERS[user.id] = user
    return user


@app.get('/api/users/{user_id}', response_model=User)
def get_user(user_id: str) -> User:
    user = USERS.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return user


@app.put('/api/users/{user_id}', response_model=User)
def update_user(user_id: str, payload: UserUpdate) -> User:
    user = USERS.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    updates = user.model_dump()

    if payload.email and payload.email.lower() != user.email.lower():
        existing = _find_user_by_email(payload.email)
        if existing and existing.id != user_id:
            raise HTTPException(status_code=409, detail='Email already exists')

    if payload.name is not None:
        updates['name'] = payload.name.strip()
    if payload.email is not None:
        updates['email'] = payload.email
    if payload.city is not None:
        updates['city'] = payload.city.strip()

    updated = User(**updates)
    USERS[user_id] = updated
    return updated


@app.delete('/api/users/{user_id}', status_code=204)
def delete_user(user_id: str) -> None:
    if user_id not in USERS:
        raise HTTPException(status_code=404, detail='User not found')
    USERS.pop(user_id)

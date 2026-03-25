"""
api/routes/auth.py — Авторизация.

POST /api/auth/login    — email + password → access_token + refresh_token
GET  /api/auth/me       — текущий пользователь
POST /api/auth/refresh  — обновить access_token по refresh_token
POST /api/auth/logout   — (клиент просто удаляет токены, но endpoint для явности)
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import JWT_ALGORITHM, JWT_SECRET, get_current_user
from db.models import User
from db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))


# ── Схемы ────────────────────────────────────────────────────────────────────

class LoginBody(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"


class RefreshBody(BaseModel):
    refreshToken: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    isActive: bool


# ── Утилиты ──────────────────────────────────────────────────────────────────

def _create_token(sub: str, token_type: str, expires_delta: timedelta) -> str:
    payload = {
        "sub": sub,
        "type": token_type,
        "exp": datetime.now(timezone.utc) + expires_delta,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _make_tokens(user_id: str) -> TokenOut:
    access = _create_token(
        user_id, "access", timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh = _create_token(
        user_id, "refresh", timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    return TokenOut(accessToken=access, refreshToken=refresh)


def _user_out(u: User) -> UserOut:
    return UserOut(id=u.id, email=u.email, name=u.name, role=u.role, isActive=u.is_active)


# ── Эндпоинты ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenOut)
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not pwd_context.verify(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт отключён")

    return _make_tokens(user.id)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return _user_out(user)


@router.post("/refresh", response_model=TokenOut)
async def refresh(body: RefreshBody, db: AsyncSession = Depends(get_db)):
    try:
        payload = jwt.decode(body.refreshToken, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise ValueError("not refresh token")
        user_id: str = payload["sub"]
    except (JWTError, ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return _make_tokens(user.id)


@router.post("/logout", status_code=204)
async def logout():
    """Клиент должен удалить токены на своей стороне."""
    return

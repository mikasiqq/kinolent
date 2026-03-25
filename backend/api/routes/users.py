"""
api/routes/users.py — Управление пользователями (только admin).

GET    /api/users          — список всех пользователей
POST   /api/users          — создать пользователя
PUT    /api/users/{id}     — обновить (имя, роль, статус)
DELETE /api/users/{id}     — удалить
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import require_admin
from db.models import User
from db.session import get_db

router = APIRouter(prefix="/api/users", tags=["users"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Схемы ────────────────────────────────────────────────────────────────────

class UserCreateBody(BaseModel):
    email: str
    name: str
    password: str
    role: str = "viewer"  # admin | manager | viewer


class UserUpdateBody(BaseModel):
    name: str
    role: str
    isActive: bool


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str
    isActive: bool
    createdAt: str


def _to_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        email=u.email,
        name=u.name,
        role=u.role,
        isActive=u.is_active,
        createdAt=u.created_at.isoformat() if u.created_at else "",
    )


# ── Эндпоинты ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[UserOut], dependencies=[Depends(require_admin)])
async def list_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at))
    return [_to_out(u) for u in result.scalars().all()]


@router.post("", response_model=UserOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_user(body: UserCreateBody, db: AsyncSession = Depends(get_db)):
    # Проверяем уникальность email
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(400, "Email уже занят")

    if body.role not in ("admin", "manager", "viewer"):
        raise HTTPException(400, "Недопустимая роль")

    user = User(
        email=body.email,
        name=body.name,
        password_hash=pwd_context.hash(body.password),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _to_out(user)


@router.put("/{user_id}", response_model=UserOut, dependencies=[Depends(require_admin)])
async def update_user(
    user_id: str, body: UserUpdateBody, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    if body.role not in ("admin", "manager", "viewer"):
        raise HTTPException(400, "Недопустимая роль")

    user.name = body.name
    user.role = body.role
    user.is_active = body.isActive
    await db.commit()
    await db.refresh(user)
    return _to_out(user)


@router.delete("/{user_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    await db.delete(user)
    await db.commit()

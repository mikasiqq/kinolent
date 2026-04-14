"""
api/routes/organizations.py — CRUD для организаций (мультитенант).

GET    /api/organizations           — список всех организаций
GET    /api/organizations/{id}      — конкретная организация + статистика
POST   /api/organizations           — создать организацию
PUT    /api/organizations/{id}      — обновить организацию
DELETE /api/organizations/{id}      — удалить организацию
"""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import require_admin
from db.models import Hall, Movie, Organization, SavedSchedule, User
from db.session import get_db

router = APIRouter(prefix="/api/organizations", tags=["organizations"])


# ── Схемы ────────────────────────────────────────────────────────────────────

class OrgBody(BaseModel):
    name: str
    slug: str | None = None
    description: str | None = None
    address: str | None = None
    logoUrl: str | None = None
    isActive: bool = True


class OrgOut(BaseModel):
    id: str
    name: str
    slug: str
    description: str | None
    address: str | None
    logoUrl: str | None
    isActive: bool
    createdAt: str


class OrgDetailOut(OrgOut):
    usersCount: int
    hallsCount: int
    moviesCount: int
    schedulesCount: int


def _to_out(o: Organization) -> OrgOut:
    return OrgOut(
        id=o.id,
        name=o.name,
        slug=o.slug,
        description=o.description,
        address=o.address,
        logoUrl=o.logo_url,
        isActive=o.is_active,
        createdAt=o.created_at.isoformat() if o.created_at else "",
    )


def _slugify(name: str) -> str:
    """Транслитерация + slug из русского названия."""
    _TRANSLIT = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
        "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
        "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
        "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    }
    result = ""
    for ch in name.lower():
        result += _TRANSLIT.get(ch, ch)
    result = re.sub(r"[^a-z0-9]+", "-", result).strip("-")
    return result or "org"


# ── Эндпоинты ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[OrgOut], dependencies=[Depends(require_admin)])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Organization).order_by(Organization.created_at.desc())
    )
    return [_to_out(o) for o in result.scalars().all()]


@router.get("/{org_id}", response_model=OrgDetailOut, dependencies=[Depends(require_admin)])
async def get_organization(org_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Organization not found")

    users_count = (await db.execute(
        select(func.count()).select_from(User).where(User.org_id == org_id)
    )).scalar() or 0
    halls_count = (await db.execute(
        select(func.count()).select_from(Hall).where(Hall.org_id == org_id)
    )).scalar() or 0
    movies_count = (await db.execute(
        select(func.count()).select_from(Movie).where(Movie.org_id == org_id)
    )).scalar() or 0
    schedules_count = (await db.execute(
        select(func.count()).select_from(SavedSchedule).where(SavedSchedule.org_id == org_id)
    )).scalar() or 0

    base = _to_out(org)
    return OrgDetailOut(
        **base.model_dump(),
        usersCount=users_count,
        hallsCount=halls_count,
        moviesCount=movies_count,
        schedulesCount=schedules_count,
    )


@router.post("", response_model=OrgOut, status_code=201, dependencies=[Depends(require_admin)])
async def create_organization(body: OrgBody, db: AsyncSession = Depends(get_db)):
    slug = body.slug or _slugify(body.name)

    existing = (await db.execute(
        select(Organization).where(Organization.slug == slug)
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(400, f"Slug '{slug}' уже занят")

    org = Organization(
        name=body.name,
        slug=slug,
        description=body.description,
        address=body.address,
        logo_url=body.logoUrl,
        is_active=body.isActive,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)
    return _to_out(org)


@router.put("/{org_id}", response_model=OrgOut, dependencies=[Depends(require_admin)])
async def update_organization(
    org_id: str, body: OrgBody, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Organization not found")

    org.name = body.name
    if body.slug and body.slug != org.slug:
        dup = (await db.execute(
            select(Organization).where(Organization.slug == body.slug, Organization.id != org_id)
        )).scalar_one_or_none()
        if dup:
            raise HTTPException(400, f"Slug '{body.slug}' уже занят")
        org.slug = body.slug
    org.description = body.description
    org.address = body.address
    org.logo_url = body.logoUrl
    org.is_active = body.isActive

    await db.commit()
    await db.refresh(org)
    return _to_out(org)


@router.delete("/{org_id}", status_code=204, dependencies=[Depends(require_admin)])
async def delete_organization(org_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(404, "Organization not found")
    await db.delete(org)
    await db.commit()

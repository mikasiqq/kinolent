"""
api/routes/movies.py — CRUD для фильмов.

GET    /api/movies          — список всех фильмов
POST   /api/movies          — создать фильм
PUT    /api/movies/{id}     — обновить фильм
PATCH  /api/movies/{id}/toggle — переключить isActive
DELETE /api/movies/{id}     — удалить фильм
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import require_any, require_manager
from db.models import Movie
from db.session import get_db

router = APIRouter(prefix="/api/movies", tags=["movies"])


# ── Схемы ────────────────────────────────────────────────────────────────────

class MovieBody(BaseModel):
    title: str
    originalTitle: str | None = None
    genre: str = "drama"
    duration: int
    ageRating: str = "0+"
    releaseDate: str = ""
    posterUrl: str | None = None
    description: str | None = None
    director: str | None = None
    popularity: float = 5.0
    minShowsPerDay: int = 0
    maxShowsPerDay: int = 5
    isActive: bool = True


class MovieOut(BaseModel):
    id: str
    title: str
    originalTitle: str | None
    genre: str
    duration: int
    ageRating: str
    releaseDate: str
    posterUrl: str | None
    description: str | None
    director: str | None
    popularity: float
    minShowsPerDay: int
    maxShowsPerDay: int
    isActive: bool
    createdAt: str


def _to_out(m: Movie) -> MovieOut:
    return MovieOut(
        id=m.id,
        title=m.title,
        originalTitle=m.original_title,
        genre=m.genre,
        duration=m.duration,
        ageRating=m.age_rating,
        releaseDate=m.release_date,
        posterUrl=m.poster_url,
        description=m.description,
        director=m.director,
        popularity=m.popularity,
        minShowsPerDay=m.min_shows_per_day,
        maxShowsPerDay=m.max_shows_per_day,
        isActive=m.is_active,
        createdAt=m.created_at.isoformat() if m.created_at else "",
    )


# ── Эндпоинты ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[MovieOut], dependencies=[Depends(require_any)])
async def list_movies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Movie).order_by(Movie.created_at.desc())
    )
    return [_to_out(m) for m in result.scalars().all()]


@router.post("", response_model=MovieOut, status_code=201, dependencies=[Depends(require_manager)])
async def create_movie(body: MovieBody, db: AsyncSession = Depends(get_db)):
    movie = Movie(
        title=body.title,
        original_title=body.originalTitle,
        genre=body.genre,
        duration=body.duration,
        age_rating=body.ageRating,
        release_date=body.releaseDate,
        poster_url=body.posterUrl,
        description=body.description,
        director=body.director,
        popularity=body.popularity,
        min_shows_per_day=body.minShowsPerDay,
        max_shows_per_day=body.maxShowsPerDay,
        is_active=body.isActive,
    )
    db.add(movie)
    await db.commit()
    await db.refresh(movie)
    return _to_out(movie)


@router.put("/{movie_id}", response_model=MovieOut, dependencies=[Depends(require_manager)])
async def update_movie(
    movie_id: str, body: MovieBody, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(404, "Movie not found")

    movie.title = body.title
    movie.original_title = body.originalTitle
    movie.genre = body.genre
    movie.duration = body.duration
    movie.age_rating = body.ageRating
    movie.release_date = body.releaseDate
    movie.poster_url = body.posterUrl
    movie.description = body.description
    movie.director = body.director
    movie.popularity = body.popularity
    movie.min_shows_per_day = body.minShowsPerDay
    movie.max_shows_per_day = body.maxShowsPerDay
    movie.is_active = body.isActive

    await db.commit()
    await db.refresh(movie)
    return _to_out(movie)


@router.patch("/{movie_id}/toggle", response_model=MovieOut, dependencies=[Depends(require_manager)])
async def toggle_movie(movie_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(404, "Movie not found")
    movie.is_active = not movie.is_active
    await db.commit()
    await db.refresh(movie)
    return _to_out(movie)


@router.delete("/{movie_id}", status_code=204, dependencies=[Depends(require_manager)])
async def delete_movie(movie_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(404, "Movie not found")
    await db.delete(movie)
    await db.commit()

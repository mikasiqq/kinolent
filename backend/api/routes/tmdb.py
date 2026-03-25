"""
api/routes/tmdb.py — прокси к TMDB API для поиска и получения информации о фильмах.

GET  /api/tmdb/search?query=...  — поиск фильмов по названию
GET  /api/tmdb/{tmdb_id}         — детали фильма (включая runtime, directors)

TMDB API v3: https://developer.themoviedb.org/reference
Ключ хранится на сервере в переменной окружения TMDB_API_KEY.
Если ключ не задан — эндпоинты возвращают 501.
"""
from __future__ import annotations

import asyncio
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import require_any

router = APIRouter(prefix="/api/tmdb", tags=["tmdb"])

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG = "https://image.tmdb.org/t/p"


def _api_key() -> str:
    return os.getenv("TMDB_API_KEY", "")


def _check_key():
    if not _api_key():
        raise HTTPException(
            501,
            "TMDB_API_KEY не задан. Задайте переменную окружения TMDB_API_KEY.",
        )


# Маппинг жанров TMDB → наши жанры
TMDB_GENRE_MAP: dict[int, str] = {
    28: "action",       # Action
    12: "action",       # Adventure → action
    16: "animation",    # Animation
    35: "comedy",       # Comedy
    80: "thriller",     # Crime → thriller
    99: "documentary",  # Documentary
    18: "drama",        # Drama
    10751: "comedy",    # Family → comedy
    14: "fantasy",      # Fantasy
    36: "drama",        # History → drama
    27: "horror",       # Horror
    10402: "drama",     # Music → drama
    9648: "thriller",   # Mystery → thriller
    10749: "romance",   # Romance
    878: "sci-fi",      # Science Fiction
    10770: "drama",     # TV Movie → drama
    53: "thriller",     # Thriller
    10752: "action",    # War → action
    37: "action",       # Western → action
}

# TMDB certification → наш возрастной рейтинг (RU certifications)
def _map_age_rating(certifications: list[dict]) -> str:
    """Извлечь российский рейтинг из TMDB release_dates."""
    # Ищем RU, потом US
    for country_code in ("RU", "US"):
        for item in certifications:
            if item.get("iso_3166_1") == country_code:
                for release in item.get("release_dates", []):
                    cert = release.get("certification", "")
                    if not cert:
                        continue
                    # RU: "0+", "6+", "12+", "16+", "18+"
                    if cert in ("0+", "6+", "12+", "16+", "18+"):
                        return cert
                    # US MPAA → наш рейтинг
                    us_map = {
                        "G": "0+", "PG": "6+", "PG-13": "12+",
                        "R": "16+", "NC-17": "18+",
                    }
                    if cert in us_map:
                        return us_map[cert]
    return "12+"  # fallback


# ── Поиск фильмов ────────────────────────────────────────────────────────────

@router.get("/search", dependencies=[Depends(require_any)])
async def tmdb_search(query: str = Query(..., min_length=1)):
    """Поиск фильмов по названию через TMDB API (язык: ru-RU)."""
    _check_key()

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{TMDB_BASE}/search/movie",
            params={
                "api_key": _api_key(),
                "query": query,
                "language": "ru-RU",
                "include_adult": False,
                "page": 1,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(502, f"TMDB error: {resp.status_code}")

        data = resp.json()

    results = []
    for m in data.get("results", [])[:15]:
        poster = None
        if m.get("poster_path"):
            poster = f"{TMDB_IMG}/w342{m['poster_path']}"

        results.append({
            "tmdbId": m["id"],
            "title": m.get("title", ""),
            "originalTitle": m.get("original_title", ""),
            "releaseDate": m.get("release_date", ""),
            "posterUrl": poster,
            "overview": (m.get("overview") or "")[:300],
            "voteAverage": m.get("vote_average", 0),
            "genreIds": m.get("genre_ids", []),
        })

    return {"results": results}


# ── Детали фильма ────────────────────────────────────────────────────────────

@router.get("/{tmdb_id}", dependencies=[Depends(require_any)])
async def tmdb_details(tmdb_id: int):
    """Получить подробную информацию о фильме по TMDB ID."""
    _check_key()

    async with httpx.AsyncClient(timeout=10) as client:
        # Параллельные запросы: детали + credits + release_dates
        detail_req = client.get(
            f"{TMDB_BASE}/movie/{tmdb_id}",
            params={"api_key": _api_key(), "language": "ru-RU"},
        )
        credits_req = client.get(
            f"{TMDB_BASE}/movie/{tmdb_id}/credits",
            params={"api_key": _api_key(), "language": "ru-RU"},
        )
        releases_req = client.get(
            f"{TMDB_BASE}/movie/{tmdb_id}/release_dates",
            params={"api_key": _api_key()},
        )

        detail_resp, credits_resp, releases_resp = await asyncio.gather(
            detail_req, credits_req, releases_req,
        )

    if detail_resp.status_code != 200:
        raise HTTPException(502, f"TMDB error: {detail_resp.status_code}")

    d = detail_resp.json()

    # Жанр
    genre = "drama"
    for g in d.get("genres", []):
        mapped = TMDB_GENRE_MAP.get(g["id"])
        if mapped:
            genre = mapped
            break

    # Постер
    poster = None
    if d.get("poster_path"):
        poster = f"{TMDB_IMG}/w500{d['poster_path']}"

    # Режиссёр
    director = ""
    if credits_resp.status_code == 200:
        crew = credits_resp.json().get("crew", [])
        directors = [c["name"] for c in crew if c.get("job") == "Director"]
        director = ", ".join(directors[:2])

    # Возрастной рейтинг
    age_rating = "12+"
    if releases_resp.status_code == 200:
        certifications = releases_resp.json().get("results", [])
        age_rating = _map_age_rating(certifications)

    # Популярность TMDB → наша шкала 1-10
    # TMDB vote_average: 0-10, наша popularity: 1-10
    vote = d.get("vote_average", 5.0)
    popularity = max(1, min(10, round(vote)))

    return {
        "tmdbId": d["id"],
        "title": d.get("title", ""),
        "originalTitle": d.get("original_title", ""),
        "genre": genre,
        "duration": d.get("runtime") or 120,
        "ageRating": age_rating,
        "releaseDate": d.get("release_date", ""),
        "posterUrl": poster,
        "description": (d.get("overview") or "")[:500],
        "director": director,
        "popularity": popularity,
        "voteAverage": d.get("vote_average", 0),
    }

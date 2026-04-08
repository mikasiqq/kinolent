"""
api/routes/kinopoisk.py — прокси к Kinopoisk Unofficial API.

GET  /api/kp/search?query=...  — поиск фильмов по ключевому слову
GET  /api/kp/{kp_id}           — детали фильма (runtime, жанры, режиссёр и т.д.)

API: https://kinopoiskapiunofficial.tech/documentation/api/
Ключ хранится в переменной окружения KP_API_KEY,
передаётся в заголовке X-API-KEY.
Если ключ не задан — эндпоинты возвращают 501.
"""
from __future__ import annotations

import logging
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import require_any

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/kp", tags=["kinopoisk"])

KP_BASE = "https://kinopoiskapiunofficial.tech/api"


def _api_key() -> str:
    return os.getenv("KP_API_KEY", "")


def _proxy() -> str | None:
    """Опциональный прокси из .env, например socks5://127.0.0.1:1080 или http://127.0.0.1:7890"""
    return os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY") or None


def _check_key():
    if not _api_key():
        raise HTTPException(
            501,
            "KP_API_KEY не задан. Получите бесплатный ключ на "
            "https://kinopoiskapiunofficial.tech и задайте переменную окружения KP_API_KEY.",
        )


def _headers() -> dict[str, str]:
    return {
        "X-API-KEY": _api_key(),
        "Content-Type": "application/json",
    }


def _client() -> httpx.AsyncClient:
    """AsyncClient с таймаутом 8с и опциональным прокси."""
    proxy = _proxy()
    return httpx.AsyncClient(
        timeout=httpx.Timeout(8.0, connect=5.0),
        proxy=proxy,
    )


# Маппинг жанров КП → наши жанры
KP_GENRE_MAP: dict[str, str] = {
    "боевик": "action",
    "триллер": "thriller",
    "комедия": "comedy",
    "драма": "drama",
    "ужасы": "horror",
    "фантастика": "sci-fi",
    "фэнтези": "fantasy",
    "мелодрама": "romance",
    "мультфильм": "animation",
    "документальный": "documentary",
    "приключения": "action",
    "криминал": "thriller",
    "детектив": "thriller",
    "военный": "action",
    "семейный": "comedy",
    "история": "drama",
    "биография": "drama",
    "музыка": "drama",
    "вестерн": "action",
    "спорт": "drama",
    "аниме": "animation",
}


def _map_genre(genres: list[dict]) -> str:
    """Конвертировать жанры КП → наш genre."""
    for g in genres:
        name = g.get("genre", "").lower()
        mapped = KP_GENRE_MAP.get(name)
        if mapped:
            return mapped
    return "drama"


def _map_age_rating(rating: str | None) -> str:
    """Конвертировать рейтинг MPAA / возрастное ограничение КП → наш формат."""
    if not rating:
        return "12+"
    rating = rating.strip().lower()
    # КП возвращает "age6", "age12", "age16", "age18" или MPAA "pg13", "r" и т.д.
    age_map = {
        "age0": "0+", "age6": "6+", "age12": "12+", "age16": "16+", "age18": "18+",
        "0+": "0+", "6+": "6+", "12+": "12+", "16+": "16+", "18+": "18+",
        "g": "0+", "pg": "6+", "pg-13": "12+", "pg13": "12+",
        "r": "16+", "nc-17": "18+", "nc17": "18+",
    }
    return age_map.get(rating, "12+")


# ── Поиск фильмов ────────────────────────────────────────────────────────────

@router.get("/search", dependencies=[Depends(require_any)])
async def kp_search(query: str = Query(..., min_length=1)):
    """Поиск фильмов по ключевому слову через Kinopoisk Unofficial API."""
    _check_key()

    try:
        async with _client() as client:
            resp = await client.get(
                f"{KP_BASE}/v2.1/films/search-by-keyword",
                params={"keyword": query, "page": 1},
                headers=_headers(),
            )
    except httpx.TimeoutException:
        log.warning("KP API timeout (search)")
        raise HTTPException(503, "Kinopoisk API недоступен: превышено время ожидания. Проверьте сеть или настройте HTTPS_PROXY в .env")
    except httpx.RequestError as exc:
        log.warning("KP API connect error (search): %s", exc)
        raise HTTPException(503, f"Не удалось подключиться к Kinopoisk API: {exc}. Проверьте сеть или настройте HTTPS_PROXY в .env")

    if resp.status_code != 200:
        raise HTTPException(502, f"Kinopoisk API вернул ошибку: {resp.status_code}")

    data = resp.json()

    results = []
    for m in data.get("films", [])[:15]:
        # Год — КП может вернуть None, "null", пустую строку
        raw_year = m.get("year")
        year = str(raw_year) if raw_year and str(raw_year).lower() not in ("null", "none") else ""

        # Рейтинг КП — может быть None, "null", строка с процентом
        rating = 0.0
        raw_rating = m.get("rating")
        if raw_rating and str(raw_rating).lower() not in ("null", "none"):
            try:
                rating = float(str(raw_rating).replace("%", ""))
                if rating > 10:
                    rating = rating / 10  # процент → десятка
            except (ValueError, TypeError):
                rating = 0.0

        # Безопасная обработка строк (КП может вернуть None / "null")
        def _s(val: object) -> str:
            if val is None:
                return ""
            s = str(val)
            return "" if s.lower() in ("null", "none") else s

        results.append({
            "kpId": m.get("filmId") or m.get("kinopoiskId"),
            "title": _s(m.get("nameRu")) or _s(m.get("nameEn")),
            "originalTitle": _s(m.get("nameEn")),
            "year": year,
            "posterUrl": _s(m.get("posterUrlPreview")) or _s(m.get("posterUrl")) or None,
            "description": _s(m.get("description"))[:300],
            "rating": rating,
            "genres": [g.get("genre", "") for g in m.get("genres", []) if g.get("genre")],
        })

    return {"results": results}


# ── Детали фильма ────────────────────────────────────────────────────────────

@router.get("/{kp_id}", dependencies=[Depends(require_any)])
async def kp_details(kp_id: int):
    """Получить подробную информацию о фильме по Kinopoisk ID."""
    _check_key()

    try:
        async with _client() as client:
            # Детали фильма
            detail_resp = await client.get(
                f"{KP_BASE}/v2.2/films/{kp_id}",
                headers=_headers(),
            )
            # Съёмочная группа (режиссёр)
            staff_resp = await client.get(
                f"{KP_BASE}/v1/staff",
                params={"filmId": kp_id},
                headers=_headers(),
            )
    except httpx.TimeoutException:
        log.warning("KP API timeout (details %s)", kp_id)
        raise HTTPException(503, "Kinopoisk API недоступен: превышено время ожидания")
    except httpx.RequestError as exc:
        log.warning("KP API connect error (details %s): %s", kp_id, exc)
        raise HTTPException(503, f"Не удалось подключиться к Kinopoisk API: {exc}")

    if detail_resp.status_code != 200:
        raise HTTPException(502, f"Kinopoisk API error: {detail_resp.status_code}")

    d = detail_resp.json()

    # Утилита для безопасной обработки строк (КП может вернуть None / "null")
    def _s(val: object) -> str:
        if val is None:
            return ""
        s = str(val)
        return "" if s.lower() in ("null", "none") else s

    def _f(val: object, default: float = 0.0) -> float:
        if val is None:
            return default
        s = str(val)
        if s.lower() in ("null", "none", ""):
            return default
        try:
            return float(s)
        except (ValueError, TypeError):
            return default

    def _i(val: object, default: int = 0) -> int:
        if val is None:
            return default
        s = str(val)
        if s.lower() in ("null", "none", ""):
            return default
        try:
            return int(float(s))
        except (ValueError, TypeError):
            return default

    # Жанр
    genre = _map_genre(d.get("genres", []))

    # Постер
    poster = _s(d.get("posterUrl")) or _s(d.get("posterUrlPreview")) or None

    # Режиссёр
    director = ""
    if staff_resp.status_code == 200:
        staff = staff_resp.json()
        if isinstance(staff, list):
            directors = [
                _s(p.get("nameRu")) or _s(p.get("nameEn"))
                for p in staff
                if p.get("professionKey") == "DIRECTOR"
            ]
            director = ", ".join(name for name in directors[:2] if name)

    # Возрастной рейтинг
    age_rating = _map_age_rating(_s(d.get("ratingAgeLimits")) or _s(d.get("ratingMpaa")))

    # Рейтинг КП → популярность 1-10
    kp_rating = _f(d.get("ratingKinopoisk")) or _f(d.get("ratingImdb")) or 5.0
    popularity = max(1, min(10, round(kp_rating)))

    # Длительность
    duration = _i(d.get("filmLength"), 120)
    if duration <= 0:
        duration = 120

    # Дата релиза — собираем из year
    raw_year = _s(d.get("year"))
    release_date = f"{raw_year}-01-01" if raw_year else ""

    # Описание
    description = _s(d.get("description")) or _s(d.get("shortDescription"))

    return {
        "kpId": d.get("kinopoiskId") or kp_id,
        "title": _s(d.get("nameRu")) or _s(d.get("nameOriginal")),
        "originalTitle": _s(d.get("nameOriginal")) or _s(d.get("nameEn")),
        "genre": genre,
        "duration": duration,
        "ageRating": age_rating,
        "releaseDate": release_date,
        "posterUrl": poster,
        "description": description[:500],
        "director": director,
        "popularity": popularity,
        "ratingKp": _f(d.get("ratingKinopoisk")),
        "ratingImdb": _f(d.get("ratingImdb")),
    }

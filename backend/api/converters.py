"""
converters.py — Преобразование между Pydantic-схемами API и моделями scheduler.

Мост между «фронтовыми» camelCase DTO и внутренними dataclass'ами алгоритма.
"""

from __future__ import annotations

import uuid
from datetime import time

from scheduler.models import (
    AgeRating,
    Hall,
    HallType,
    Movie,
    SchedulerConfig,
)

from .schemas import (
    GenerateRequest,
    HallConfigIn,
    MovieIn,
)


# ── Маппинг типов залов ─────────────────────────────────────────────────────

_HALL_TYPE_MAP: dict[str, HallType] = {
    "2D": HallType.STANDARD_2D,
    "3D": HallType.STANDARD_3D,
    "IMAX": HallType.IMAX,
    "DOLBY_ATMOS": HallType.DOLBY_ATMOS,
    "VIP": HallType.VIP,
}

_AGE_RATING_MAP: dict[str, AgeRating] = {
    "0+": AgeRating.RATING_0,
    "6+": AgeRating.RATING_6,
    "12+": AgeRating.RATING_12,
    "16+": AgeRating.RATING_16,
    "18+": AgeRating.RATING_18,
}


# ── Конвертеры ───────────────────────────────────────────────────────────────

def _parse_time(s: str) -> time:
    """'HH:MM' → datetime.time"""
    h, m = s.split(":")
    return time(int(h), int(m))


def hall_from_dto(dto: HallConfigIn) -> Hall:
    """HallConfigIn (Pydantic) → Hall (dataclass)."""
    return Hall(
        id=dto.id,
        name=dto.name,
        capacity=dto.capacity,
        hall_type=_HALL_TYPE_MAP.get(dto.hall_type, HallType.STANDARD_2D),
        cleaning_minutes=dto.cleaning_minutes,
        floor=dto.floor,
        open_time=_parse_time(dto.open_time),
        close_time=_parse_time(dto.close_time),
    )


def movie_from_dto(dto: MovieIn, allowed_types: list[HallType] | None = None) -> Movie:
    """MovieIn (Pydantic) → Movie (dataclass)."""
    age = _AGE_RATING_MAP.get(dto.age_rating, AgeRating.RATING_0)
    is_children = age in (AgeRating.RATING_0, AgeRating.RATING_6)

    # popularity 0-10 → 0-1
    pop_score = max(0.0, min(dto.popularity / 10.0, 1.0))

    # Если не переданы разрешённые типы залов, разрешаем все типы
    allowed = allowed_types if allowed_types else list(HallType)

    return Movie(
        id=dto.id,
        title=dto.title,
        duration_minutes=dto.duration,
        ad_block_minutes=15,
        age_rating=age,
        genres=[dto.genre] if dto.genre else [],
        popularity_score=pop_score,
        release_week=1,
        allowed_hall_types=allowed,
        distributor_min_shows_per_day=0,           # не навязываем минимум — делает LP недопустимым
        distributor_max_copies=dto.max_shows_per_day,
        is_children=is_children,
    )


def config_from_request(req: GenerateRequest, hall_types: list[str] | None = None) -> SchedulerConfig:
    """GenerateRequest → SchedulerConfig."""
    return SchedulerConfig(
        time_slot_minutes=req.stagger_minutes if req.stagger_minutes >= 5 else 5,
        max_columns_per_hall_day=req.max_columns_per_iteration,
        max_cg_iterations=30,
        days=list(range(req.days)),
        ensure_all_movies_shown=False,  # отключаем, чтобы не делать LP недопустимым
        # SilverScheduler параметры
        movie_switch_penalty=100.0,
        stagger_penalty=50.0,           # смягчаем штраф
        max_gap_between_starts=60,      # увеличиваем допустимый gap
        crowding_block_minutes=10 if req.anti_crowding else 9999,
        min_gap_same_movie_diff_halls=60,
        children_movie_latest_start=1080 if req.children_daytime_only else 1410,
        children_preferred_latest_start=840,
        children_weekday_morning_boost=2.5,
        early_close_fraction=0.0,       # отключаем ограничение раннего закрытия
        early_close_time_minutes=1380,
    )

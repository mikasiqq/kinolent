"""
schemas.py — Pydantic-схемы для REST API.

Определяют контракт запросов/ответов между фронтендом и бэкендом.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ── Запросы ──────────────────────────────────────────────────────────────────


class HallConfigIn(BaseModel):
    """Конфигурация зала (от фронтенда)."""
    id: str
    name: str
    capacity: int = Field(ge=1)
    hall_type: str = Field(alias="hallType", default="2D")
    cleaning_minutes: int = Field(alias="cleaningMinutes", default=15, ge=0)
    open_time: str = Field(alias="openTime", default="09:00")
    close_time: str = Field(alias="closeTime", default="23:30")
    floor: int = 1
    enabled: bool = True

    model_config = {"populate_by_name": True}


class GenerateRequest(BaseModel):
    """Тело POST /api/schedule/generate."""
    schedule_name: str = Field(alias="scheduleName", default="Расписание на неделю")
    days: int = Field(default=7, ge=1, le=7)
    halls: list[HallConfigIn]
    stagger_minutes: int = Field(alias="staggerMinutes", default=5, ge=0)
    max_columns_per_iteration: int = Field(alias="maxColumnsPerIteration", default=100, ge=10)
    lp_time_limit_seconds: int = Field(alias="lpTimeLimitSeconds", default=30, ge=1)
    anti_crowding: bool = Field(alias="antiCrowding", default=True)
    children_daytime_only: bool = Field(alias="childrenDaytimeOnly", default=True)

    model_config = {"populate_by_name": True}


class MovieIn(BaseModel):
    """Фильм (от фронтенда)."""
    id: str
    title: str
    duration: int = Field(ge=1)
    age_rating: str = Field(alias="ageRating", default="0+")
    genre: str = "drama"
    popularity: float = Field(default=5.0, ge=0, le=10)
    min_shows_per_day: int = Field(alias="minShowsPerDay", default=1, ge=0)
    max_shows_per_day: int = Field(alias="maxShowsPerDay", default=99, ge=1)
    is_active: bool = Field(alias="isActive", default=True)
    poster_url: str | None = Field(alias="posterUrl", default=None)

    model_config = {"populate_by_name": True}


# ── Ответы ──────────────────────────────────────────────────────────────────


class ShowOut(BaseModel):
    """Один сеанс в ответе."""
    id: str
    movie_id: str = Field(alias="movieId")
    movie_title: str = Field(alias="movieTitle")
    movie_duration: int = Field(alias="movieDuration")
    ad_block_minutes: int = Field(alias="adBlockMinutes")
    hall_id: str = Field(alias="hallId")
    hall_name: str = Field(alias="hallName")
    day: int
    start_minutes: int = Field(alias="startMinutes")
    end_minutes: int = Field(alias="endMinutes")
    predicted_attendance: int = Field(alias="predictedAttendance")
    predicted_revenue: float = Field(alias="predictedRevenue")
    genre: str
    age_rating: str = Field(alias="ageRating")
    poster_url: str | None = Field(alias="posterUrl", default=None)

    model_config = {"populate_by_name": True, "by_alias": True}


class HallDayScheduleOut(BaseModel):
    """Расписание одного зала на один день."""
    hall_id: str = Field(alias="hallId")
    hall_name: str = Field(alias="hallName")
    day: int
    shows: list[ShowOut]
    total_revenue: float = Field(alias="totalRevenue")
    total_attendance: int = Field(alias="totalAttendance")

    model_config = {"populate_by_name": True, "by_alias": True}


class MetricsOut(BaseModel):
    """Метрики оптимизации."""
    lp_bound: float = Field(alias="lpBound")
    ip_objective: float = Field(alias="ipObjective")
    gap_pct: float = Field(alias="gapPct")
    generation_time_ms: float = Field(alias="generationTimeMs")
    columns_generated: int = Field(alias="columnsGenerated")

    model_config = {"populate_by_name": True, "by_alias": True}


class QualityReportOut(BaseModel):
    """Отчёт качества расписания."""
    total_shows: int = Field(alias="totalShows")
    total_revenue: float = Field(alias="totalRevenue")
    total_attendance: int = Field(alias="totalAttendance")
    total_movie_switches: int = Field(alias="totalMovieSwitches")
    stagger_violations: int = Field(alias="staggerViolations")
    crowding_violations: int = Field(alias="crowdingViolations")
    same_movie_stagger_violations: int = Field(alias="sameMovieStaggerViolations")
    early_closure_violations: int = Field(alias="earlyClosureViolations")
    optimality_gap_pct: float = Field(alias="optimalityGapPct")

    model_config = {"populate_by_name": True, "by_alias": True}


class ScheduleOut(BaseModel):
    """Полное расписание — ответ API."""
    id: str
    name: str
    created_at: str = Field(alias="createdAt")
    days: int
    hall_schedules: list[HallDayScheduleOut] = Field(alias="hallSchedules")
    total_revenue: float = Field(alias="totalRevenue")
    total_attendance: int = Field(alias="totalAttendance")
    total_shows: int = Field(alias="totalShows")
    metrics: MetricsOut
    quality_report: QualityReportOut | None = Field(alias="qualityReport", default=None)

    model_config = {"populate_by_name": True, "by_alias": True}


# ── WebSocket сообщения ─────────────────────────────────────────────────────


class WsStepUpdate(BaseModel):
    """Обновление этапа генерации (по WebSocket)."""
    type: str = "step"
    step_index: int = Field(alias="stepIndex")
    label: str
    description: str
    status: str  # "active" | "completed" | "error"
    progress: float  # 0..100

    model_config = {"populate_by_name": True, "by_alias": True}


class WsDone(BaseModel):
    """Генерация завершена (по WebSocket)."""
    type: str = "done"
    schedule: ScheduleOut

    model_config = {"populate_by_name": True, "by_alias": True}


class WsError(BaseModel):
    """Ошибка генерации (по WebSocket)."""
    type: str = "error"
    message: str

    model_config = {"populate_by_name": True, "by_alias": True}

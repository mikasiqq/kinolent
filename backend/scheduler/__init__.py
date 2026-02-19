"""
scheduler (пакет для автоматической генерации расписаний кинотеатров)

Алгоритм: Column Generation (SilverScheduler).
"""

from .models import (
    AgeRating,
    Hall,
    HallDaySchedule,
    HallType,
    Movie,
    SchedulerConfig,
    Show,
    SolverMetrics,
    WeeklySchedule,
)
from .demand_forecaster import DemandForecaster
from .column_generator import ColumnGenerator
from .solver import ScheduleSolver
from .engine import CinemaScheduler

__all__ = [
    # Модели
    "AgeRating",
    "Hall",
    "HallDaySchedule",
    "HallType",
    "Movie",
    "SchedulerConfig",
    "Show",
    "SolverMetrics",
    "WeeklySchedule",

    # Компоненты
    "DemandForecaster",
    "ColumnGenerator",
    "ScheduleSolver",

    # Фасад
    "CinemaScheduler",
]

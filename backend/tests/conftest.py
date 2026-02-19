"""
conftest.py (общие фикстуры для тестов генератора расписания)
"""

from __future__ import annotations

import pytest
from datetime import time

from scheduler.models import (
    AgeRating, Hall, HallDaySchedule, HallType, Movie, SchedulerConfig, Show,
)


# Фикстуры

@pytest.fixture
def config() -> SchedulerConfig:
    return SchedulerConfig(
        time_slot_minutes=15,
        max_columns_per_hall_day=50,
        max_cg_iterations=10,
        days=[0, 5],  # только понедельник и суббота для быстрых тестов
    )


@pytest.fixture
def small_hall() -> Hall:
    return Hall(
        id="h1", name="Тест-зал",
        capacity=100, hall_type=HallType.STANDARD_2D,
        cleaning_minutes=15,
        open_time=time(10, 0), close_time=time(22, 0),
    )


@pytest.fixture
def imax_hall() -> Hall:
    return Hall(
        id="h2", name="IMAX",
        capacity=250, hall_type=HallType.IMAX,
        cleaning_minutes=20,
        open_time=time(10, 0), close_time=time(23, 0),
    )


@pytest.fixture
def short_movie() -> Movie:
    return Movie(
        id="m1", title="Короткий фильм",
        duration_minutes=90, ad_block_minutes=10,
        popularity_score=0.8, release_week=1,
        allowed_hall_types=[HallType.STANDARD_2D],
    )


@pytest.fixture
def long_movie() -> Movie:
    return Movie(
        id="m2", title="Длинный фильм",
        duration_minutes=170, ad_block_minutes=15,
        popularity_score=0.9, release_week=1,
        allowed_hall_types=[HallType.STANDARD_2D, HallType.IMAX],
    )


@pytest.fixture
def imax_movie() -> Movie:
    return Movie(
        id="m3", title="IMAX-фильм",
        duration_minutes=140, ad_block_minutes=15,
        popularity_score=0.95, release_week=1,
        allowed_hall_types=[HallType.IMAX],
    )

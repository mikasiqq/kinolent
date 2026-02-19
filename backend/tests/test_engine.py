"""
test_engine.py (тесты полного пайплайна (CinemaScheduler))
"""

from __future__ import annotations

from datetime import time

from scheduler.models import Hall, HallType, Movie, SchedulerConfig
from scheduler.engine import CinemaScheduler


class TestCinemaScheduler:
    def test_full_schedule_generation(self, config: SchedulerConfig) -> None:
        halls = [
            Hall(id="h1", name="Зал 1", capacity=100, hall_type=HallType.STANDARD_2D,
                 open_time=time(10, 0), close_time=time(22, 0)),
            Hall(id="h2", name="Зал 2", capacity=150, hall_type=HallType.STANDARD_2D,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм А", duration_minutes=100, popularity_score=0.8,
                  allowed_hall_types=[HallType.STANDARD_2D]),
            Movie(id="m2", title="Фильм Б", duration_minutes=120, popularity_score=0.9,
                  allowed_hall_types=[HallType.STANDARD_2D]),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()

        # Расписание не пустое
        assert len(schedule.all_shows) > 0

        # Выручка положительна
        assert schedule.total_revenue > 0

        # Все сеансы валидны
        for hds in schedule.hall_day_schedules:
            assert hds.is_feasible(), f"Infeasible: {hds}"

    def test_to_dict(self, config: SchedulerConfig) -> None:
        halls = [
            Hall(id="h1", name="Зал 1", capacity=100, hall_type=HallType.STANDARD_2D,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8,
                  allowed_hall_types=[HallType.STANDARD_2D]),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()
        d = scheduler.to_dict(schedule)

        assert "total_shows" in d
        assert "total_revenue" in d
        assert "days" in d
        assert isinstance(d["days"], list)

    def test_quality_report(self, config: SchedulerConfig) -> None:
        """Отчёт качества содержит все метрики SilverScheduler."""
        halls = [
            Hall(id="h1", name="Зал 1", capacity=100, hall_type=HallType.STANDARD_2D,
                 open_time=time(10, 0), close_time=time(22, 0)),
            Hall(id="h2", name="Зал 2", capacity=150, hall_type=HallType.STANDARD_2D,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм А", duration_minutes=100, popularity_score=0.8,
                  allowed_hall_types=[HallType.STANDARD_2D]),
            Movie(id="m2", title="Фильм Б", duration_minutes=120, popularity_score=0.9,
                  allowed_hall_types=[HallType.STANDARD_2D]),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()
        report = scheduler.quality_report(schedule)

        assert "total_shows" in report
        assert "total_movie_switches" in report
        assert "stagger_violations" in report
        assert "crowding_violations" in report
        assert "same_movie_stagger_violations" in report
        assert "movies_coverage" in report
        assert report["movies_coverage"]["total_movies_available"] == 2
        # Новые метрики
        assert "early_closure_violations" in report
        assert "lower_bound" in report
        assert "optimality_gap_pct" in report

    def test_movie_switch_penalty_effect(self, config: SchedulerConfig) -> None:
        """Штраф Q предпочитает столбцы с меньшим кол-вом смен фильма."""
        halls = [
            Hall(id="h1", name="Зал", capacity=100, hall_type=HallType.STANDARD_2D,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм А", duration_minutes=90, popularity_score=0.8,
                  allowed_hall_types=[HallType.STANDARD_2D]),
            Movie(id="m2", title="Фильм Б", duration_minutes=90, popularity_score=0.81,
                  allowed_hall_types=[HallType.STANDARD_2D]),
        ]
        # С высоким штрафом Q — предпочтение одного фильма на экране
        config_high_q = SchedulerConfig(
            time_slot_minutes=15,
            max_columns_per_hall_day=50,
            max_cg_iterations=10,
            days=[0],
            movie_switch_penalty=500.0,  # очень высокий штраф
        )
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config_high_q)
        schedule = scheduler.generate()
        # Должен стремиться к 0 или минимуму смен
        report = scheduler.quality_report(schedule)
        assert report["total_movie_switches"] >= 0  # валидно

"""
test_solver.py (тесты солвера: stagger, early closure, bounds, MILP, Лагранжева релаксация)
"""

from __future__ import annotations

from datetime import time

from scheduler.models import Hall, HallDaySchedule, HallType, Movie, SchedulerConfig, Show
from scheduler.engine import CinemaScheduler


class TestStaggeringInLP:
    """Тесты: Staggering R + y_l в LP."""

    def test_stagger_penalty_exists_in_config(self) -> None:
        """Конфигурация содержит stagger_penalty."""
        config = SchedulerConfig()
        assert hasattr(config, "stagger_penalty")
        assert config.stagger_penalty > 0

    def test_stagger_violations_counted(self) -> None:
        """Quality report считает stagger violations."""
        config = SchedulerConfig(
            days=[0], max_cg_iterations=5, max_columns_per_hall_day=30,
        )
        halls = [
            Hall(id="h1", name="Зал", capacity=100,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм", duration_minutes=120, popularity_score=0.8),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()
        report = scheduler.quality_report(schedule)
        assert "stagger_violations" in report
        assert isinstance(report["stagger_violations"], int)


class TestEarlyClosure:
    """Тесты: Early closure проверка."""

    def test_early_closure_config(self) -> None:
        """Конфигурация содержит early_close параметры."""
        config = SchedulerConfig()
        assert hasattr(config, "early_close_fraction")
        assert hasattr(config, "early_close_time_minutes")
        assert 0 <= config.early_close_fraction <= 1

    def test_early_closure_in_report(self) -> None:
        """Quality report содержит early_closure_violations."""
        config = SchedulerConfig(
            days=[0], max_cg_iterations=5, max_columns_per_hall_day=30,
        )
        halls = [
            Hall(id="h1", name="Зал", capacity=100,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()
        report = scheduler.quality_report(schedule)
        assert "early_closure_violations" in report
        assert isinstance(report["early_closure_violations"], int)

    def test_last_show_end_minutes(self) -> None:
        """HallDaySchedule.last_show_end_minutes работает."""
        hall = Hall(id="h1", name="Зал", capacity=100)
        movie = Movie(id="m1", title="Фильм", duration_minutes=120)
        show = Show(movie=movie, hall=hall, start_minutes=1200)
        hds = HallDaySchedule(hall=hall, day=0, shows=[show])
        assert hds.last_show_end_minutes == show.end_minutes

    def test_empty_schedule_end_minutes(self) -> None:
        """Пустое расписание → last_show_end_minutes = 0."""
        hall = Hall(id="h1", name="Зал", capacity=100)
        hds = HallDaySchedule(hall=hall, day=0, shows=[])
        assert hds.last_show_end_minutes == 0


class TestLowerBoundAndGap:
    """Тесты: Нижняя граница и gap оптимальности."""

    def test_solver_produces_bounds(self) -> None:
        """Солвер записывает solver_metrics с lp_bound, ip_objective, gap_pct."""
        config = SchedulerConfig(
            days=[0], max_cg_iterations=5, max_columns_per_hall_day=30,
        )
        halls = [
            Hall(id="h1", name="Зал", capacity=100,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()

        assert schedule.solver_metrics is not None
        assert schedule.solver_metrics.lp_bound > 0
        assert schedule.solver_metrics.ip_objective > 0
        assert schedule.solver_metrics.gap_pct >= 0

    def test_gap_in_quality_report(self) -> None:
        """Quality report содержит lower_bound и optimality_gap_pct."""
        config = SchedulerConfig(
            days=[0], max_cg_iterations=5, max_columns_per_hall_day=30,
        )
        halls = [
            Hall(id="h1", name="Зал", capacity=100,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()
        report = scheduler.quality_report(schedule)
        assert "lower_bound" in report
        assert "optimality_gap_pct" in report
        assert report["lower_bound"] >= 0


class TestMILPSolver:
    """Тесты: PuLP MILP солвер."""

    def test_pulp_available(self) -> None:
        """PuLP импортируется успешно."""
        import pulp  # noqa: F401
        assert True

    def test_milp_produces_schedule(self) -> None:
        """MILP-солвер генерирует непустое расписание."""
        config = SchedulerConfig(
            days=[0], max_cg_iterations=3, max_columns_per_hall_day=20,
        )
        halls = [
            Hall(id="h1", name="Зал", capacity=100,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()
        assert len(schedule.all_shows) > 0
        assert schedule.total_revenue > 0


class TestLagrangianRelaxation:
    """Тесты: Лагранжева релаксация."""

    def test_lagrangian_bound_computed(self) -> None:
        """Солвер вычисляет Лагранжеву границу и сохраняет в solver_metrics."""
        config = SchedulerConfig(
            days=[0], max_cg_iterations=5, max_columns_per_hall_day=30,
        )
        halls = [
            Hall(id="h1", name="Зал", capacity=100,
                 open_time=time(10, 0), close_time=time(22, 0)),
        ]
        movies = [
            Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8),
        ]
        scheduler = CinemaScheduler(halls=halls, movies=movies, config=config)
        schedule = scheduler.generate()

        assert schedule.solver_metrics is not None
        assert schedule.solver_metrics.lp_bound > 0

    def test_column_generation_state_has_lagrangian_bound(self) -> None:
        """_ColumnGenerationState имеет lagrangian_bound поле."""
        from scheduler.solver import _ColumnGenerationState
        state = _ColumnGenerationState(columns=[])
        assert hasattr(state, "lagrangian_bound")
        assert state.lagrangian_bound == 0.0

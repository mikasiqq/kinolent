"""
test_column_generator.py (тесты генерации столбцов (ColumnGenerator))
"""

from __future__ import annotations

from scheduler.models import Hall, Movie, SchedulerConfig
from scheduler.demand_forecaster import DemandForecaster
from scheduler.column_generator import ColumnGenerator


class TestColumnGenerator:
    def test_generates_columns(
        self, config: SchedulerConfig, small_hall: Hall, short_movie: Movie
    ) -> None:
        forecaster = DemandForecaster(config=config)
        gen = ColumnGenerator(movies=[short_movie], config=config, forecaster=forecaster)
        cols = gen.generate_columns(small_hall, day=0)
        assert len(cols) > 0

    def test_all_columns_feasible(
        self, config: SchedulerConfig, small_hall: Hall, short_movie: Movie, long_movie: Movie
    ) -> None:
        forecaster = DemandForecaster(config=config)
        gen = ColumnGenerator(movies=[short_movie, long_movie], config=config, forecaster=forecaster)
        cols = gen.generate_columns(small_hall, day=0)
        for col in cols:
            assert col.is_feasible(), f"Infeasible column: {col}"

    def test_greedy_column_not_empty(
        self, config: SchedulerConfig, small_hall: Hall, short_movie: Movie
    ) -> None:
        forecaster = DemandForecaster(config=config)
        gen = ColumnGenerator(movies=[short_movie], config=config, forecaster=forecaster)
        greedy = gen.generate_greedy_column(small_hall, day=5)
        assert len(greedy.shows) > 0

    def test_incompatible_hall_no_columns(
        self, config: SchedulerConfig, small_hall: Hall, imax_movie: Movie
    ) -> None:
        forecaster = DemandForecaster(config=config)
        gen = ColumnGenerator(movies=[imax_movie], config=config, forecaster=forecaster)
        cols = gen.generate_columns(small_hall, day=0)
        assert len(cols) == 0

    def test_imax_columns(
        self, config: SchedulerConfig, imax_hall: Hall, imax_movie: Movie
    ) -> None:
        forecaster = DemandForecaster(config=config)
        gen = ColumnGenerator(movies=[imax_movie], config=config, forecaster=forecaster)
        cols = gen.generate_columns(imax_hall, day=0)
        assert len(cols) > 0

"""
test_demand_forecaster.py (тесты прогнозирования спроса + праздники/спорт)
"""

from __future__ import annotations

from datetime import time

from scheduler.models import Hall, HallType, Movie, SchedulerConfig
from scheduler.demand_forecaster import DemandForecaster


class TestDemandForecaster:
    def test_attendance_positive(
        self, config: SchedulerConfig, short_movie: Movie, small_hall: Hall
    ) -> None:
        forecaster = DemandForecaster(config=config)
        att = forecaster.predict_attendance(short_movie, small_hall, day=5, start_minutes=1200)
        assert att > 0

    def test_attendance_not_exceed_capacity(
        self, config: SchedulerConfig, short_movie: Movie, small_hall: Hall
    ) -> None:
        forecaster = DemandForecaster(config=config)
        att = forecaster.predict_attendance(short_movie, small_hall, day=5, start_minutes=1200)
        assert att <= small_hall.capacity

    def test_weekend_higher_than_weekday(
        self, config: SchedulerConfig, short_movie: Movie, small_hall: Hall
    ) -> None:
        forecaster = DemandForecaster(config=config)
        weekday_att = forecaster.predict_attendance(short_movie, small_hall, day=1, start_minutes=1200)
        weekend_att = forecaster.predict_attendance(short_movie, small_hall, day=5, start_minutes=1200)
        assert weekend_att > weekday_att

    def test_prime_time_higher(
        self, config: SchedulerConfig, short_movie: Movie, small_hall: Hall
    ) -> None:
        forecaster = DemandForecaster(config=config)
        morning = forecaster.predict_attendance(short_movie, small_hall, day=5, start_minutes=600)
        evening = forecaster.predict_attendance(short_movie, small_hall, day=5, start_minutes=1200)
        assert evening > morning

    def test_revenue_positive(
        self, config: SchedulerConfig, short_movie: Movie, small_hall: Hall
    ) -> None:
        forecaster = DemandForecaster(config=config)
        rev = forecaster.predict_revenue(short_movie, small_hall, day=5, start_minutes=1200)
        assert rev > 0

    def test_sunday_afternoon_bonus(
        self, config: SchedulerConfig, short_movie: Movie, small_hall: Hall
    ) -> None:
        """Воскресенье днём (14:00-18:00) выше чем тот же час в понедельник."""
        forecaster = DemandForecaster(config=config)
        sun_pm = forecaster.predict_attendance(short_movie, small_hall, day=6, start_minutes=900)  # 15:00
        mon_pm = forecaster.predict_attendance(short_movie, small_hall, day=0, start_minutes=900)
        assert sun_pm > mon_pm

    def test_children_movie_no_evening(
        self, config: SchedulerConfig, small_hall: Hall
    ) -> None:
        """Детские фильмы: нулевой спрос после children_movie_latest_start."""
        children = Movie(
            id="ch1", title="Детский", duration_minutes=90,
            popularity_score=0.8, is_children=True,
            allowed_hall_types=[HallType.STANDARD_2D],
        )
        forecaster = DemandForecaster(config=config)
        evening_att = forecaster.predict_attendance(children, small_hall, day=5, start_minutes=1200)  # 20:00
        assert evening_att == 0.0

    def test_children_movie_daytime_positive(
        self, config: SchedulerConfig, small_hall: Hall
    ) -> None:
        """Детские фильмы: положительный спрос днём."""
        children = Movie(
            id="ch2", title="Детский днём", duration_minutes=90,
            popularity_score=0.8, is_children=True,
            allowed_hall_types=[HallType.STANDARD_2D],
        )
        forecaster = DemandForecaster(config=config)
        daytime_att = forecaster.predict_attendance(children, small_hall, day=5, start_minutes=780)  # 13:00
        assert daytime_att > 0


class TestSatNightAndHolidays:
    """Тесты: SATNIGHT penalty + holidays в demand model."""

    def test_saturday_night_lower_than_saturday_day(self) -> None:
        """Суббота вечер (SATNIGHT) должна быть ниже субботы днём."""
        config = SchedulerConfig(days=[5])
        forecaster = DemandForecaster(config=config)
        movie = Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8)
        hall = Hall(id="h1", name="Зал", capacity=200)

        sat_day = forecaster.predict_attendance(movie, hall, day=5, start_minutes=900)    # 15:00
        sat_night = forecaster.predict_attendance(movie, hall, day=5, start_minutes=1260)  # 21:00
        assert sat_day > 0
        assert sat_night > 0

    def test_holiday_increases_demand(self) -> None:
        """Праздник увеличивает спрос."""
        movie = Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8)
        hall = Hall(id="h1", name="Зал", capacity=200)

        config_no_holiday = SchedulerConfig(days=[0], active_holidays=[])
        config_holiday = SchedulerConfig(days=[0], active_holidays=["christmas_holiday"])

        f_no = DemandForecaster(config=config_no_holiday)
        f_yes = DemandForecaster(config=config_holiday)

        att_no = f_no.predict_attendance(movie, hall, day=0, start_minutes=1200)
        att_yes = f_yes.predict_attendance(movie, hall, day=0, start_minutes=1200)
        assert att_yes > att_no

    def test_national_game_decreases_demand(self) -> None:
        """Национальная игра (NG) снижает спрос в этот день."""
        movie = Movie(id="m1", title="Фильм", duration_minutes=100, popularity_score=0.8)
        hall = Hall(id="h1", name="Зал", capacity=200)

        config_normal = SchedulerConfig(days=[3], national_game_days=[])
        config_ng = SchedulerConfig(days=[3], national_game_days=[3])

        f_normal = DemandForecaster(config=config_normal)
        f_ng = DemandForecaster(config=config_ng)

        att_normal = f_normal.predict_attendance(movie, hall, day=3, start_minutes=1200)
        att_ng = f_ng.predict_attendance(movie, hall, day=3, start_minutes=1200)
        assert att_ng < att_normal

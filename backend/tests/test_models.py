"""
test_models.py (тесты моделей данных (Movie, Hall, Show, HallDaySchedule))
"""

from __future__ import annotations

from datetime import time

from scheduler.models import (
    Hall, HallDaySchedule, HallType, Movie, Show,
)


class TestModels:
    def test_movie_total_slot(self, short_movie: Movie) -> None:
        assert short_movie.total_slot_minutes == 100  # 90 + 10

    def test_hall_operating_minutes(self, small_hall: Hall) -> None:
        assert small_hall.operating_minutes == 720  # 10:00-22:00 = 12h

    def test_hall_can_show(self, small_hall: Hall, short_movie: Movie, imax_movie: Movie) -> None:
        assert small_hall.can_show(short_movie) is True
        assert small_hall.can_show(imax_movie) is False

    def test_show_times(self, short_movie: Movie, small_hall: Hall) -> None:
        show = Show(movie=short_movie, hall=small_hall, start_minutes=600)  # 10:00
        assert show.start_time == time(10, 0)
        assert show.end_minutes == 700  # 10:00 + 100 мин = 11:40
        assert show.end_with_cleaning == 715  # + 15 мин уборка

    def test_hall_day_schedule_feasibility(
        self, short_movie: Movie, small_hall: Hall
    ) -> None:
        show1 = Show(movie=short_movie, hall=small_hall, start_minutes=600)
        show2 = Show(movie=short_movie, hall=small_hall, start_minutes=720)
        schedule = HallDaySchedule(hall=small_hall, day=0, shows=[show1, show2])
        assert schedule.is_feasible() is True

    def test_hall_day_schedule_infeasible_overlap(
        self, short_movie: Movie, small_hall: Hall
    ) -> None:
        show1 = Show(movie=short_movie, hall=small_hall, start_minutes=600)
        show2 = Show(movie=short_movie, hall=small_hall, start_minutes=650)  # перекрытие!
        schedule = HallDaySchedule(hall=small_hall, day=0, shows=[show1, show2])
        assert schedule.is_feasible() is False

    def test_movie_switches_same_movie(
        self, short_movie: Movie, small_hall: Hall
    ) -> None:
        """Нет смен фильма если один и тот же фильм."""
        show1 = Show(movie=short_movie, hall=small_hall, start_minutes=600)
        show2 = Show(movie=short_movie, hall=small_hall, start_minutes=720)
        schedule = HallDaySchedule(hall=small_hall, day=0, shows=[show1, show2])
        assert schedule.movie_switches == 0

    def test_movie_switches_different_movies(
        self, short_movie: Movie, long_movie: Movie, small_hall: Hall
    ) -> None:
        """Одна смена фильма."""
        show1 = Show(movie=short_movie, hall=small_hall, start_minutes=600)
        show2 = Show(movie=long_movie, hall=small_hall, start_minutes=720)
        schedule = HallDaySchedule(hall=small_hall, day=0, shows=[show1, show2])
        assert schedule.movie_switches == 1

    def test_is_children_flag(self) -> None:
        """Флаг is_children у фильма."""
        movie = Movie(id="c1", title="Детский фильм", duration_minutes=90, is_children=True)
        assert movie.is_children is True
        movie2 = Movie(id="c2", title="Обычный фильм", duration_minutes=120)
        assert movie2.is_children is False

    def test_hall_floor(self) -> None:
        """Атрибут floor у зала."""
        hall = Hall(id="f1", name="Зал", capacity=100, floor=2)
        assert hall.floor == 2

"""
engine.py (главный оркестратор генерации расписания кинотеатра)

Объединяет все модули:
  - DemandForecaster (прогнозирование)
  - ColumnGenerator  (генерация столбцов)
  - ScheduleSolver   (Column Generation + IP)

Предоставляет простой API: CinemaScheduler → generate() → WeeklySchedule

Усовершенствования из статьи SilverScheduler:
  - Штраф за смену фильма (Q)
  - Anti-crowding по этажам
  - Staggering (равномерность старта)
  - Разнос одного фильма в разных залах
  - Часовые коэффициенты спроса из Table 2
  - Ограничения детских фильмов по времени
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from .column_generator import ColumnGenerator
from .demand_forecaster import DemandForecaster
from .models import Hall, Movie, SchedulerConfig, SolverMetrics, WeeklySchedule
from .solver import ScheduleSolver

logger = logging.getLogger(__name__)


@dataclass
class CinemaScheduler:
    """
    Фасад: генерация расписания кинотеатра на неделю.

    Использование:
        scheduler = CinemaScheduler(halls, movies)
        schedule  = scheduler.generate()
        scheduler.print_schedule(schedule)
    """
    halls: list[Hall]
    movies: list[Movie]
    config: SchedulerConfig | None = None

    def __post_init__(self) -> None:
        if self.config is None:
            self.config = SchedulerConfig()

    def generate(self) -> WeeklySchedule:
        """Генерирует оптимальное расписание на неделю."""
        forecaster = DemandForecaster(config=self.config)
        col_gen = ColumnGenerator(
            movies=self.movies,
            config=self.config,
            forecaster=forecaster,
        )
        solver = ScheduleSolver(
            halls=self.halls,
            movies=self.movies,
            config=self.config,
            column_gen=col_gen,
        )
        return solver.solve()

    @staticmethod
    def print_schedule(schedule: WeeklySchedule) -> None:
        """Красиво выводит расписание в консоль."""
        day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

        print("\n" + "=" * 80)
        print("  РАСПИСАНИЕ КИНОТЕАТРА НА НЕДЕЛЮ")
        print("=" * 80)
        print(
            f"  Всего сеансов: {len(schedule.all_shows)} | "
            f"Прогноз зрителей: {schedule.total_attendance:,.0f} | "
            f"Прогноз выручки: {schedule.total_revenue:,.0f} ₽"
        )
        print("=" * 80)

        # Группировка по дням
        for day in range(7):
            hds_list = [
                hds for hds in schedule.hall_day_schedules if hds.day == day
            ]
            if not hds_list:
                continue

            print(f"\n{'─' * 80}")
            print(f"  📅 {day_names[day]}")
            print(f"{'─' * 80}")

            for hds in sorted(hds_list, key=lambda h: h.hall.name):
                rev = hds.total_revenue
                att = hds.total_attendance
                print(
                    f"  🎬 {hds.hall.name} ({hds.hall.hall_type.value}, "
                    f"{hds.hall.capacity} мест) — "
                    f"зрителей: {att:.0f}, выручка: {rev:,.0f} ₽"
                )
                for show in hds.shows:
                    fill = show.predicted_attendance / show.hall.capacity * 100
                    print(
                        f"      {show.start_time.strftime('%H:%M')}-"
                        f"{show.end_time.strftime('%H:%M')}  "
                        f"{show.movie.title:<30s}  "
                        f"зрит: {show.predicted_attendance:>5.0f}  "
                        f"заполн: {fill:>5.1f}%  "
                        f"выручка: {show.predicted_revenue:>9,.0f} ₽"
                    )

        print(f"\n{'=' * 80}\n")

    def quality_report(self, schedule: WeeklySchedule) -> dict:
        """
        Отчёт качества расписания по критериям SilverScheduler.

        Проверяет:
          - Кол-во смен фильмов (screen changes, penalty Q)
          - Staggering: макс. пауза без начала нового фильма
          - Anti-crowding: старты на одном этаже в один time-block
          - Same-movie stagger: разнос одного фильма в разных залах
          - Покрытие фильмов: все ли фильмы из пула показаны
          - Early closure: доля залов с ранним завершением
          - Нижняя граница / gap оптимальности
        """
        report: dict = {
            "total_shows": len(schedule.all_shows),
            "total_revenue": round(schedule.total_revenue, 2),
            "total_attendance": round(schedule.total_attendance),
            "total_movie_switches": 0,
            "stagger_violations": 0,
            "crowding_violations": 0,
            "same_movie_stagger_violations": 0,
            "early_closure_violations": 0,
            "movies_coverage": {},
            "lower_bound": 0.0,
            "optimality_gap_pct": 0.0,
        }

        # Подсчёт смен фильмов (screen changes)
        total_switches = 0
        for hds in schedule.hall_day_schedules:
            total_switches += hds.movie_switches
        report["total_movie_switches"] = total_switches

        # Staggering: проверка max_gap
        max_gap = self.config.max_gap_between_starts
        stagger_violations = 0
        for day in self.config.days:
            day_shows = schedule.shows_for_day(day)
            starts = sorted(set(s.start_minutes for s in day_shows))
            for i in range(1, len(starts)):
                gap = starts[i] - starts[i - 1]
                if gap > max_gap:
                    stagger_violations += 1
        report["stagger_violations"] = stagger_violations

        # Anti-crowding
        block = self.config.crowding_block_minutes
        peak_start = self.config.crowding_peak_start
        peak_end = self.config.crowding_peak_end
        crowding_violations = 0
        for day in self.config.days:
            floor_block_starts: dict[tuple[int, int], int] = {}
            for hds in schedule.hall_day_schedules:
                if hds.day != day:
                    continue
                for show in hds.shows:
                    if peak_start <= show.start_minutes < peak_end:
                        block_idx = show.start_minutes // block
                        key = (hds.hall.floor, block_idx)
                        floor_block_starts[key] = floor_block_starts.get(key, 0) + 1
            for count in floor_block_starts.values():
                if count > 1:
                    crowding_violations += count - 1
        report["crowding_violations"] = crowding_violations

        # Same-movie stagger across halls
        min_gap = self.config.min_gap_same_movie_diff_halls
        same_movie_violations = 0
        for day in self.config.days:
            movie_starts: dict[str, list[tuple[int, str]]] = {}
            for hds in schedule.hall_day_schedules:
                if hds.day != day:
                    continue
                for show in hds.shows:
                    movie_starts.setdefault(show.movie.id, []).append(
                        (show.start_minutes, hds.hall.id)
                    )
            for mid, starts in movie_starts.items():
                if len(starts) <= 1:
                    continue
                starts.sort()
                for k in range(len(starts)):
                    for l in range(k + 1, len(starts)):
                        if starts[k][1] != starts[l][1]:  # разные залы
                            if abs(starts[k][0] - starts[l][0]) < min_gap:
                                same_movie_violations += 1
        report["same_movie_stagger_violations"] = same_movie_violations

        # Покрытие фильмов
        all_movie_ids = set()
        for hds in schedule.hall_day_schedules:
            for show in hds.shows:
                all_movie_ids.add(show.movie.id)
        report["movies_coverage"] = {
            "total_movies_available": len(self.movies),
            "movies_in_schedule": len(all_movie_ids),
            "missing_movies": [
                m.title for m in self.movies if m.id not in all_movie_ids
            ],
        }

        # Early closure: доля залов, завершающих до early_close_time
        ec_time = self.config.early_close_time_minutes
        r_frac = self.config.early_close_fraction
        ec_violations = 0
        for day in self.config.days:
            day_hds = [h for h in schedule.hall_day_schedules if h.day == day]
            n_total = len(day_hds)
            if n_total == 0:
                continue
            n_early = sum(
                1 for h in day_hds if h.last_show_end_minutes <= ec_time
            )
            actual_frac = n_early / n_total
            if actual_frac < r_frac:
                ec_violations += 1
        report["early_closure_violations"] = ec_violations

        # Нижняя граница и gap оптимальности (из SolverMetrics)
        metrics = schedule.solver_metrics or SolverMetrics()
        report["lower_bound"] = round(metrics.lp_bound, 2)
        report["optimality_gap_pct"] = round(metrics.gap_pct, 2)

        return report

    def print_quality_report(self, schedule: WeeklySchedule) -> None:
        """Выводит отчёт качества в консоль."""
        r = self.quality_report(schedule)
        print(f"  Всего сеансов:       {r['total_shows']}")
        print(f"  Прогноз зрителей:    {r['total_attendance']:,}")
        print(f"  Прогноз выручки:     {r['total_revenue']:,.0f} ₽")
        print(f"  Смен фильмов (Q):    {r['total_movie_switches']} "
              f"(штраф: {r['total_movie_switches'] * self.config.movie_switch_penalty:,.0f} ₽)")
        print(f"  Stagger нарушения:   {r['stagger_violations']} "
              f"(gap > {self.config.max_gap_between_starts} мин)")
        print(f"  Crowding нарушения:  {r['crowding_violations']} "
              f"(>1 старт на этаже в {self.config.crowding_block_minutes} мин)")
        print(f"  Same-movie stagger:  {r['same_movie_stagger_violations']} "
              f"(<{self.config.min_gap_same_movie_diff_halls} мин в разных залах)")
        cov = r["movies_coverage"]
        print(f"  Покрытие фильмов:    {cov['movies_in_schedule']}/{cov['total_movies_available']}")
        if cov["missing_movies"]:
            print(f"  Не показаны:     {', '.join(cov['missing_movies'])}")
        else:
            print(f"  Все фильмы показаны")
        # Early closure
        print(f"  Early closure наруш.: {r['early_closure_violations']} "
              f"(требуется {self.config.early_close_fraction:.0%} залов "
              f"до {self.config.early_close_time_minutes // 60}:"
              f"{self.config.early_close_time_minutes % 60:02d})")
        # Оптимальность
        if r["lower_bound"] > 0:
            print(f"  Нижняя граница:      {r['lower_bound']:,.0f} ₽")
            print(f"  Gap оптимальности:   {r['optimality_gap_pct']:.2f}%")
        print("=" * 60 + "\n")

    @staticmethod
    def to_dict(schedule: WeeklySchedule) -> dict:
        """
        Сериализует расписание в словарь (для JSON API).
        Удобно для передачи на фронтенд.
        """
        day_names = ["Понедельник", "Вторник", "Среда", "Четверг",
                     "Пятница", "Суббота", "Воскресенье"]
        result = {
            "total_shows": len(schedule.all_shows),
            "total_attendance": round(schedule.total_attendance),
            "total_revenue": round(schedule.total_revenue, 2),
            "days": [],
        }

        for day in range(7):
            day_data = {
                "day": day,
                "day_name": day_names[day],
                "halls": [],
            }
            hds_list = [
                hds for hds in schedule.hall_day_schedules if hds.day == day
            ]
            for hds in sorted(hds_list, key=lambda h: h.hall.name):
                hall_data = {
                    "hall_id": hds.hall.id,
                    "hall_name": hds.hall.name,
                    "hall_type": hds.hall.hall_type.value,
                    "capacity": hds.hall.capacity,
                    "total_attendance": round(hds.total_attendance),
                    "total_revenue": round(hds.total_revenue, 2),
                    "shows": [],
                }
                for show in hds.shows:
                    hall_data["shows"].append({
                        "movie_id": show.movie.id,
                        "movie_title": show.movie.title,
                        "start_time": show.start_time.strftime("%H:%M"),
                        "end_time": show.end_time.strftime("%H:%M"),
                        "duration_minutes": show.movie.total_slot_minutes,
                        "predicted_attendance": round(show.predicted_attendance),
                        "predicted_revenue": round(show.predicted_revenue, 2),
                        "fill_rate": round(
                            show.predicted_attendance / show.hall.capacity * 100, 1
                        ),
                    })
                day_data["halls"].append(hall_data)
            result["days"].append(day_data)

        return result

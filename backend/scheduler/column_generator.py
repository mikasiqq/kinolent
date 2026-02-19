"""
column_generator.py (генерация допустимых столбцов (цепочек сеансов) для Column Generation)

Каждый «столбец» — допустимая последовательность сеансов для одного зала на один день.
Строится как поиск путей на ориентированном ациклическом графе (DAG):

    Узел = (movie_id, start_minute)
    Дуга  из (m1, t1) в (m2, t2)  ⟺  t2 ≥ t1 + duration(m1) + cleaning

Усовершенствования из статьи SilverScheduler:
  1. Штраф Q за смену фильма на экране (constraint на дугах между слоями)
  2. Фильтрация детских фильмов из вечерних слотов
  3. DFS с отсечением по времени и лимиту столбцов
  4. Приоритизация узлов по «приведённой стоимости» (reduced cost) для CG
  5. Жадная эвристика для быстрого стартового набора столбцов
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import Optional

from .demand_forecaster import DemandForecaster
from .models import Hall, HallDaySchedule, Movie, SchedulerConfig, Show


# ---------------------------------------------------------------------------
# Узел графа
# ---------------------------------------------------------------------------

@dataclass(frozen=True, order=True)
class _ScheduleNode:
    """Узел DAG расписания: (минута старта, идентификатор фильма)."""
    start_minute: int
    movie_id: str


# ---------------------------------------------------------------------------
# Генератор столбцов
# ---------------------------------------------------------------------------

@dataclass
class ColumnGenerator:
    """
    Строит множество допустимых расписаний (столбцов) для пары (зал, день).

    Алгоритм:
        1. Создать все допустимые узлы (movie, time) в рабочем интервале зала.
        2. Для каждого узла определить множество «следующих» узлов.
        3. DFS от виртуального истока → перечислить пути → HallDaySchedule.
        4. Если путей слишком много — обрезать по лимиту, сохраняя лучшие
           по суммарной выручке.
    """
    movies: list[Movie]
    config: SchedulerConfig
    forecaster: DemandForecaster

    # ------------------------------------------------------------------
    # Публичный API
    # ------------------------------------------------------------------

    def generate_columns(
        self,
        hall: Hall,
        day: int,
        dual_prices: Optional[dict[str, float]] = None,
    ) -> list[HallDaySchedule]:
        """
        Генерирует допустимые столбцы для (hall, day).

        Args:
            hall: зал кинотеатра
            day: день недели (0..6)
            dual_prices: двойственные цены из LP-релаксации (для pricing step CG).
                         Ключ — movie_id, значение — двойственная цена ограничения.
                         Если None — генерирует стартовый набор на основе выручки.

        Returns:
            Список HallDaySchedule (каждый = один столбец).
        """
        compatible_movies = [m for m in self.movies if hall.can_show(m)]
        if not compatible_movies:
            return []

        hall_open = hall.open_time.hour * 60 + hall.open_time.minute
        hall_close = hall.close_time.hour * 60 + hall.close_time.minute
        slot = self.config.time_slot_minutes
        children_latest = self.config.children_movie_latest_start

        # 1. Построить узлы (фильтрация: детские — только до children_latest)
        nodes: list[_ScheduleNode] = []
        node_show: dict[_ScheduleNode, Show] = {}
        for movie in compatible_movies:
            t = hall_open
            while t + movie.total_slot_minutes <= hall_close:
                # Детские фильмы не ставим на вечерние слоты
                if movie.is_children and t >= children_latest:
                    t += slot
                    continue
                node = _ScheduleNode(start_minute=t, movie_id=movie.id)
                show = Show(movie=movie, hall=hall, start_minutes=t, day=day)
                self.forecaster.predict_for_show(show)
                nodes.append(node)
                node_show[node] = show
                t += slot

        nodes.sort()

        # 2. Построить список смежности (DAG)
        adjacency: dict[_ScheduleNode, list[_ScheduleNode]] = {n: [] for n in nodes}
        for i, n1 in enumerate(nodes):
            show1 = node_show[n1]
            earliest_next = show1.end_with_cleaning
            for j in range(i + 1, len(nodes)):
                n2 = nodes[j]
                if n2.start_minute >= earliest_next:
                    adjacency[n1].append(n2)

        # 3. DFS для перечисления путей (с лимитом)
        columns: list[HallDaySchedule] = []
        limit = self.config.max_columns_per_hall_day

        # Сортируем стартовые узлы по убыванию «ценности»
        def _node_value(n: _ScheduleNode) -> float:
            show = node_show[n]
            if dual_prices:
                return show.predicted_revenue - dual_prices.get(n.movie_id, 0.0)
            return show.predicted_revenue

        # DFS с ограничением глубины + лимитом
        stack: list[list[_ScheduleNode]] = [[n] for n in nodes if n.start_minute == hall_open
                                     or n.start_minute < hall_open + 60]
        # Добавляем пути, начинающиеся с каждого узла
        for n in nodes:
            if [n] not in stack:
                stack.append([n])
            if len(stack) > limit * 2:
                break

        visited_paths: set[tuple[_ScheduleNode, ...]] = set()

        while stack and len(columns) < limit:
            path = stack.pop()
            current = path[-1]

            # Попытка «закрыть» путь — добавить как столбец
            path_key = tuple(path)
            if path_key not in visited_paths and len(path) >= 1:
                visited_paths.add(path_key)
                schedule = self._path_to_schedule(path, node_show, hall, day)
                if schedule.is_feasible():
                    columns.append(schedule)

            # Расширить путь
            neighbors = adjacency.get(current, [])
            # Ограничиваем ветвление: берём top-K соседей по ценности
            scored = sorted(neighbors, key=_node_value, reverse=True)[:8]
            max_same = self.config.max_same_movie_per_hall_day
            for nxt in scored:
                # Проверяем лимит повторений одного фильма в цепочке
                movie_count = sum(1 for n in path if n.movie_id == nxt.movie_id)
                if movie_count >= max_same:
                    continue
                new_path = path + [nxt]
                new_key = tuple(new_path)
                if new_key not in visited_paths:
                    stack.append(new_path)

        # 4. Отсортировать по суммарной ценности (revenue − Q·switches, или reduced cost)
        Q = self.config.movie_switch_penalty
        if dual_prices:
            columns.sort(
                key=lambda c: c.total_revenue - Q * c.movie_switches - sum(
                    dual_prices.get(mid, 0.0) * c.movie_show_count(mid)
                    for mid in c.movie_ids
                ),
                reverse=True,
            )
        else:
            columns.sort(
                key=lambda c: c.total_revenue - Q * c.movie_switches,
                reverse=True,
            )

        return columns[:limit]

    # ------------------------------------------------------------------
    # Быстрая жадная эвристика (для начального решения)
    # ------------------------------------------------------------------

    def generate_greedy_column(
        self,
        hall: Hall,
        day: int,
        preferred_movie: Optional[Movie] = None,
        max_same_movie: int = 2,
    ) -> HallDaySchedule:
        """
        Жадно строит одну «хорошую» цепочку: на каждом шаге выбирает
        ближайший по времени сеанс с максимальной скорр. выручкой.

        Скорректированная выручка = revenue − Q (если фильм меняется).

        Args:
            preferred_movie: если задан, первый сеанс будет с этим фильмом
            max_same_movie: макс. повторений одного фильма в цепочке
        """
        compatible = [m for m in self.movies if hall.can_show(m)]
        if not compatible:
            return HallDaySchedule(hall=hall, day=day, shows=[])

        hall_open = hall.open_time.hour * 60 + hall.open_time.minute
        hall_close = hall.close_time.hour * 60 + hall.close_time.minute
        slot = self.config.time_slot_minutes
        Q = self.config.movie_switch_penalty
        children_latest = self.config.children_movie_latest_start

        shows: list[Show] = []
        current_time = hall_open
        movie_counts: dict[str, int] = {}
        last_movie_id: Optional[str] = None

        while current_time + min(m.total_slot_minutes for m in compatible) <= hall_close:
            best_show: Optional[Show] = None
            best_score = -float("inf")

            available = [
                m for m in compatible
                if movie_counts.get(m.id, 0) < max_same_movie
            ]
            if not available:
                break

            # Фильтруем детские фильмы из вечерних слотов
            available = [
                m for m in available
                if not (m.is_children and current_time >= children_latest)
            ]
            if not available:
                break

            candidates = available
            if preferred_movie and not shows and preferred_movie in available:
                candidates = [preferred_movie]

            for movie in candidates:
                t = current_time
                while t <= current_time + 30 and t + movie.total_slot_minutes <= hall_close:
                    # Детский фильм — пропускаем вечерние слоты
                    if movie.is_children and t >= children_latest:
                        t += slot
                        continue
                    show = Show(movie=movie, hall=hall, start_minutes=t, day=day)
                    self.forecaster.predict_for_show(show)
                    # Штраф Q за смену фильма (как в статье SilverScheduler)
                    switch_cost = Q if (last_movie_id is not None and movie.id != last_movie_id) else 0.0
                    score = show.predicted_revenue - switch_cost
                    if score > best_score:
                        best_score = score
                        best_show = show
                    t += slot

            if best_show is None:
                break

            shows.append(best_show)
            movie_counts[best_show.movie.id] = movie_counts.get(best_show.movie.id, 0) + 1
            last_movie_id = best_show.movie.id
            current_time = best_show.end_with_cleaning

        return HallDaySchedule(hall=hall, day=day, shows=shows)

    # ------------------------------------------------------------------
    # Приватные методы
    # ------------------------------------------------------------------

    def _path_to_schedule(
        self,
        path: list[_ScheduleNode],
        node_show: dict[_ScheduleNode, Show],
        hall: Hall,
        day: int,
    ) -> HallDaySchedule:
        shows = [node_show[n] for n in path]
        return HallDaySchedule(hall=hall, day=day, shows=shows)

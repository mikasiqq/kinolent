/**
 * DndScheduleBoard — интерактивная доска расписания с drag-and-drop.
 *
 * Функции:
 *  - Временная шкала 09:00–24:00 с часовой сеткой
 *  - Drag сеансов по горизонтали (смена времени) и между залами
 *  - Drop фильмов из боковой панели для добавления новых сеансов
 *  - Визуальный DragOverlay (призрак)
 *  - Клик по сеансу → открытие редактора
 */
import { MoviePoster } from "@/components/movies/MoviePoster";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { movieStore } from "@/stores/movieStore";
import { scheduleStore } from "@/stores/scheduleStore";
import type { Movie } from "@/types/movie";
import { GENRE_COLORS, GENRE_LABELS, type Genre } from "@/types/movie";
import type { HallDaySchedule, ScheduleShow } from "@/types/schedule";
import { formatMinutesToTime, HALL_COLORS } from "@/types/schedule";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Film, GripVertical, Search } from "lucide-react";
import { observer } from "mobx-react";
import { useCallback, useMemo, useState } from "react";

// ── Константы ────────────────────────────────────────────────────────────────

const START_HOUR = 9;
const END_HOUR = 24;
const TOTAL_MINUTES = (END_HOUR - START_HOUR) * 60; // 900
const SNAP_MINUTES = 5; // привязка к 5-минутным интервалам
const PIXELS_PER_MINUTE = 1.8; // ширина пикселей на минуту
const TIMELINE_WIDTH = TOTAL_MINUTES * PIXELS_PER_MINUTE; // 1620px
const ROW_HEIGHT = 56; // px

// ── Утилиты ──────────────────────────────────────────────────────────────────

function minutesToPx(min: number): number {
  return (min - START_HOUR * 60) * PIXELS_PER_MINUTE;
}

// ── Draggable Show Block ─────────────────────────────────────────────────────

interface ShowBlockProps {
  show: ScheduleShow;
  hallIndex: number;
  onClick?: () => void;
}

function ShowBlock({ show, hallIndex, onClick }: ShowBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: show.id,
    data: { type: "show", show },
  });

  const left = minutesToPx(show.startMinutes);
  const width = (show.endMinutes - show.startMinutes) * PIXELS_PER_MINUTE;
  const hallColor = HALL_COLORS[hallIndex % HALL_COLORS.length];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            className={cn(
              "absolute top-1 bottom-1 rounded-md cursor-grab active:cursor-grabbing",
              "flex items-center overflow-hidden select-none",
              "transition-shadow duration-150",
              "hover:ring-2 hover:ring-white/50 hover:z-10",
              hallColor,
              isDragging && "opacity-30 ring-2 ring-primary",
            )}
            style={{
              left: `${left}px`,
              width: `${Math.max(width, 20)}px`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            {/* Drag handle */}
            <span
              {...listeners}
              {...attributes}
              className="shrink-0 flex items-center px-0.5 h-full cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-3 w-3 text-white/60" />
            </span>
            {width > 80 && (
              <span className="text-[10px] font-medium text-white truncate leading-tight pr-1">
                {show.movieTitle}
              </span>
            )}
            {width > 140 && (
              <span className="text-[9px] text-white/70 shrink-0 pr-1">
                {formatMinutesToTime(show.startMinutes)}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs bg-popover text-popover-foreground border shadow-lg p-0 z-50"
        >
          <div className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{show.movieTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMinutesToTime(show.startMinutes)} —{" "}
                  {formatMinutesToTime(show.endMinutes)} ({show.movieDuration}{" "}
                  мин)
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                  GENRE_COLORS[show.genre as Genre] ??
                    "bg-gray-100 text-gray-800",
                )}
              >
                {GENRE_LABELS[show.genre as Genre] ?? show.genre}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div>
                <span className="text-muted-foreground">Зал:</span>{" "}
                {show.hallName}
              </div>
              <div>
                <span className="text-muted-foreground">Рейтинг:</span>{" "}
                {show.ageRating}
              </div>
              <div>
                <span className="text-muted-foreground">Зрители:</span>{" "}
                {show.predictedAttendance}
              </div>
              <div>
                <span className="text-muted-foreground">Выручка:</span>{" "}
                {(show.predictedRevenue / 1000).toFixed(0)}K ₽
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── DragOverlay content (призрак при перетаскивании) ──────────────────────────

function ShowDragOverlay({ show }: { show: ScheduleShow }) {
  const width = (show.endMinutes - show.startMinutes) * PIXELS_PER_MINUTE;
  return (
    <div
      className="rounded-md bg-emerald-600 text-white flex items-center px-2 shadow-xl ring-2 ring-emerald-400/50 opacity-90"
      style={{
        width: `${Math.max(width, 80)}px`,
        height: `${ROW_HEIGHT - 8}px`,
      }}
    >
      <span className="text-[11px] font-medium truncate">
        {show.movieTitle}
      </span>
      <span className="text-[9px] ml-auto pl-2 text-white/70">
        {formatMinutesToTime(show.startMinutes)}
      </span>
    </div>
  );
}

function MovieDragOverlay({ movie }: { movie: Movie }) {
  return (
    <div className="rounded-lg bg-blue-600 text-white flex items-center gap-2 px-3 py-2 shadow-xl ring-2 ring-blue-400/50 opacity-90 w-48">
      <Film className="h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium truncate">{movie.title}</p>
        <p className="text-[9px] text-white/70">{movie.duration} мин</p>
      </div>
    </div>
  );
}

// ── Droppable Hall Row ───────────────────────────────────────────────────────

interface HallRowProps {
  hallSchedule: HallDaySchedule;
  hallIndex: number;
  onShowClick: (show: ScheduleShow) => void;
}

function HallRow({ hallSchedule, hallIndex, onShowClick }: HallRowProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `hall-${hallSchedule.hallId}`,
    data: {
      type: "hall",
      hallId: hallSchedule.hallId,
      hallName: hallSchedule.hallName,
    },
  });

  const hallColor = HALL_COLORS[hallIndex % HALL_COLORS.length];

  return (
    <div className="flex group">
      {/* Hall label */}
      <div className="w-28 shrink-0 flex items-center gap-2 pr-2">
        <div className={cn("h-3 w-3 rounded-full shrink-0", hallColor)} />
        <span className="text-xs font-medium text-foreground truncate">
          {hallSchedule.hallName}
        </span>
      </div>

      {/* Timeline area */}
      <div
        ref={setNodeRef}
        className={cn(
          "relative rounded-lg border overflow-hidden transition-colors",
          isOver
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700"
            : "bg-muted/30 border-border/40",
        )}
        style={{ width: `${TIMELINE_WIDTH}px`, height: `${ROW_HEIGHT}px` }}
      >
        {/* Hour grid lines */}
        {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 border-l border-border/20"
            style={{ left: `${i * 60 * PIXELS_PER_MINUTE}px` }}
          />
        ))}

        {/* Shows */}
        {hallSchedule.shows.map((show) => (
          <ShowBlock
            key={show.id}
            show={show}
            hallIndex={hallIndex}
            onClick={() => onShowClick(show)}
          />
        ))}

        {/* Drop indicator */}
        {isOver && (
          <div className="absolute inset-0 border-2 border-dashed border-emerald-400 rounded-lg pointer-events-none z-20" />
        )}
      </div>
    </div>
  );
}

// ── Movie Sidebar (список фильмов для drag-and-drop добавления) ──────────────

const MovieSidebar = observer(function MovieSidebar() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return movieStore.movies
      .filter((m) => m.isActive)
      .filter(
        (m) =>
          !q ||
          m.title.toLowerCase().includes(q) ||
          (m.originalTitle?.toLowerCase().includes(q) ?? false),
      );
  }, [search]);

  return (
    <div className="w-56 shrink-0 rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col h-full">
      <div className="p-3 border-b border-border/50 space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Film className="h-3.5 w-3.5" />
          Фильмы
        </h4>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full rounded-lg border border-border/50 bg-muted/30 pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((movie) => (
          <DraggableMovie key={movie.id} movie={movie} />
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Нет фильмов
          </p>
        )}
      </div>
    </div>
  );
});

function DraggableMovie({ movie }: { movie: Movie }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `movie-${movie.id}`,
    data: { type: "movie", movie },
  });

  const genreColor =
    GENRE_COLORS[movie.genre as Genre] ?? "bg-gray-100 text-gray-800";

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-lg border border-border/40 p-2 cursor-grab active:cursor-grabbing",
        "hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10",
        "transition-all select-none",
        isDragging && "opacity-30",
      )}
    >
      <div className="flex items-start gap-2">
        <MoviePoster
          posterUrl={movie.posterUrl}
          title={movie.title}
          genre={movie.genre}
          className="w-8 h-11 rounded shrink-0"
          emojiSize="text-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium truncate leading-tight">
            {movie.title}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[9px] text-muted-foreground">
              {movie.duration} мин
            </span>
            <span
              className={cn(
                "text-[8px] rounded-full px-1.5 py-0 font-medium",
                genreColor,
              )}
            >
              {GENRE_LABELS[movie.genre] ?? movie.genre}
            </span>
          </div>
          <span className="text-[9px] text-muted-foreground">
            {movie.ageRating}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main Board ───────────────────────────────────────────────────────────────

interface DndScheduleBoardProps {
  onShowClick: (show: ScheduleShow) => void;
}

export const DndScheduleBoard = observer(function DndScheduleBoard({
  onShowClick,
}: DndScheduleBoardProps) {
  const hallSchedules = scheduleStore.currentDaySchedules;
  const uniqueHalls = scheduleStore.uniqueHalls;

  // Ensure all halls have a row even if no shows for this day
  const hallRows: HallDaySchedule[] = useMemo(() => {
    const existing = new Map(hallSchedules.map((hs) => [hs.hallId, hs]));
    return uniqueHalls.map(
      (h) =>
        existing.get(h.id) ?? {
          hallId: h.id,
          hallName: h.name,
          day: scheduleStore.selectedDay,
          shows: [],
          totalRevenue: 0,
          totalAttendance: 0,
        },
    );
  }, [hallSchedules, uniqueHalls]);

  // Active drag state
  const [activeShow, setActiveShow] = useState<ScheduleShow | null>(null);
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (data?.type === "show") {
      setActiveShow(data.show as ScheduleShow);
      setActiveMovie(null);
    } else if (data?.type === "movie") {
      setActiveMovie(data.movie as Movie);
      setActiveShow(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over, delta } = event;

      if (activeShow && over) {
        const overData = over.data.current;

        // Если бросили на зал
        if (overData?.type === "hall") {
          const targetHallId = overData.hallId as string;
          const targetHallName = overData.hallName as string;

          // Вычислить новое время на основе delta.x
          const deltaMinutes =
            Math.round(delta.x / PIXELS_PER_MINUTE / SNAP_MINUTES) *
            SNAP_MINUTES;
          const newStart = Math.max(
            START_HOUR * 60,
            Math.min(
              END_HOUR * 60 - (activeShow.endMinutes - activeShow.startMinutes),
              activeShow.startMinutes + deltaMinutes,
            ),
          );

          if (targetHallId !== activeShow.hallId) {
            // Перемещение в другой зал
            const err = scheduleStore.moveShow(
              activeShow.id,
              targetHallId,
              targetHallName,
              scheduleStore.selectedDay,
            );
            if (!err) {
              // Обновить время после перемещения
              scheduleStore.updateShowTime(activeShow.id, newStart);
            }
          } else if (newStart !== activeShow.startMinutes) {
            // Смена времени в том же зале
            scheduleStore.updateShowTime(activeShow.id, newStart);
          }
        }
      } else if (activeMovie && over) {
        const overData = over.data.current;

        if (overData?.type === "hall") {
          const targetHallId = overData.hallId as string;
          const targetHallName = overData.hallName as string;

          // Определить время по позиции drop
          // Попробуем поместить в середину рабочего дня по умолчанию
          // или используем pointer position
          let startMinutes = 12 * 60; // по умолчанию 12:00

          // Snap к ближайшему свободному слоту
          startMinutes = findFreeSlot(
            targetHallId,
            scheduleStore.selectedDay,
            activeMovie.duration + 15,
            startMinutes,
          );

          scheduleStore.addShow({
            movieId: activeMovie.id,
            movieTitle: activeMovie.title,
            movieDuration: activeMovie.duration,
            genre: activeMovie.genre,
            ageRating: activeMovie.ageRating,
            posterUrl: activeMovie.posterUrl,
            hallId: targetHallId,
            hallName: targetHallName,
            day: scheduleStore.selectedDay,
            startMinutes,
          });
        }
      }

      setActiveShow(null);
      setActiveMovie(null);
    },
    [activeShow, activeMovie],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4">
        {/* Sidebar */}
        <MovieSidebar />

        {/* Timeline board */}
        <div className="flex-1 overflow-x-auto rounded-xl border border-border/50 bg-card">
          <div className="min-w-max">
            {/* Time scale header */}
            <div className="flex border-b border-border/50">
              <div className="w-28 shrink-0" /> {/* Hall label spacer */}
              <div
                className="relative h-7"
                style={{ width: `${TIMELINE_WIDTH}px` }}
              >
                {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
                  const hour = START_HOUR + i;
                  return (
                    <div
                      key={hour}
                      className="absolute top-0 bottom-0 flex items-end"
                      style={{ left: `${i * 60 * PIXELS_PER_MINUTE}px` }}
                    >
                      <span className="text-[10px] font-medium text-muted-foreground -translate-x-1/2 pb-1">
                        {hour}:00
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hall rows */}
            <div className="p-3 space-y-3">
              {hallRows.map((hs, idx) => (
                <HallRow
                  key={hs.hallId}
                  hallSchedule={hs}
                  hallIndex={idx}
                  onShowClick={onShowClick}
                />
              ))}
              {hallRows.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Нет залов
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeShow ? (
          <ShowDragOverlay show={activeShow} />
        ) : activeMovie ? (
          <MovieDragOverlay movie={activeMovie} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Найти ближайший свободный слот для фильма в зале. */
function findFreeSlot(
  hallId: string,
  day: number,
  durationWithAd: number,
  preferredStart: number,
): number {
  const schedule = scheduleStore.currentSchedule;
  if (!schedule) return preferredStart;

  const hs = schedule.hallSchedules.find(
    (h) => h.hallId === hallId && h.day === day,
  );
  if (!hs || hs.shows.length === 0) return preferredStart;

  const sorted = [...hs.shows].sort((a, b) => a.startMinutes - b.startMinutes);

  // Попробовать preferredStart
  if (
    !sorted.some(
      (s) =>
        preferredStart < s.endMinutes &&
        preferredStart + durationWithAd > s.startMinutes,
    )
  ) {
    return preferredStart;
  }

  // Искать первый свободный слот после каждого сеанса
  for (const s of sorted) {
    const candidate = s.endMinutes + 5; // 5 мин буфер
    if (candidate + durationWithAd <= END_HOUR * 60) {
      if (
        !sorted.some(
          (other) =>
            candidate < other.endMinutes &&
            candidate + durationWithAd > other.startMinutes,
        )
      ) {
        return candidate;
      }
    }
  }

  // Попробовать самое начало
  return START_HOUR * 60;
}

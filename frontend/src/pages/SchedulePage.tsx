import { observer } from "mobx-react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Sparkles,
  Trash2,
  Clock,
  Info,
  AlertCircle,
  Users,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { HallTimeline } from "@/components/schedule/HallTimeline";
import { ScheduleStats } from "@/components/schedule/ScheduleStats";
import { DaySelector } from "@/components/schedule/DaySelector";
import { scheduleStore } from "@/stores/scheduleStore";
import { DAY_NAMES_FULL } from "@/types/schedule";
import { cn } from "@/lib/utils";

export const SchedulePage = observer(function SchedulePage() {
  const navigate = useNavigate();
  const schedule = scheduleStore.currentSchedule;

  return (
    <div className="space-y-8">
      {/* Заголовок с градиентом */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-teal-600 to-cyan-700 p-8 text-white shadow-xl">
        {/* Декоративные элементы */}
        <div className="absolute top-0 right-0 -mt-6 -mr-6 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-1/2 right-1/4 h-20 w-20 rounded-full bg-teal-300/20 blur-xl" />
        <div className="absolute bottom-4 right-8 opacity-5">
          <CalendarDays className="h-32 w-32" />
        </div>

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <CalendarDays className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Расписание</h1>
            </div>
            <p className="text-white/70 text-sm max-w-md">
              Просмотр и управление расписанием кинотеатра
            </p>
          </div>
          <Button
            onClick={() => navigate("/generate")}
            size="lg"
            className="shrink-0 bg-white text-teal-700 hover:bg-white/90 shadow-lg font-semibold h-12 px-6"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Сгенерировать расписание
          </Button>
        </div>
      </div>

      {/* Выбор расписания — если несколько */}
      {scheduleStore.schedules.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {scheduleStore.schedules.map((s) => (
            <button
              key={s.id}
              onClick={() => scheduleStore.selectSchedule(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all cursor-pointer",
                s.id === scheduleStore.currentScheduleId
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 shadow-sm ring-1 ring-emerald-500/20"
                  : "border-border/50 hover:border-emerald-300 hover:bg-muted/50",
              )}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="font-medium">{s.name}</span>
              <Badge variant="secondary" className="text-[10px]">
                {s.totalShows} сеансов
              </Badge>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  scheduleStore.deleteSchedule(s.id);
                }}
                className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Контент */}
      {schedule ? (
        <>
          {/* Мета-информация */}
          <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-5">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Info className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="font-semibold text-foreground">
                  {schedule.name}
                </span>
              </div>
              <div className="hidden sm:block h-5 w-px bg-border" />
              <Badge variant="outline" className="rounded-lg">
                📅 {schedule.days} дней
              </Badge>
              <Badge variant="outline" className="rounded-lg">
                🎬 {schedule.totalShows} сеансов
              </Badge>
              <Badge
                variant="outline"
                className="rounded-lg text-emerald-600 border-emerald-200 dark:border-emerald-800"
              >
                💰 {(schedule.totalRevenue / 1_000_000).toFixed(1)}M ₽
              </Badge>
              {schedule.metrics.gapPct < 5 && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 rounded-lg">
                  ⚡ Gap {schedule.metrics.gapPct.toFixed(1)}%
                </Badge>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground ml-auto">
                <Clock className="h-3 w-3" />
                <span className="text-xs">
                  {new Date(schedule.createdAt).toLocaleString("ru-RU")}
                </span>
              </div>
            </div>
          </div>

          {/* Выбор дня */}
          <Tabs>
            <DaySelector />
          </Tabs>

          {/* Статистика дня */}
          <ScheduleStats />

          {/* Таймлайны залов */}
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
            <div className="border-b border-border/50 px-6 py-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-500" />
                {DAY_NAMES_FULL[scheduleStore.selectedDay % 7]}
                <Badge
                  variant="secondary"
                  className="ml-2 font-normal rounded-lg"
                >
                  {scheduleStore.currentDayShows.length} сеансов
                </Badge>
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-8 pt-2">
                {scheduleStore.currentDaySchedules.map((hs, index) => (
                  <HallTimeline
                    key={hs.hallId}
                    shows={hs.shows}
                    hallName={hs.hallName}
                    hallIndex={index}
                  />
                ))}
                {scheduleStore.currentDaySchedules.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Нет сеансов на этот день</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Таблица сеансов */}
          <ShowsTable />
        </>
      ) : (
        /* Пустое состояние */
        <EmptyScheduleState onGenerate={() => navigate("/generate")} />
      )}
    </div>
  );
});

/** Таблица сеансов дня */
const ShowsTable = observer(function ShowsTable() {
  const shows = scheduleStore.currentDayShows;
  if (shows.length === 0) return null;

  const sorted = [...shows].sort((a, b) => a.startMinutes - b.startMinutes);

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="border-b border-border/50 px-6 py-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          Список сеансов
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Время
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Фильм
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Зал
              </th>
              <th className="text-left px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Рейтинг
              </th>
              <th className="text-right px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Зрители
              </th>
              <th className="text-right px-6 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Выручка
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((show, i) => {
              const startH = Math.floor(show.startMinutes / 60);
              const startM = show.startMinutes % 60;
              const endH = Math.floor(show.endMinutes / 60);
              const endM = show.endMinutes % 60;
              const timeStr = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")} — ${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

              return (
                <tr
                  key={show.id}
                  className={cn(
                    "border-b border-border/30 last:border-0 transition-colors hover:bg-muted/40",
                    i % 2 === 0 && "bg-muted/10",
                  )}
                >
                  <td className="px-6 py-3 font-mono text-xs whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {timeStr}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium">{show.movieTitle}</td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {show.hallName}
                  </td>
                  <td className="px-6 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs rounded-md",
                        show.ageRating === "18+"
                          ? "border-red-200 text-red-600"
                          : show.ageRating === "16+"
                            ? "border-orange-200 text-orange-600"
                            : "",
                      )}
                    >
                      {show.ageRating}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      {show.predictedAttendance}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-emerald-600">
                    {(show.predictedRevenue / 1000).toFixed(0)}K ₽
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

/** Пустое состояние */
function EmptyScheduleState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="relative mb-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20">
          <CalendarDays className="h-12 w-12 text-emerald-500" />
        </div>
        <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertCircle className="h-4 w-4 text-amber-600" />
        </div>
      </div>
      <h3 className="text-xl font-bold">Расписание не создано</h3>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        Сгенерируйте оптимальное расписание кинотеатра на основе алгоритма
        Column Generation. Система автоматически распределит фильмы по залам и
        временным слотам.
      </p>
      <Button
        onClick={onGenerate}
        size="lg"
        className="mt-6 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-500/25"
      >
        <Sparkles className="mr-2 h-5 w-5" />
        Создать расписание
      </Button>
    </div>
  );
}

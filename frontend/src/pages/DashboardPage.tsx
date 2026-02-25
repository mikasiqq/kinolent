import { observer } from "mobx-react";
import {
  CalendarDays,
  Film,
  Sparkles,
  ArrowRight,
  BarChart3,
  Clock,
  Clapperboard,
  Popcorn,
  Star,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { movieStore } from "@/stores/movieStore";
import { scheduleStore } from "@/stores/scheduleStore";
import { cn } from "@/lib/utils";

export const DashboardPage = observer(function DashboardPage() {
  const hasSchedule = scheduleStore.schedules.length > 0;

  return (
    <div className="space-y-8">
      {/* Hero-секция */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-violet-600 via-indigo-600 to-blue-700 p-8 sm:p-12 text-white">
        {/* Декоративные элементы */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-60 w-60 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 -mb-16 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute top-1/3 right-1/3 h-24 w-24 rounded-full bg-violet-300/10 blur-2xl" />
        <div className="absolute bottom-4 right-8 opacity-5">
          <Clapperboard className="h-40 w-40" />
        </div>

        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-1.5 text-sm mb-6">
            <Sparkles className="h-4 w-4" />
            Column Generation алгоритм
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Кинолент
          </h1>
          <p className="text-lg text-white/70 max-w-lg leading-relaxed">
            Автоматическая генерация оптимального расписания кинотеатра с
            использованием математической оптимизации
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link to="/generate">
              <Button
                size="lg"
                className="bg-white text-indigo-700 hover:bg-white/90 shadow-xl font-semibold h-12 px-6"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Сгенерировать расписание
              </Button>
            </Link>
            <Link to="/movies">
              <Button
                size="lg"
                variant="outline"
                className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white h-12 px-6 backdrop-blur-sm"
              >
                <Film className="mr-2 h-5 w-5" />
                Каталог фильмов
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Film className="h-5 w-5" />}
          label="Фильмов в каталоге"
          value={movieStore.totalCount}
          sub={`${movieStore.activeCount} активных`}
          color="violet"
        />
        <StatCard
          icon={<Star className="h-5 w-5" />}
          label="Средний рейтинг"
          value={
            movieStore.movies.length > 0
              ? (
                  movieStore.movies.reduce((s, m) => s + m.popularity, 0) /
                  movieStore.movies.length
                ).toFixed(1)
              : "—"
          }
          sub="из 10"
          color="amber"
        />
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Средняя длительность"
          value={`${movieStore.avgDuration}м`}
          sub={`≈ ${(movieStore.avgDuration / 60).toFixed(1)} ч`}
          color="blue"
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Расписаний"
          value={scheduleStore.schedules.length}
          sub={hasSchedule ? "создано" : "ещё нет"}
          color="emerald"
        />
      </div>

      {/* Быстрые действия */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <QuickActionCard
          icon={<Popcorn className="h-7 w-7" />}
          title="Каталог фильмов"
          description="Управляйте фильмами: добавляйте, настраивайте параметры показа и популярность"
          to="/movies"
          gradient="from-blue-500 to-cyan-500"
          iconBg="bg-blue-100 dark:bg-blue-900/30 text-blue-600"
          badge={`${movieStore.totalCount} фильмов`}
        />
        <QuickActionCard
          icon={<CalendarDays className="h-7 w-7" />}
          title="Расписание"
          description="Просматривайте таймлайны залов, статистику сеансов и загрузку кинотеатра"
          to="/schedule"
          gradient="from-emerald-500 to-teal-500"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
          badge={
            hasSchedule
              ? `${scheduleStore.currentSchedule?.totalShows ?? 0} сеансов`
              : undefined
          }
        />
        <QuickActionCard
          icon={<Sparkles className="h-7 w-7" />}
          title="Генерация"
          description="Запустите алгоритм Column Generation для автоматического создания расписания"
          to="/generate"
          gradient="from-violet-500 to-purple-500"
          iconBg="bg-violet-100 dark:bg-violet-900/30 text-violet-600"
          badge="CG алгоритм"
        />
      </div>

      {/* Последнее расписание — если есть */}
      {hasSchedule && scheduleStore.currentSchedule && (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-500" />
              Последнее расписание
            </h3>
            <Link to="/schedule">
              <Button variant="ghost" size="sm" className="text-violet-600">
                Подробнее
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricPill
              label="Сеансов"
              value={scheduleStore.currentSchedule.totalShows}
              color="blue"
            />
            <MetricPill
              label="Зрителей"
              value={`${(scheduleStore.currentSchedule.totalAttendance / 1000).toFixed(1)}K`}
              color="green"
            />
            <MetricPill
              label="Выручка"
              value={`${(scheduleStore.currentSchedule.totalRevenue / 1_000_000).toFixed(1)}M ₽`}
              color="amber"
            />
            <MetricPill
              label="Gap"
              value={`${scheduleStore.currentSchedule.metrics.gapPct.toFixed(1)}%`}
              color="violet"
            />
          </div>
        </div>
      )}
    </div>
  );
});

/* --- Вспомогательные компоненты --- */

const COLOR_MAP: Record<string, { icon: string; bg: string; glow: string }> = {
  violet: {
    icon: "text-violet-600",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    glow: "bg-violet-500",
  },
  blue: {
    icon: "text-blue-600",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    glow: "bg-blue-500",
  },
  amber: {
    icon: "text-amber-600",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    glow: "bg-amber-500",
  },
  emerald: {
    icon: "text-emerald-600",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    glow: "bg-emerald-500",
  },
  green: {
    icon: "text-green-600",
    bg: "bg-green-100 dark:bg-green-900/30",
    glow: "bg-green-500",
  },
};

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.violet;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div
        className={cn(
          "absolute top-0 right-0 h-20 w-20 -mr-4 -mt-4 rounded-full opacity-10 blur-2xl",
          c.glow,
        )}
      />
      <div className="relative flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            c.bg,
            c.icon,
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          {sub && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  to,
  gradient,
  iconBg,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  to: string;
  gradient: string;
  iconBg: string;
  badge?: string;
}) {
  return (
    <Link to={to} className="group block">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 transition-all duration-500 hover:shadow-xl hover:-translate-y-1 hover:border-border h-full">
        {/* Градиент-полоска сверху */}
        <div
          className={cn(
            "absolute top-0 inset-x-0 h-1 bg-linear-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            gradient,
          )}
        />

        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-110",
              iconBg,
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="font-bold text-base">{title}</h3>
              {badge && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {badge}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-4 text-sm font-medium text-violet-600 dark:text-violet-400 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1">
          Перейти
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  );
}

function MetricPill({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.violet;
  return (
    <div className={cn("rounded-xl p-4 text-center", c.bg)}>
      <p className={cn("text-2xl font-bold", c.icon)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

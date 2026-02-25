import { observer } from "mobx-react";
import { Users, DollarSign, BarChart3, Clapperboard } from "lucide-react";
import { scheduleStore } from "@/stores/scheduleStore";
import { cn } from "@/lib/utils";

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  iconBg: string;
  glowColor: string;
}

function StatItem({
  icon,
  label,
  value,
  sub,
  iconBg,
  glowColor,
}: StatItemProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <div
        className={cn(
          "absolute top-0 right-0 h-20 w-20 -mr-4 -mt-4 rounded-full opacity-10 blur-2xl",
          glowColor,
        )}
      />
      <div className="relative flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            iconBg,
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground font-medium truncate">
            {label}
          </p>
          {sub && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export const ScheduleStats = observer(function ScheduleStats() {
  const stats = scheduleStore.currentDayStats;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatItem
        icon={<Clapperboard className="h-5 w-5 text-blue-600" />}
        label="Сеансов сегодня"
        value={stats.totalShows}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        glowColor="bg-blue-500"
      />
      <StatItem
        icon={<Users className="h-5 w-5 text-emerald-600" />}
        label="Зрителей"
        value={stats.totalAttendance.toLocaleString("ru-RU")}
        sub={`~${stats.avgOccupancy} чел/сеанс`}
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
        glowColor="bg-emerald-500"
      />
      <StatItem
        icon={<DollarSign className="h-5 w-5 text-amber-600" />}
        label="Выручка за день"
        value={`${(stats.totalRevenue / 1_000_000).toFixed(1)}M ₽`}
        iconBg="bg-amber-100 dark:bg-amber-900/30"
        glowColor="bg-amber-500"
      />
      <StatItem
        icon={<BarChart3 className="h-5 w-5 text-violet-600" />}
        label="Загрузка"
        value={
          stats.totalShows > 0
            ? `${Math.round((stats.totalAttendance / (stats.totalShows * 250)) * 100)}%`
            : "—"
        }
        sub="от общей вместимости"
        iconBg="bg-violet-100 dark:bg-violet-900/30"
        glowColor="bg-violet-500"
      />
    </div>
  );
});

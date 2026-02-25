import { observer } from "mobx-react";
import { Film, Clock, TrendingUp, Eye } from "lucide-react";
import { movieStore } from "@/stores/movieStore";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  gradient: string;
  iconBg: string;
}

function StatCard({
  icon,
  label,
  value,
  subValue,
  gradient,
  iconBg,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-card p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
      )}
    >
      {/* Декоративный градиент */}
      <div
        className={cn(
          "absolute top-0 right-0 h-24 w-24 -mr-6 -mt-6 rounded-full opacity-10 blur-2xl",
          gradient,
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
        <div>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          {subValue && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {subValue}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export const MovieStats = observer(function MovieStats() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={<Film className="h-5 w-5 text-violet-600" />}
        label="Всего фильмов"
        value={movieStore.totalCount}
        subValue={`${movieStore.activeCount} активных`}
        gradient="bg-violet-500"
        iconBg="bg-violet-100 dark:bg-violet-900/30"
      />
      <StatCard
        icon={<Eye className="h-5 w-5 text-emerald-600" />}
        label="Активных"
        value={movieStore.activeCount}
        subValue={`${movieStore.totalCount - movieStore.activeCount} скрытых`}
        gradient="bg-emerald-500"
        iconBg="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <StatCard
        icon={<Clock className="h-5 w-5 text-blue-600" />}
        label="Средняя длительность"
        value={`${movieStore.avgDuration}м`}
        subValue={`≈ ${(movieStore.avgDuration / 60).toFixed(1)} ч`}
        gradient="bg-blue-500"
        iconBg="bg-blue-100 dark:bg-blue-900/30"
      />
      <StatCard
        icon={<TrendingUp className="h-5 w-5 text-amber-600" />}
        label="По фильтру"
        value={movieStore.filteredMovies.length}
        subValue="фильмов отображено"
        gradient="bg-amber-500"
        iconBg="bg-amber-100 dark:bg-amber-900/30"
      />
    </div>
  );
});

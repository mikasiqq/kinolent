import { observer } from "mobx-react";
import { DAY_NAMES_FULL, DAY_NAMES } from "@/types/schedule";
import { scheduleStore } from "@/stores/scheduleStore";
import { cn } from "@/lib/utils";

export const DaySelector = observer(function DaySelector() {
  const schedule = scheduleStore.currentSchedule;
  if (!schedule) return null;

  const days = Array.from({ length: schedule.days }, (_, i) => i);

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-2">
      {days.map((day) => {
        const isWeekend = day % 7 >= 5;
        const isActive = scheduleStore.selectedDay === day;
        return (
          <button
            key={day}
            onClick={() => scheduleStore.setSelectedDay(day)}
            className={cn(
              "relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
              isActive
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                : isWeekend
                  ? "text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <span className="hidden sm:inline">{DAY_NAMES_FULL[day % 7]}</span>
            <span className="sm:hidden">{DAY_NAMES[day % 7]}</span>
          </button>
        );
      })}
    </div>
  );
});

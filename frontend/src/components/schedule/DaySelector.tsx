import { cn } from "@/lib/utils";
import { scheduleStore } from "@/stores/scheduleStore";
import { DAY_NAMES, DAY_NAMES_FULL } from "@/types/schedule";
import { observer } from "mobx-react";

/** Короткие названия месяцев */
const MONTH_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

export const DaySelector = observer(function DaySelector() {
  const schedule = scheduleStore.currentSchedule;
  if (!schedule) return null;

  const days = Array.from({ length: schedule.days }, (_, i) => i);
  const hasRealDates = !!schedule.startDate;

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-2">
      {days.map((day) => {
        const realDate = scheduleStore.getDateForDay(day);
        const dayOfWeek = realDate ? realDate.getDay() : -1;
        // getDay(): 0=вс, 6=сб
        const isWeekend = realDate
          ? dayOfWeek === 0 || dayOfWeek === 6
          : day % 7 >= 5;
        const isPast = scheduleStore.isDayPast(day);
        const isActive = scheduleStore.selectedDay === day;

        // Название дня: "Пн" или "Понедельник"
        // getDay() возвращает 0=вс, нам нужен маппинг на наш массив (0=пн)
        const weekdayIdx = realDate
          ? (dayOfWeek + 6) % 7 // 0=пн, 1=вт...6=вс
          : day % 7;

        // Формат даты: "7 апр"
        const dateLabel = realDate
          ? `${realDate.getDate()} ${MONTH_SHORT[realDate.getMonth()]}`
          : null;

        return (
          <button
            key={day}
            onClick={() => scheduleStore.setSelectedDay(day)}
            className={cn(
              "relative rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer",
              isActive
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                : isPast
                  ? "text-muted-foreground/50 hover:bg-muted/40 line-through decoration-muted-foreground/30"
                  : isWeekend
                    ? "text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <span className="flex flex-col items-center gap-0.5">
              <span className="hidden sm:inline">
                {DAY_NAMES_FULL[weekdayIdx]}
              </span>
              <span className="sm:hidden">{DAY_NAMES[weekdayIdx]}</span>
              {hasRealDates && dateLabel && (
                <span
                  className={cn(
                    "text-[10px] font-normal",
                    isActive
                      ? "text-white/70"
                      : isPast
                        ? "text-muted-foreground/40"
                        : "text-muted-foreground/60",
                  )}
                >
                  {dateLabel}
                </span>
              )}
            </span>
            {isPast && !isActive && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-muted-foreground/30" />
            )}
          </button>
        );
      })}
    </div>
  );
});

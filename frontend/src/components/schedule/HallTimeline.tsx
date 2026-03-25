import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Genre } from "@/types/movie";
import { GENRE_COLORS, GENRE_LABELS } from "@/types/movie";
import type { ScheduleShow } from "@/types/schedule";
import { formatMinutesToTime, HALL_COLORS } from "@/types/schedule";
import { observer } from "mobx-react";

interface TimelineProps {
  shows: ScheduleShow[];
  hallName: string;
  hallIndex: number;
  startHour?: number;
  endHour?: number;
  onShowClick?: (show: ScheduleShow) => void;
}

/** Временная шкала одного зала на один день */
export const HallTimeline = observer(function HallTimeline({
  shows,
  hallName,
  hallIndex,
  startHour = 9,
  endHour = 24,
  onShowClick,
}: TimelineProps) {
  const totalMinutes = (endHour - startHour) * 60;
  const startOffset = startHour * 60;

  const getPosition = (minutes: number) =>
    ((minutes - startOffset) / totalMinutes) * 100;
  const getWidth = (start: number, end: number) =>
    ((end - start) / totalMinutes) * 100;

  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i,
  );

  const hallColor = HALL_COLORS[hallIndex % HALL_COLORS.length];

  return (
    <div className="group">
      {/* Название зала */}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("h-3 w-3 rounded-full", hallColor)} />
        <span className="text-sm font-medium text-foreground">{hallName}</span>
        <span className="text-xs text-muted-foreground">
          ({shows.length} сеансов)
        </span>
      </div>

      {/* Таймлайн */}
      <div className="relative h-14 bg-muted/50 rounded-lg border overflow-hidden">
        {/* Сетка часов */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute top-0 bottom-0 border-l border-border/30"
            style={{ left: `${getPosition(hour * 60)}%` }}
          >
            <span className="absolute -top-5 left-0.5 text-[10px] text-muted-foreground">
              {hour}:00
            </span>
          </div>
        ))}

        {/* Блоки сеансов */}
        <TooltipProvider delayDuration={100}>
          {shows.map((show) => {
            const left = getPosition(show.startMinutes);
            const width = getWidth(show.startMinutes, show.endMinutes);
            const genreLabel = GENRE_LABELS[show.genre as Genre] ?? show.genre;
            const genreColor =
              GENRE_COLORS[show.genre as Genre] ?? "bg-gray-100 text-gray-800";

            return (
              <Tooltip key={show.id}>
                <TooltipTrigger asChild>
                  <div
                    onClick={() => onShowClick?.(show)}
                    className={cn(
                      "absolute top-1 bottom-1 rounded-md cursor-pointer transition-all duration-200",
                      "hover:ring-2 hover:ring-primary hover:z-10 hover:scale-y-110",
                      "flex items-center overflow-hidden",
                      hallColor,
                    )}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 1.5)}%`,
                    }}
                  >
                    {width > 6 && (
                      <span className="px-1.5 text-[10px] font-medium text-white truncate leading-tight">
                        {show.movieTitle}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="max-w-xs bg-popover text-popover-foreground border shadow-lg p-0"
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">
                          {show.movieTitle}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMinutesToTime(show.startMinutes)} —{" "}
                          {formatMinutesToTime(show.endMinutes)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
                          genreColor,
                        )}
                      >
                        {genreLabel}
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
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
});

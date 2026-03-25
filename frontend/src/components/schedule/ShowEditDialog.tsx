import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { movieStore } from "@/stores/movieStore";
import { scheduleStore } from "@/stores/scheduleStore";
import type { Genre } from "@/types/movie";
import { GENRE_LABELS } from "@/types/movie";
import type { ScheduleShow } from "@/types/schedule";
import { formatMinutesToTime } from "@/types/schedule";
import {
  AlertTriangle,
  ArrowRightLeft,
  Clock,
  Film,
  Save,
  Trash2,
} from "lucide-react";
import { observer } from "mobx-react";
import { useState } from "react";

interface ShowEditDialogProps {
  show: ScheduleShow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ShowEditDialog = observer(function ShowEditDialog({
  show,
  open,
  onOpenChange,
}: ShowEditDialogProps) {
  const [startHour, setStartHour] = useState(0);
  const [startMinute, setStartMinute] = useState(0);
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset state when show changes
  const resetState = () => {
    if (show) {
      setStartHour(Math.floor(show.startMinutes / 60));
      setStartMinute(show.startMinutes % 60);
      setSelectedMovieId(null);
      setConfirmDelete(false);
    }
  };

  // Initialize on open
  if (
    show &&
    open &&
    startHour === 0 &&
    startMinute === 0 &&
    show.startMinutes > 0
  ) {
    resetState();
  }

  if (!show) return null;

  const genreLabel = GENRE_LABELS[show.genre as Genre] ?? show.genre;
  const activeMovies = movieStore.movies.filter((m) => m.isActive);
  const newStartMinutes = startHour * 60 + startMinute;
  const timeChanged = newStartMinutes !== show.startMinutes;
  const movieChanged = selectedMovieId && selectedMovieId !== show.movieId;
  const hasChanges = timeChanged || movieChanged;

  // ── Live overlap validation ────────────────────────────────────────────
  const overlapError = (() => {
    // Determine the effective duration after all pending changes
    const effectiveMovie = movieChanged
      ? movieStore.movies.find((m) => m.id === selectedMovieId)
      : null;
    const duration = effectiveMovie
      ? effectiveMovie.duration + show.adBlockMinutes
      : show.endMinutes - show.startMinutes;
    const start = timeChanged ? newStartMinutes : show.startMinutes;
    const end = start + duration;

    const conflict = scheduleStore.checkOverlap(
      show.hallId,
      show.day,
      start,
      end,
      show.id,
    );
    if (!conflict) return null;
    return `Пересечение с «${conflict.movieTitle}» (${fmt(conflict.startMinutes)}–${fmt(conflict.endMinutes)})`;
  })();

  function fmt(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  function handleSave() {
    if (overlapError) return;

    if (timeChanged) {
      const err = scheduleStore.updateShowTime(show!.id, newStartMinutes);
      if (err) return; // safety — shouldn't happen since we pre-validated
    }
    if (movieChanged && selectedMovieId) {
      const movie = movieStore.movies.find((m) => m.id === selectedMovieId);
      if (movie) {
        const err = scheduleStore.replaceShowMovie(show!.id, {
          id: movie.id,
          title: movie.title,
          duration: movie.duration,
          genre: movie.genre,
          ageRating: movie.ageRating,
          posterUrl: movie.posterUrl,
        });
        if (err) return;
      }
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    scheduleStore.removeShow(show!.id);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) resetState();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="h-5 w-5 text-emerald-500" />
            Редактировать сеанс
          </DialogTitle>
          <DialogDescription>
            Измените время, фильм или удалите сеанс из расписания
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Текущая информация */}
          <div className="rounded-xl bg-muted/50 border border-border/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{show.movieTitle}</p>
              <Badge variant="outline" className="text-xs rounded-md">
                {show.ageRating}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatMinutesToTime(show.startMinutes)} —{" "}
                {formatMinutesToTime(show.endMinutes)}
              </span>
              <span>{show.hallName}</span>
              <span>{genreLabel}</span>
              <span>{show.movieDuration} мин</span>
            </div>
          </div>

          {/* Время */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Время начала
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) =>
                  setStartHour(
                    Math.max(0, Math.min(23, Number(e.target.value))),
                  )
                }
                className="w-20 text-center"
              />
              <span className="text-lg font-bold text-muted-foreground">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                step={5}
                value={startMinute}
                onChange={(e) =>
                  setStartMinute(
                    Math.max(0, Math.min(59, Number(e.target.value))),
                  )
                }
                className="w-20 text-center"
              />
              {timeChanged && (
                <span className="text-xs text-emerald-600 ml-2">
                  → {formatMinutesToTime(newStartMinutes)}
                </span>
              )}
            </div>
          </div>

          {/* Замена фильма */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              Заменить фильм
            </Label>
            <Select
              value={selectedMovieId ?? ""}
              onValueChange={(v) => setSelectedMovieId(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Оставить текущий" />
              </SelectTrigger>
              <SelectContent>
                {activeMovies.map((m) => (
                  <SelectItem
                    key={m.id}
                    value={m.id}
                    disabled={m.id === show.movieId}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-2",
                        m.id === show.movieId && "opacity-50",
                      )}
                    >
                      {m.title}
                      <span className="text-muted-foreground text-xs">
                        {m.duration} мин · {m.ageRating}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Ошибка пересечения */}
        {overlapError && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{overlapError}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            className={cn(
              "gap-1.5 w-full sm:w-auto",
              confirmDelete
                ? "bg-red-600 text-white border-red-600 hover:bg-red-700 hover:text-white"
                : "text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800/40 dark:text-red-400 dark:hover:bg-red-900/20",
            )}
          >
            <Trash2 className="h-4 w-4" />
            {confirmDelete ? "Подтвердить удаление" : "Удалить сеанс"}
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-initial"
            >
              Отмена
            </Button>
            <Button
              disabled={!hasChanges || !!overlapError}
              onClick={handleSave}
              className="flex-1 sm:flex-initial bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-1.5"
            >
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

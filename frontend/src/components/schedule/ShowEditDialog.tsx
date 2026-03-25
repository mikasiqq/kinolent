import { useState } from "react";
import { observer } from "mobx-react";
import {
  Clock,
  Film,
  Trash2,
  ArrowRightLeft,
  Save,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ScheduleShow } from "@/types/schedule";
import { formatMinutesToTime } from "@/types/schedule";
import { GENRE_LABELS } from "@/types/movie";
import type { Genre } from "@/types/movie";
import { scheduleStore } from "@/stores/scheduleStore";
import { movieStore } from "@/stores/movieStore";
import { cn } from "@/lib/utils";

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
  if (show && open && startHour === 0 && startMinute === 0 && show.startMinutes > 0) {
    resetState();
  }

  if (!show) return null;

  const genreLabel = GENRE_LABELS[show.genre as Genre] ?? show.genre;
  const activeMovies = movieStore.movies.filter((m) => m.isActive);
  const newStartMinutes = startHour * 60 + startMinute;
  const timeChanged = newStartMinutes !== show.startMinutes;
  const movieChanged = selectedMovieId && selectedMovieId !== show.movieId;
  const hasChanges = timeChanged || movieChanged;

  function handleSave() {
    if (timeChanged) {
      scheduleStore.updateShowTime(show!.id, newStartMinutes);
    }
    if (movieChanged && selectedMovieId) {
      const movie = movieStore.movies.find((m) => m.id === selectedMovieId);
      if (movie) {
        scheduleStore.replaceShowMovie(show!.id, {
          id: movie.id,
          title: movie.title,
          duration: movie.duration,
          genre: movie.genre,
          ageRating: movie.ageRating,
          posterUrl: movie.posterUrl,
        });
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
      <DialogContent className="max-w-md">
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
                {formatMinutesToTime(show.startMinutes)} — {formatMinutesToTime(show.endMinutes)}
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
                onChange={(e) => setStartHour(Math.max(0, Math.min(23, Number(e.target.value))))}
                className="w-20 text-center"
              />
              <span className="text-lg font-bold text-muted-foreground">:</span>
              <Input
                type="number"
                min={0}
                max={59}
                step={5}
                value={startMinute}
                onChange={(e) => setStartMinute(Math.max(0, Math.min(59, Number(e.target.value))))}
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

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2">
          <Button
            type="button"
            variant={confirmDelete ? "destructive" : "outline"}
            onClick={handleDelete}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            {confirmDelete ? "Подтвердить удаление" : "Удалить сеанс"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button
              disabled={!hasChanges}
              onClick={handleSave}
              className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-1.5"
            >
              <Save className="h-4 w-4" />
              Сохранить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

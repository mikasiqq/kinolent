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
import { movieStore } from "@/stores/movieStore";
import { scheduleStore } from "@/stores/scheduleStore";
import { DAY_NAMES_FULL, formatMinutesToTime } from "@/types/schedule";
import {
  AlertTriangle,
  CalendarDays,
  Clock,
  Film,
  MapPin,
  Plus,
} from "lucide-react";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";

interface AddShowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Предзаполнить зал (при нажатии "+" рядом с залом) */
  preselectedHallId?: string;
  /** Предзаполнить день */
  preselectedDay?: number;
}

export const AddShowDialog = observer(function AddShowDialog({
  open,
  onOpenChange,
  preselectedHallId,
  preselectedDay,
}: AddShowDialogProps) {
  const [selectedMovieId, setSelectedMovieId] = useState<string>("");
  const [selectedHallId, setSelectedHallId] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const [startHour, setStartHour] = useState(10);
  const [startMinute, setStartMinute] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const schedule = scheduleStore.currentSchedule;
  const halls = scheduleStore.uniqueHalls;
  const activeMovies = movieStore.movies.filter((m) => m.isActive);
  const days = schedule ? schedule.days : 7;

  // Сбросить стейт при открытии
  useEffect(() => {
    if (open) {
      setSelectedMovieId("");
      setSelectedHallId(preselectedHallId ?? halls[0]?.id ?? "");
      setSelectedDay(preselectedDay ?? scheduleStore.selectedDay);
      setStartHour(10);
      setStartMinute(0);
      setError(null);
    }
  }, [open, preselectedHallId, preselectedDay, halls]);

  const selectedMovie = activeMovies.find((m) => m.id === selectedMovieId);
  const selectedHall = halls.find((h) => h.id === selectedHallId);
  const startMinutes = startHour * 60 + startMinute;
  const adBlock = 15;
  const endMinutes = selectedMovie
    ? startMinutes + selectedMovie.duration + adBlock
    : startMinutes;

  // Live overlap validation
  const overlapError = (() => {
    if (!selectedMovieId || !selectedHallId) return null;
    if (!selectedMovie) return null;

    const conflict = scheduleStore.checkOverlap(
      selectedHallId,
      selectedDay,
      startMinutes,
      endMinutes,
    );
    if (!conflict) return null;
    return `Пересечение с «${conflict.movieTitle}» (${fmt(conflict.startMinutes)}–${fmt(conflict.endMinutes)})`;
  })();

  function fmt(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  function handleAdd() {
    if (!selectedMovie || !selectedHall) return;
    if (overlapError) return;

    const err = scheduleStore.addShow({
      movieId: selectedMovie.id,
      movieTitle: selectedMovie.title,
      movieDuration: selectedMovie.duration,
      genre: selectedMovie.genre,
      ageRating: selectedMovie.ageRating,
      posterUrl: selectedMovie.posterUrl,
      hallId: selectedHall.id,
      hallName: selectedHall.name,
      day: selectedDay,
      startMinutes,
      adBlockMinutes: adBlock,
    });

    if (err) {
      setError(err);
      return;
    }

    onOpenChange(false);
  }

  const canAdd = !!selectedMovieId && !!selectedHallId && !overlapError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-500" />
            Добавить сеанс
          </DialogTitle>
          <DialogDescription>
            Выберите фильм, зал, день и время для нового сеанса
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Фильм */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Film className="h-4 w-4 text-muted-foreground" />
              Фильм
            </Label>
            <Select value={selectedMovieId} onValueChange={setSelectedMovieId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите фильм..." />
              </SelectTrigger>
              <SelectContent>
                {activeMovies.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-2">
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

          {/* Зал */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Зал
            </Label>
            <Select value={selectedHallId} onValueChange={setSelectedHallId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите зал..." />
              </SelectTrigger>
              <SelectContent>
                {halls.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* День */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              День
            </Label>
            <Select
              value={String(selectedDay)}
              onValueChange={(v) => setSelectedDay(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: days }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    День {i + 1} — {DAY_NAMES_FULL[i % 7]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              {selectedMovie && (
                <span className="text-xs text-muted-foreground ml-2">
                  {formatMinutesToTime(startMinutes)} —{" "}
                  {formatMinutesToTime(endMinutes)}
                  <span className="ml-1.5">
                    ({selectedMovie.duration} + {adBlock} мин)
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Превью выбранного фильма */}
          {selectedMovie && (
            <div className="rounded-xl bg-muted/50 border border-border/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{selectedMovie.title}</p>
                <Badge variant="outline" className="text-xs rounded-md">
                  {selectedMovie.ageRating}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{selectedMovie.duration} мин</span>
                <span>{selectedMovie.genre}</span>
                {selectedHall && <span>{selectedHall.name}</span>}
                <span>
                  День {selectedDay + 1} — {DAY_NAMES_FULL[selectedDay % 7]}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Ошибка пересечения */}
        {(overlapError || error) && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 px-3.5 py-2.5 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{overlapError || error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            disabled={!canAdd}
            onClick={handleAdd}
            className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Добавить сеанс
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

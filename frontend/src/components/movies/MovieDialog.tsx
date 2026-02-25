import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Movie, MovieFormData, Genre, AgeRating } from "@/types/movie";
import { GENRE_LABELS, AGE_RATING_OPTIONS } from "@/types/movie";
import { movieStore } from "@/stores/movieStore";

interface MovieDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movie?: Movie | null;
}

const INITIAL_FORM: MovieFormData = {
  title: "",
  originalTitle: "",
  genre: "drama",
  duration: 120,
  ageRating: "12+",
  releaseDate: new Date().toISOString().split("T")[0],
  posterUrl: "",
  description: "",
  director: "",
  popularity: 5,
  minShowsPerDay: 1,
  maxShowsPerDay: 4,
  isActive: true,
};

export function MovieDialog({ open, onOpenChange, movie }: MovieDialogProps) {
  const isEditing = !!movie;

  const [form, setForm] = useState<MovieFormData>(() => {
    if (movie) {
      return {
        title: movie.title,
        originalTitle: movie.originalTitle ?? "",
        genre: movie.genre,
        duration: movie.duration,
        ageRating: movie.ageRating,
        releaseDate: movie.releaseDate,
        posterUrl: movie.posterUrl ?? "",
        description: movie.description ?? "",
        director: movie.director ?? "",
        popularity: movie.popularity,
        minShowsPerDay: movie.minShowsPerDay,
        maxShowsPerDay: movie.maxShowsPerDay,
        isActive: movie.isActive,
      };
    }
    return { ...INITIAL_FORM };
  });

  const updateField = <K extends keyof MovieFormData>(
    key: K,
    value: MovieFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    if (isEditing && movie) {
      movieStore.updateMovie(movie.id, form);
    } else {
      movieStore.addMovie(form);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактирование фильма" : "Добавить фильм"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Измените информацию о фильме"
              : "Заполните информацию о новом фильме для расписания кинотеатра"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Основная информация */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название *</Label>
              <Input
                id="title"
                placeholder="Название фильма"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="originalTitle">Оригинальное название</Label>
              <Input
                id="originalTitle"
                placeholder="Original Title"
                value={form.originalTitle}
                onChange={(e) => updateField("originalTitle", e.target.value)}
              />
            </div>
          </div>

          {/* Жанр и рейтинг */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Жанр</Label>
              <Select
                value={form.genre}
                onValueChange={(v) => updateField("genre", v as Genre)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GENRE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Возрастной рейтинг</Label>
              <Select
                value={form.ageRating}
                onValueChange={(v) => updateField("ageRating", v as AgeRating)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGE_RATING_OPTIONS.map((rating) => (
                    <SelectItem key={rating} value={rating}>
                      {rating}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Длительность (мин)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={600}
                value={form.duration}
                onChange={(e) =>
                  updateField("duration", Number(e.target.value))
                }
              />
            </div>
          </div>

          {/* Режиссёр и дата */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="director">Режиссёр</Label>
              <Input
                id="director"
                placeholder="Имя режиссёра"
                value={form.director}
                onChange={(e) => updateField("director", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="releaseDate">Дата выхода</Label>
              <Input
                id="releaseDate"
                type="date"
                value={form.releaseDate}
                onChange={(e) => updateField("releaseDate", e.target.value)}
              />
            </div>
          </div>

          {/* Постер */}
          <div className="space-y-2">
            <Label htmlFor="posterUrl">URL постера</Label>
            <Input
              id="posterUrl"
              placeholder="https://example.com/poster.jpg"
              value={form.posterUrl}
              onChange={(e) => updateField("posterUrl", e.target.value)}
            />
          </div>

          {/* Описание */}
          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              placeholder="Краткое описание фильма..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Параметры расписания */}
          <div className="rounded-lg border p-4 space-y-4">
            <h4 className="font-medium text-sm">Параметры расписания</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="popularity">
                  Популярность ({form.popularity}/10)
                </Label>
                <Input
                  id="popularity"
                  type="range"
                  min={1}
                  max={10}
                  value={form.popularity}
                  onChange={(e) =>
                    updateField("popularity", Number(e.target.value))
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minShows">Мин. сеансов/день</Label>
                <Input
                  id="minShows"
                  type="number"
                  min={0}
                  max={10}
                  value={form.minShowsPerDay}
                  onChange={(e) =>
                    updateField("minShowsPerDay", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxShows">Макс. сеансов/день</Label>
                <Input
                  id="maxShows"
                  type="number"
                  min={1}
                  max={20}
                  value={form.maxShowsPerDay}
                  onChange={(e) =>
                    updateField("maxShowsPerDay", Number(e.target.value))
                  }
                />
              </div>
            </div>
          </div>

          {/* Активность */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => updateField("isActive", e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="isActive" className="cursor-pointer">
              Фильм активен (участвует в генерации расписания)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button type="submit">
              {isEditing ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

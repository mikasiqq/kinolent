import { observer } from "mobx-react";
import { Search, SlidersHorizontal, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Genre } from "@/types/movie";
import { GENRE_LABELS, GENRE_EMOJI } from "@/types/movie";
import { movieStore } from "@/stores/movieStore";
import { cn } from "@/lib/utils";

export const MovieFilters = observer(function MovieFilters() {
  const hasActiveFilters =
    movieStore.filters.search !== "" ||
    movieStore.filters.genre !== "all" ||
    movieStore.filters.activeOnly;

  const clearFilters = () => {
    movieStore.setSearch("");
    movieStore.setGenreFilter("all");
    if (movieStore.filters.activeOnly) {
      movieStore.toggleActiveOnly();
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4">
      {/* Поиск */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск фильмов..."
          value={movieStore.filters.search}
          onChange={(e) => movieStore.setSearch(e.target.value)}
          className="pl-10 bg-background/80 border-border/50 rounded-lg h-10"
        />
        {movieStore.filters.search && (
          <button
            onClick={() => movieStore.setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Разделитель */}
      <div className="hidden sm:block h-8 w-px bg-border/50" />

      {/* Фильтр жанра */}
      <Select
        value={movieStore.filters.genre}
        onValueChange={(v) => movieStore.setGenreFilter(v as Genre | "all")}
      >
        <SelectTrigger className="w-48 bg-background/80 border-border/50 rounded-lg h-10">
          <SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Все жанры" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">🎞️ Все жанры</SelectItem>
          {Object.entries(GENRE_LABELS).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {GENRE_EMOJI[key as Genre]} {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Только активные */}
      <Button
        variant={movieStore.filters.activeOnly ? "default" : "outline"}
        size="sm"
        onClick={() => movieStore.toggleActiveOnly()}
        className={cn(
          "shrink-0 rounded-lg h-10 px-4 transition-all",
          movieStore.filters.activeOnly
            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            : "bg-background/80 border-border/50",
        )}
      >
        {movieStore.filters.activeOnly && (
          <Check className="mr-1.5 h-3.5 w-3.5" />
        )}
        Только активные
      </Button>

      {/* Сброс */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="shrink-0 text-muted-foreground hover:text-foreground h-10"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Сбросить
          <Badge
            variant="secondary"
            className="ml-2 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
          >
            {movieStore.filteredMovies.length}
          </Badge>
        </Button>
      )}
    </div>
  );
});

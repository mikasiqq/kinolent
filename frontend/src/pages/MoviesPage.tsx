import { useState, useCallback } from "react";
import { observer } from "mobx-react";
import { Plus, Film, Sparkles, Popcorn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovieCard } from "@/components/movies/MovieCard";
import { MovieDialog } from "@/components/movies/MovieDialog";
import { MovieStats } from "@/components/movies/MovieStats";
import { MovieFilters } from "@/components/movies/MovieFilters";
import { movieStore } from "@/stores/movieStore";
import type { Movie } from "@/types/movie";

export const MoviesPage = observer(function MoviesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie | null>(null);

  const handleAddMovie = useCallback(() => {
    setEditingMovie(null);
    setDialogOpen(true);
  }, []);

  const handleEditMovie = useCallback((movie: Movie) => {
    setEditingMovie(movie);
    setDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingMovie(null);
    }
  }, []);

  return (
    <div className="space-y-8">
      {/* Заголовок с градиентом */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 via-indigo-600 to-blue-700 p-8 text-white shadow-xl">
        {/* Декоративные элементы */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-8 h-32 w-32 rounded-full bg-white/5 blur-2xl" />
        <div className="absolute top-1/2 right-1/4 h-20 w-20 rounded-full bg-indigo-400/20 blur-xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Popcorn className="h-7 w-7" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Каталог фильмов
              </h1>
            </div>
            <p className="text-white/70 text-sm max-w-md">
              Управляйте каталогом фильмов для автоматической генерации
              расписания кинотеатра
            </p>
          </div>
          <Button
            onClick={handleAddMovie}
            size="lg"
            className="shrink-0 bg-white text-indigo-700 hover:bg-white/90 shadow-lg font-semibold h-12 px-6"
          >
            <Plus className="mr-2 h-5 w-5" />
            Добавить фильм
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <MovieStats />

      {/* Фильтры */}
      <MovieFilters />

      {/* Сетка фильмов */}
      {movieStore.filteredMovies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {movieStore.filteredMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} onEdit={handleEditMovie} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="relative mb-6">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-linear-to-br from-violet-100 to-indigo-100 dark:from-violet-900/20 dark:to-indigo-900/20">
              <Film className="h-12 w-12 text-violet-500" />
            </div>
            <div className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Sparkles className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <h3 className="text-xl font-bold">Фильмы не найдены</h3>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            {movieStore.totalCount === 0
              ? "Добавьте первый фильм, чтобы начать формировать расписание кинотеатра"
              : "Попробуйте изменить параметры фильтрации"}
          </p>
          {movieStore.totalCount === 0 && (
            <Button
              onClick={handleAddMovie}
              className="mt-6 bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Добавить фильм
            </Button>
          )}
        </div>
      )}

      {/* Диалог добавления/редактирования */}
      <MovieDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        movie={editingMovie}
      />
    </div>
  );
});

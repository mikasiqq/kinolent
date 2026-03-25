import {
  createMovie as apiCreateMovie,
  fetchMovies as apiFetchMovies,
  updateMovie as apiUpdateMovie,
  deleteMovieApi,
  toggleMovieApi,
} from "@/services/api";
import type { Genre, Movie, MovieFormData } from "@/types/movie";
import { makeAutoObservable, runInAction } from "mobx";

/** Фильтры для списка фильмов */
export interface MovieFilters {
  search: string;
  genre: Genre | "all";
  activeOnly: boolean;
}

/** MobX стор для управления фильмами */
class MovieStore {
  movies: Movie[] = [];
  filters: MovieFilters = {
    search: "",
    genre: "all",
    activeOnly: false,
  };
  isLoading = false;
  selectedMovieId: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /** Отфильтрованные фильмы */
  get filteredMovies(): Movie[] {
    return this.movies.filter((movie) => {
      if (this.filters.search) {
        const query = this.filters.search.toLowerCase();
        const matchTitle = movie.title.toLowerCase().includes(query);
        const matchOriginal = movie.originalTitle
          ?.toLowerCase()
          .includes(query);
        const matchDirector = movie.director?.toLowerCase().includes(query);
        if (!matchTitle && !matchOriginal && !matchDirector) return false;
      }
      if (this.filters.genre !== "all" && movie.genre !== this.filters.genre)
        return false;
      if (this.filters.activeOnly && !movie.isActive) return false;
      return true;
    });
  }

  get totalCount(): number {
    return this.movies.length;
  }
  get activeCount(): number {
    return this.movies.filter((m) => m.isActive).length;
  }
  get avgDuration(): number {
    if (this.movies.length === 0) return 0;
    return Math.round(
      this.movies.reduce((s, m) => s + m.duration, 0) / this.movies.length,
    );
  }
  get selectedMovie(): Movie | undefined {
    return this.movies.find((m) => m.id === this.selectedMovieId);
  }

  setSearch(search: string) {
    this.filters.search = search;
  }
  setGenreFilter(genre: Genre | "all") {
    this.filters.genre = genre;
  }
  toggleActiveOnly() {
    this.filters.activeOnly = !this.filters.activeOnly;
  }
  selectMovie(id: string | null) {
    this.selectedMovieId = id;
  }

  /** Загрузить фильмы из API */
  async fetchMovies() {
    this.isLoading = true;
    try {
      const movies = await apiFetchMovies();
      runInAction(() => {
        this.movies = movies;
        this.isLoading = false;
      });
    } catch (e) {
      console.error("fetchMovies failed:", e);
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  /** Добавить фильм через API */
  async addMovie(data: MovieFormData) {
    const created = await apiCreateMovie(data);
    runInAction(() => {
      this.movies.unshift(created);
    });
  }

  /** Обновить фильм через API */
  async updateMovie(id: string, data: Partial<MovieFormData>) {
    const movie = this.movies.find((m) => m.id === id);
    if (!movie) return;
    const updated = await apiUpdateMovie(id, {
      ...movie,
      ...data,
    } as MovieFormData);
    runInAction(() => {
      const idx = this.movies.findIndex((m) => m.id === id);
      if (idx !== -1) this.movies[idx] = updated;
    });
  }

  /** Удалить фильм через API */
  async deleteMovie(id: string) {
    await deleteMovieApi(id);
    runInAction(() => {
      this.movies = this.movies.filter((m) => m.id !== id);
      if (this.selectedMovieId === id) this.selectedMovieId = null;
    });
  }

  /** Переключить активность через API */
  async toggleMovieActive(id: string) {
    const updated = await toggleMovieApi(id);
    runInAction(() => {
      const idx = this.movies.findIndex((m) => m.id === id);
      if (idx !== -1) this.movies[idx] = updated;
    });
  }
}

export const movieStore = new MovieStore();

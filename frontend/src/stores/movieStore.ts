import { makeAutoObservable, runInAction } from "mobx";
import type { Movie, MovieFormData, Genre } from "@/types/movie";

/** Демо-данные для начального состояния */
const DEMO_MOVIES: Movie[] = [
  {
    id: "1",
    title: "Дюна: Часть вторая",
    originalTitle: "Dune: Part Two",
    genre: "sci-fi",
    duration: 166,
    ageRating: "12+",
    releaseDate: "2024-03-01",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BNTc0YmQxN2UtODAxMC00NTg1LTgzOTAtMzRjNWEwNjI4NTMyXkEyXkFqcGc@._V1_SX300.jpg",
    description:
      "Пол Атрейдес объединяется с Чани и фрименами, вынашивая план мести заговорщикам, уничтожившим его семью.",
    director: "Дени Вильнёв",
    popularity: 9,
    minShowsPerDay: 2,
    maxShowsPerDay: 5,
    isActive: true,
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "2",
    title: "Оппенгеймер",
    originalTitle: "Oppenheimer",
    genre: "drama",
    duration: 180,
    ageRating: "16+",
    releaseDate: "2023-07-21",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BN2JkMDc5MGQtZjg3YS00NmFiLWIyZmQtZjBmZGMzMTRhOGM0XkEyXkFqcGc@._V1_SX300.jpg",
    description:
      "История жизни американского физика Роберта Оппенгеймера и его роли в разработке атомной бомбы.",
    director: "Кристофер Нолан",
    popularity: 10,
    minShowsPerDay: 2,
    maxShowsPerDay: 4,
    isActive: true,
    createdAt: "2024-01-10T10:00:00Z",
  },
  {
    id: "3",
    title: "Головоломка 2",
    originalTitle: "Inside Out 2",
    genre: "animation",
    duration: 100,
    ageRating: "6+",
    releaseDate: "2024-06-14",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BYTc1MDQ3NjAtOWEzMi00YzE1LWI2OWEtNjQ1MDVjNjFjOGRiXkEyXkFqcGc@._V1_SX300.jpg",
    description:
      "Райли вступает в подростковый возраст, и в её голове появляются новые, неожиданные эмоции.",
    director: "Келси Манн",
    popularity: 8,
    minShowsPerDay: 3,
    maxShowsPerDay: 6,
    isActive: true,
    createdAt: "2024-02-01T10:00:00Z",
  },
  {
    id: "4",
    title: "Чужой: Ромул",
    originalTitle: "Alien: Romulus",
    genre: "horror",
    duration: 119,
    ageRating: "18+",
    releaseDate: "2024-08-16",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BMDU0NjcwOGQtNjNjOS00NzQ3LWIwM2YtYWVkMjRkMjhhNjRhXkEyXkFqcGc@._V1_SX300.jpg",
    description:
      "Группа молодых колонистов оказывается лицом к лицу с самой ужасающей формой жизни во Вселенной.",
    director: "Феде Альварес",
    popularity: 7,
    minShowsPerDay: 1,
    maxShowsPerDay: 3,
    isActive: true,
    createdAt: "2024-03-05T10:00:00Z",
  },
  {
    id: "5",
    title: "Гладиатор 2",
    originalTitle: "Gladiator II",
    genre: "action",
    duration: 148,
    ageRating: "16+",
    releaseDate: "2024-11-22",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BN2Y1ZTg4MGItNjBjMi00MmNhLWFmOTktYjY1ZGRlYzVmYWMyXkEyXkFqcGc@._V1_SX300.jpg",
    description:
      "Луций, выросший вдали от Рима, вынужден выйти на арену Колизея и вспомнить своё прошлое.",
    director: "Ридли Скотт",
    popularity: 8,
    minShowsPerDay: 2,
    maxShowsPerDay: 5,
    isActive: false,
    createdAt: "2024-04-20T10:00:00Z",
  },
  {
    id: "6",
    title: "Интерстеллар",
    originalTitle: "Interstellar",
    genre: "sci-fi",
    duration: 169,
    ageRating: "12+",
    releaseDate: "2014-11-07",
    posterUrl:
      "https://m.media-amazon.com/images/M/MV5BYzdjMDAxZGItMjI2My00ODA1LTlkNzItOWFjMDU5ZDJlYWY3XkEyXkFqcGc@._V1_SX300.jpg",
    description:
      "Команда исследователей путешествует через червоточину в космосе в попытке обеспечить выживание человечества.",
    director: "Кристофер Нолан",
    popularity: 9,
    minShowsPerDay: 1,
    maxShowsPerDay: 3,
    isActive: true,
    createdAt: "2024-05-10T10:00:00Z",
  },
];

/** Фильтры для списка фильмов */
export interface MovieFilters {
  search: string;
  genre: Genre | "all";
  activeOnly: boolean;
}

/** MobX стор для управления фильмами */
class MovieStore {
  movies: Movie[] = DEMO_MOVIES;
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
      // Поиск по названию
      if (this.filters.search) {
        const query = this.filters.search.toLowerCase();
        const matchTitle = movie.title.toLowerCase().includes(query);
        const matchOriginal = movie.originalTitle
          ?.toLowerCase()
          .includes(query);
        const matchDirector = movie.director?.toLowerCase().includes(query);
        if (!matchTitle && !matchOriginal && !matchDirector) return false;
      }

      // Фильтр по жанру
      if (this.filters.genre !== "all" && movie.genre !== this.filters.genre) {
        return false;
      }

      // Только активные
      if (this.filters.activeOnly && !movie.isActive) {
        return false;
      }

      return true;
    });
  }

  /** Общее количество фильмов */
  get totalCount(): number {
    return this.movies.length;
  }

  /** Количество активных фильмов */
  get activeCount(): number {
    return this.movies.filter((m) => m.isActive).length;
  }

  /** Средняя длительность */
  get avgDuration(): number {
    if (this.movies.length === 0) return 0;
    const total = this.movies.reduce((sum, m) => sum + m.duration, 0);
    return Math.round(total / this.movies.length);
  }

  /** Выбранный фильм */
  get selectedMovie(): Movie | undefined {
    return this.movies.find((m) => m.id === this.selectedMovieId);
  }

  /** Установить поисковый запрос */
  setSearch(search: string) {
    this.filters.search = search;
  }

  /** Установить фильтр жанра */
  setGenreFilter(genre: Genre | "all") {
    this.filters.genre = genre;
  }

  /** Переключить фильтр активности */
  toggleActiveOnly() {
    this.filters.activeOnly = !this.filters.activeOnly;
  }

  /** Выбрать фильм */
  selectMovie(id: string | null) {
    this.selectedMovieId = id;
  }

  /** Добавить фильм */
  addMovie(data: MovieFormData) {
    const newMovie: Movie = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.movies.push(newMovie);
  }

  /** Обновить фильм */
  updateMovie(id: string, data: Partial<MovieFormData>) {
    const index = this.movies.findIndex((m) => m.id === id);
    if (index !== -1) {
      this.movies[index] = { ...this.movies[index], ...data };
    }
  }

  /** Удалить фильм */
  deleteMovie(id: string) {
    this.movies = this.movies.filter((m) => m.id !== id);
    if (this.selectedMovieId === id) {
      this.selectedMovieId = null;
    }
  }

  /** Переключить активность фильма */
  toggleMovieActive(id: string) {
    const movie = this.movies.find((m) => m.id === id);
    if (movie) {
      movie.isActive = !movie.isActive;
    }
  }

  /** Имитация загрузки (для будущего API) */
  async fetchMovies() {
    this.isLoading = true;
    try {
      // В будущем — запрос к API
      await new Promise((resolve) => setTimeout(resolve, 500));
      runInAction(() => {
        this.isLoading = false;
      });
    } catch {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }
}

export const movieStore = new MovieStore();

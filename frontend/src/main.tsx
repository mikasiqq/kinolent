import { authStore } from "@/stores/authStore";
import { movieStore } from "@/stores/movieStore";
import { scheduleStore } from "@/stores/scheduleStore";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Сначала восстанавливаем сессию, потом грузим данные
authStore.init().then(() => {
  if (authStore.isAuthenticated) {
    movieStore.fetchMovies();
    scheduleStore.fetchHalls();
    scheduleStore.loadSchedules();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { movieStore } from "@/stores/movieStore";
import { scheduleStore } from "@/stores/scheduleStore";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Инициализация данных из API при старте приложения
movieStore.fetchMovies();
scheduleStore.fetchHalls();
scheduleStore.loadSchedules();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

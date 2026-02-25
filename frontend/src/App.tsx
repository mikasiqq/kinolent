import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { MoviesPage } from "@/pages/MoviesPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { GenerateSchedulePage } from "@/pages/GenerateSchedulePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/generate" element={<GenerateSchedulePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

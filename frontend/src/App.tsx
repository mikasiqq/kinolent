import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/layouts/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { MoviesPage } from "@/pages/MoviesPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { GenerateSchedulePage } from "@/pages/GenerateSchedulePage";
import { LoginPage } from "@/pages/LoginPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/movies" element={<MoviesPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/generate" element={<GenerateSchedulePage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

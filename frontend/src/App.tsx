import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/layouts/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { GenerateSchedulePage } from "@/pages/GenerateSchedulePage";
import { LoginPage } from "@/pages/LoginPage";
import { MoviesPage } from "@/pages/MoviesPage";
import { SchedulePage } from "@/pages/SchedulePage";
import { UsersPage } from "@/pages/UsersPage";
import { BrowserRouter, Route, Routes } from "react-router-dom";

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
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

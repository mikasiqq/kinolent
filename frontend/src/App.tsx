import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/layouts/AppLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { GenerateSchedulePage } from "@/pages/GenerateSchedulePage";
import { HallsPage } from "@/pages/HallsPage";
import { LoginPage } from "@/pages/LoginPage";
import { MoviesPage } from "@/pages/MoviesPage";
import { OrganizationsPage } from "@/pages/OrganizationsPage";
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
            <Route path="/halls" element={<HallsPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/generate" element={<GenerateSchedulePage />} />
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/organizations" element={<OrganizationsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

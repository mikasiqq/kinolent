import { authStore } from "@/stores/authStore";
import type { UserRole } from "@/types/user";
import { observer } from "mobx-react";
import { Navigate, Outlet } from "react-router-dom";

interface Props {
  requiredRole?: UserRole | "manager+"; // "manager+" = manager или admin
}

export const ProtectedRoute = observer(function ProtectedRoute({
  requiredRole,
}: Props) {
  if (!authStore.isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!authStore.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole === "manager+" && !authStore.can("manage")) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole === "admin" && !authStore.can("admin")) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
});

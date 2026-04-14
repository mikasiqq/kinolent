export type UserRole = "admin" | "manager" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  orgId?: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface OrganizationDetail extends Organization {
  usersCount: number;
  hallsCount: number;
  moviesCount: number;
  schedulesCount: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  viewer: "Оператор",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: "text-red-400",
  manager: "text-blue-400",
  viewer: "text-slate-400",
};

export type UserRole = "admin" | "fund_manager" | "manager" | "viewer";

export interface SessionUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isArchived: boolean;
}

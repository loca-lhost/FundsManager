export type UserRole = "admin" | "fund_manager" | "manager" | "viewer";

export interface SessionUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isArchived: boolean;
}

export interface ActiveSession {
  id: string;
  current: boolean;
  createdAt: string;
  expireAt: string;
  clientName: string;
  deviceName: string;
  osName: string;
  countryName: string;
  ip: string;
  factors: string[];
}

export interface UserProfileSnapshot {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  mfaEnabled: boolean;
  lastLogin: string | null;
  sessions: ActiveSession[];
}

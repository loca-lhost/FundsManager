import type { Models } from "appwrite";
import { ID } from "appwrite";
import { APPWRITE_COLLECTIONS, APPWRITE_DB_ID, appwriteAccount, appwriteDatabases, appwriteTeams, AppwriteQuery } from "@/lib/appwrite";
import type { ActiveSession, SessionUser, UserProfileSnapshot, UserRole } from "@/types/auth";

type ProfileDocument = Models.Document & {
  userId?: string;
  fullName?: string;
  full_name?: string;
  role?: string;
  isArchived?: boolean;
  lastLogin?: string;
};

type UpdateUserProfileInput = {
  fullName: string;
  email: string;
  phone: string;
  currentPassword?: string;
};

type PasswordUpdateInput = {
  currentPassword: string;
  newPassword: string;
};

function normalizeRole(value: string | undefined): UserRole {
  const role = String(value || "viewer").toLowerCase();
  if (role === "admin") return "admin";
  if (role === "fund_manager") return "fund_manager";
  if (role === "manager") return "manager";
  return "viewer";
}

function normalizeDisplayRole(role: UserRole): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return String((error as { message: string }).message);
  }
  return fallback;
}

function toSessionSummary(session: Models.Session): ActiveSession {
  return {
    id: session.$id,
    current: Boolean(session.current),
    createdAt: session.$createdAt,
    expireAt: session.expire,
    clientName: String(session.clientName || "Unknown client"),
    deviceName: String(session.deviceName || "Unknown device"),
    osName: String(session.osName || "Unknown OS"),
    countryName: String(session.countryName || "Unknown"),
    ip: String(session.ip || "N/A"),
    factors: Array.isArray(session.factors) ? session.factors : [],
  };
}

function sortSessions(a: ActiveSession, b: ActiveSession): number {
  if (a.current !== b.current) {
    return a.current ? -1 : 1;
  }
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

async function getTeamRole(): Promise<UserRole> {
  try {
    const teamsList = await appwriteTeams.list();
    const names = teamsList.teams.map((team) => String(team.name || "").toLowerCase());
    if (names.includes("admins") || names.includes("admin")) return "admin";
    if (names.includes("managers") || names.includes("manager")) return "fund_manager";
    return "viewer";
  } catch {
    return "viewer";
  }
}

async function findProfile(userId: string): Promise<ProfileDocument | null> {
  try {
    const response = await appwriteDatabases.listDocuments(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.profiles, [
      AppwriteQuery.equal("userId", userId),
      AppwriteQuery.limit(1),
    ]);
    return (response.documents[0] as ProfileDocument) || null;
  } catch {
    return null;
  }
}

async function ensureProfile(user: Models.User<Models.Preferences>, role: UserRole): Promise<ProfileDocument | null> {
  const existing = await findProfile(user.$id);
  if (existing) {
    try {
      await appwriteDatabases.updateDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.profiles, existing.$id, {
        lastLogin: new Date().toISOString(),
      });
    } catch {
      // Optional attribute in schema; ignore when not available.
    }
    return existing;
  }

  try {
    const created = await appwriteDatabases.createDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.profiles, ID.unique(), {
      userId: user.$id,
      fullName: user.name || user.email,
      role,
    });
    return created as ProfileDocument;
  } catch {
    return null;
  }
}

function profileFullName(profile: ProfileDocument | null, fallback: string): string {
  if (!profile) return fallback;
  return String(profile.fullName || profile.full_name || fallback);
}

export async function getCurrentSessionUser(): Promise<SessionUser | null> {
  try {
    const accountUser = await appwriteAccount.get();
    const teamRole = await getTeamRole();
    const profile = await ensureProfile(accountUser, teamRole);

    if (profile?.isArchived) {
      await signOut();
      throw new Error("Your account has been archived.");
    }

    const profileRole = normalizeRole(profile?.role);
    const role = teamRole !== "viewer" ? teamRole : profileRole;

    return {
      userId: accountUser.$id,
      email: accountUser.email,
      fullName: profileFullName(profile, accountUser.name || accountUser.email),
      role,
      isArchived: Boolean(profile?.isArchived),
    };
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<SessionUser> {
  try {
    await appwriteAccount.deleteSession("current");
  } catch {
    // Ignore if there is no active session.
  }

  await appwriteAccount.createEmailPasswordSession(email, password);

  const sessionUser = await getCurrentSessionUser();
  if (!sessionUser) {
    throw new Error("Login succeeded but session could not be loaded.");
  }

  return sessionUser;
}

export async function signOut(): Promise<void> {
  try {
    await appwriteAccount.deleteSession("current");
  } catch {
    // Ignore missing/expired session.
  }
}

export async function getUserProfileSnapshot(): Promise<UserProfileSnapshot> {
  try {
    const accountUser = await appwriteAccount.get();
    const teamRole = await getTeamRole();
    const profile = await ensureProfile(accountUser, teamRole);
    const profileRole = normalizeRole(profile?.role);
    const role = teamRole !== "viewer" ? teamRole : profileRole;
    const sessionsResponse = await appwriteAccount.listSessions();
    const sessions = sessionsResponse.sessions.map(toSessionSummary).sort(sortSessions);

    return {
      userId: accountUser.$id,
      fullName: profileFullName(profile, accountUser.name || accountUser.email),
      email: accountUser.email,
      phone: String(accountUser.phone || ""),
      role,
      mfaEnabled: Boolean(accountUser.mfa),
      lastLogin: profile?.lastLogin ? String(profile.lastLogin) : null,
      sessions,
    };
  } catch (error) {
    throw new Error(toErrorMessage(error, "Unable to load profile details."));
  }
}

export async function updateCurrentUserProfile(input: UpdateUserProfileInput): Promise<SessionUser> {
  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  const currentPassword = input.currentPassword || "";

  if (!fullName) {
    throw new Error("Full name is required.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (phone && !/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw new Error("Phone number must use E.164 format, e.g. +233555123456.");
  }
  try {
    const accountUser = await appwriteAccount.get();

    const needsEmailUpdate = email !== String(accountUser.email || "").trim().toLowerCase();
    const currentPhone = String(accountUser.phone || "").trim();
    const needsPhoneUpdate = phone !== currentPhone;

    if ((needsEmailUpdate || needsPhoneUpdate) && !currentPassword) {
      throw new Error("Current password is required when changing email or phone.");
    }
    if (needsPhoneUpdate && !phone) {
      throw new Error("Phone number cannot be blank when changing it.");
    }

    if (fullName !== String(accountUser.name || "").trim()) {
      await appwriteAccount.updateName(fullName);
    }
    if (needsEmailUpdate) {
      await appwriteAccount.updateEmail(email, currentPassword);
    }
    if (needsPhoneUpdate) {
      await appwriteAccount.updatePhone(phone, currentPassword);
    }

    const profile = await findProfile(accountUser.$id);
    if (profile) {
      try {
        await appwriteDatabases.updateDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.profiles, profile.$id, {
          fullName,
        });
      } catch {
        // Optional profile synchronization.
      }
    }

    const sessionUser = await getCurrentSessionUser();
    if (!sessionUser) {
      throw new Error("Profile saved but session refresh failed.");
    }
    return sessionUser;
  } catch (error) {
    throw new Error(toErrorMessage(error, "Failed to update profile."));
  }
}

export async function changeCurrentUserPassword(input: PasswordUpdateInput): Promise<void> {
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;

  if (!currentPassword) {
    throw new Error("Current password is required.");
  }
  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters.");
  }
  if (currentPassword === newPassword) {
    throw new Error("New password must be different from current password.");
  }

  try {
    await appwriteAccount.updatePassword(newPassword, currentPassword);
  } catch (error) {
    throw new Error(toErrorMessage(error, "Failed to change password."));
  }
}

export async function setCurrentUserMfa(enabled: boolean): Promise<boolean> {
  try {
    const user = await appwriteAccount.updateMFA(enabled);
    return Boolean(user.mfa);
  } catch (error) {
    throw new Error(toErrorMessage(error, "Unable to update MFA status."));
  }
}

export async function signOutAllUserSessions(): Promise<void> {
  try {
    await appwriteAccount.deleteSessions();
  } catch (error) {
    throw new Error(toErrorMessage(error, "Unable to sign out all sessions."));
  }
}

export function isManagerRole(role: UserRole): boolean {
  return role === "admin" || role === "fund_manager" || role === "manager";
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export function formatRoleLabel(role: UserRole): string {
  return normalizeDisplayRole(role);
}

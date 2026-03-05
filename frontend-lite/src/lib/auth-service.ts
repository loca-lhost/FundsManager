import type { Models } from "appwrite";
import { ID } from "appwrite";
import { APPWRITE_COLLECTIONS, APPWRITE_DB_ID, appwriteAccount, appwriteDatabases, appwriteTeams, AppwriteQuery } from "@/lib/appwrite";
import type { SessionUser, UserRole } from "@/types/auth";

type ProfileDocument = Models.Document & {
  userId?: string;
  fullName?: string;
  full_name?: string;
  role?: string;
  isArchived?: boolean;
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

export function isManagerRole(role: UserRole): boolean {
  return role === "admin" || role === "fund_manager" || role === "manager";
}

export function isAdminRole(role: UserRole): boolean {
  return role === "admin";
}

export function formatRoleLabel(role: UserRole): string {
  return normalizeDisplayRole(role);
}

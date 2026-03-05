import { Account, Client, Databases, Query, Teams } from "appwrite";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || "fundmanager";

export const APPWRITE_DB_ID = import.meta.env.VITE_APPWRITE_DB_ID || "welfare_db";

export const APPWRITE_COLLECTIONS = {
  members: import.meta.env.VITE_APPWRITE_MEMBERS_COLLECTION || "members",
  contributions: import.meta.env.VITE_APPWRITE_CONTRIBUTIONS_COLLECTION || "contributions",
  overdrafts: import.meta.env.VITE_APPWRITE_OVERDRAFTS_COLLECTION || "overdrafts",
  profiles: import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION || "profiles",
} as const;

export const appwriteClient = new Client().setEndpoint(endpoint).setProject(projectId);

export const appwriteAccount = new Account(appwriteClient);
export const appwriteDatabases = new Databases(appwriteClient);
export const appwriteTeams = new Teams(appwriteClient);
export const AppwriteQuery = Query;

// --- APPWRITE CONFIGURATION ---
const client = new Appwrite.Client();
client
    .setEndpoint('https://cloud.appwrite.io/v1') // Your API Endpoint
    .setProject('fundmanager'); // <--- PASTE YOUR PROJECT ID HERE

const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);
const teams = new Appwrite.Teams(client);

// Database Constants
const DB_ID = 'welfare_db'; // Create this database in Appwrite Console
// Note: Ensure collections 'members', 'contributions', 'overdrafts', 'audit_logs', 'profiles' exist

// Security Configuration
const SESSION_KEY = 'welfareUser';
const STORAGE_USERS_KEY = 'welfare_users';
const DEFAULT_PASSWORD = 'password';
const DEFAULT_INACTIVITY_MINUTES = 10;
const DEFAULT_AUDIT_RETENTION_DAYS = 30;
const INTEREST_RATE = 0.02;

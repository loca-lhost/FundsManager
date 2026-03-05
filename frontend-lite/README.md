# Funds Manager (Vite + React)

Lightweight frontend-only version of Funds Manager using React + Vite + Appwrite.

## Setup

1. Install dependencies:
   - `npm install`
2. Create env file:
   - Copy `.env.example` to `.env`
3. Start dev server:
   - `npm run dev`

## Scripts

- `npm run dev` - start development server
- `npm run build` - type-check and production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint

## Environment Variables

Use `VITE_` prefixed Appwrite values:

- `VITE_APPWRITE_ENDPOINT`
- `VITE_APPWRITE_PROJECT_ID`
- `VITE_APPWRITE_DB_ID`
- `VITE_APPWRITE_MEMBERS_COLLECTION`
- `VITE_APPWRITE_CONTRIBUTIONS_COLLECTION`
- `VITE_APPWRITE_OVERDRAFTS_COLLECTION`
- `VITE_APPWRITE_PROFILES_COLLECTION`

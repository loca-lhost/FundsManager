import { ID } from "appwrite";
import type { Models } from "appwrite";
import { APPWRITE_COLLECTIONS, APPWRITE_DB_ID, appwriteDatabases, AppwriteQuery } from "@/lib/appwrite";
import { months } from "@/lib/months";
import type { MemberContribution, MonthName } from "@/types/funds";

type MemberDocument = Models.Document & {
  name?: string;
  accountNumber?: string;
  isArchived?: boolean;
};

type ContributionDocument = Models.Document & {
  memberId?: string;
  year?: number | string;
  month?: string;
  amount?: number | string;
};

const PAGE_LIMIT = 5000;

async function listAllDocuments<T extends Models.Document>(collectionId: string, queries: string[] = []): Promise<T[]> {
  const all: T[] = [];
  let lastId: string | null = null;

  while (true) {
    const pageQueries = [...queries, AppwriteQuery.limit(PAGE_LIMIT)];
    if (lastId) {
      pageQueries.push(AppwriteQuery.cursorAfter(lastId));
    }

    const response = await appwriteDatabases.listDocuments(APPWRITE_DB_ID, collectionId, pageQueries);
    const docs = response.documents as unknown as T[];
    all.push(...docs);

    if (docs.length < PAGE_LIMIT) break;
    lastId = docs[docs.length - 1]?.$id || null;
    if (!lastId) break;
  }

  return all;
}

function toMonth(value: string | undefined): MonthName | null {
  if (!value) return null;
  const normalized = months.find((month) => month.toLowerCase() === value.toLowerCase());
  return normalized || null;
}

function toAmount(value: number | string | undefined): number {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function defaultContributions(): Record<MonthName, number> {
  return months.reduce<Record<MonthName, number>>((acc, month) => {
    acc[month] = 0;
    return acc;
  }, {} as Record<MonthName, number>);
}

function toMemberContribution(doc: MemberDocument, map: Map<string, Partial<Record<MonthName, number>>>): MemberContribution {
  const perMonth = map.get(doc.$id) || {};
  const contributionsByMonth = defaultContributions();

  months.forEach((month) => {
    contributionsByMonth[month] = perMonth[month] || 0;
  });

  return {
    id: doc.$id,
    name: String(doc.name || "Unknown Member"),
    accountNumber: String(doc.accountNumber || "0"),
    contributions: contributionsByMonth,
    isArchived: Boolean(doc.isArchived),
  };
}

export async function fetchMembersWithContributions(year: number): Promise<MemberContribution[]> {
  const members = await listAllDocuments<MemberDocument>(APPWRITE_COLLECTIONS.members);

  let contributions = await listAllDocuments<ContributionDocument>(APPWRITE_COLLECTIONS.contributions, [
    AppwriteQuery.equal("year", year),
  ]);

  if (contributions.length === 0) {
    contributions = await listAllDocuments<ContributionDocument>(APPWRITE_COLLECTIONS.contributions, [
      AppwriteQuery.equal("year", String(year)),
    ]);
  }

  const contributionMap = new Map<string, Partial<Record<MonthName, number>>>();

  contributions.forEach((doc) => {
    const memberId = String(doc.memberId || "");
    const month = toMonth(doc.month);
    if (!memberId || !month) return;

    const current = contributionMap.get(memberId) || {};
    current[month] = toAmount(doc.amount);
    contributionMap.set(memberId, current);
  });

  return members
    .filter((doc) => Boolean(doc.name))
    .map((doc) => toMemberContribution(doc, contributionMap))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function fetchAvailableYears(): Promise<number[]> {
  const docs = await listAllDocuments<ContributionDocument>(APPWRITE_COLLECTIONS.contributions);
  const yearSet = new Set<number>();

  docs.forEach((doc) => {
    const parsedYear = parseInt(String(doc.year || ""), 10);
    if (Number.isFinite(parsedYear)) {
      yearSet.add(parsedYear);
    }
  });

  const currentYear = new Date().getFullYear();
  yearSet.add(currentYear);

  return [...yearSet].sort((left, right) => right - left);
}

export async function createMember(input: { name: string; accountNumber: string }): Promise<MemberContribution> {
  const response = (await appwriteDatabases.createDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.members, ID.unique(), {
    name: input.name.trim(),
    accountNumber: input.accountNumber.trim(),
    isArchived: false,
  })) as MemberDocument;

  return {
    id: response.$id,
    name: String(response.name || input.name),
    accountNumber: String(response.accountNumber || input.accountNumber),
    contributions: defaultContributions(),
    isArchived: Boolean(response.isArchived),
  };
}

export async function updateMember(
  memberId: string,
  input: { name: string; accountNumber: string },
): Promise<void> {
  await appwriteDatabases.updateDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.members, memberId, {
    name: input.name.trim(),
    accountNumber: input.accountNumber.trim(),
  });
}

export async function setMemberArchived(memberId: string, isArchived: boolean): Promise<void> {
  await appwriteDatabases.updateDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.members, memberId, { isArchived });
}

async function findContributionRecord(memberId: string, year: number, month: MonthName): Promise<ContributionDocument | null> {
  const numberYearDocs = await appwriteDatabases.listDocuments(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.contributions, [
    AppwriteQuery.equal("memberId", memberId),
    AppwriteQuery.equal("year", year),
    AppwriteQuery.equal("month", month),
    AppwriteQuery.limit(1),
  ]);

  if (numberYearDocs.documents.length > 0) {
    return numberYearDocs.documents[0] as ContributionDocument;
  }

  const stringYearDocs = await appwriteDatabases.listDocuments(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.contributions, [
    AppwriteQuery.equal("memberId", memberId),
    AppwriteQuery.equal("year", String(year)),
    AppwriteQuery.equal("month", month),
    AppwriteQuery.limit(1),
  ]);

  return (stringYearDocs.documents[0] as ContributionDocument) || null;
}

export async function upsertContribution(input: {
  memberId: string;
  year: number;
  month: MonthName;
  amount: number;
}): Promise<void> {
  const amount = Number.isFinite(input.amount) ? Math.max(0, input.amount) : 0;
  const existing = await findContributionRecord(input.memberId, input.year, input.month);

  if (existing) {
    if (amount > 0) {
      await appwriteDatabases.updateDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.contributions, existing.$id, { amount });
    } else {
      await appwriteDatabases.deleteDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.contributions, existing.$id);
    }
    return;
  }

  if (amount <= 0) {
    return;
  }

  await appwriteDatabases.createDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.contributions, ID.unique(), {
    memberId: input.memberId,
    year: input.year,
    month: input.month,
    amount,
  });
}

export async function deleteContribution(input: {
  memberId: string;
  year: number;
  month: MonthName;
}): Promise<void> {
  const existing = await findContributionRecord(input.memberId, input.year, input.month);
  if (!existing) return;
  await appwriteDatabases.deleteDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.contributions, existing.$id);
}

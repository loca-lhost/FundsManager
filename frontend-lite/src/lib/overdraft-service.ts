import { ID } from "appwrite";
import type { Models } from "appwrite";
import { APPWRITE_COLLECTIONS, APPWRITE_DB_ID, appwriteDatabases, AppwriteQuery } from "@/lib/appwrite";
import type { OverdraftRecord, OverdraftStatus } from "@/types/funds";

const PAGE_LIMIT = 5000;
const OVERDRAFT_INTEREST_RATE = 0.02;

const OPEN_STATUSES: OverdraftStatus[] = ["pending", "approved"];

type OverdraftDocument = Models.Document & {
  year?: number | string;
  memberId?: string;
  memberName?: string;
  amount?: number | string;
  interest?: number | string;
  totalRepayment?: number | string;
  totalDue?: number | string;
  amountPaid?: number | string;
  reason?: string;
  status?: string;
  dateIssued?: string;
  dateTaken?: string;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toMoney(value: number | string | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return roundMoney(parsed);
}

function normalizeStatus(status: string | undefined): OverdraftStatus {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "active") return "approved";
  if (normalized === "paid") return "settled";
  if (normalized === "approved" || normalized === "rejected" || normalized === "settled") {
    return normalized;
  }
  return "pending";
}

function computeInterest(principal: number): number {
  return roundMoney(principal * OVERDRAFT_INTEREST_RATE);
}

function resolveIssuedAt(input: string | undefined, fallback: string): string {
  const candidate = input || fallback;
  const date = new Date(candidate);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function toRecord(doc: OverdraftDocument): OverdraftRecord {
  const amount = toMoney(doc.amount);
  const interest = Number.isFinite(Number(doc.interest)) ? toMoney(doc.interest) : computeInterest(amount);
  const totalRepaymentRaw = Number.isFinite(Number(doc.totalRepayment))
    ? Number(doc.totalRepayment)
    : Number(doc.totalDue);
  const totalRepayment = Number.isFinite(totalRepaymentRaw) ? toMoney(totalRepaymentRaw) : roundMoney(amount + interest);
  const amountPaid = Math.min(totalRepayment, Math.max(0, toMoney(doc.amountPaid)));
  const dateIssued = resolveIssuedAt(doc.dateIssued || doc.dateTaken, doc.$createdAt || new Date().toISOString());
  const year = Number.parseInt(String(doc.year ?? new Date(dateIssued).getFullYear()), 10);

  return {
    id: doc.$id,
    year: Number.isFinite(year) ? year : new Date(dateIssued).getFullYear(),
    memberId: String(doc.memberId || ""),
    memberName: String(doc.memberName || "Unknown Member"),
    amount,
    interest,
    totalRepayment,
    amountPaid,
    reason: String(doc.reason || "General overdraft"),
    status: normalizeStatus(doc.status),
    dateIssued,
  };
}

async function listOverdraftDocuments(queries: string[] = []): Promise<OverdraftDocument[]> {
  const all: OverdraftDocument[] = [];
  let lastId: string | null = null;

  while (true) {
    const pageQueries = [...queries, AppwriteQuery.limit(PAGE_LIMIT)];
    if (lastId) {
      pageQueries.push(AppwriteQuery.cursorAfter(lastId));
    }

    const response = await appwriteDatabases.listDocuments(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.overdrafts, pageQueries);
    const docs = response.documents as unknown as OverdraftDocument[];
    all.push(...docs);

    if (docs.length < PAGE_LIMIT) break;
    lastId = docs[docs.length - 1]?.$id || null;
    if (!lastId) break;
  }

  return all;
}

export function getOverdraftCollectionDate(record: OverdraftRecord): Date {
  const issuedDate = new Date(record.dateIssued);
  const normalizedIssued = Number.isNaN(issuedDate.getTime()) ? new Date() : issuedDate;
  return new Date(normalizedIssued.getFullYear(), normalizedIssued.getMonth() + 1, 1);
}

export function isInterestCollectible(record: OverdraftRecord): boolean {
  const dueDate = getOverdraftCollectionDate(record);
  const now = new Date();
  if (now.getFullYear() > dueDate.getFullYear()) return true;
  if (now.getFullYear() < dueDate.getFullYear()) return false;
  return now.getMonth() >= dueDate.getMonth();
}

export function getOverdraftStatusLabel(record: OverdraftRecord): string {
  if (record.status === "settled") return "Settled";
  if (record.status === "rejected") return "Rejected";
  if (!isInterestCollectible(record)) {
    return `Interest in ${formatCollectionMonth(record)}`;
  }
  if (record.amountPaid < record.amount) {
    return "Principal Due";
  }
  return "Interest Due";
}

export function formatCollectionMonth(record: OverdraftRecord): string {
  return getOverdraftCollectionDate(record).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function isOpenOverdraftStatus(status: OverdraftStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function getRemainingTotal(record: OverdraftRecord): number {
  return Math.max(0, roundMoney(record.totalRepayment - record.amountPaid));
}

export function getRemainingCollectibleNow(record: OverdraftRecord): number {
  const collectibleCeiling = isInterestCollectible(record) ? record.totalRepayment : record.amount;
  return Math.max(0, roundMoney(collectibleCeiling - record.amountPaid));
}

export function getCollectedInterest(record: OverdraftRecord): number {
  const extraPaid = Math.max(0, roundMoney(record.amountPaid - record.amount));
  return Math.min(extraPaid, record.interest);
}

export function sumCollectedOverdraftInterest(overdrafts: OverdraftRecord[]): number {
  return overdrafts.reduce((sum, item) => sum + getCollectedInterest(item), 0);
}

export async function fetchOverdrafts(): Promise<OverdraftRecord[]> {
  const docs = await listOverdraftDocuments();
  return docs
    .map(toRecord)
    .sort((left, right) => {
      const leftOpen = isOpenOverdraftStatus(left.status);
      const rightOpen = isOpenOverdraftStatus(right.status);
      if (leftOpen && !rightOpen) return -1;
      if (!leftOpen && rightOpen) return 1;
      return new Date(right.dateIssued).getTime() - new Date(left.dateIssued).getTime();
    });
}

export async function createOverdraft(input: {
  year?: number;
  memberId: string;
  memberName: string;
  amount: number;
  reason?: string;
  dateIssued?: string;
}): Promise<OverdraftRecord> {
  const principal = roundMoney(input.amount);
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error("Overdraft amount must be greater than 0.");
  }

  const interest = computeInterest(principal);
  const totalRepayment = roundMoney(principal + interest);
  const issuedAt = resolveIssuedAt(input.dateIssued, new Date().toISOString());
  const issueYear = Number.isFinite(input.year) ? Number(input.year) : new Date(issuedAt).getFullYear();

  const basePayload = {
    memberId: input.memberId,
    memberName: input.memberName,
    amount: principal,
    interest,
    totalRepayment,
    amountPaid: 0,
    reason: (input.reason || "General overdraft").trim(),
    status: "pending",
    dateIssued: issuedAt,
    dateTaken: issuedAt,
  };

  const payloadQueue: Record<string, unknown>[] = [
    { ...basePayload, year: issueYear, dateTaken: issuedAt },
    { ...basePayload, year: issueYear },
    { ...basePayload, year: String(issueYear), dateTaken: issuedAt },
    { ...basePayload, year: String(issueYear) },
  ];
  const seenPayloads = new Set<string>();

  let created: OverdraftDocument | null = null;
  let lastError: unknown = null;

  while (payloadQueue.length > 0) {
    const candidate = payloadQueue.shift() as Record<string, unknown>;
    const signature = JSON.stringify(candidate);
    if (seenPayloads.has(signature)) {
      continue;
    }
    seenPayloads.add(signature);

    try {
      created = (await appwriteDatabases.createDocument(
        APPWRITE_DB_ID,
        APPWRITE_COLLECTIONS.overdrafts,
        ID.unique(),
        candidate,
      )) as OverdraftDocument;
      break;
    } catch (error) {
      lastError = error;
      const rawMessage = String(error instanceof Error ? error.message : error || "");
      const message = rawMessage.toLowerCase();
      const unknownAttrMatch = rawMessage.match(/Unknown attribute:\s*"([^"]+)"/i);
      if (unknownAttrMatch?.[1]) {
        const unknownAttr = unknownAttrMatch[1];
        if (unknownAttr in candidate) {
          const sanitized = { ...candidate };
          Reflect.deleteProperty(sanitized, unknownAttr);
          payloadQueue.unshift(sanitized);
          continue;
        }
      }

      const schemaIssue =
        message.includes("membername") ||
        message.includes("year") ||
        message.includes("datetaken") ||
        message.includes("invalid document structure") ||
        message.includes("missing required attribute");

      if (!schemaIssue) {
        throw error;
      }
    }
  }

  if (!created) {
    if (lastError instanceof Error) {
      throw lastError;
    }
    throw new Error("Failed to create overdraft due to schema mismatch.");
  }

  return toRecord(created);
}

export async function repayOverdraft(input: { overdraftId: string; amount: number }): Promise<OverdraftRecord> {
  const doc = (await appwriteDatabases.getDocument(
    APPWRITE_DB_ID,
    APPWRITE_COLLECTIONS.overdrafts,
    input.overdraftId,
  )) as OverdraftDocument;
  const record = toRecord(doc);

  if (!isOpenOverdraftStatus(record.status)) {
    throw new Error("Only pending or approved overdrafts can be repaid.");
  }

  const repayAmount = roundMoney(input.amount);
  if (!Number.isFinite(repayAmount) || repayAmount <= 0) {
    throw new Error("Repayment amount must be greater than 0.");
  }

  const remainingTotal = getRemainingTotal(record);
  if (repayAmount > remainingTotal) {
    throw new Error(`Amount exceeds remaining balance (${remainingTotal.toFixed(2)}).`);
  }

  const remainingCollectibleNow = getRemainingCollectibleNow(record);
  if (repayAmount > remainingCollectibleNow) {
    if (!isInterestCollectible(record)) {
      throw new Error(`Interest can be collected in ${formatCollectionMonth(record)}.`);
    }
    throw new Error(`Amount exceeds collectible balance (${remainingCollectibleNow.toFixed(2)}).`);
  }

  const amountPaid = roundMoney(record.amountPaid + repayAmount);
  const status: OverdraftStatus =
    amountPaid >= record.totalRepayment ? "settled" : isInterestCollectible(record) ? "approved" : "pending";

  const updated = (await appwriteDatabases.updateDocument(APPWRITE_DB_ID, APPWRITE_COLLECTIONS.overdrafts, input.overdraftId, {
    amountPaid,
    status,
    totalRepayment: record.totalRepayment,
    dateIssued: record.dateIssued,
  })) as OverdraftDocument;

  return toRecord(updated);
}

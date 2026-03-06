import type { MemberContribution } from "@/types/funds";
import { months } from "@/lib/months";

export function currency(value: number): string {
  const formatted = new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(value);
  return formatted.replace("GHS", "GH\u20B5");
}

export function memberTotal(member: MemberContribution): number {
  return months.reduce((sum, month) => sum + (member.contributions[month] || 0), 0);
}

export function grandTotal(members: MemberContribution[]): number {
  return members.reduce((sum, member) => sum + memberTotal(member), 0);
}

export function monthlyTotal(members: MemberContribution[], month: (typeof months)[number]): number {
  return members.reduce((sum, member) => sum + (member.contributions[month] || 0), 0);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function nameInitials(value: string): string {
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return "?";
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] ?? ""}${tokens[tokens.length - 1][0] ?? ""}`.toUpperCase();
}

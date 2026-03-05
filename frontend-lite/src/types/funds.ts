export type MonthName =
  | "January"
  | "February"
  | "March"
  | "April"
  | "May"
  | "June"
  | "July"
  | "August"
  | "September"
  | "October"
  | "November"
  | "December";

export interface MemberContribution {
  id: string;
  name: string;
  accountNumber: string;
  contributions: Record<MonthName, number>;
  isArchived?: boolean;
}

export type OverdraftStatus = "pending" | "approved" | "rejected" | "settled";

export interface OverdraftRecord {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  interest: number;
  totalRepayment: number;
  amountPaid: number;
  reason: string;
  status: OverdraftStatus;
  dateIssued: string;
}

export type ActivityTone = "success" | "warning" | "info";

export interface ActivityLog {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
  icon: string;
  tone: ActivityTone;
}

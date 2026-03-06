import { currency } from "@/lib/format";
import type { OverdraftRecord } from "@/types/funds";

type PrintOverdraftLetterInput = {
  record: OverdraftRecord;
  referenceNumber?: string;
  memberAccountNumber: string;
  managerName: string;
  organizationName?: string;
  printedBy?: string;
  printWindow?: Window | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toSafeDate(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(toSafeDate(value));
}

function formatCollectionMonth(value: string): string {
  const issued = toSafeDate(value);
  const due = new Date(issued.getFullYear(), issued.getMonth() + 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(due);
}

function toReferenceDateStamp(value: string): string {
  const date = toSafeDate(value);
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatOverdraftReference(dateStamp: string, sequence: number): string {
  return `OD${dateStamp}-${String(Math.max(1, sequence)).padStart(3, "0")}`;
}

export function buildOverdraftReferenceIndex(records: OverdraftRecord[]): Map<string, string> {
  const sorted = [...records].sort((left, right) => {
    const leftTime = toSafeDate(left.dateIssued).getTime();
    const rightTime = toSafeDate(right.dateIssued).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id.localeCompare(right.id);
  });

  const dailySequence = new Map<string, number>();
  const references = new Map<string, string>();

  for (const record of sorted) {
    const dateStamp = toReferenceDateStamp(record.dateIssued);
    const sequence = (dailySequence.get(dateStamp) || 0) + 1;
    dailySequence.set(dateStamp, sequence);
    references.set(record.id, formatOverdraftReference(dateStamp, sequence));
  }

  return references;
}

export function buildOverdraftReference(record: OverdraftRecord, records: OverdraftRecord[] = [record]): string {
  const references = buildOverdraftReferenceIndex(records);
  const resolved = references.get(record.id);
  if (resolved) return resolved;
  return formatOverdraftReference(toReferenceDateStamp(record.dateIssued), 1);
}

export function openOverdraftPrintWindow(): Window | null {
  if (typeof window === "undefined") return null;
  const opened = window.open("", "_blank", "width=960,height=1080");
  if (!opened) return null;

  opened.document.open();
  opened.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preparing Overdraft Letter...</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Manrope", "Segoe UI", Arial, sans-serif;
      color: #163968;
      background: linear-gradient(180deg, #f6f9ff, #e9f1ff);
    }
    .chip {
      border: 1px solid #c8daef;
      border-radius: 12px;
      background: #fff;
      padding: 12px 16px;
      box-shadow: 0 8px 24px rgba(13, 47, 93, 0.12);
      font-size: 14px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="chip">Preparing letter for print...</div>
</body>
</html>`);
  opened.document.close();
  return opened;
}

export function printOverdraftLetter(input: PrintOverdraftLetterInput): boolean {
  if (typeof window === "undefined") return false;

  const referenceNumber = input.referenceNumber || buildOverdraftReference(input.record);
  const issuedDateLabel = formatLongDate(input.record.dateIssued);
  const collectionMonth = formatCollectionMonth(input.record.dateIssued);
  const purpose = input.record.reason.trim() || "General overdraft support";
  const opened = input.printWindow || window.open("", "_blank", "width=960,height=1080");
  if (!opened) {
    return false;
  }

  const organizationName = (input.organizationName || "KABsTech Fund").trim();
  const printDate = formatLongDate(new Date().toISOString());
  const printedBy = (input.printedBy || "").trim();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Overdraft Issuance Letter - ${escapeHtml(referenceNumber)}</title>
  <style>
    :root {
      --ink: #0f2342;
      --muted: #52698e;
      --line: #d7e3f4;
      --accent: #1e4f92;
      --surface: #f6f9ff;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: var(--ink);
      font-family: "Manrope", "Segoe UI", Arial, sans-serif;
      line-height: 1.45;
    }
    @page {
      size: A4;
      margin: 14mm;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 12mm 10mm 10mm;
      background: #fff;
    }
    .letter {
      border: 1px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
    }
    .top-band {
      background: linear-gradient(140deg, #0c2f63, #2c67b3);
      color: #fff;
      padding: 16px 18px;
      display: flex;
      justify-content: space-between;
      gap: 14px;
      align-items: flex-end;
    }
    .org {
      font-size: 21px;
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    .doc {
      text-align: right;
      font-size: 12px;
      opacity: 0.95;
    }
    .body {
      padding: 18px;
      background: linear-gradient(180deg, #ffffff, #f8fbff);
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
      color: var(--muted);
      font-size: 13px;
    }
    .subject {
      margin: 4px 0 14px;
      font-size: 15px;
      font-weight: 700;
      color: var(--ink);
    }
    .lead {
      margin: 0 0 12px;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0 14px;
      background: var(--surface);
      border-radius: 10px;
      overflow: hidden;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 8px 10px;
      text-align: left;
      font-size: 13px;
    }
    th {
      color: var(--accent);
      font-weight: 700;
      width: 35%;
      background: #eef4ff;
    }
    .note {
      margin: 0 0 14px;
      padding: 10px 12px;
      border-radius: 10px;
      border: 1px solid #d2e1f8;
      background: #edf4ff;
      color: #244978;
      font-size: 13px;
    }
    .signatures {
      margin-top: 22px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
    }
    .sign-card {
      padding-top: 26px;
      border-top: 1px dashed #9fb8de;
      font-size: 12px;
      color: var(--muted);
    }
    .footer {
      margin-top: 14px;
      font-size: 11px;
      color: var(--muted);
      text-align: right;
    }
    @media print {
      .page {
        width: auto;
        min-height: auto;
        padding: 0;
      }
      .letter {
        border: 0;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="letter">
      <div class="top-band">
        <div class="org">${escapeHtml(organizationName)}</div>
        <div class="doc">
          Overdraft Issuance Letter<br />
          Ref: ${escapeHtml(referenceNumber)}
        </div>
      </div>
      <div class="body">
        <div class="meta">
          <div><strong>Date:</strong> ${escapeHtml(issuedDateLabel)}</div>
          <div><strong>Addressed To:</strong> Fund Manager</div>
          <div><strong>Reference No.:</strong> ${escapeHtml(referenceNumber)}</div>
          <div><strong>Status:</strong> ${escapeHtml(input.record.status.toUpperCase())}</div>
        </div>
        <p class="subject">Subject: Overdraft Issuance Confirmation for ${escapeHtml(input.record.memberName)}</p>
        <p class="lead">
          Dear Fund Manager, this letter confirms that an overdraft has been issued under the approved fund policy.
          Details are provided below for records and filing.
        </p>
        <table>
          <tbody>
            <tr><th>Member Name</th><td>${escapeHtml(input.record.memberName)}</td></tr>
            <tr><th>Account Number</th><td>${escapeHtml(input.memberAccountNumber || "N/A")}</td></tr>
            <tr><th>Principal Amount</th><td>${escapeHtml(currency(input.record.amount))}</td></tr>
            <tr><th>Overdraft Interest (2%)</th><td>${escapeHtml(currency(input.record.interest))}</td></tr>
            <tr><th>Total Repayment</th><td>${escapeHtml(currency(input.record.totalRepayment))}</td></tr>
            <tr><th>Reason/Purpose</th><td>${escapeHtml(purpose)}</td></tr>
            <tr><th>Interest Collection Month</th><td>${escapeHtml(collectionMonth)}</td></tr>
          </tbody>
        </table>
        <p class="note">
          Policy note: Overdraft interest is fixed at 2% of principal and is due in the month after issuance.
          Reference number ${escapeHtml(referenceNumber)} should be quoted in all related records.
        </p>
        <div class="signatures">
          <div class="sign-card">
            Fund Manager<br />
            ${escapeHtml(input.managerName)}
          </div>
          <div class="sign-card">
            Member Acknowledgement<br />
            ${escapeHtml(input.record.memberName)}
          </div>
        </div>
        <div class="footer">
          Printed ${escapeHtml(printDate)}${printedBy ? ` by ${escapeHtml(printedBy)}` : ""}
        </div>
      </div>
    </section>
  </main>
</body>
</html>`;

  opened.document.open();
  opened.document.write(html);
  opened.document.close();

  const triggerPrint = () => {
    try {
      opened.focus();
      opened.print();
    } catch {
      // Ignore print errors; caller already has a success/failure signal.
    }
  };

  if (opened.document.readyState === "complete") {
    setTimeout(triggerPrint, 150);
  } else {
    opened.addEventListener("load", () => setTimeout(triggerPrint, 150), { once: true });
  }

  return true;
}

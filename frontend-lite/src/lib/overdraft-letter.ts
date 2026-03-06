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

function dayWithOrdinal(day: number): string {
  const remainder10 = day % 10;
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
  if (remainder10 === 1) return `${day}st`;
  if (remainder10 === 2) return `${day}nd`;
  if (remainder10 === 3) return `${day}rd`;
  return `${day}th`;
}

function formatLongDate(value: string): string {
  const date = toSafeDate(value);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
  return `${dayWithOrdinal(date.getDate())} ${month} ${date.getFullYear()}`;
}

function toReferenceYear(value: string): string {
  const date = toSafeDate(value);
  return String(date.getUTCFullYear());
}

function formatOverdraftReference(year: string, sequence: number): string {
  return `OD${year}-${String(Math.max(1, sequence)).padStart(3, "0")}`;
}

export function buildOverdraftReferenceIndex(records: OverdraftRecord[]): Map<string, string> {
  const sorted = [...records].sort((left, right) => {
    const leftTime = toSafeDate(left.dateIssued).getTime();
    const rightTime = toSafeDate(right.dateIssued).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id.localeCompare(right.id);
  });

  const yearlySequence = new Map<string, number>();
  const references = new Map<string, string>();

  for (const record of sorted) {
    const year = toReferenceYear(record.dateIssued);
    const sequence = (yearlySequence.get(year) || 0) + 1;
    yearlySequence.set(year, sequence);
    references.set(record.id, formatOverdraftReference(year, sequence));
  }

  return references;
}

export function buildOverdraftReference(record: OverdraftRecord, records: OverdraftRecord[] = [record]): string {
  const references = buildOverdraftReferenceIndex(records);
  const resolved = references.get(record.id);
  if (resolved) return resolved;
  return formatOverdraftReference(toReferenceYear(record.dateIssued), 1);
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
  <title>Overdraft Application Letter - ${escapeHtml(referenceNumber)}</title>
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
        <div class="doc">Overdraft Application Letter<br />Ref: ${escapeHtml(referenceNumber)}</div>
      </div>
      <div class="body">
        <div class="meta">
          <div><strong>To:</strong> The Fund Manager</div>
          <div><strong>Date:</strong> ${escapeHtml(issuedDateLabel)}</div>
          <div><strong>Ref:</strong> ${escapeHtml(referenceNumber)}</div>
        </div>
        <p class="lead"><strong>Dear Sir/Madam,</strong></p>
        <p class="subject">APPLICATION FOR OVERDRAFT FACILITY</p>
        <p class="lead">
          I, ${escapeHtml(input.record.memberName)} (Account No: ${escapeHtml(input.memberAccountNumber || "N/A")}),
          hereby submit my application for an overdraft facility of ${escapeHtml(currency(input.record.amount))}.
        </p>
        <p class="subject" style="font-size:14px; margin-top: 0;">Terms and Conditions</p>
        <p class="lead" style="margin-bottom: 8px;">I understand and agree with the following terms governing this facility:</p>
        <ul class="lead" style="margin: 0 0 12px 18px; padding: 0;">
          <li style="margin-bottom: 6px;"><strong>Interest Rate:</strong> A flat rate of 2% will be charged on the principal amount.</li>
          <li style="margin-bottom: 6px;">
            <strong>Repayment Amount:</strong> The total amount payable is ${escapeHtml(currency(input.record.totalRepayment))}
            (Principal: ${escapeHtml(currency(input.record.amount))} + Interest: ${escapeHtml(currency(input.record.interest))}).
          </li>
          <li>
            <strong>Duration:</strong> Repayment is due within one month from the date of issuance or upon the next salary payment date, whichever occurs first.
          </li>
        </ul>
        <p class="lead">
          I confirm that I have read and understood the terms above. Kindly approve my application.
        </p>
        <p class="lead" style="margin-bottom: 0;">Yours faithfully,</p>
        <div class="signatures">
          <div class="sign-card">
            Signature of Applicant<br /><br />
            _________________________<br />
            <strong>${escapeHtml(input.record.memberName.toUpperCase())}</strong>
          </div>
          <div class="sign-card">
            Approved By<br /><br />
            _____________________<br />
            <strong>FUND MANAGER</strong>
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

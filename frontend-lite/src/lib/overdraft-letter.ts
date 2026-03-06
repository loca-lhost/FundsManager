import { currency } from "@/lib/format";
import type { OverdraftRecord } from "@/types/funds";

type PrintOverdraftLetterInput = {
  record: OverdraftRecord;
  memberAccountNumber: string;
  managerName: string;
  organizationName?: string;
  printedBy?: string;
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

function safeReferenceId(rawId: string): string {
  const compact = rawId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact.length >= 6) return compact.slice(-6);
  return compact.padStart(6, "0");
}

export function buildOverdraftReference(record: Pick<OverdraftRecord, "id" | "dateIssued" | "year">): string {
  const issued = toSafeDate(record.dateIssued);
  const year = Number.isFinite(record.year) ? record.year : issued.getFullYear();
  const month = String(issued.getMonth() + 1).padStart(2, "0");
  return `OD-${year}-${month}-${safeReferenceId(record.id)}`;
}

export function printOverdraftLetter(input: PrintOverdraftLetterInput): boolean {
  if (typeof window === "undefined") return false;

  const referenceNumber = buildOverdraftReference(input.record);
  const issuedDateLabel = formatLongDate(input.record.dateIssued);
  const collectionMonth = formatCollectionMonth(input.record.dateIssued);
  const purpose = input.record.reason.trim() || "General overdraft support";
  const opened = window.open("", "_blank", "noopener,noreferrer,width=960,height=1080");
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
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () {
        window.print();
      }, 120);
    });
  </script>
</body>
</html>`;

  opened.document.open();
  opened.document.write(html);
  opened.document.close();
  opened.focus();
  return true;
}

"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { currency } from "@/lib/format";
import type { MemberContribution } from "@/types/funds";

type IssueOverdraftModalProps = {
  open: boolean;
  saving: boolean;
  members: MemberContribution[];
  onClose: () => void;
  onSave: (payload: { memberId: string; amount: number; reason: string }) => Promise<void>;
};

const INTEREST_RATE = 0.02;

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export default function IssueOverdraftModal({ open, saving, members, onClose, onSave }: IssueOverdraftModalProps) {
  const activeMembers = useMemo(() => members.filter((member) => !member.isArchived), [members]);
  const [memberId, setMemberId] = useState(activeMembers[0]?.id || "");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountInput || 0);
  const principal = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const interest = roundMoney(principal * INTEREST_RATE);
  const totalRepayment = roundMoney(principal + interest);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!memberId) {
      setError("Please select a member.");
      return;
    }
    if (!Number.isFinite(principal) || principal <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setError(null);
    await onSave({
      memberId,
      amount: principal,
      reason: reason.trim(),
    });
  }

  return (
    <div className={`modal ${open ? "active" : ""}`} id="issueOverdraftModal">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Issue Overdraft</h3>
          <button className="close-modal" onClick={onClose} type="button">
            <i className="fas fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Member *</label>
            <select className="form-select" onChange={(event) => setMemberId(event.target.value)} required value={memberId}>
              <option value="">Select Member</option>
              {activeMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Principal Amount (GH₵) *</label>
            <input
              className="form-input"
              inputMode="decimal"
              min={0}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder="0.00"
              required
              step="0.01"
              type="number"
              value={amountInput}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reason (Optional)</label>
            <textarea
              className="form-input"
              onChange={(event) => setReason(event.target.value)}
              placeholder="Emergency support, school fees, medical..."
              rows={3}
              value={reason}
            />
          </div>

          <div className="payout-summary">
            <div>
              <span className="text-muted">Interest (2%)</span>
              <strong>{currency(interest)}</strong>
            </div>
            <div>
              <span className="text-muted">Total Repayment</span>
              <strong>{currency(totalRepayment)}</strong>
            </div>
            <div>
              <span className="text-muted">Collection Rule</span>
              <strong>Interest from next month</strong>
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button className="btn btn-primary" disabled={saving} type="submit">
              <i className="fas fa-save" /> {saving ? "Saving..." : "Issue Overdraft"}
            </button>
            <button className="btn btn-secondary" onClick={onClose} type="button">
              <i className="fas fa-times" /> Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

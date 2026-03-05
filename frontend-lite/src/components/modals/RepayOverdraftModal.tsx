"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { currency } from "@/lib/format";
import {
  formatCollectionMonth,
  getRemainingCollectibleNow,
  getRemainingTotal,
  isInterestCollectible,
} from "@/lib/overdraft-service";
import type { OverdraftRecord } from "@/types/funds";

type RepayOverdraftModalProps = {
  open: boolean;
  saving: boolean;
  overdraft: OverdraftRecord | null;
  onClose: () => void;
  onSave: (amount: number) => Promise<void>;
};

export default function RepayOverdraftModal({ open, saving, overdraft, onClose, onSave }: RepayOverdraftModalProps) {
  const [amountInput, setAmountInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const remainingTotal = useMemo(() => (overdraft ? getRemainingTotal(overdraft) : 0), [overdraft]);
  const remainingCollectibleNow = useMemo(() => (overdraft ? getRemainingCollectibleNow(overdraft) : 0), [overdraft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overdraft) return;

    const amount = Number(amountInput || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a repayment amount greater than 0.");
      return;
    }

    if (amount > remainingTotal) {
      setError(`Amount exceeds remaining balance (${currency(remainingTotal)}).`);
      return;
    }

    if (amount > remainingCollectibleNow) {
      if (!isInterestCollectible(overdraft)) {
        setError(`Only principal is collectible now. Interest is due in ${formatCollectionMonth(overdraft)}.`);
      } else {
        setError(`Amount exceeds collectible balance (${currency(remainingCollectibleNow)}).`);
      }
      return;
    }

    setError(null);
    await onSave(amount);
    setAmountInput("");
  }

  return (
    <div className={`modal ${open ? "active" : ""}`} id="repayOverdraftModal">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">Repay Overdraft</h3>
          <button className="close-modal" onClick={onClose} type="button">
            <i className="fas fa-times" />
          </button>
        </div>

        {!overdraft ? (
          <div className="empty-state">
            <p>No overdraft selected.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="payout-summary">
              <div>
                <span className="text-muted">Member</span>
                <strong>{overdraft.memberName}</strong>
              </div>
              <div>
                <span className="text-muted">Principal</span>
                <strong>{currency(overdraft.amount)}</strong>
              </div>
              <div>
                <span className="text-muted">Interest</span>
                <strong>{currency(overdraft.interest)}</strong>
              </div>
              <div>
                <span className="text-muted">Total Repayment</span>
                <strong>{currency(overdraft.totalRepayment)}</strong>
              </div>
              <div>
                <span className="text-muted">Amount Paid</span>
                <strong>{currency(overdraft.amountPaid)}</strong>
              </div>
              <div>
                <span className="text-muted">Remaining Balance</span>
                <strong>{currency(remainingTotal)}</strong>
              </div>
              <div>
                <span className="text-muted">Collectible Now</span>
                <strong>{currency(remainingCollectibleNow)}</strong>
              </div>
              <div>
                <span className="text-muted">Interest Collection Month</span>
                <strong>{formatCollectionMonth(overdraft)}</strong>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Repayment Amount (GH₵) *</label>
              <input
                className="form-input"
                inputMode="decimal"
                max={remainingCollectibleNow}
                min={0}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder="0.00"
                required
                step="0.01"
                type="number"
                value={amountInput}
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <div className="modal-actions">
              <button className="btn btn-success" disabled={saving} type="submit">
                <i className="fas fa-money-bill-wave" /> {saving ? "Saving..." : "Record Payment"}
              </button>
              <button className="btn btn-secondary" onClick={onClose} type="button">
                <i className="fas fa-times" /> Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

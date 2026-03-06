"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { months } from "@/lib/months";
import { useModalBehavior } from "@/lib/use-modal-behavior";
import type { MonthName, MemberContribution } from "@/types/funds";

type MemberModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initialMember: MemberContribution | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    accountNumber: string;
    initialMonth: MonthName | null;
    initialAmount: number;
  }) => Promise<void>;
  saving: boolean;
};

export default function MemberModal({ open, mode, initialMember, onClose, onSave, saving }: MemberModalProps) {
  const [name, setName] = useState(initialMember?.name || "");
  const [accountNumber, setAccountNumber] = useState(initialMember?.accountNumber || "");
  const [initialMonth, setInitialMonth] = useState<MonthName | "">("");
  const [initialAmount, setInitialAmount] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { dialogRef, handleBackdropMouseDown } = useModalBehavior({ open, onClose });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Member name is required.");
      return;
    }

    if (!/^\d{1,13}$/.test(accountNumber)) {
      setError("Account number must be numeric and up to 13 digits.");
      return;
    }

    const parsedAmount = Number(initialAmount || 0);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setError("Initial amount must be a valid positive number.");
      return;
    }

    if (parsedAmount > 0 && !initialMonth) {
      setError("Select a month for the initial contribution.");
      return;
    }

    if (initialMonth && parsedAmount <= 0) {
      setError("Enter an amount greater than 0 when a month is selected.");
      return;
    }

    setError(null);
    await onSave({
      name: name.trim(),
      accountNumber: accountNumber.trim(),
      initialMonth: initialMonth || null,
      initialAmount: parsedAmount,
    });
  }

  return (
    <div
      aria-hidden={!open}
      className={`modal ${open ? "active" : ""}`}
      id="memberModal"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        aria-labelledby="memberModalTitle"
        aria-modal="true"
        className="modal-content"
        ref={dialogRef}
        role="dialog"
      >
        <div className="modal-header">
          <h3 className="modal-title" id="memberModalTitle">
            {mode === "create" ? "Add New Member" : "Edit Member"}
          </h3>
          <button aria-label="Close member modal" className="close-modal" onClick={onClose} type="button">
            <i className="fas fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="memberName">
                Member Name *
              </label>
              <input
                className="form-input"
                id="memberName"
                onChange={(event) => setName(event.target.value)}
                required
                type="text"
                value={name}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="memberAccountNumber">
                Account Number *
              </label>
              <input
                className="form-input"
                id="memberAccountNumber"
                inputMode="numeric"
                maxLength={13}
                onChange={(event) => setAccountNumber(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Account Number (max 13 digits)"
                required
                type="text"
                value={accountNumber}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="memberInitialMonth">
              Initial/Adjustment Contribution (Optional)
            </label>
            <div className="form-row">
              <select
                className="form-select"
                id="memberInitialMonth"
                onChange={(event) => setInitialMonth(event.target.value as MonthName | "")}
                value={initialMonth}
              >
                <option value="">Select Month</option>
                {months.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
              <input
                className="form-input"
                id="memberInitialAmount"
                inputMode="decimal"
                min={0}
                onChange={(event) => setInitialAmount(event.target.value)}
                placeholder="Amount (GH₵)"
                step="0.01"
                type="number"
                value={initialAmount}
              />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button className="btn btn-primary modal-btn" disabled={saving} type="submit">
              <i className="fas fa-save" /> <span className="btn-text">{saving ? "Saving..." : "Save"}</span>
            </button>
            <button className="btn btn-secondary modal-btn" onClick={onClose} type="button">
              <i className="fas fa-times" /> <span className="btn-text">Cancel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

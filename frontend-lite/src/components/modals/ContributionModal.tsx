"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { MonthName, MemberContribution } from "@/types/funds";
import { currency } from "@/lib/format";
import { months } from "@/lib/months";
import { useModalBehavior } from "@/lib/use-modal-behavior";

type ContributionModalProps = {
  open: boolean;
  year: number;
  members: MemberContribution[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { memberId: string; month: MonthName; amount: number }) => Promise<void>;
  onDelete: (payload: { memberId: string; month: MonthName }) => Promise<void>;
};

export default function ContributionModal({ open, year, members, saving, onClose, onSave, onDelete }: ContributionModalProps) {
  const activeMembers = useMemo(() => members.filter((member) => !member.isArchived), [members]);
  const hasMembers = activeMembers.length > 0;
  const defaultMonth = months[new Date().getMonth()];
  const defaultMemberId = activeMembers[0]?.id || "";
  const defaultAmount = activeMembers[0]?.contributions[defaultMonth] || 0;

  const [memberId, setMemberId] = useState(defaultMemberId);
  const [month, setMonth] = useState<MonthName>(defaultMonth);
  const [amountInput, setAmountInput] = useState(defaultAmount > 0 ? String(defaultAmount) : "");
  const [error, setError] = useState<string | null>(null);
  const { dialogRef, handleBackdropMouseDown } = useModalBehavior({ open, onClose });
  const resolvedMemberId = activeMembers.some((member) => member.id === memberId) ? memberId : activeMembers[0]?.id || "";
  const selectedMember = useMemo(
    () => activeMembers.find((member) => member.id === resolvedMemberId) || null,
    [activeMembers, resolvedMemberId],
  );
  const existingAmount = selectedMember ? selectedMember.contributions[month] || 0 : 0;

  function handleMemberChange(nextMemberId: string) {
    setMemberId(nextMemberId);
    const member = activeMembers.find((item) => item.id === nextMemberId);
    const value = member ? member.contributions[month] || 0 : 0;
    setAmountInput(value > 0 ? String(value) : "");
  }

  function handleMonthChange(nextMonth: MonthName) {
    setMonth(nextMonth);
    const value = selectedMember ? selectedMember.contributions[nextMonth] || 0 : 0;
    setAmountInput(value > 0 ? String(value) : "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resolvedMemberId) {
      setError("Please select a member.");
      return;
    }

    const amount = Number(amountInput || 0);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Please enter a valid amount.");
      return;
    }

    setError(null);
    await onSave({ memberId: resolvedMemberId, month, amount });
  }

  async function handleDelete() {
    if (!resolvedMemberId || existingAmount <= 0) return;
    const confirmed = window.confirm(
      `Delete ${month} contribution for ${selectedMember?.name || "the selected member"}?`,
    );
    if (!confirmed) return;
    await onDelete({ memberId: resolvedMemberId, month });
  }

  return (
    <div
      aria-hidden={!open}
      className={`modal ${open ? "active" : ""}`}
      id="contributionModal"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        aria-labelledby="contributionModalTitle"
        aria-modal="true"
        className="modal-content"
        ref={dialogRef}
        role="dialog"
      >
        <div className="modal-header">
          <h3 className="modal-title" id="contributionModalTitle">
            Record Contribution ({year})
          </h3>
          <button aria-label="Close contribution modal" className="close-modal" onClick={onClose} type="button">
            <i className="fas fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="contributionMember">
                Member *
              </label>
              <select
                className="form-select"
                disabled={!hasMembers}
                id="contributionMember"
                onChange={(event) => handleMemberChange(event.target.value)}
                required
                value={resolvedMemberId}
              >
                <option value="">Select Member</option>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="contributionMonth">
                Month *
              </label>
              <select
                className="form-select"
                id="contributionMonth"
                onChange={(event) => handleMonthChange(event.target.value as MonthName)}
                required
                value={month}
              >
                {months.map((monthName) => (
                  <option key={monthName} value={monthName}>
                    {monthName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="contributionAmount">
              Amount (GH₵) *
            </label>
            <input
              className="form-input"
              disabled={!hasMembers}
              id="contributionAmount"
              inputMode="decimal"
              min={0}
              onChange={(event) => setAmountInput(event.target.value)}
              placeholder="0.00"
              required
              step="0.01"
              type="number"
              value={amountInput}
            />
            <small className="text-muted">
              Existing value for selected member/month: {currency(existingAmount)}
            </small>
          </div>

          {!hasMembers && <div className="form-error">Add at least one active member before recording contributions.</div>}
          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button className="btn btn-primary modal-btn" disabled={saving || !hasMembers} type="submit">
              <i className="fas fa-save" /> <span className="btn-text">{saving ? "Saving..." : "Save"}</span>
            </button>
            <button
              className="btn btn-danger modal-btn"
              disabled={saving || existingAmount <= 0 || !hasMembers}
              onClick={handleDelete}
              type="button"
            >
              <i className="fas fa-trash" /> <span className="btn-text">Delete</span>
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

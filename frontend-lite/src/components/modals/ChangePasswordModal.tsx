"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { changeCurrentUserPassword } from "@/lib/auth-service";
import { useModalBehavior } from "@/lib/use-modal-behavior";

type ChangePasswordModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function ChangePasswordModal({ open, onClose, onSuccess }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { dialogRef, handleBackdropMouseDown } = useModalBehavior({ open, onClose });

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    setError(null);
    setSaving(false);
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword) {
      setError("Current password is required.");
      return;
    }
    if (nextPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (nextPassword === currentPassword) {
      setError("New password must be different from current password.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await changeCurrentUserPassword({ currentPassword, newPassword: nextPassword });
      await onSuccess();
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to change password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div aria-hidden={!open} className={`modal ${open ? "active" : ""}`} id="changePasswordModal" onMouseDown={handleBackdropMouseDown}>
      <div aria-labelledby="changePasswordTitle" aria-modal="true" className="modal-content" ref={dialogRef} role="dialog">
        <div className="modal-header">
          <h3 className="modal-title" id="changePasswordTitle">
            Change Password
          </h3>
          <button aria-label="Close change password modal" className="close-modal" onClick={onClose} type="button">
            <i className="fas fa-times" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="currentPassword">
              Current Password *
            </label>
            <input
              autoComplete="current-password"
              className="form-input"
              id="currentPassword"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              type="password"
              value={currentPassword}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">
                New Password *
              </label>
              <input
                autoComplete="new-password"
                className="form-input"
                id="newPassword"
                minLength={8}
                onChange={(event) => setNextPassword(event.target.value)}
                required
                type="password"
                value={nextPassword}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm New Password *
              </label>
              <input
                autoComplete="new-password"
                className="form-input"
                id="confirmPassword"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="modal-actions">
            <button className="btn btn-primary modal-btn" disabled={saving} type="submit">
              <i className="fas fa-key" /> <span className="btn-text">{saving ? "Updating..." : "Update Password"}</span>
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

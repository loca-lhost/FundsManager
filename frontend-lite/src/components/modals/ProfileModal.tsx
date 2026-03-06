"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { formatRoleLabel, getUserProfileSnapshot, setCurrentUserMfa, signOutAllUserSessions, updateCurrentUserProfile } from "@/lib/auth-service";
import { formatDateTime, nameInitials } from "@/lib/format";
import { useModalBehavior } from "@/lib/use-modal-behavior";
import type { UserProfileSnapshot } from "@/types/auth";

type ProfileModalProps = {
  open: boolean;
  onClose: () => void;
  onSessionRefresh: () => Promise<void>;
  onSignedOutAll: () => Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function roleLabel(snapshot: UserProfileSnapshot | null): string {
  if (!snapshot) return "";
  return formatRoleLabel(snapshot.role);
}

export default function ProfileModal({ open, onClose, onSessionRefresh, onSignedOutAll }: ProfileModalProps) {
  const [snapshot, setSnapshot] = useState<UserProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [updatingMfa, setUpdatingMfa] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");

  const { dialogRef, handleBackdropMouseDown } = useModalBehavior({ open, onClose });

  const hydrateForm = useCallback((data: UserProfileSnapshot) => {
    setFullName(data.fullName);
    setEmail(data.email);
    setPhone(data.phone);
    setCurrentPassword("");
  }, []);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserProfileSnapshot();
      setSnapshot(data);
      hydrateForm(data);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Unable to load profile."));
    } finally {
      setLoading(false);
    }
  }, [hydrateForm]);

  useEffect(() => {
    if (!open) return;
    setSuccess(null);
    void loadSnapshot();
  }, [loadSnapshot, open]);

  const requiresPasswordForContactUpdate = useMemo(() => {
    if (!snapshot) return false;
    return email.trim().toLowerCase() !== snapshot.email.trim().toLowerCase() || phone.trim() !== snapshot.phone.trim();
  }, [email, phone, snapshot]);

  const hasChanges = useMemo(() => {
    if (!snapshot) return false;
    return (
      fullName.trim() !== snapshot.fullName.trim() ||
      email.trim().toLowerCase() !== snapshot.email.trim().toLowerCase() ||
      phone.trim() !== snapshot.phone.trim()
    );
  }, [email, fullName, phone, snapshot]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (phone.trim() && !/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
      setError("Phone must use E.164 format, e.g. +233555123456.");
      return;
    }

    setSavingProfile(true);
    setError(null);
    setSuccess(null);
    try {
      await updateCurrentUserProfile({
        fullName,
        email,
        phone,
        currentPassword: requiresPasswordForContactUpdate ? currentPassword : undefined,
      });
      await onSessionRefresh();
      await loadSnapshot();
      setSuccess("Profile updated successfully.");
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Unable to save profile."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleToggleMfa() {
    if (!snapshot) return;
    setUpdatingMfa(true);
    setError(null);
    setSuccess(null);
    try {
      const nextEnabled = !snapshot.mfaEnabled;
      await setCurrentUserMfa(nextEnabled);
      await loadSnapshot();
      setSuccess(nextEnabled ? "MFA has been enabled." : "MFA has been disabled.");
    } catch (mfaError) {
      setError(getErrorMessage(mfaError, "Unable to update MFA."));
    } finally {
      setUpdatingMfa(false);
    }
  }

  async function handleSignOutAllSessions() {
    const confirmed = window.confirm("Sign out all devices? This will end your current session immediately.");
    if (!confirmed) return;

    setSigningOutAll(true);
    setError(null);
    setSuccess(null);
    try {
      await signOutAllUserSessions();
      await onSignedOutAll();
      onClose();
    } catch (signOutError) {
      setError(getErrorMessage(signOutError, "Unable to sign out all sessions."));
    } finally {
      setSigningOutAll(false);
    }
  }

  const avatarInitials = nameInitials(fullName || snapshot?.fullName || "");

  return (
    <div aria-hidden={!open} className={`modal ${open ? "active" : ""}`} id="profileModal" onMouseDown={handleBackdropMouseDown}>
      <div aria-labelledby="profileModalTitle" aria-modal="true" className="modal-content modal-wide" ref={dialogRef} role="dialog">
        <div className="modal-header">
          <h3 className="modal-title" id="profileModalTitle">
            User Profile
          </h3>
          <button aria-label="Close profile modal" className="close-modal" onClick={onClose} type="button">
            <i className="fas fa-times" />
          </button>
        </div>

        {loading ? (
          <div className="profile-loading">
            <div className="spinner" />
            <p className="text-muted">Loading profile...</p>
          </div>
        ) : (
          <div className="profile-layout">
            <section className="profile-main-panel">
              <form onSubmit={handleSubmit}>
                <div className="profile-avatar-row">
                  <div className="profile-modal-avatar" aria-hidden="true">
                    <span>{avatarInitials}</span>
                  </div>
                  <div className="profile-avatar-meta">
                    <strong>{fullName || "Unnamed user"}</strong>
                    <span>{email || "No email"}</span>
                    <small>{roleLabel(snapshot)}</small>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileFullName">
                      Full Name *
                    </label>
                    <input
                      className="form-input"
                      id="profileFullName"
                      onChange={(event) => setFullName(event.target.value)}
                      required
                      type="text"
                      value={fullName}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileRole">
                      Role
                    </label>
                    <input className="form-input" id="profileRole" readOnly type="text" value={roleLabel(snapshot)} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="profileEmail">
                      Email *
                    </label>
                    <input
                      autoComplete="email"
                      className="form-input"
                      id="profileEmail"
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      type="email"
                      value={email}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profilePhone">
                      Phone
                    </label>
                    <input
                      autoComplete="tel"
                      className="form-input"
                      id="profilePhone"
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+233555123456"
                      type="tel"
                      value={phone}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="profileCurrentPassword">
                    Current Password {requiresPasswordForContactUpdate ? "*" : "(only needed for email/phone updates)"}
                  </label>
                  <input
                    autoComplete="current-password"
                    className="form-input"
                    id="profileCurrentPassword"
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required={requiresPasswordForContactUpdate}
                    type="password"
                    value={currentPassword}
                  />
                </div>

                {error && <div className="form-error">{error}</div>}
                {success && <div className="notice success profile-notice">{success}</div>}

                <div className="modal-actions">
                  <button className="btn btn-primary modal-btn" disabled={savingProfile || !hasChanges} type="submit">
                    <i className="fas fa-save" /> <span className="btn-text">{savingProfile ? "Saving..." : "Save Profile"}</span>
                  </button>
                  <button
                    className="btn btn-secondary modal-btn"
                    disabled={savingProfile || !snapshot}
                    onClick={() => snapshot && hydrateForm(snapshot)}
                    type="button"
                  >
                    <i className="fas fa-rotate-left" /> <span className="btn-text">Reset</span>
                  </button>
                </div>
              </form>
            </section>

            <aside className="profile-security-panel">
              <h4>Security</h4>
              <div className="profile-security-item">
                <span>MFA Status</span>
                <strong
                  className={
                    snapshot?.mfaEnabled
                      ? "security-status-pill security-status-active"
                      : "security-status-pill security-status-inactive"
                  }
                >
                  {snapshot?.mfaEnabled ? "Enabled" : "Disabled"}
                </strong>
              </div>
              <div className="profile-security-item">
                <span>Last Login</span>
                <strong>{snapshot?.lastLogin ? formatDateTime(snapshot.lastLogin) : "Not available"}</strong>
              </div>
              <div className="profile-security-item">
                <span>Active Sessions</span>
                <strong>{snapshot?.sessions.length || 0}</strong>
              </div>

              <div className="security-actions">
                <button className="btn btn-secondary" disabled={updatingMfa || !snapshot} onClick={handleToggleMfa} type="button">
                  <i className="fas fa-shield-alt" /> {updatingMfa ? "Updating..." : snapshot?.mfaEnabled ? "Disable MFA" : "Enable MFA"}
                </button>
                <button className="btn btn-danger" disabled={signingOutAll} onClick={handleSignOutAllSessions} type="button">
                  <i className="fas fa-door-open" /> {signingOutAll ? "Signing Out..." : "Sign Out All Devices"}
                </button>
              </div>

              <div className="session-list">
                {snapshot?.sessions.map((session) => (
                  <div className="session-row" key={session.id}>
                    <div>
                      <strong>
                        {session.clientName} on {session.osName}
                      </strong>
                      <p>
                        {session.deviceName} | {session.countryName} | {session.ip}
                      </p>
                    </div>
                    <span className={`session-badge ${session.current ? "current" : ""}`}>
                      {session.current ? "Current" : formatDateTime(session.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

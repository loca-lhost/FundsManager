"use client";

import { useEffect, useRef, useState } from "react";
import ChangePasswordModal from "@/components/modals/ChangePasswordModal";
import ProfileModal from "@/components/modals/ProfileModal";
import { nameInitials } from "@/lib/format";

type AppHeaderProps = {
  canManage: boolean;
  canAdmin: boolean;
  showArchived: boolean;
  onOpenAddMemberModal: () => void;
  onOpenDividendModal: () => void;
  onToggleArchived: () => void;
  userName: string;
  userEmail: string;
  role: string;
  onLogout: () => Promise<void>;
  onRefreshSession: () => Promise<void>;
  onSignedOutAllSessions: () => Promise<void>;
};

export default function AppHeader({
  canManage,
  canAdmin,
  showArchived,
  onOpenAddMemberModal,
  onOpenDividendModal,
  onToggleArchived,
  userName,
  userEmail,
  role,
  onLogout,
  onRefreshSession,
  onSignedOutAllSessions,
}: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const displayName = userName.trim() || "User";
  const avatarInitials = nameInitials(displayName);

  useEffect(() => {
    if (!profileOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) return;
      const target = event.target as Node;
      if (!containerRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileOpen]);

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo">
              <img alt="Bese Saka" className="brand-icon" src="/favicon.svg" />
            </div>
            <div className="header-title">
              <h1>Funds Manager</h1>
              <p>Nurturing Collective Wealth</p>
            </div>
          </div>

          <div className="header-actions">
            <div className="header-profile" ref={containerRef}>
              <button
                aria-controls="profileMenu"
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                className={`header-profile-trigger ${profileOpen ? "open" : ""}`}
                onClick={() => setProfileOpen((current) => !current)}
                title={displayName}
                type="button"
              >
                <div className="profile-avatar">
                  <span>{avatarInitials}</span>
                </div>
                <div className="profile-name" title={displayName}>
                  {displayName}
                </div>
                <i className="fas fa-chevron-down header-chevron" />
              </button>

              <div className={`dropdown-content profile-dropdown ${profileOpen ? "show" : ""}`} id="profileMenu" role="menu">
                <div className="profile-header">
                  <div className="profile-header-name">{displayName}</div>
                  <div className="profile-header-role">{role}</div>
                  <div className="profile-header-email">{userEmail}</div>
                </div>

                <div className="dropdown-section-label">Account</div>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowProfileModal(true);
                    setProfileOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <i className="fas fa-user-circle" /> View Profile
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowPasswordModal(true);
                    setProfileOpen(false);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <i className="fas fa-key" /> Change Password
                </button>

                {(canManage || canAdmin) && (
                  <>
                    <div className="dropdown-divider" />
                    <div className="dropdown-section-label">Actions</div>

                    {canManage && (
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          onOpenAddMemberModal();
                          setProfileOpen(false);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <i className="fas fa-user-plus text-success" /> Add Member
                      </button>
                    )}

                    {canManage && (
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          onOpenDividendModal();
                          setProfileOpen(false);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <i className="fas fa-calculator text-success" /> Calculate Dividends
                      </button>
                    )}

                    {canAdmin && (
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          onToggleArchived();
                          setProfileOpen(false);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        <i className="fas fa-archive text-muted" /> {showArchived ? "Hide Archived" : "Show Archived"}
                      </button>
                    )}
                  </>
                )}

                <div className="dropdown-divider" />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setProfileOpen(false);
                    void onLogout();
                  }}
                  role="menuitem"
                  type="button"
                >
                  <i className="fas fa-sign-out-alt text-danger" /> Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ProfileModal
        onClose={() => setShowProfileModal(false)}
        onSessionRefresh={onRefreshSession}
        onSignedOutAll={onSignedOutAllSessions}
        open={showProfileModal}
      />

      <ChangePasswordModal onClose={() => setShowPasswordModal(false)} onSuccess={onRefreshSession} open={showPasswordModal} />
    </>
  );
}

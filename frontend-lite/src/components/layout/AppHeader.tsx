"use client";

import { useEffect, useRef, useState } from "react";

type AppHeaderProps = {
  canManage: boolean;
  canAdmin: boolean;
  showArchived: boolean;
  onOpenAddMemberModal: () => void;
  onOpenDividendModal: () => void;
  onToggleArchived: () => void;
  userName: string;
  role: string;
  onLogout: () => Promise<void>;
};

export default function AppHeader({
  canManage,
  canAdmin,
  showArchived,
  onOpenAddMemberModal,
  onOpenDividendModal,
  onToggleArchived,
  userName,
  role,
  onLogout,
}: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
    <header className="header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo">
            <img alt="Bese Saka" className="brand-icon" src="/favicon.svg" />
          </div>
          <div className="header-title">
            <h1>Funds Manager</h1>
            <p>Premium Welfare Operations</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-role-chip">{role}</div>
          <div className="header-profile" ref={containerRef}>
            <button
              aria-controls="profileMenu"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              className={`header-profile-trigger ${profileOpen ? "open" : ""}`}
              onClick={() => setProfileOpen((current) => !current)}
              type="button"
            >
              <div className="profile-avatar">{userName.trim().charAt(0).toUpperCase() || "?"}</div>
              <div className="profile-name">{userName}</div>
              <i className="fas fa-chevron-down header-chevron" />
            </button>

            <div className={`dropdown-content profile-dropdown ${profileOpen ? "show" : ""}`} id="profileMenu" role="menu">
              <div className="profile-header">
                <div className="profile-header-name">{userName}</div>
                <div className="profile-header-role">{role}</div>
              </div>

              <div className="dropdown-section-label">Account</div>
              <button className="dropdown-item" disabled role="menuitem" type="button">
                <i className="fas fa-key" /> Change Password (Coming soon)
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
  );
}

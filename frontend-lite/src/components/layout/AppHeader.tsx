"use client";

import { useEffect, useRef, useState } from "react";

type AppHeaderProps = {
  userName: string;
  role: string;
  onLogout: () => Promise<void>;
};

export default function AppHeader({ userName, role, onLogout }: AppHeaderProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current) return;
      const target = event.target as Node;
      if (!containerRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-section">
          <div className="logo">{"\u20B5"}</div>
          <div className="header-title">
            <h1>Funds Manager</h1>
            <p>Funds Management Systems</p>
          </div>
        </div>

        <div className="header-actions">
          <div
            aria-expanded={profileOpen}
            className="header-profile"
            onClick={() => setProfileOpen((current) => !current)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setProfileOpen((current) => !current);
              }
            }}
            ref={containerRef}
            role="button"
            tabIndex={0}
          >
            <div className="profile-avatar">{userName.charAt(0)}</div>
            <div className="profile-name">{userName}</div>
            <i className="fas fa-chevron-down" style={{ fontSize: "0.9rem", color: "var(--theme-text-secondary)" }} />

            <div className={`dropdown-content ${profileOpen ? "show" : ""}`} style={{ top: "100%", right: 0, marginTop: "0.5rem" }}>
              <div className="profile-header">
                <div style={{ fontWeight: 700, color: "var(--brand-dark)" }}>{userName}</div>
                <div style={{ fontSize: "0.9rem", color: "var(--theme-text-secondary)", textTransform: "uppercase" }}>{role}</div>
              </div>

              <div className="dropdown-section-label">Account</div>
              <button className="dropdown-item" disabled type="button">
                <i className="fas fa-key" style={{ color: "var(--theme-text-secondary)" }} /> Change Password (Coming soon)
              </button>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item"
                onClick={(event) => {
                  event.stopPropagation();
                  void onLogout();
                }}
                type="button"
              >
                <i className="fas fa-sign-out-alt" style={{ color: "var(--brand-error)" }} /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

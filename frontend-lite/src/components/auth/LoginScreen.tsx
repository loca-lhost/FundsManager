"use client";

import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

type LoginScreenProps = {
  defaultEmail?: string;
  loading: boolean;
  errorMessage?: string | null;
  onSubmit: (payload: { email: string; password: string; remember: boolean }) => Promise<void>;
};

export default function LoginScreen({ defaultEmail = "", loading, errorMessage, onSubmit }: LoginScreenProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(Boolean(defaultEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    setEmail(defaultEmail);
    setRemember(Boolean(defaultEmail));
  }, [defaultEmail]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ email: email.trim(), password, remember });
  }

  function handlePasswordKeyboardEvent(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState("CapsLock"));
  }

  function togglePasswordVisibility() {
    setShowPassword((current) => !current);
  }

  const loginErrorId = errorMessage ? "loginErrorMessage" : undefined;

  return (
    <div className="login-container">
      <div className="login-shell">
        <aside className="login-brand-panel" aria-hidden="true">
          <div className="login-brand-eyebrow">Funds Manager</div>
          <h1>Nurturing collective wealth.</h1>
          <p>Track contributions, overdrafts, and records in one secure workspace.</p>
          <ul className="login-benefits">
            <li>
              <i className="fas fa-shield-alt" /> Role-based access and audit logs
            </li>
            <li>
              <i className="fas fa-bolt" /> Faster daily operations
            </li>
            <li>
              <i className="fas fa-mobile-alt" /> Desktop and mobile ready
            </li>
          </ul>
        </aside>

        <div className="login-card">
          <div className="login-header">
            <div className="login-logo">
              <img alt="Bese Saka" className="brand-icon" src="/favicon.svg" />
            </div>
            <div className="login-badge">
              <i className="fas fa-lock" /> Secure Sign In
            </div>
            <h2>Welcome back</h2>
            <p>Use your account credentials to continue.</p>
          </div>

          <form className="login-form" noValidate onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="loginEmail">
                Email
              </label>
              <input
                autoComplete="username"
                className="form-input"
                id="loginEmail"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="loginPassword">
                Password
              </label>
              <div className="password-field">
                <input
                  aria-describedby={loginErrorId}
                  aria-invalid={Boolean(errorMessage)}
                  autoComplete="current-password"
                  className="form-input"
                  id="loginPassword"
                  onBlur={() => setCapsLockOn(false)}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={handlePasswordKeyboardEvent}
                  onKeyUp={handlePasswordKeyboardEvent}
                  placeholder="Enter password"
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="password-toggle"
                  onClick={togglePasswordVisibility}
                  type="button"
                >
                  <i className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>

              {capsLockOn && <div className="caps-lock-warning">Caps Lock is on.</div>}

              <div className="remember-row">
                <label className="remember-label">
                  <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" /> Remember me
                </label>
                <span className="login-meta">This device only</span>
              </div>
            </div>

            {errorMessage && (
              <div aria-live="assertive" className="notice error login-error" id="loginErrorMessage" role="alert">
                {errorMessage}
              </div>
            )}

            <div className="login-action">
              <button className="btn btn-primary login-btn" disabled={loading} type="submit">
                {loading ? "Signing In..." : "Sign In"} <i className="fas fa-arrow-right login-arrow" />
              </button>
              <p className="login-support-copy">
                Need help? Contact your administrator.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

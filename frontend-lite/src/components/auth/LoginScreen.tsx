"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

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

  useEffect(() => {
    setEmail(defaultEmail);
    setRemember(Boolean(defaultEmail));
  }, [defaultEmail]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({ email: email.trim(), password, remember });
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">{"\u20B5"}</div>
          <h2>Funds Manager</h2>
          <p>Please sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="loginEmail">
              Email
            </label>
            <input
              className="form-input"
              id="loginEmail"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter email"
              required
              type="email"
              value={email}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="loginPassword">
              Password
            </label>
            <input
              className="form-input"
              id="loginPassword"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              required
              type="password"
              value={password}
            />
            <div className="remember-row">
              <label className="remember-label">
                <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" /> Remember me
              </label>
            </div>
          </div>

          {errorMessage && (
            <div className="notice error login-error">{errorMessage}</div>
          )}

          <div className="login-action">
            <button className="btn btn-primary login-btn" disabled={loading} type="submit">
              {loading ? "Signing In..." : "Sign In"} <i className="fas fa-arrow-right login-arrow" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

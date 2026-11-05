"use client";

import React, { useState } from "react";
import { useAuth } from "../../lib/auth";

const DEMO_ACCOUNTS = [
  { role: "Inspector", email: "inspector.ahm@demo.invalid" },
  { role: "Mamlatdar", email: "mamlatdar.ahm1@demo.invalid" },
  { role: "District Officer", email: "do.ahm@demo.invalid" },
  { role: "Vigilance", email: "vigilance.1@demo.invalid" },
  { role: "Admin", email: "admin@demo.invalid" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    // Standard demo password
    setPassword("demoPassword123");
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 px-6 sm:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-title font-bold text-text tracking-tight">
          PDS Virtual Inspection System
        </h2>
        <p className="mt-1 text-center text-meta text-text-muted">
          Sign in to access assigned queues and oversight records
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-bg py-8 px-6 border border-border rounded-md shadow-sm sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="p-3 bg-risk-high-bg border border-risk-high text-risk-high text-meta rounded-sm font-medium"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-meta font-medium text-text">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-sm text-body bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                  placeholder="officer@demo.invalid"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-meta font-medium text-text">
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-sm text-body bg-bg text-text focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-sm shadow-sm text-body font-medium text-accent-fg bg-accent hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 transition-opacity"
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>

          {/* Quick Demo Shortcuts */}
          <div className="mt-6 pt-6 border-t border-border">
            <div className="text-meta font-medium text-text-muted mb-3 flex items-center justify-between">
              <span>Demo Quick Sign-in</span>
              <span className="text-[11px] bg-surface px-1.5 py-0.5 rounded border border-border">Demo Mode</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleQuickDemo(acc.email)}
                  className="px-2.5 py-1.5 text-meta text-left border border-border rounded-sm hover:bg-surface hover:border-text-muted transition-colors text-text"
                >
                  <div className="font-medium text-xs leading-tight">{acc.role}</div>
                  <div className="text-[11px] text-text-muted truncate">{acc.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

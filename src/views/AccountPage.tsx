"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brand } from "../components/ui";
import { authErrorMessage } from "../services/auth";
import { useSession } from "../services/session";
export function AccountPage() {
  const { user, setUser, service } = useSession();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await service.logout();
      setUser(null);
      router.replace("/login");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="state-page">
      <Brand />
      <span className="eyebrow">YOUR WORKSPACE</span>
      <h1>Welcome, {user?.name}.</h1>
      <p>
        Your account is connected. Subscription and live data services will
        appear here when available.
      </p>
      {error && (
        <p role="alert" className="form-alert">
          {error}
        </p>
      )}
      <button
        className="button button-primary"
        disabled={busy}
        onClick={logout}
      >
        {busy ? "Signing out…" : "Sign Out"}
      </button>
    </main>
  );
}

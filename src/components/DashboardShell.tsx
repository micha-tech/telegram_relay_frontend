"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authErrorMessage } from "../services/auth";
import { useSession } from "../services/session";
import { Brand } from "./ui";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Account" },
  { href: "/dashboard/telegram-accounts", label: "Telegram Accounts" },
] as const;

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, setUser, service } = useSession();
  const pathname = usePathname();
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
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <Brand />
          <nav className="dashboard-nav" aria-label="Dashboard">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname?.startsWith(`${item.href}/`))
                    ? "page"
                    : undefined
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="dashboard-actions">
            {user && <span className="dashboard-user">{user.name}</span>}
            <button
              type="button"
              className="button button-secondary dashboard-signout"
              disabled={busy}
              onClick={logout}
            >
              {busy ? "Signing out…" : "Sign Out"}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="form-alert dashboard-alert">
            {error}
          </p>
        )}
      </header>
      <main className="dashboard-main" id="main-content">
        {children}
      </main>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../services/session";
import { AccountPage } from "../views/AccountPage";
import { Brand } from "./ui";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !error && !user)
      router.replace(
        `/login?next=${encodeURIComponent(pathname ?? "/dashboard")}`,
      );
  }, [user, loading, error, router, pathname]);
  if (error)
    return (
      <main className="state-page">
        <Brand />
        <p role="alert">{error}</p>
        <button
          className="button button-primary"
          onClick={() => void refresh()}
        >
          Try again
        </button>
        <Link href="/">Return home</Link>
      </main>
    );
  if (loading || !user)
    return (
      <main className="state-page" role="status">
        Checking your session…
      </main>
    );
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useSession();
  if (!user?.isAdmin)
    return (
      <main className="state-page">
        <Brand />
        <h1>Workspace administrator access required</h1>
        <p>
          Telegram accounts, signal sources and workspace settings are limited
          to workspace administrators. Ask the owner of{" "}
          {user?.tenant?.name ?? "your workspace"} for an admin role, or read
          the signals feed on your dashboard.
        </p>
        <Link href="/dashboard/signals">Go to signals</Link>
      </main>
    );
  return <>{children}</>;
}

function OwnerOnly({ children }: { children: ReactNode }) {
  const { user } = useSession();
  // The backend treats platform superusers as workspace owners as well.
  if (user?.isSuperuser) return <>{children}</>;
  if (!user?.isAdmin || user.role !== "owner")
    return (
      <main className="state-page">
        <Brand />
        <h1>Workspace owner access required</h1>
        <p>
          Only the owner of {user?.tenant?.name ?? "this workspace"} can change
          its name or manage administrators.
        </p>
        <Link href="/dashboard/workspace">Back to workspace</Link>
      </main>
    );
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminOnly>{children}</AdminOnly>
    </RequireAuth>
  );
}

export function RequireOwner({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <OwnerOnly>{children}</OwnerOnly>
    </RequireAuth>
  );
}

/** @deprecated Use RequireAdmin — access is per workspace now. */
export const RequireSuperAdmin = RequireAdmin;

export function ProtectedAccount() {
  return (
    <RequireAuth>
      <AccountPage />
    </RequireAuth>
  );
}

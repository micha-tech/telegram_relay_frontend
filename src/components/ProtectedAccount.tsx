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

function SuperAdminOnly({ children }: { children: ReactNode }) {
  const { user } = useSession();
  if (!user?.isSuperAdmin)
    return (
      <main className="state-page">
        <Brand />
        <h1>Super administrator access required</h1>
        <p>
          Telegram accounts and signal sources are limited to super
          administrators. The signals feed is available on your dashboard.
        </p>
        <Link href="/dashboard/signals">Go to signals</Link>
      </main>
    );
  return <>{children}</>;
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <SuperAdminOnly>{children}</SuperAdminOnly>
    </RequireAuth>
  );
}

export function ProtectedAccount() {
  return (
    <RequireAuth>
      <AccountPage />
    </RequireAuth>
  );
}

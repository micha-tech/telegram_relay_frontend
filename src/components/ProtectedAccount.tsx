"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "../services/session";
import { AccountPage } from "../views/AccountPage";
import { Brand } from "./ui";

export function ProtectedAccount() {
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
  return <AccountPage />;
}

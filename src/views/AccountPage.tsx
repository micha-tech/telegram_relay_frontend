"use client";

import Link from "next/link";
import { Arrow, Brand } from "../components/ui";
import { useSession } from "../services/session";

export function AccountPage() {
  const { user } = useSession();
  return (
    <main className="state-page">
      <Brand />
      <span className="eyebrow">YOUR WORKSPACE</span>
      <h1>Welcome, {user?.name}.</h1>
      <p>
        Your account is connected. Subscription and live data services will
        appear here when available.
      </p>
      <Link
        href="/dashboard/telegram-accounts"
        className="button button-primary"
      >
        Telegram Accounts <Arrow />
      </Link>
    </main>
  );
}

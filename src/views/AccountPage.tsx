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
        {user?.tenant ? (
          <>
            You’re signed in to <b>{user.tenant.name}</b> as{" "}
            {user.role ?? "member"}. Signals and Telegram connections are shared
            with the other members of this workspace.
          </>
        ) : (
          "Your account is connected. Your workspace will appear here once it is created."
        )}
      </p>
      <div className="state-actions">
        <Link href="/dashboard/signals" className="button button-primary">
          Signals <Arrow />
        </Link>
        {user?.isAdmin && (
          <Link
            href="/dashboard/telegram-accounts"
            className="button button-secondary"
          >
            Telegram Accounts <Arrow />
          </Link>
        )}
        {user?.isAdmin && (
          <Link href="/dashboard/workspace" className="button button-secondary">
            Workspace settings <Arrow />
          </Link>
        )}
      </div>
    </main>
  );
}

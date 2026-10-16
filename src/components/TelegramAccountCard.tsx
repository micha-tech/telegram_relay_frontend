"use client";

import { useState } from "react";
import { telegramErrorMessage } from "../services/telegram";
import type {
  TelegramAccount,
  TelegramAccountHealth,
  TelegramAccountStatus,
  TelegramService,
} from "../services/telegram";

const STATUS_LABELS: Record<TelegramAccountStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting",
  requires_attention: "Needs attention",
  unknown: "Status unavailable",
};

export function statusLabel(status: TelegramAccountStatus) {
  return STATUS_LABELS[status];
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function TelegramAccountCard({
  account,
  service,
  onAccountsChanged,
  onReconnect,
}: {
  account: TelegramAccount;
  service: TelegramService;
  onAccountsChanged: () => void;
  onReconnect: (account: TelegramAccount) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState<TelegramAccountHealth | null>(null);
  const headingId = `tg-account-${safeId(account.id)}`;
  const displayName =
    account.displayName ??
    (account.username ? `@${account.username}` : "Telegram account");
  const canReconnect =
    account.status === "disconnected" ||
    account.status === "reconnecting" ||
    account.status === "requires_attention" ||
    account.status === "unknown";

  async function disconnect() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await service.disconnectAccount(account.id);
      setConfirming(false);
      setNotice(`${displayName} was disconnected.`);
      onAccountsChanged();
    } catch (err) {
      setError(telegramErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function checkHealth() {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setHealth(await service.getAccountHealth(account.id));
    } catch (err) {
      setHealth(null);
      setError(telegramErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="tg-card" aria-labelledby={headingId}>
      <header className="tg-card-head">
        <h3 id={headingId}>{displayName}</h3>
        <span
          className={`tg-status tg-status-${account.status}`}
          aria-label={`Status: ${STATUS_LABELS[account.status]}`}
        >
          {STATUS_LABELS[account.status]}
        </span>
      </header>
      <dl className="tg-card-details">
        <div>
          <dt>Username</dt>
          <dd>{account.username ? `@${account.username}` : "Not set"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{account.maskedPhoneNumber ?? "Not available"}</dd>
        </div>
        <div>
          <dt>Last connected</dt>
          <dd>{formatDate(account.lastConnectedAt) ?? "Never"}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{formatDate(account.lastActivityAt) ?? "None recorded"}</dd>
        </div>
      </dl>
      {account.lastError && (
        <p className="tg-card-last-error">
          <span>Last reported issue</span>
          {account.lastError}
        </p>
      )}
      {notice && (
        <p role="status" className="form-notice">
          {notice}
        </p>
      )}
      {error && (
        <div className="form-alert" role="alert">
          <span>{error}</span>
        </div>
      )}
      {health && (
        <div className="tg-health" role="status">
          <b>Health check</b>
          <span>
            {STATUS_LABELS[health.status]}
            {health.lastCheckedAt
              ? ` · checked ${formatDate(health.lastCheckedAt)}`
              : ""}
          </span>
          {health.message && <span>{health.message}</span>}
        </div>
      )}
      <div className="tg-card-actions">
        {canReconnect && (
          <button
            type="button"
            className="button button-primary tg-card-button"
            disabled={busy}
            onClick={() => onReconnect(account)}
          >
            Reconnect
          </button>
        )}
        <button
          type="button"
          className="button button-secondary tg-card-button"
          disabled={busy}
          onClick={() => void checkHealth()}
        >
          {busy ? "Working…" : "Check health"}
        </button>
        <button
          type="button"
          className="button button-secondary tg-card-button"
          disabled={busy || confirming}
          onClick={() => {
            setError("");
            setConfirming(true);
          }}
        >
          Disconnect
        </button>
      </div>
      {confirming && (
        <div className="tg-confirm">
          <p>
            Disconnect {displayName}? The platform will stop using this account
            until you connect it again.
          </p>
          <div className="tg-confirm-actions">
            <button
              type="button"
              className="button button-primary tg-card-button"
              disabled={busy}
              onClick={() => void disconnect()}
            >
              {busy ? (
                <>
                  <span className="spinner" />
                  Disconnecting…
                </>
              ) : (
                "Confirm disconnect"
              )}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

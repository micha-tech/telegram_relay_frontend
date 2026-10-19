"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Arrow } from "../components/ui";
import { TelegramAccountCard } from "../components/TelegramAccountCard";
import { TelegramWizard } from "../components/TelegramWizard";
import {
  TelegramApiError,
  telegramErrorMessage,
  telegramService,
} from "../services/telegram";
import type { TelegramAccount, TelegramService } from "../services/telegram";

type LoadState = "loading" | "ready" | "error" | "unconfigured";

export function TelegramAccountsView({
  service = telegramService,
}: {
  service?: TelegramService;
}) {
  const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [reconnectBusy, setReconnectBusy] = useState<string | null>(null);
  const [wizard, setWizard] = useState(false);
  const version = useRef(0);

  const load = useCallback(
    async (background = false) => {
      const request = ++version.current;
      if (background) setRefreshing(true);
      else setLoadState("loading");
      try {
        const list = await service.listAccounts();
        if (request !== version.current) return;
        setAccounts(list);
        setLoadState("ready");
        setErrorMessage("");
      } catch (err) {
        if (request !== version.current) return;
        const unconfigured =
          err instanceof TelegramApiError && err.code === "unavailable";
        setErrorMessage(unconfigured ? err.message : telegramErrorMessage(err));
        setLoadState(unconfigured ? "unconfigured" : "error");
      } finally {
        if (request === version.current) setRefreshing(false);
      }
    },
    [service],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const stats =
    loadState === "ready"
      ? {
          total: accounts.length,
          connected: accounts.filter((a) => a.status === "connected").length,
          attention: accounts.filter(
            (a) => a.status === "invalid" || a.status === "error",
          ).length,
          pending: accounts.filter((a) => a.status === "pending").length,
        }
      : null;

  const onConnected = useCallback(() => {
    setNotice("Your Telegram account is connected.");
    setActionError("");
    void load(true);
  }, [load]);

  async function handleReconnect(account: TelegramAccount) {
    if (reconnectBusy) return;
    setReconnectBusy(account.id);
    setActionError("");
    setNotice(null);
    try {
      await service.reconnectAccount(account.id);
      setNotice("The account was reconnected.");
      await load(true);
    } catch (err) {
      setActionError(telegramErrorMessage(err));
    } finally {
      setReconnectBusy(null);
    }
  }

  return (
    <div className="tg-page">
      <header className="tg-header">
        <div className="tg-header-copy">
          <span className="eyebrow">TELEGRAM ACCOUNTS</span>
          <h1>Telegram Accounts</h1>
          <p>
            Connect and manage the Telegram accounts linked to your workspace.
            Each account is verified with a login code sent by Telegram.
          </p>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => setWizard(true)}
        >
          Connect Telegram <Arrow />
        </button>
      </header>

      {notice && (
        <div className="tg-page-notice" role="status">
          <span>{notice}</span>
          <button
            type="button"
            className="text-button"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      {actionError && (
        <div className="form-alert" role="alert">
          <b>We couldn’t complete that action.</b>
          <span>{actionError}</span>
        </div>
      )}

      {stats && (
        <section className="tg-summary" aria-label="Account summary">
          <div className="tg-stat">
            <span className="tg-stat-value">{stats.total}</span>
            <span className="tg-stat-label">Total accounts</span>
          </div>
          <div className="tg-stat">
            <span className="tg-stat-value">{stats.connected}</span>
            <span className="tg-stat-label">Connected</span>
          </div>
          <div className="tg-stat">
            <span className="tg-stat-value">{stats.attention}</span>
            <span className="tg-stat-label">Needs attention</span>
          </div>
          <div className="tg-stat">
            <span className="tg-stat-value">{stats.pending}</span>
            <span className="tg-stat-label">Pending</span>
          </div>
        </section>
      )}

      <section className="tg-list-section" aria-labelledby="tg-list-title">
        <div className="tg-list-head">
          <h2 id="tg-list-title">Your accounts</h2>
          {loadState === "ready" && accounts.length > 0 && (
            <button
              type="button"
              className="button button-secondary tg-refresh"
              disabled={refreshing}
              onClick={() => void load(true)}
            >
              {refreshing ? (
                <>
                  <span className="spinner" />
                  Refreshing…
                </>
              ) : (
                "Refresh"
              )}
            </button>
          )}
        </div>

        {loadState === "loading" && (
          <div className="tg-loading" role="status">
            Loading Telegram accounts…
            <div className="tg-skeleton" aria-hidden="true" />
            <div className="tg-skeleton" aria-hidden="true" />
          </div>
        )}

        {loadState === "unconfigured" && (
          <div className="tg-config-notice">
            <h3>Telegram integration isn’t configured</h3>
            <p>{errorMessage}</p>
            <button
              type="button"
              className="button button-secondary"
              disabled={refreshing}
              onClick={() => void load()}
            >
              Check again
            </button>
          </div>
        )}

        {loadState === "error" && (
          <div className="tg-error-state">
            <div className="form-alert" role="alert">
              <b>We couldn’t load your Telegram accounts.</b>
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              className="button button-primary"
              disabled={refreshing}
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        )}

        {loadState === "ready" && accounts.length === 0 && (
          <div className="tg-empty">
            <h3>No Telegram accounts yet</h3>
            <p>
              Connect a Telegram account to manage it from your workspace.
              Telegram will send a login code to verify the account — you are
              never asked for a Telegram password on this website.
            </p>
            <button
              type="button"
              className="button button-primary"
              onClick={() => setWizard(true)}
            >
              Connect Telegram <Arrow />
            </button>
          </div>
        )}

        {loadState === "ready" && accounts.length > 0 && (
          <ul className="tg-list">
            {accounts.map((account) => (
              <li key={account.id}>
                <TelegramAccountCard
                  account={account}
                  service={service}
                  onReconnect={(target) => void handleReconnect(target)}
                  onAccountsChanged={() => {
                    setNotice(null);
                    setActionError("");
                    void load(true);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {wizard && (
        <TelegramWizard
          service={service}
          onClose={() => setWizard(false)}
          onConnected={onConnected}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signalsErrorMessage, signalsService } from "../services/signals";
import type {
  Signal,
  SignalPage,
  SignalStats,
  SignalsService,
} from "../services/signals";

const REFRESH_INTERVAL = 20000;
const PAGE_SIZE = 20;

const TIME_WINDOWS = [
  { value: "", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function sinceFor(window: string) {
  if (!window) return "";
  const hours = window === "24h" ? 24 : window === "7d" ? 168 : 720;
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function formatWhen(value: string | null) {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function labelFor(id: string, fallback: string) {
  return fallback.trim() || `Chat ${id}`;
}

export function SignalsView({
  service = signalsService,
}: {
  service?: SignalsService;
}) {
  const [feed, setFeed] = useState<SignalPage | null>(null);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [windowFilter, setWindowFilter] = useState("");
  const [page, setPage] = useState(1);
  const version = useRef(0);

  const load = useCallback(
    async (background = false) => {
      const request = ++version.current;
      if (background) setRefreshing(true);
      else setLoading(true);
      try {
        const [pageData, summary] = await Promise.all([
          service.listSignals({
            q: query,
            source: sourceFilter,
            account: accountFilter,
            since: sinceFor(windowFilter),
            page,
            pageSize: PAGE_SIZE,
          }),
          service.getStats(),
        ]);
        if (request !== version.current) return;
        setFeed(pageData);
        setStats(summary);
        setErrorMessage("");
      } catch (err) {
        if (request !== version.current) return;
        setErrorMessage(signalsErrorMessage(err));
      } finally {
        if (request === version.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [service, query, sourceFilter, accountFilter, windowFilter, page],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => void load(true), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  const signals: Signal[] = feed?.results ?? [];
  const totalPages =
    feed && feed.pageSize > 0 ? Math.ceil(feed.count / feed.pageSize) : 0;

  return (
    <div className="sig-page">
      <header className="tg-header">
        <div className="tg-header-copy">
          <span className="eyebrow">SIGNALS</span>
          <h1>Signals</h1>
          <p>
            Matched Telegram messages from the watched chats. Every signal is
            captured live and refreshed automatically.
          </p>
        </div>
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
      </header>

      {errorMessage && (
        <div className="form-alert" role="alert">
          <b>We couldn’t load the signals feed.</b>
          <span>{errorMessage}</span>
        </div>
      )}

      {stats && (
        <section className="tg-summary" aria-label="Signal summary">
          <div className="tg-stat">
            <span className="tg-stat-value">{stats.total}</span>
            <span className="tg-stat-label">Total signals</span>
          </div>
          <div className="tg-stat">
            <span className="tg-stat-value">{stats.last24h}</span>
            <span className="tg-stat-label">Last 24 hours</span>
          </div>
          <div className="tg-stat">
            <span className="tg-stat-value">{stats.activeSources}</span>
            <span className="tg-stat-label">Active chats</span>
          </div>
        </section>
      )}

      <section className="sig-filters" aria-label="Signal filters">
        <label className="sig-field sig-field-grow">
          <span>Search</span>
          <input
            type="search"
            value={search}
            placeholder="Search signal text"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="sig-field">
          <span>Chat</span>
          <select
            value={sourceFilter}
            onChange={(event) =>
              changeFilter(setSourceFilter, event.target.value)
            }
          >
            <option value="">All chats</option>
            {(stats?.bySource ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {labelFor(entry.id, entry.name)} ({entry.count})
              </option>
            ))}
          </select>
        </label>
        <label className="sig-field">
          <span>Account</span>
          <select
            value={accountFilter}
            onChange={(event) =>
              changeFilter(setAccountFilter, event.target.value)
            }
          >
            <option value="">All accounts</option>
            {(stats?.byAccount ?? []).map((entry) => (
              <option key={entry.id} value={entry.id}>
                {labelFor(entry.id, entry.name)} ({entry.count})
              </option>
            ))}
          </select>
        </label>
        <label className="sig-field">
          <span>Window</span>
          <select
            value={windowFilter}
            onChange={(event) =>
              changeFilter(setWindowFilter, event.target.value)
            }
          >
            {TIME_WINDOWS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="sig-list-section" aria-labelledby="sig-list-title">
        <div className="tg-list-head">
          <h2 id="sig-list-title">
            Latest signals
            {feed ? ` (${feed.count})` : ""}
          </h2>
        </div>

        {loading && (
          <div className="tg-loading" role="status">
            Loading signals…
            <div className="tg-skeleton" aria-hidden="true" />
            <div className="tg-skeleton" aria-hidden="true" />
          </div>
        )}

        {!loading && signals.length === 0 && (
          <div className="tg-empty">
            <h3>No signals yet</h3>
            <p>
              Signals appear here as soon as a watched chat posts a message that
              matches a keyword rule.
            </p>
          </div>
        )}

        {!loading && signals.length > 0 && (
          <ul className="sig-list">
            {signals.map((signal) => (
              <li className="sig-item" key={signal.id}>
                <div className="sig-item-head">
                  <span className="sig-source">
                    {signal.sourceName ?? "Signal"}
                    {signal.accountLabel ? ` · ${signal.accountLabel}` : ""}
                  </span>
                  <span className="sig-time">{formatWhen(signal.sentAt)}</span>
                </div>
                <p className="sig-text">{signal.text}</p>
                <div className="sig-item-foot">
                  <span className="sig-author">
                    {signal.author ?? "Unknown author"}
                  </span>
                  {signal.matchedTerms.length > 0 && (
                    <span className="sig-terms">
                      {signal.matchedTerms.map((term) => (
                        <span className="sig-term" key={term}>
                          {term}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {feed && totalPages > 1 && (
          <nav className="sig-pagination" aria-label="Signal pages">
            <button
              type="button"
              className="button button-secondary"
              disabled={!feed.hasPrevious || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </button>
            <span>
              Page {feed.page} of {totalPages}
            </span>
            <button
              type="button"
              className="button button-secondary"
              disabled={!feed.hasNext}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}

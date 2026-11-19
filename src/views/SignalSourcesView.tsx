"use client";

import { useCallback, useEffect, useState } from "react";
import { telegramService } from "../services/telegram";
import type {
  TelegramAccount,
  TelegramDialog,
  TelegramService,
} from "../services/telegram";
import { signalsErrorMessage, signalsService } from "../services/signals";
import type { SignalSource, SignalsService } from "../services/signals";
import { templatesService } from "../services/templates";
import type { SignalTemplate, TemplatesService } from "../services/templates";

interface SourceForm {
  name: string;
  backfillLimit: string;
  forwardEnabled: boolean;
  /** TelegramEntity UUID for a destination chat (not the raw peer ID). */
  forwardToId: string;
  /** SignalTemplate UUID applied to forwarded copies of this source. */
  templateId: string;
}

const EMPTY_FORM: SourceForm = {
  name: "",
  backfillLimit: "200",
  forwardEnabled: false,
  forwardToId: "",
  templateId: "",
};

function formatWhen(value: string | null) {
  if (!value) return "never";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { dateStyle: "medium" });
}

export function SignalSourcesView({
  service = signalsService,
  telegram = telegramService,
  templates = templatesService,
}: {
  service?: SignalsService;
  telegram?: TelegramService;
  templates?: TemplatesService;
}) {
  const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [templateList, setTemplateList] = useState<SignalTemplate[]>([]);
  const [dialogs, setDialogs] = useState<TelegramDialog[]>([]);
  const [accountId, setAccountId] = useState("");
  const [selectedDialog, setSelectedDialog] = useState<TelegramDialog | null>(
    null,
  );
  const [form, setForm] = useState<SourceForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const destinations = dialogs.filter((dialog) => dialog.destinationId);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accountList, sourceList, templateItems] = await Promise.all([
        telegram.listAccounts(),
        service.listSources(),
        templates.listTemplates().catch(() => [] as SignalTemplate[]),
      ]);
      setAccounts(accountList);
      setSources(sourceList);
      setTemplateList(templateItems);
      setAccountId((current) => current || accountList[0]?.id || "");
      setErrorMessage("");
    } catch (err) {
      setErrorMessage(signalsErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [service, telegram, templates]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!accountId) {
      setDialogs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await telegram.getAccountDialogs(accountId);
        if (!cancelled) setDialogs(list);
      } catch {
        if (!cancelled) setDialogs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, telegram]);

  function updateForm(patch: Partial<SourceForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setSelectedDialog(null);
    setEditingId(null);
  }

  function startEdit(source: SignalSource) {
    setEditingId(source.id);
    setSelectedDialog(null);
    setActionError("");
    setNotice(null);
    // The destination list is loaded from the dialogs of the source's account.
    setAccountId(source.accountId);
    setForm({
      name: source.name ?? "",
      backfillLimit: String(source.backfillLimit),
      forwardEnabled: source.forwardEnabled,
      forwardToId: source.forwardToId ?? "",
      templateId: source.templateId ?? "",
    });
  }

  async function handleSave() {
    if (!editingId && !selectedDialog?.sourceId) {
      setActionError("Pick a chat to watch.");
      return;
    }
    if (form.forwardEnabled && !form.forwardToId) {
      setActionError("Pick a destination chat to forward signals to.");
      return;
    }
    setSaving(true);
    setActionError("");
    setNotice(null);
    const payload = {
      name: form.name.trim(),
      backfillLimit: Number(form.backfillLimit) || 200,
      forwardEnabled: form.forwardEnabled,
      forwardToId: form.forwardEnabled ? form.forwardToId || null : null,
      templateId: form.templateId || null,
    };
    try {
      if (editingId) {
        await service.updateSource(editingId, payload);
        setNotice("Watched chat updated.");
      } else {
        await service.createSource({
          ...payload,
          accountId,
          entityId: selectedDialog?.sourceId ?? "",
        });
        setNotice("Watched chat added.");
      }
      resetForm();
      await load();
    } catch (err) {
      setActionError(signalsErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(source: SignalSource) {
    setBusyId(source.id);
    setActionError("");
    try {
      await service.updateSource(source.id, { enabled: !source.enabled });
      await load();
    } catch (err) {
      setActionError(signalsErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleBackfill(source: SignalSource) {
    setBusyId(source.id);
    setActionError("");
    setNotice(null);
    try {
      await service.requestScrape(source.id);
      setNotice("History backfill queued for the worker.");
    } catch (err) {
      setActionError(signalsErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(source: SignalSource) {
    setBusyId(source.id);
    setActionError("");
    try {
      await service.deleteSource(source.id);
      if (editingId === source.id) resetForm();
      setNotice("Watched chat removed.");
      await load();
    } catch (err) {
      setActionError(signalsErrorMessage(err));
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  return (
    <div className="sig-page">
      <header className="tg-header">
        <div className="tg-header-copy">
          <span className="eyebrow">ADMIN</span>
          <h1>Signal Sources</h1>
          <p>
            Choose the Telegram chats to watch. Every message posted there is
            captured as a signal. Backfills are queued for the worker.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary tg-refresh"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Loading…
            </>
          ) : (
            "Refresh"
          )}
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
      {errorMessage && (
        <div className="form-alert" role="alert">
          <b>We couldn’t load the signal sources.</b>
          <span>{errorMessage}</span>
        </div>
      )}
      {actionError && (
        <div className="form-alert" role="alert">
          <b>We couldn’t complete that action.</b>
          <span>{actionError}</span>
        </div>
      )}

      <section className="sig-editor" aria-label="Watched chat editor">
        <h2>{editingId ? "Edit watched chat" : "Add watched chat"}</h2>

        {!editingId && (
          <div className="sig-editor-grid">
            <label className="sig-field">
              <span>Telegram account</span>
              <select
                value={accountId}
                onChange={(event) => {
                  setAccountId(event.target.value);
                  setSelectedDialog(null);
                }}
              >
                {accounts.length === 0 && <option value="">No accounts</option>}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName ??
                      account.username ??
                      account.maskedPhoneNumber ??
                      account.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="sig-field sig-field-grow">
              <span>Chat</span>
              <select
                value={selectedDialog?.sourceId ?? ""}
                onChange={(event) =>
                  setSelectedDialog(
                    dialogs.find(
                      (dialog) => dialog.sourceId === event.target.value,
                    ) ?? null,
                  )
                }
              >
                <option value="">Select a chat…</option>
                {dialogs.map((dialog) => (
                  <option
                    key={dialog.sourceId ?? dialog.peerId}
                    value={dialog.sourceId ?? ""}
                  >
                    {dialog.title ?? dialog.username ?? `Chat ${dialog.peerId}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="sig-editor-grid">
          <label className="sig-field">
            <span>Source name</span>
            <input
              type="text"
              value={form.name}
              placeholder="Optional label"
              onChange={(event) => updateForm({ name: event.target.value })}
            />
          </label>
          <label className="sig-field">
            <span>Backfill limit</span>
            <input
              type="number"
              min={1}
              value={form.backfillLimit}
              onChange={(event) =>
                updateForm({ backfillLimit: event.target.value })
              }
            />
          </label>
        </div>

        <div className="sig-editor-grid">
          <label className="sig-field sig-field-grow">
            <span>Formatting template</span>
            <select
              value={form.templateId}
              onChange={(event) =>
                updateForm({ templateId: event.target.value })
              }
            >
              <option value="">Raw text (no template)</option>
              {templateList.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <span className="sig-hint">
              Applied only to forwarded copies. Manage templates on the Signal
              Templates page.
            </span>
          </label>
        </div>

        <div className="sig-editor-grid">
          <label className="sig-check">
            <input
              type="checkbox"
              checked={form.forwardEnabled}
              onChange={(event) =>
                updateForm({ forwardEnabled: event.target.checked })
              }
            />
            <span>Forward signals to another chat</span>
          </label>
          {form.forwardEnabled && (
            <label className="sig-field sig-field-grow">
              <span>Destination chat</span>
              <select
                value={form.forwardToId}
                onChange={(event) =>
                  updateForm({ forwardToId: event.target.value })
                }
              >
                <option value="">Select a destination chat…</option>
                {form.forwardToId &&
                  !destinations.some(
                    (dialog) => dialog.destinationId === form.forwardToId,
                  ) && (
                    <option value={form.forwardToId}>
                      Current destination
                    </option>
                  )}
                {destinations.map((dialog) => (
                  <option
                    key={dialog.destinationId}
                    value={dialog.destinationId ?? ""}
                  >
                    {dialog.title ?? dialog.username ?? `Chat ${dialog.peerId}`}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="sig-editor-actions">
          <button
            type="button"
            className="button button-primary"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving
              ? "Saving…"
              : editingId
                ? "Save changes"
                : "Add watched chat"}
          </button>
          {editingId && (
            <button
              type="button"
              className="button button-secondary"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="sig-list-section" aria-labelledby="sig-sources-title">
        <div className="tg-list-head">
          <h2 id="sig-sources-title">Watched chats ({sources.length})</h2>
        </div>

        {loading && (
          <div className="tg-loading" role="status">
            Loading signal sources…
          </div>
        )}

        {!loading && sources.length === 0 && (
          <div className="tg-empty">
            <h3>No watched chats yet</h3>
            <p>
              Pick a Telegram account and a chat above to start capturing every
              message posted there.
            </p>
          </div>
        )}

        {!loading && sources.length > 0 && (
          <ul className="sig-source-list">
            {sources.map((source) => (
              <li className="sig-source-card" key={source.id}>
                <div className="sig-source-head">
                  <div>
                    <h3>{source.name || source.chatTitle || "Watched chat"}</h3>
                    <p>
                      {source.chatTitle ? `${source.chatTitle} · ` : ""}
                      {source.accountLabel ?? "Account"}
                    </p>
                  </div>
                  <span
                    className={`tg-status ${
                      source.enabled
                        ? "tg-status-connected"
                        : "tg-status-disconnected"
                    }`}
                  >
                    {source.enabled ? "Enabled" : "Paused"}
                  </span>
                </div>

                <dl className="tg-card-details">
                  <dt>Last signal</dt>
                  <dd>{formatWhen(source.lastSignalAt)}</dd>
                  <dt>Last scrape</dt>
                  <dd>{formatWhen(source.lastScrapedAt)}</dd>
                  <dt>Forward template</dt>
                  <dd>{source.templateName ?? "Raw text"}</dd>
                </dl>

                <div className="tg-card-actions">
                  <button
                    type="button"
                    className="button button-secondary tg-card-button"
                    disabled={busyId === source.id}
                    onClick={() => void handleToggle(source)}
                  >
                    {source.enabled ? "Pause" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="button button-secondary tg-card-button"
                    disabled={busyId === source.id}
                    onClick={() => void handleBackfill(source)}
                  >
                    Backfill
                  </button>
                  <button
                    type="button"
                    className="button button-secondary tg-card-button"
                    onClick={() => startEdit(source)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button button-secondary tg-card-button"
                    disabled={busyId === source.id}
                    onClick={() =>
                      setConfirmId((current) =>
                        current === source.id ? null : source.id,
                      )
                    }
                  >
                    Delete
                  </button>
                </div>

                {confirmId === source.id && (
                  <div className="tg-confirm">
                    <p>Delete this watched chat and its signals?</p>
                    <div className="tg-confirm-actions">
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => setConfirmId(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={busyId === source.id}
                        onClick={() => void handleDelete(source)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { templatesService, templatesErrorMessage } from "../services/templates";
import type {
  Replacement,
  SignalTemplate,
  SignalTemplatePreview,
  TemplatesService,
} from "../services/templates";

interface TemplateForm {
  name: string;
  header: string;
  body: string;
  footer: string;
  stripHeaderLines: string;
  removeUrls: boolean;
  removePatternsText: string;
  replacementsText: string;
  dropEmpty: boolean;
}

const EMPTY_FORM: TemplateForm = {
  name: "",
  header: "",
  body: "{{ text }}",
  footer: "",
  stripHeaderLines: "0",
  removeUrls: false,
  removePatternsText: "",
  replacementsText: "",
  dropEmpty: true,
};

function templateToForm(template: SignalTemplate): TemplateForm {
  return {
    name: template.name,
    header: template.header,
    body: template.body,
    footer: template.footer,
    stripHeaderLines: String(template.stripHeaderLines),
    removeUrls: template.removeUrls,
    removePatternsText: template.removePatterns.join("\n"),
    replacementsText: template.replacements
      .map((item) => `${item.from} => ${item.to}`)
      .join("\n"),
    dropEmpty: template.dropEmpty,
  };
}

function parsePatternLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseReplacementLines(value: string): Replacement[] {
  return value
    .split("\n")
    .map((line) => {
      const index = line.indexOf("=>");
      if (index < 0) return null;
      const from = line.slice(0, index).trim();
      const to = line.slice(index + 2).trim();
      return from ? { from, to } : null;
    })
    .filter((item): item is Replacement => item !== null);
}

const SAMPLE_TEXT = "SPONSOR\nOver 2.5 goals https://example.com";

export function SignalTemplatesView({
  service = templatesService,
}: {
  service?: TemplatesService;
}) {
  const [templates, setTemplates] = useState<SignalTemplate[]>([]);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [sampleText, setSampleText] = useState(SAMPLE_TEXT);
  const [sampleSource, setSampleSource] = useState("Betting tips");
  const [preview, setPreview] = useState<SignalTemplatePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTemplates(await service.listTemplates());
      setErrorMessage("");
    } catch (err) {
      setErrorMessage(templatesErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateForm(patch: Partial<TemplateForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setPreview(null);
  }

  function startEdit(template: SignalTemplate) {
    setEditingId(template.id);
    setForm(templateToForm(template));
    setActionError("");
    setNotice(null);
    setPreview(null);
  }

  function formPayload() {
    return {
      name: form.name.trim(),
      header: form.header,
      body: form.body,
      footer: form.footer,
      stripHeaderLines: Number(form.stripHeaderLines) || 0,
      removeUrls: form.removeUrls,
      removePatterns: parsePatternLines(form.removePatternsText),
      replacements: parseReplacementLines(form.replacementsText),
      dropEmpty: form.dropEmpty,
    };
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setActionError("Give the template a name.");
      return;
    }
    setSaving(true);
    setActionError("");
    setNotice(null);
    try {
      if (editingId) {
        await service.updateTemplate(editingId, formPayload());
        setNotice("Template updated. Existing sources use the new rules.");
      } else {
        await service.createTemplate(formPayload());
        setNotice("Template created. Assign it to a watched chat to use it.");
      }
      resetForm();
      await load();
    } catch (err) {
      setActionError(templatesErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setActionError("");
    try {
      setPreview(
        await service.previewTemplate({
          ...formPayload(),
          text: sampleText,
          source: sampleSource,
        }),
      );
    } catch (err) {
      setPreview(null);
      setActionError(templatesErrorMessage(err));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleDelete(template: SignalTemplate) {
    setBusyId(template.id);
    setActionError("");
    try {
      await service.deleteTemplate(template.id);
      if (editingId === template.id) resetForm();
      setNotice("Template deleted. Sources using it now forward raw text.");
      await load();
    } catch (err) {
      setActionError(templatesErrorMessage(err));
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
          <h1>Signal Templates</h1>
          <p>
            Build reusable formatting rules for forwarded signals. Remove
            headers and links, replace text, and wrap the message in your own
            layout. The stored feed always keeps the original message.
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
          <b>We couldn’t load the signal templates.</b>
          <span>{errorMessage}</span>
        </div>
      )}
      {actionError && (
        <div className="form-alert" role="alert">
          <b>We couldn’t complete that action.</b>
          <span>{actionError}</span>
        </div>
      )}

      <section className="sig-editor" aria-label="Signal template editor">
        <h2>{editingId ? "Edit template" : "New template"}</h2>

        <div className="sig-editor-grid">
          <label className="sig-field sig-field-grow">
            <span>Template name</span>
            <input
              type="text"
              value={form.name}
              placeholder="e.g. Clean football tips"
              onChange={(event) => updateForm({ name: event.target.value })}
            />
          </label>
          <label className="sig-field">
            <span>Strip first N lines</span>
            <input
              type="number"
              min={0}
              max={50}
              value={form.stripHeaderLines}
              onChange={(event) =>
                updateForm({ stripHeaderLines: event.target.value })
              }
            />
          </label>
        </div>

        <div className="sig-editor-grid">
          <label className="sig-check">
            <input
              type="checkbox"
              checked={form.removeUrls}
              onChange={(event) =>
                updateForm({ removeUrls: event.target.checked })
              }
            />
            <span>Remove URLs</span>
          </label>
          <label className="sig-check">
            <input
              type="checkbox"
              checked={form.dropEmpty}
              onChange={(event) =>
                updateForm({ dropEmpty: event.target.checked })
              }
            />
            <span>Skip empty results</span>
          </label>
        </div>

        <div className="sig-editor-grid">
          <label className="sig-field sig-field-grow">
            <span>Remove regex matches (one per line)</span>
            <textarea
              rows={3}
              value={form.removePatternsText}
              placeholder="SPONSOR|ADVERTISEMENT"
              onChange={(event) =>
                updateForm({ removePatternsText: event.target.value })
              }
            />
          </label>
          <label className="sig-field sig-field-grow">
            <span>Replacements (one per line: find =&gt; replace)</span>
            <textarea
              rows={3}
              value={form.replacementsText}
              placeholder="2.5 => 2.75"
              onChange={(event) =>
                updateForm({ replacementsText: event.target.value })
              }
            />
          </label>
        </div>

        <label className="sig-field">
          <span>Header (prepended)</span>
          <textarea
            rows={2}
            value={form.header}
            placeholder="PRIME EDGE"
            onChange={(event) => updateForm({ header: event.target.value })}
          />
        </label>

        <label className="sig-field">
          <span>Body template</span>
          <textarea
            rows={5}
            value={form.body}
            onChange={(event) => updateForm({ body: event.target.value })}
          />
          <span className="sig-hint">
            Leave <code>{"{{ text }}"}</code> to keep the cleaned message.
            Available: <code>{"{{ text }}"}</code>,{" "}
            <code>{"{{ source }}"}</code>, <code>{"{{ account }}"}</code>,{" "}
            <code>{"{{ author }}"}</code>, <code>{"{{ sent_at }}"}</code>,{" "}
            <code>{"{{ date }}"}</code>, <code>{"{{ message_id }}"}</code>,{" "}
            <code>{"{{ peer_id }}"}</code>.
          </span>
        </label>

        <label className="sig-field">
          <span>Footer (appended)</span>
          <textarea
            rows={2}
            value={form.footer}
            placeholder="— verified"
            onChange={(event) => updateForm({ footer: event.target.value })}
          />
        </label>

        <div className="sig-preview">
          <h3>Try it out</h3>
          <div className="sig-editor-grid">
            <label className="sig-field sig-field-grow">
              <span>Sample text</span>
              <textarea
                rows={4}
                value={sampleText}
                onChange={(event) => setSampleText(event.target.value)}
              />
            </label>
            <label className="sig-field">
              <span>Source label</span>
              <input
                type="text"
                value={sampleSource}
                onChange={(event) => setSampleSource(event.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="button button-secondary"
            disabled={previewing}
            onClick={() => void handlePreview()}
          >
            {previewing ? "Rendering…" : "Preview"}
          </button>
          {preview && (
            <div className="sig-preview-result" aria-live="polite">
              {preview.skipped ? (
                <p className="sig-preview-skipped">
                  This signal would be skipped — nothing would be forwarded.
                </p>
              ) : (
                <pre className="sig-preview-text">{preview.formatted}</pre>
              )}
            </div>
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
                : "Create template"}
          </button>
          {(editingId || form.name || form.body !== EMPTY_FORM.body) && (
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

      <section
        className="sig-list-section"
        aria-labelledby="sig-templates-title"
      >
        <div className="tg-list-head">
          <h2 id="sig-templates-title">Templates ({templates.length})</h2>
        </div>

        {loading && (
          <div className="tg-loading" role="status">
            Loading signal templates…
          </div>
        )}

        {!loading && templates.length === 0 && (
          <div className="tg-empty">
            <h3>No templates yet</h3>
            <p>
              Create a template above, then assign it to a watched chat. Without
              a template, forwarded messages contain the raw signal text.
            </p>
          </div>
        )}

        {!loading && templates.length > 0 && (
          <ul className="sig-source-list">
            {templates.map((template) => (
              <li className="sig-source-card" key={template.id}>
                <div className="sig-source-head">
                  <div>
                    <h3>{template.name}</h3>
                    <p>{templateSummary(template)}</p>
                  </div>
                  {template.body && (
                    <span className="tg-status tg-status-connected">
                      Custom body
                    </span>
                  )}
                </div>
                {template.header || template.footer || template.body ? (
                  <pre className="sig-template-excerpt">
                    {[
                      template.header,
                      template.body || "{{ text }}",
                      template.footer,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </pre>
                ) : null}
                <div className="tg-card-actions">
                  <button
                    type="button"
                    className="button button-secondary tg-card-button"
                    onClick={() => startEdit(template)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="button button-secondary tg-card-button"
                    disabled={busyId === template.id}
                    onClick={() =>
                      setConfirmId((current) =>
                        current === template.id ? null : template.id,
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
                {confirmId === template.id && (
                  <div className="tg-confirm">
                    <p>
                      Delete this template? Sources using it will forward raw
                      text until you assign another one.
                    </p>
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
                        disabled={busyId === template.id}
                        onClick={() => void handleDelete(template)}
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

function templateSummary(template: SignalTemplate): string {
  const parts: string[] = [];
  if (template.stripHeaderLines > 0)
    parts.push(
      `strip ${template.stripHeaderLines} line${template.stripHeaderLines === 1 ? "" : "s"}`,
    );
  if (template.removeUrls) parts.push("remove URLs");
  if (template.removePatterns.length)
    parts.push(
      `${template.removePatterns.length} regex rule${template.removePatterns.length === 1 ? "" : "s"}`,
    );
  if (template.replacements.length)
    parts.push(
      `${template.replacements.length} replacement${template.replacements.length === 1 ? "" : "s"}`,
    );
  if (template.header) parts.push("header");
  if (template.footer) parts.push("footer");
  if (template.dropEmpty) parts.push("skip empty");
  return parts.length ? parts.join(" · ") : "Raw text, trimmed";
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createTemplatesService,
  templatesErrorMessage,
} from "../src/services/templates";
import type {
  SignalTemplate,
  TemplatesService,
} from "../src/services/templates";
import { SignalTemplatesView } from "../src/views/SignalTemplatesView";
import { ApiError, clearTokens, setTokens } from "../src/services/api";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => headers[key.toLowerCase()] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function envelope(data: unknown, status = 200) {
  return jsonResponse(status, { success: true, data, message: null });
}

const templatePayload = {
  id: "66666666-6666-6666-6666-666666666666",
  tenant: "11111111-1111-1111-1111-111111111111",
  name: "Clean tips",
  body: "{{ text }}",
  header: "PRIME EDGE",
  footer: "— verified",
  strip_header_lines: 2,
  remove_urls: true,
  remove_patterns: ["SPONSOR", "AD"],
  replacements: [{ from: "2.5", to: "2.75" }],
  drop_empty: true,
  created_at: "2026-01-01T09:00:00.000Z",
  updated_at: "2026-01-02T09:00:00.000Z",
};

function template(overrides: Partial<SignalTemplate> = {}): SignalTemplate {
  return {
    id: "tpl-1",
    tenantId: "tenant-1",
    name: "Clean tips",
    body: "{{ text }}",
    header: "PRIME EDGE",
    footer: "",
    stripHeaderLines: 2,
    removeUrls: true,
    removePatterns: ["SPONSOR"],
    replacements: [{ from: "2.5", to: "2.75" }],
    dropEmpty: true,
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-02T09:00:00.000Z",
    ...overrides,
  };
}

function fakeService(
  overrides: Partial<TemplatesService> = {},
): TemplatesService {
  return {
    listTemplates: vi.fn().mockResolvedValue([template()]),
    createTemplate: vi.fn().mockResolvedValue(template()),
    updateTemplate: vi.fn().mockResolvedValue(template()),
    deleteTemplate: vi.fn().mockResolvedValue(undefined),
    previewTemplate: vi.fn().mockResolvedValue({
      formatted: "PRIME EDGE\nOver 2.75 goals",
      skipped: false,
    }),
    ...overrides,
  } as TemplatesService;
}

describe("templates api adapter", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const service = createTemplatesService();

  beforeEach(() => {
    vi.stubEnv(
      "NEXT_PUBLIC_TELEGRAM_API_BASE_URL",
      "https://api.example.test/api/v1/",
    );
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    clearTokens();
  });
  afterEach(() => {
    clearTokens();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lists templates from the paginated payload", async () => {
    setTokens({ access: "test-access" });
    fetchMock.mockResolvedValue(
      envelope({
        count: 1,
        next: null,
        previous: null,
        results: [templatePayload],
      }),
    );
    const templates = await service.listTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      id: "66666666-6666-6666-6666-666666666666",
      name: "Clean tips",
      body: "{{ text }}",
      header: "PRIME EDGE",
      footer: "— verified",
      stripHeaderLines: 2,
      removeUrls: true,
      removePatterns: ["SPONSOR", "AD"],
      replacements: [{ from: "2.5", to: "2.75" }],
      dropEmpty: true,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/signal-templates/");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-access",
    );
  });

  it("creates and updates templates with backend field names", async () => {
    fetchMock
      .mockResolvedValueOnce(envelope(templatePayload, 201))
      .mockResolvedValueOnce(envelope(templatePayload));
    await service.createTemplate({
      name: "Clean tips",
      body: "{{ text }}",
      stripHeaderLines: 2,
      removeUrls: true,
      removePatterns: ["SPONSOR"],
      replacements: [{ from: "2.5", to: "2.75" }],
      dropEmpty: true,
    });
    await service.updateTemplate("66666666-6666-6666-6666-666666666666", {
      header: "PRIME EDGE",
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/api/v1/signal-templates/",
    );
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(
      JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)),
    ).toEqual({
      name: "Clean tips",
      body: "{{ text }}",
      strip_header_lines: 2,
      remove_urls: true,
      remove_patterns: ["SPONSOR"],
      replacements: [{ from: "2.5", to: "2.75" }],
      drop_empty: true,
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.example.test/api/v1/signal-templates/66666666-6666-6666-6666-666666666666/",
    );
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("PATCH");
    expect(
      JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body)),
    ).toEqual({
      header: "PRIME EDGE",
    });
  });

  it("previews a template and deletes by id", async () => {
    fetchMock
      .mockResolvedValueOnce(
        envelope({ formatted: "Over 2.75 goals", skipped: false }),
      )
      .mockResolvedValueOnce(envelope({ message: "Signal template deleted" }));
    const preview = await service.previewTemplate({
      body: "{{ text }}",
      text: "Over 2.5 goals",
      source: "Tips",
      sentAt: "2026-01-02T10:00:00Z",
      messageId: "42",
    });
    expect(preview).toEqual({ formatted: "Over 2.75 goals", skipped: false });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.example.test/api/v1/signal-templates/preview/",
    );
    expect(
      JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body)),
    ).toEqual({
      body: "{{ text }}",
      text: "Over 2.5 goals",
      source: "Tips",
      sent_at: "2026-01-02T10:00:00Z",
      message_id: "42",
    });

    await service.deleteTemplate("66666666-6666-6666-6666-666666666666");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("DELETE");
  });

  it("maps a forbidden response and field errors", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        success: false,
        data: null,
        message: "This action requires workspace administrator rights.",
        error: { code: "permission_denied", details: null },
      }),
    );
    await expect(service.listTemplates()).rejects.toMatchObject({
      code: "forbidden",
    });
    expect(
      templatesErrorMessage(new ApiError({ code: "forbidden", message: "no" })),
    ).toBe("Only workspace administrators can manage signal templates.");
  });
});

describe("signal templates administration", () => {
  afterEach(cleanup);

  it("lists templates with a readable settings summary", async () => {
    render(<SignalTemplatesView service={fakeService()} />);
    await waitFor(() => expect(screen.getByText("Templates (1)")).toBeTruthy());
    expect(screen.getByRole("heading", { name: "Clean tips" })).toBeTruthy();
    expect(
      screen.getByText(
        /strip 2 lines · remove URLs · 1 regex rule · 1 replacement · header · skip empty/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Custom body")).toBeTruthy();
  });

  it("creates a template with parsed regex and replacement rules", async () => {
    const service = fakeService({
      listTemplates: vi.fn().mockResolvedValue([]),
    });
    render(<SignalTemplatesView service={service} />);
    await waitFor(() => expect(service.listTemplates).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText("Template name"), "Desk format");
    await userEvent.type(
      screen.getByLabelText("Remove regex matches (one per line)"),
      "SPONSOR\nADVERTISEMENT",
    );
    await userEvent.type(
      screen.getByLabelText(/Replacements/),
      "2.5 => 2.75\n",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Create template" }),
    );

    await waitFor(() => expect(service.createTemplate).toHaveBeenCalled());
    expect(service.createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Desk format",
        removePatterns: ["SPONSOR", "ADVERTISEMENT"],
        replacements: [{ from: "2.5", to: "2.75" }],
        stripHeaderLines: 0,
        dropEmpty: true,
      }),
    );
  });

  it("previews the current form against sample text", async () => {
    const service = fakeService();
    render(<SignalTemplatesView service={service} />);
    await waitFor(() => expect(screen.getByText("Templates (1)")).toBeTruthy());

    await userEvent.type(screen.getByLabelText("Sample text"), " Over 2.5");
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));

    await waitFor(() =>
      expect(document.querySelector(".sig-preview-text")?.textContent).toBe(
        "PRIME EDGE\nOver 2.75 goals",
      ),
    );
    expect(service.previewTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "SPONSOR\nOver 2.5 goals https://example.com Over 2.5",
        source: "Betting tips",
      }),
    );
  });

  it("explains when a preview would be skipped", async () => {
    const service = fakeService({
      previewTemplate: vi
        .fn()
        .mockResolvedValue({ formatted: "", skipped: true }),
    });
    render(<SignalTemplatesView service={service} />);
    await waitFor(() => expect(screen.getByText("Templates (1)")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Preview" }));
    await waitFor(() =>
      expect(screen.getByText(/would be skipped/)).toBeTruthy(),
    );
  });

  it("loads a template into the form and deletes it after confirmation", async () => {
    const service = fakeService();
    render(<SignalTemplatesView service={service} />);
    await waitFor(() => expect(screen.getByText("Templates (1)")).toBeTruthy());

    const card = screen
      .getByRole("heading", { name: "Clean tips" })
      .closest("li");
    expect(card).not.toBeNull();
    await userEvent.click(within(card!).getByRole("button", { name: "Edit" }));
    expect(
      (screen.getByLabelText("Template name") as HTMLInputElement).value,
    ).toBe("Clean tips");
    expect(
      (
        screen.getByLabelText(
          "Remove regex matches (one per line)",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("SPONSOR");

    await userEvent.click(
      within(card!).getByRole("button", { name: "Delete" }),
    );
    const confirm = within(card!)
      .getByText(/Delete this template/)
      .closest("div");
    await userEvent.click(
      within(confirm!).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(service.deleteTemplate).toHaveBeenCalledWith("tpl-1"),
    );
  });
});

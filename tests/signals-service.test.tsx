import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSignalsService } from "../src/services/signals";
import { clearTokens, setTokens } from "../src/services/api";

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

const signalPayload = {
  id: "44444444-4444-4444-4444-444444444444",
  account: 7,
  account_label: "Analyst",
  source: 9,
  source_name: "Betting tips",
  chat_id: -1001234567890,
  message_id: 512,
  text: "Over 2.5 goals confirmed",
  author: "Tipster",
  author_id: 42,
  matched_terms: ["over 2.5"],
  sent_at: "2026-01-02T10:00:00.000Z",
  created_at: "2026-01-02T10:00:05.000Z",
};

const sourcePayload = {
  id: "55555555-5555-5555-5555-555555555555",
  account: 7,
  account_label: "Analyst",
  entity: 3,
  chat_title: "Betting tips",
  chat_username: "tips",
  peer_id: -1001234567890,
  name: "Betting tips",
  enabled: true,
  rules: {
    keywords: ["over 2.5"],
    blocked_phrases: ["spoiler"],
    min_length: 10,
    case_sensitive: false,
  },
  backfill_limit: 200,
  last_scraped_at: null,
  last_signal_at: "2026-01-02T10:00:00.000Z",
  created_at: "2026-01-01T09:00:00.000Z",
};

let fetchMock: ReturnType<typeof vi.fn>;
const service = createSignalsService();

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

describe("signals api adapter", () => {
  it("lists signals with filters and parses the paginated payload", async () => {
    setTokens({ access: "test-access" });
    fetchMock.mockResolvedValue(
      envelope({
        count: 42,
        next: "https://api.example.test/api/v1/signals/?page=2",
        previous: null,
        results: [signalPayload],
      }),
    );
    const page = await service.listSignals({
      q: "over",
      source: "9",
      account: "7",
      since: "2026-01-01T00:00:00.000Z",
      page: 1,
      pageSize: 20,
    });
    expect(page.count).toBe(42);
    expect(page.hasNext).toBe(true);
    expect(page.hasPrevious).toBe(false);
    expect(page.results[0]).toMatchObject({
      text: "Over 2.5 goals confirmed",
      sourceName: "Betting tips",
      accountLabel: "Analyst",
      matchedTerms: ["over 2.5"],
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://api.example.test/api/v1/signals/?");
    expect(url).toContain("q=over");
    expect(url).toContain("source=9");
    expect(url).toContain("account=7");
    expect(url).toContain("page=1");
    expect(url).toContain("page_size=20");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-access",
    );
  });

  it("reads the signal summary", async () => {
    fetchMock.mockResolvedValue(
      envelope({
        total: 12,
        last_24h: 4,
        active_sources: 3,
        by_source: [{ source_id: "9", name: "Betting tips", count: 12 }],
        by_account: [{ account_id: "7", name: "Analyst", count: 12 }],
      }),
    );
    const stats = await service.getStats();
    expect(stats).toMatchObject({ total: 12, last24h: 4, activeSources: 3 });
    expect(stats.bySource[0]).toMatchObject({ id: "9", name: "Betting tips" });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/signals/stats/");
  });

  it("creates a source with the backend field names", async () => {
    fetchMock.mockResolvedValue(envelope(sourcePayload, 201));
    const source = await service.createSource({
      accountId: "7",
      entityId: "3",
      name: "Betting tips",
      keywords: ["over 2.5"],
      blockedPhrases: ["spoiler"],
      minLength: 10,
      caseSensitive: false,
      backfillLimit: 200,
    });
    expect(source).toMatchObject({
      id: "55555555-5555-5555-5555-555555555555",
      accountId: "7",
      entityId: "3",
      enabled: true,
      backfillLimit: 200,
    });
    expect(source.rules).toEqual({
      keywords: ["over 2.5"],
      blockedPhrases: ["spoiler"],
      minLength: 10,
      caseSensitive: false,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/signal-sources/");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      account: "7",
      entity: "3",
      name: "Betting tips",
      backfill_limit: 200,
      rules: {
        keywords: ["over 2.5"],
        blocked_phrases: ["spoiler"],
        min_length: 10,
        case_sensitive: false,
      },
    });
  });

  it("lists sources from the paginated payload", async () => {
    fetchMock.mockResolvedValue(
      envelope({
        count: 1,
        next: null,
        previous: null,
        results: [sourcePayload],
      }),
    );
    const sources = await service.listSources();
    expect(sources).toHaveLength(1);
    expect(sources[0].rules.keywords).toEqual(["over 2.5"]);
  });

  it("updates, queues a backfill and deletes a source", async () => {
    fetchMock
      .mockResolvedValueOnce(envelope(sourcePayload))
      .mockResolvedValueOnce(envelope({ queued: true }, 202))
      .mockResolvedValueOnce(envelope({ message: "Signal source deleted" }));
    await service.updateSource("55555555-5555-5555-5555-555555555555", {
      enabled: false,
    });
    await service.requestScrape("55555555-5555-5555-5555-555555555555");
    await service.deleteSource("55555555-5555-5555-5555-555555555555");
    const [updateUrl, updateInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(updateUrl).toBe(
      "https://api.example.test/api/v1/signal-sources/55555555-5555-5555-5555-555555555555/",
    );
    expect(updateInit.method).toBe("PATCH");
    expect(JSON.parse(String(updateInit.body))).toEqual({ enabled: false });
    const [scrapeUrl, scrapeInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(scrapeUrl).toBe(
      "https://api.example.test/api/v1/signal-sources/55555555-5555-5555-5555-555555555555/scrape/",
    );
    expect(scrapeInit.method).toBe("POST");
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[2] as [
      string,
      RequestInit,
    ];
    expect(deleteInit.method).toBe("DELETE");
    expect(deleteUrl).toContain("/signal-sources/");
  });

  it("maps a forbidden response for non administrators", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        success: false,
        data: null,
        message: "This action is restricted to super administrators.",
        error: { code: "permission_denied", details: null },
      }),
    );
    await expect(service.listSources()).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

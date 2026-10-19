import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TelegramApiError,
  createTelegramService,
  maskTelegramPhone,
  normalizeTelegramPhone,
} from "../src/services/telegram";
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

function errorEnvelope(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return jsonResponse(status, {
    success: false,
    data: null,
    message,
    error: { code, details: details ?? null },
  });
}

const challenge = {
  challenge_id: "11111111-1111-1111-1111-111111111111",
  status: "code_sent",
  expires_at: "2026-01-02T10:05:00.000Z",
};

const accountPayload = {
  id: "22222222-2222-2222-2222-222222222222",
  phone_masked: "+•••••••••0123",
  telegram_user_id: 1001,
  display_name: "Test Analyst",
  username: "analyst",
  status: "connected",
  last_connected_at: null,
  last_activity_at: null,
  last_error: "",
  created_at: "2026-01-01T10:00:00.000Z",
};

let fetchMock: ReturnType<typeof vi.fn>;
const service = createTelegramService();

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

describe("telegram api adapter", () => {
  it("fails honestly when the backend url is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_TELEGRAM_API_BASE_URL", "");
    await expect(service.listAccounts()).rejects.toMatchObject({
      code: "unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts a challenge with a normalized phone number and bearer auth", async () => {
    setTokens({ access: "test-access" });
    fetchMock.mockResolvedValue(envelope(challenge, 202));
    const result = await service.startConnection({
      phoneNumber: "+447700900123",
    });
    expect(result).toMatchObject({
      challengeId: challenge.challenge_id,
      status: "code_sent",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/telegram/auth/start");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(JSON.parse(String(init.body))).toEqual({
      phone_number: "+447700900123",
    });
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-access",
    );
  });

  it("sends codes and passwords to the challenge endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce(envelope({ ...challenge, status: "complete" }))
      .mockResolvedValueOnce(envelope({ ...challenge, status: "complete" }));
    await service.verifyCode(challenge.challenge_id, "12345");
    await service.verifyPassword(challenge.challenge_id, "cloud-password");
    const first = fetchMock.mock.calls[0] as [string, RequestInit];
    const second = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(first[0]).toBe(
      "https://api.example.test/api/v1/telegram/auth/verify",
    );
    expect(JSON.parse(String(first[1].body))).toEqual({
      challenge_id: challenge.challenge_id,
      code: "12345",
    });
    expect(second[0]).toBe("https://api.example.test/api/v1/telegram/auth/2fa");
    expect(JSON.parse(String(second[1].body))).toEqual({
      challenge_id: challenge.challenge_id,
      password: "cloud-password",
    });
  });

  it("unwraps the paginated account envelope", async () => {
    fetchMock.mockResolvedValue(
      envelope({
        count: 1,
        next: null,
        previous: null,
        results: [accountPayload],
      }),
    );
    expect(await service.listAccounts()).toEqual([
      {
        id: accountPayload.id,
        maskedPhoneNumber: accountPayload.phone_masked,
        telegramUserId: "1001",
        displayName: "Test Analyst",
        username: "analyst",
        status: "connected",
        lastConnectedAt: null,
        lastActivityAt: null,
        lastError: "",
        createdAt: accountPayload.created_at,
      },
    ]);
  });

  it("maps backend error envelopes to typed errors", async () => {
    fetchMock.mockResolvedValueOnce(
      errorEnvelope(400, "invalid", "Request validation failed", {
        phone_number: ["Use an E.164 phone number such as +15551234567"],
      }),
    );
    await expect(
      service.startConnection({ phoneNumber: "+1" }),
    ).rejects.toMatchObject({
      code: "validation",
      message: "Use an E.164 phone number such as +15551234567",
    });
    fetchMock.mockResolvedValueOnce(
      errorEnvelope(
        429,
        "throttled",
        "Request was throttled. Expected available in 42 seconds.",
      ),
    );
    await expect(
      service.startConnection({ phoneNumber: "+447700900123" }),
    ).rejects.toMatchObject({ code: "flood-wait", retryAfterSeconds: 42 });
    fetchMock.mockResolvedValueOnce(
      errorEnvelope(
        401,
        "not_authenticated",
        "Authentication credentials were not provided.",
      ),
    );
    await expect(service.listAccounts()).rejects.toMatchObject({
      code: "unauthorized",
    });
    fetchMock.mockResolvedValueOnce(
      errorEnvelope(404, "not_found", "Not found"),
    );
    await expect(service.getAccount("missing")).rejects.toMatchObject({
      code: "not-found",
    });
    fetchMock.mockResolvedValueOnce(
      errorEnvelope(500, "INTERNAL_ERROR", "Internal server error"),
    );
    await expect(service.listAccounts()).rejects.toMatchObject({
      code: "server",
    });
  });

  it("rejects malformed challenge payloads instead of trusting them", async () => {
    fetchMock.mockResolvedValueOnce(envelope({ nope: true }, 202));
    await expect(
      service.startConnection({ phoneNumber: "+447700900123" }),
    ).rejects.toBeInstanceOf(TelegramApiError);
  });

  it("distinguishes timeouts from network failures", async () => {
    fetchMock.mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    await expect(service.listAccounts()).rejects.toMatchObject({
      code: "timeout",
    });
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(service.listAccounts()).rejects.toMatchObject({
      code: "network",
    });
  });
});

describe("phone helpers", () => {
  it("normalizes international numbers and rejects ambiguous ones", () => {
    expect(normalizeTelegramPhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizeTelegramPhone("+1 (555) 010-9999")).toBe("+15550109999");
    expect(normalizeTelegramPhone("07700900123")).toBe(null);
    expect(normalizeTelegramPhone("12345")).toBe(null);
  });

  it("masks numbers for display", () => {
    expect(maskTelegramPhone("+447700900123")).toBe("+447 •••• 23");
  });
});

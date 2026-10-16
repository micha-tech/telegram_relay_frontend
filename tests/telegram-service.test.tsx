import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TelegramApiError,
  createTelegramService,
  maskTelegramPhone,
  normalizeTelegramPhone,
} from "../src/services/telegram";

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
  } as unknown as Response;
}

const connectionPayload = {
  connectionId: "cn_1",
  nextStep: "code",
  expiresAt: "2026-01-02T10:05:00.000Z",
  retryAfterSeconds: 30,
};

let fetchMock: ReturnType<typeof vi.fn>;
const service = createTelegramService();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TELEGRAM_API_BASE_URL", "https://api.example.test/");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
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

  it("starts a connection with the normalized phone number and cookie credentials", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, connectionPayload));
    const result = await service.startConnection({
      phoneNumber: "+447700900123",
    });
    expect(result).toMatchObject({ connectionId: "cn_1", nextStep: "code" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/telegram/connections");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(String(init.body))).toEqual({
      phoneNumber: "+447700900123",
    });
    expect((init.headers as Record<string, string>)["X-Requested-With"]).toBe(
      "XMLHttpRequest",
    );
  });

  it("sends codes and passwords to the connection endpoints", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ...connectionPayload, nextStep: "completed" }),
    );
    await service.verifyCode("cn_1", "12345");
    await service.verifyPassword("cn_1", "cloud-password");
    const first = fetchMock.mock.calls[0] as [string, RequestInit];
    const second = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(first[0]).toBe(
      "https://api.example.test/api/v1/telegram/connections/cn_1/verify-code",
    );
    expect(JSON.parse(String(first[1].body))).toEqual({ code: "12345" });
    expect(second[0]).toBe(
      "https://api.example.test/api/v1/telegram/connections/cn_1/verify-password",
    );
    expect(JSON.parse(String(second[1].body))).toEqual({
      password: "cloud-password",
    });
  });

  it("lists accounts from either an envelope or a bare array", async () => {
    const record = {
      id: "acc_1",
      telegramUserId: "1001",
      username: "analyst",
      displayName: "Test Analyst",
      maskedPhoneNumber: "+44 •••• 23",
      status: "connected",
      lastConnectedAt: null,
      lastActivityAt: null,
      lastError: null,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { accounts: [record] }));
    expect(await service.listAccounts()).toEqual([record]);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, [record]));
    expect(await service.listAccounts()).toEqual([record]);
  });

  it("maps wire error codes and retry hints", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        error: { code: "invalid_code", message: "Bad code" },
      }),
    );
    await expect(service.verifyCode("cn_1", "00000")).rejects.toMatchObject({
      code: "invalid-code",
      message: "Bad code",
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, {
        error: { code: "flood_wait", message: "Slow down" },
      }),
    );
    await expect(service.sendCode("cn_1")).rejects.toMatchObject({
      code: "flood-wait",
    });
  });

  it("uses the Retry-After header and falls back to status codes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(429, { message: "Too many" }, { "retry-after": "45" }),
    );
    await expect(service.sendCode("cn_1")).rejects.toMatchObject({
      code: "flood-wait",
      retryAfterSeconds: 45,
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(401, null));
    await expect(service.listAccounts()).rejects.toMatchObject({
      code: "unauthorized",
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(410, null));
    await expect(service.getConnection("cn_1")).rejects.toMatchObject({
      code: "expired",
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(503, null));
    await expect(service.listAccounts()).rejects.toMatchObject({
      code: "server",
    });
  });

  it("rejects malformed connection payloads instead of trusting them", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { nope: true }));
    await expect(
      service.startConnection({ phoneNumber: "+1" }),
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

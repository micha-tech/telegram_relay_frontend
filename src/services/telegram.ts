// Implement this boundary with the real Python/Telethon backend contract.
// Requests reuse the website session cookie; no Telegram credentials or
// session strings ever reach the browser.

export type TelegramAccountStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "reconnecting"
  | "requires_attention"
  | "unknown";

export type TelegramAuthStep =
  | "phone"
  | "code"
  | "password"
  | "connecting"
  | "completed"
  | "expired"
  | "failed";

export interface TelegramAccount {
  id: string;
  telegramUserId: string;
  username: string | null;
  displayName: string | null;
  maskedPhoneNumber: string | null;
  status: TelegramAccountStatus;
  lastConnectedAt: string | null;
  lastActivityAt: string | null;
  lastError: string | null;
}

export interface TelegramConnection {
  connectionId: string;
  nextStep: TelegramAuthStep;
  expiresAt: string | null;
  retryAfterSeconds?: number;
  message?: string;
  account?: TelegramAccount;
}

export interface TelegramAccountHealth {
  accountId: string;
  status: TelegramAccountStatus;
  lastCheckedAt: string | null;
  message: string | null;
}

export type TelegramErrorCode =
  | "unavailable"
  | "network"
  | "timeout"
  | "validation"
  | "invalid-phone"
  | "invalid-code"
  | "code-expired"
  | "incorrect-password"
  | "password-required"
  | "flood-wait"
  | "expired"
  | "unauthorized"
  | "not-found"
  | "server";

export class TelegramApiError extends Error {
  constructor(
    public code: TelegramErrorCode,
    message: string,
    public retryAfterSeconds?: number,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "TelegramApiError";
  }
}

export interface TelegramService {
  startConnection(input: { phoneNumber: string }): Promise<TelegramConnection>;
  sendCode(connectionId: string): Promise<TelegramConnection>;
  verifyCode(connectionId: string, code: string): Promise<TelegramConnection>;
  verifyPassword(
    connectionId: string,
    password: string,
  ): Promise<TelegramConnection>;
  getConnection(connectionId: string): Promise<TelegramConnection>;
  listAccounts(): Promise<TelegramAccount[]>;
  getAccount(accountId: string): Promise<TelegramAccount>;
  reconnectAccount(accountId: string): Promise<TelegramConnection>;
  disconnectAccount(accountId: string): Promise<void>;
  getAccountHealth(accountId: string): Promise<TelegramAccountHealth>;
}

const REQUEST_TIMEOUT_MS = 15000;
const ACCOUNT_STATUSES: TelegramAccountStatus[] = [
  "connected",
  "connecting",
  "disconnected",
  "reconnecting",
  "requires_attention",
  "unknown",
];
const AUTH_STEPS: TelegramAuthStep[] = [
  "phone",
  "code",
  "password",
  "connecting",
  "completed",
  "expired",
  "failed",
];

export function telegramApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_API_BASE_URL;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : null;
}

export function normalizeTelegramPhone(value: string): string | null {
  const cleaned = value.trim().replace(/[\s\-().]/g, "");
  if (!/^\+\d{7,15}$/.test(cleaned)) return null;
  return cleaned;
}

export function maskTelegramPhone(value: string): string {
  const plus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return `${plus ? "+" : ""}${"•".repeat(2)}`;
  return `${plus ? "+" : ""}${digits.slice(0, 3)} •••• ${digits.slice(-2)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readOptionalNumber(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseAccountStatus(value: unknown): TelegramAccountStatus {
  return typeof value === "string" &&
    ACCOUNT_STATUSES.includes(value as TelegramAccountStatus)
    ? (value as TelegramAccountStatus)
    : "unknown";
}

function parseAuthStep(value: unknown): TelegramAuthStep | null {
  return typeof value === "string" &&
    AUTH_STEPS.includes(value as TelegramAuthStep)
    ? (value as TelegramAuthStep)
    : null;
}

function parseAccount(value: unknown): TelegramAccount {
  const record = asRecord(value);
  if (!record || typeof record.id !== "string")
    throw new TelegramApiError(
      "server",
      "The Telegram service returned an unexpected account response.",
    );
  return {
    id: record.id,
    telegramUserId: readString(record, "telegramUserId") ?? record.id,
    username: readString(record, "username"),
    displayName: readString(record, "displayName"),
    maskedPhoneNumber: readString(record, "maskedPhoneNumber"),
    status: parseAccountStatus(record.status),
    lastConnectedAt: readString(record, "lastConnectedAt"),
    lastActivityAt: readString(record, "lastActivityAt"),
    lastError: readString(record, "lastError"),
  };
}

function parseConnection(value: unknown): TelegramConnection {
  const record = asRecord(value);
  const nextStep = record ? parseAuthStep(record.nextStep) : null;
  if (!record || typeof record.connectionId !== "string" || !nextStep)
    throw new TelegramApiError(
      "server",
      "The Telegram service returned an unexpected connection response.",
    );
  const connection: TelegramConnection = {
    connectionId: record.connectionId,
    nextStep,
    expiresAt: readString(record, "expiresAt"),
  };
  const retryAfterSeconds = readOptionalNumber(record, "retryAfterSeconds");
  if (retryAfterSeconds !== undefined)
    connection.retryAfterSeconds = retryAfterSeconds;
  const message = readString(record, "message");
  if (message) connection.message = message;
  const account = record.account;
  if (asRecord(account)) connection.account = parseAccount(account);
  return connection;
}

function parseHealth(value: unknown): TelegramAccountHealth {
  const record = asRecord(value);
  if (!record || typeof record.accountId !== "string")
    throw new TelegramApiError(
      "server",
      "The Telegram service returned an unexpected health response.",
    );
  return {
    accountId: record.accountId,
    status: parseAccountStatus(record.status),
    lastCheckedAt: readString(record, "lastCheckedAt"),
    message: readString(record, "message"),
  };
}

function parseErrorPayload(record: Record<string, unknown> | null): {
  code?: string;
  message?: string;
  retryAfterSeconds?: number;
} {
  const nested = asRecord(record?.error) ?? record;
  if (!nested) return {};
  const result: {
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
  } = {};
  const code = readString(nested, "code");
  const message = readString(nested, "message");
  const retryAfterSeconds = readOptionalNumber(nested, "retryAfterSeconds");
  if (code) result.code = code;
  if (message) result.message = message;
  if (retryAfterSeconds !== undefined)
    result.retryAfterSeconds = retryAfterSeconds;
  return result;
}

const WIRE_CODE_MAP: Record<string, TelegramErrorCode> = {
  invalid_phone: "invalid-phone",
  phone_number_invalid: "invalid-phone",
  invalid_code: "invalid-code",
  phone_code_invalid: "invalid-code",
  code_expired: "code-expired",
  phone_code_expired: "code-expired",
  expired: "expired",
  password_required: "password-required",
  session_password_needed: "password-required",
  incorrect_password: "incorrect-password",
  password_hash_invalid: "incorrect-password",
  flood_wait: "flood-wait",
  flood_sleep: "flood-wait",
  rate_limited: "flood-wait",
  unauthorized: "unauthorized",
  unauthenticated: "unauthorized",
  not_found: "not-found",
  connection_not_found: "not-found",
  account_not_found: "not-found",
  validation: "validation",
  server_error: "server",
};

function mapHttpError(
  status: number,
  payload: unknown,
  retryAfterHeader: string | null,
): TelegramApiError {
  const details = parseErrorPayload(asRecord(payload));
  let code: TelegramErrorCode;
  if (details.code && WIRE_CODE_MAP[details.code]) {
    code = WIRE_CODE_MAP[details.code];
  } else if (status === 401) {
    code = "unauthorized";
  } else if (status === 404) {
    code = "not-found";
  } else if (status === 410) {
    code = "expired";
  } else if (status === 429) {
    code = "flood-wait";
  } else if (status === 400 || status === 422) {
    code = "validation";
  } else if (status >= 500) {
    code = "server";
  } else {
    code = "validation";
  }
  let retryAfterSeconds = details.retryAfterSeconds;
  if (retryAfterSeconds === undefined && retryAfterHeader) {
    const parsed = Number(retryAfterHeader);
    if (Number.isFinite(parsed)) retryAfterSeconds = parsed;
  }
  const error = new TelegramApiError(
    code,
    details.message ?? "The Telegram service rejected the request.",
    retryAfterSeconds,
  );
  return error;
}

export function telegramErrorMessage(error: unknown) {
  if (error instanceof TelegramApiError) {
    if (error.code === "flood-wait" && error.retryAfterSeconds)
      return `Telegram is rate-limiting connection attempts. Try again in about ${error.retryAfterSeconds} seconds.`;
    return error.message;
  }
  if (error instanceof TypeError)
    return "We couldn’t reach the Telegram service. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

function unavailableError() {
  return new TelegramApiError(
    "unavailable",
    "The Telegram service isn’t configured yet. The integration becomes available once the Telegram backend is connected to this deployment.",
  );
}

export function createTelegramService(): TelegramService {
  async function request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      parse: (payload: unknown) => T;
      empty?: T;
    },
  ): Promise<T> {
    const baseUrl = telegramApiBaseUrl();
    if (!baseUrl) throw unavailableError();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError")
        throw new TelegramApiError(
          "timeout",
          "The request timed out before the Telegram service responded.",
        );
      if (err instanceof TelegramApiError) throw err;
      throw new TelegramApiError(
        "network",
        "We couldn’t reach the Telegram service. Check your connection and try again.",
      );
    } finally {
      clearTimeout(timer);
    }
    let payload: unknown = null;
    if (response.status !== 204) {
      payload = await response.json().catch(() => null);
    }
    if (!response.ok)
      throw mapHttpError(
        response.status,
        payload,
        response.headers.get("Retry-After"),
      );
    if (response.status === 204 && options.empty !== undefined)
      return options.empty;
    return options.parse(payload);
  }

  return {
    startConnection(input) {
      return request("POST", "/api/v1/telegram/connections", {
        body: { phoneNumber: input.phoneNumber },
        parse: parseConnection,
      });
    },
    sendCode(connectionId) {
      return request(
        "POST",
        `/api/v1/telegram/connections/${encodeURIComponent(connectionId)}/send-code`,
        { parse: parseConnection },
      );
    },
    verifyCode(connectionId, code) {
      return request(
        "POST",
        `/api/v1/telegram/connections/${encodeURIComponent(connectionId)}/verify-code`,
        { body: { code }, parse: parseConnection },
      );
    },
    verifyPassword(connectionId, password) {
      const options = { body: { password }, parse: parseConnection };
      return request(
        "POST",
        `/api/v1/telegram/connections/${encodeURIComponent(connectionId)}/verify-password`,
        options,
      );
    },
    getConnection(connectionId) {
      return request(
        "GET",
        `/api/v1/telegram/connections/${encodeURIComponent(connectionId)}`,
        { parse: parseConnection },
      );
    },
    listAccounts() {
      return request("GET", "/api/v1/telegram/accounts", {
        parse: (payload) => {
          const record = asRecord(payload);
          const list = Array.isArray(payload)
            ? payload
            : record && Array.isArray(record.accounts)
              ? record.accounts
              : null;
          if (!list)
            throw new TelegramApiError(
              "server",
              "The Telegram service returned an unexpected account list.",
            );
          return list.map(parseAccount);
        },
      });
    },
    getAccount(accountId) {
      return request(
        "GET",
        `/api/v1/telegram/accounts/${encodeURIComponent(accountId)}`,
        { parse: parseAccount },
      );
    },
    reconnectAccount(accountId) {
      return request(
        "POST",
        `/api/v1/telegram/accounts/${encodeURIComponent(accountId)}/reconnect`,
        { parse: parseConnection },
      );
    },
    disconnectAccount(accountId) {
      return request(
        "DELETE",
        `/api/v1/telegram/accounts/${encodeURIComponent(accountId)}`,
        { parse: () => undefined, empty: undefined },
      );
    },
    getAccountHealth(accountId) {
      return request(
        "GET",
        `/api/v1/telegram/accounts/${encodeURIComponent(accountId)}/health`,
        { parse: parseHealth },
      );
    },
  };
}

export const telegramService = createTelegramService();

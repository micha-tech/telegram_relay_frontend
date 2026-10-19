// Typed adapter for the Python/Telethon relay backend.
//
// Every request is authenticated with the JWT access token owned by
// `src/services/api.ts`. Telegram login codes and two-step verification
// passwords are sent once to the backend and are never persisted by the
// browser.

import { ApiError, apiBaseUrl, apiRequest } from "./api";
import type { ApiErrorCode } from "./api";

export { ApiError as TelegramApiError };
export type { ApiErrorCode as TelegramErrorCode };

export function telegramApiBaseUrl() {
  return apiBaseUrl();
}

export type TelegramAccountStatus =
  "pending" | "connected" | "disconnected" | "invalid" | "error";

export const TELEGRAM_ACCOUNT_STATUSES: TelegramAccountStatus[] = [
  "pending",
  "connected",
  "disconnected",
  "invalid",
  "error",
];

export interface TelegramAccount {
  id: string;
  maskedPhoneNumber: string | null;
  telegramUserId: string | null;
  displayName: string | null;
  username: string | null;
  status: TelegramAccountStatus;
  lastConnectedAt: string | null;
  lastActivityAt: string | null;
  lastError: string | null;
  createdAt: string | null;
}

export type TelegramChallengeStatus =
  "code_sent" | "password_required" | "complete" | "failed" | "expired";

export interface TelegramChallenge {
  challengeId: string;
  status: TelegramChallengeStatus;
  expiresAt: string | null;
}

export interface TelegramAccountHealth {
  status: TelegramAccountStatus;
  sessionPresent: boolean;
  workerActive: boolean | null;
  lastConnectedAt: string | null;
  lastActivityAt: string | null;
  lastError: string | null;
  checkedAt: string | null;
}

export interface TelegramAccountEvent {
  kind: string;
  detail: string;
  createdAt: string | null;
}

export interface TelegramDialog {
  peerId: string;
  entityType: string;
  username: string | null;
  title: string | null;
  sourceId: string | null;
  destinationId: string | null;
}

export interface TelegramService {
  startConnection(input: { phoneNumber: string }): Promise<TelegramChallenge>;
  verifyCode(challengeId: string, code: string): Promise<TelegramChallenge>;
  verifyPassword(
    challengeId: string,
    password: string,
  ): Promise<TelegramChallenge>;
  listAccounts(): Promise<TelegramAccount[]>;
  getAccount(accountId: string): Promise<TelegramAccount>;
  getAccountHealth(accountId: string): Promise<TelegramAccountHealth>;
  getAccountEvents(accountId: string): Promise<TelegramAccountEvent[]>;
  getAccountDialogs(accountId: string): Promise<TelegramDialog[]>;
  reconnectAccount(accountId: string): Promise<TelegramAccount>;
  disconnectAccount(accountId: string): Promise<TelegramAccount>;
}

export function normalizeTelegramPhone(value: string): string | null {
  const cleaned = value.trim().replace(/[\s\-().]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) return null;
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

function readId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parseStatus(value: unknown): TelegramAccountStatus {
  return typeof value === "string" &&
    TELEGRAM_ACCOUNT_STATUSES.includes(value as TelegramAccountStatus)
    ? (value as TelegramAccountStatus)
    : "error";
}

function parseAccount(value: unknown): TelegramAccount {
  const record = asRecord(value);
  const id = record ? readId(record.id) : null;
  if (!record || !id)
    throw new ApiError({
      code: "server",
      message: "The Telegram service returned an unexpected account response.",
    });
  return {
    id,
    maskedPhoneNumber: readString(record, "phone_masked"),
    telegramUserId: readId(record.telegram_user_id),
    displayName: readString(record, "display_name"),
    username: readString(record, "username"),
    status: parseStatus(record.status),
    lastConnectedAt: readString(record, "last_connected_at"),
    lastActivityAt: readString(record, "last_activity_at"),
    lastError: readString(record, "last_error"),
    createdAt: readString(record, "created_at"),
  };
}

function parseAccountList(payload: unknown): TelegramAccount[] {
  const record = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : record && Array.isArray(record.results)
      ? record.results
      : null;
  if (!list)
    throw new ApiError({
      code: "server",
      message: "The Telegram service returned an unexpected account list.",
    });
  return list.map(parseAccount);
}

const CHALLENGE_STATUSES: TelegramChallengeStatus[] = [
  "code_sent",
  "password_required",
  "complete",
  "failed",
  "expired",
];

function parseChallenge(value: unknown): TelegramChallenge {
  const record = asRecord(value);
  const challengeId = record ? readId(record.challenge_id) : null;
  const status =
    record && typeof record.status === "string"
      ? (record.status as TelegramChallengeStatus)
      : null;
  if (
    !record ||
    !challengeId ||
    !status ||
    !CHALLENGE_STATUSES.includes(status)
  )
    throw new ApiError({
      code: "server",
      message:
        "The Telegram service returned an unexpected connection response.",
    });
  return {
    challengeId,
    status,
    expiresAt: readString(record, "expires_at"),
  };
}

function parseHealth(value: unknown): TelegramAccountHealth {
  const record = asRecord(value);
  if (!record)
    throw new ApiError({
      code: "server",
      message: "The Telegram service returned an unexpected health response.",
    });
  const worker = record.worker_active;
  return {
    status: parseStatus(record.status),
    sessionPresent: record.session_present === true,
    workerActive: typeof worker === "boolean" ? worker : null,
    lastConnectedAt: readString(record, "last_connected_at"),
    lastActivityAt: readString(record, "last_activity_at"),
    lastError: readString(record, "last_error"),
    checkedAt: readString(record, "checked_at"),
  };
}

function parseEvent(value: unknown): TelegramAccountEvent {
  const record = asRecord(value);
  return {
    kind: (record && readString(record, "kind")) ?? "event",
    detail: (record && readString(record, "detail")) ?? "",
    createdAt: record ? readString(record, "created_at") : null,
  };
}

function parseDialog(value: unknown): TelegramDialog {
  const record = asRecord(value);
  return {
    peerId: (record && readId(record.peer_id)) ?? "",
    entityType: (record && readString(record, "entity_type")) ?? "",
    username: record ? readString(record, "username") : null,
    title: record ? readString(record, "title") : null,
    sourceId: record ? readId(record.source_id) : null,
    destinationId: record ? readId(record.destination_id) : null,
  };
}

export function telegramErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "flood-wait" && error.retryAfterSeconds)
      return `Telegram is rate-limiting connection attempts. Try again in about ${error.retryAfterSeconds} seconds.`;
    return error.message;
  }
  if (error instanceof TypeError)
    return "We couldn’t reach the Telegram service. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

const accountPath = (accountId: string) =>
  `/telegram/accounts/${encodeURIComponent(accountId)}/`;

export function createTelegramService(): TelegramService {
  return {
    async startConnection(input) {
      const payload = await apiRequest<unknown>("/telegram/auth/start", {
        method: "POST",
        auth: true,
        body: { phone_number: input.phoneNumber },
      });
      return parseChallenge(payload);
    },
    async verifyCode(challengeId, code) {
      const payload = await apiRequest<unknown>("/telegram/auth/verify", {
        method: "POST",
        auth: true,
        body: { challenge_id: challengeId, code },
      });
      return parseChallenge(payload);
    },
    async verifyPassword(challengeId, password) {
      const payload = await apiRequest<unknown>("/telegram/auth/2fa", {
        method: "POST",
        auth: true,
        body: { challenge_id: challengeId, password },
      });
      return parseChallenge(payload);
    },
    async listAccounts() {
      const payload = await apiRequest<unknown>("/telegram/accounts/", {
        auth: true,
      });
      return parseAccountList(payload);
    },
    async getAccount(accountId) {
      const payload = await apiRequest<unknown>(accountPath(accountId), {
        auth: true,
      });
      return parseAccount(payload);
    },
    async getAccountHealth(accountId) {
      const payload = await apiRequest<unknown>(
        `${accountPath(accountId)}health/`,
        { auth: true },
      );
      return parseHealth(payload);
    },
    async getAccountEvents(accountId) {
      const payload = await apiRequest<unknown>(
        `${accountPath(accountId)}events/`,
        { auth: true },
      );
      if (!Array.isArray(payload))
        throw new ApiError({
          code: "server",
          message:
            "The Telegram service returned an unexpected activity response.",
        });
      return payload.map(parseEvent);
    },
    async getAccountDialogs(accountId) {
      const payload = await apiRequest<unknown>(
        `${accountPath(accountId)}dialogs/`,
        { auth: true },
      );
      if (!Array.isArray(payload))
        throw new ApiError({
          code: "server",
          message:
            "The Telegram service returned an unexpected dialog response.",
        });
      return payload.map(parseDialog);
    },
    async reconnectAccount(accountId) {
      const payload = await apiRequest<unknown>(
        `${accountPath(accountId)}reconnect/`,
        { method: "POST", auth: true },
      );
      return parseAccount(payload);
    },
    async disconnectAccount(accountId) {
      const payload = await apiRequest<unknown>(
        `${accountPath(accountId)}disconnect/`,
        { method: "POST", auth: true },
      );
      return parseAccount(payload);
    },
  };
}

export const telegramService = createTelegramService();

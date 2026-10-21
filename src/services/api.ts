// Shared HTTP boundary for the Prime Edge backend.
//
// The backend is a Django REST Framework service with SimpleJWT bearer auth.
// Every response is wrapped in an envelope: `{ success, data, message }` on
// success and `{ success, data, message, error: { code, details } }` on
// failure. This module owns the base URL, token storage, automatic access
// token refresh and envelope unwrapping so callers only deal with domain data.

const REQUEST_TIMEOUT_MS = 15000;
const ACCESS_TOKEN_KEY = "prime-edge.access-token";
const REFRESH_TOKEN_KEY = "prime-edge.refresh-token";
const FIELD_ERROR_FALLBACK = "Request validation failed";

export type ApiErrorCode =
  | "unavailable"
  | "network"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "flood-wait"
  | "validation"
  | "not-found"
  | "server"
  | "request";

export interface ApiErrorInit {
  code: ApiErrorCode;
  message: string;
  status?: number;
  details?: unknown;
  retryAfterSeconds?: number;
  fieldErrors?: Record<string, string>;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: unknown;
  readonly retryAfterSeconds?: number;
  readonly fieldErrors?: Record<string, string>;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.code = init.code;
    this.status = init.status ?? 0;
    this.details = init.details ?? null;
    if (init.retryAfterSeconds !== undefined)
      this.retryAfterSeconds = init.retryAfterSeconds;
    if (init.fieldErrors) this.fieldErrors = init.fieldErrors;
  }
}

export function apiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_TELEGRAM_API_BASE_URL;
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : null;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export function setTokens(tokens: {
  access: string;
  refresh?: string | null;
}): void {
  const store = storage();
  if (!store) return;
  store.setItem(ACCESS_TOKEN_KEY, tokens.access);
  if (tokens.refresh) store.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
}

export function clearTokens(): void {
  const store = storage();
  if (!store) return;
  store.removeItem(ACCESS_TOKEN_KEY);
  store.removeItem(REFRESH_TOKEN_KEY);
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  params?: Record<string, string | number | boolean | null | undefined>;
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const base = apiBaseUrl();
  if (!base) throw unavailableError();
  const auth = options.auth ?? false;
  let response = await send(base, path, options, auth);
  if (auth && response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await send(base, path, options, auth);
  }
  return unwrap<T>(response);
}

function buildUrl(
  base: string,
  path: string,
  params?: ApiRequestOptions["params"],
): string {
  if (!params) return `${base}${path}`;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  if (!query) return `${base}${path}`;
  return `${base}${path}${path.includes("?") ? "&" : "?"}${query}`;
}

async function send(
  base: string,
  path: string,
  options: ApiRequestOptions,
  auth: boolean,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? REQUEST_TIMEOUT_MS,
  );
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = auth ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(buildUrl(base, path, options.params), {
      method: options.method ?? "GET",
      credentials: "omit",
      headers,
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw new ApiError({
        code: "timeout",
        message:
          "The request timed out before the service responded. Please try again.",
      });
    throw new ApiError({
      code: "network",
      message:
        "We couldn’t reach the service. Check your connection and try again.",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function unwrap<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text().catch(() => "");
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  const record = asRecord(payload);
  if (record && typeof record.success === "boolean") {
    if (record.success) return (record.data ?? null) as T;
    throw errorFromEnvelope(record, response.status);
  }
  if (!response.ok) throw errorFromStatus(response.status);
  return (payload ?? null) as T;
}

function errorFromEnvelope(
  record: Record<string, unknown>,
  status: number,
): ApiError {
  const errorInfo = asRecord(record.error);
  const rawCode = typeof errorInfo?.code === "string" ? errorInfo.code : "";
  const details = errorInfo?.details ?? null;
  const fieldErrors = toFieldErrors(details);
  let message =
    typeof record.message === "string" && record.message
      ? record.message
      : fallbackMessage(status);
  if ((message === FIELD_ERROR_FALLBACK || !message) && fieldErrors) {
    const first = Object.values(fieldErrors)[0];
    if (first) message = first;
  }
  const code = mapCode(rawCode, status);
  const retryAfterSeconds =
    code === "flood-wait" ? parseRetrySeconds(message, details) : undefined;
  return new ApiError({
    code,
    message,
    status,
    details,
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
    ...(fieldErrors ? { fieldErrors } : {}),
  });
}

function errorFromStatus(status: number): ApiError {
  const code = mapCode("", status);
  return new ApiError({ code, message: fallbackMessage(status), status });
}

const CODE_MAP: Record<string, ApiErrorCode> = {
  not_authenticated: "unauthorized",
  authentication_failed: "unauthorized",
  token_not_valid: "unauthorized",
  invalid_token: "unauthorized",
  permission_denied: "forbidden",
  not_found: "not-found",
  throttled: "flood-wait",
  invalid: "validation",
  parse_error: "validation",
  internal_error: "server",
};

function mapCode(raw: string, status: number): ApiErrorCode {
  const mapped = CODE_MAP[raw.toLowerCase()];
  if (mapped) return mapped;
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "flood-wait";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "request";
}

function fallbackMessage(status: number): string {
  switch (mapCode("", status)) {
    case "unauthorized":
      return "You need to sign in to continue.";
    case "forbidden":
      return "You don’t have permission to do that.";
    case "not-found":
      return "We couldn’t find what you were looking for.";
    case "flood-wait":
      return "Too many attempts. Please wait a moment and try again.";
    case "validation":
      return "Some of the values you entered aren’t valid.";
    case "server":
      return "The service ran into a problem. Please try again.";
    default:
      return "The service rejected the request.";
  }
}

function parseRetrySeconds(
  message: string,
  details: unknown,
): number | undefined {
  const sources = [message, typeof details === "string" ? details : ""];
  for (const source of sources) {
    const match = /(\d+)\s*second/i.exec(source);
    if (match) {
      const seconds = Number(match[1]);
      if (Number.isFinite(seconds)) return seconds;
    }
  }
  return undefined;
}

function toFieldErrors(details: unknown): Record<string, string> | undefined {
  const record = asRecord(details);
  if (!record) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string" && value) result[key] = value;
    else if (Array.isArray(value) && typeof value[0] === "string")
      result[key] = value[0];
  }
  return Object.keys(result).length ? result : undefined;
}

function unavailableError(): ApiError {
  return new ApiError({
    code: "unavailable",
    message: "The service isn’t configured for this deployment yet.",
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

let refreshInFlight: Promise<boolean> | null = null;

export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function performRefresh(): Promise<boolean> {
  const base = apiBaseUrl();
  const refresh = getRefreshToken();
  if (!base || !refresh) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/auth/refresh`, {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh }),
      signal: controller.signal,
    });
    if (!response.ok) {
      clearTokens();
      return false;
    }
    const payload = await response.json().catch(() => null);
    const record = asRecord(payload);
    const access =
      record && typeof record.access === "string" ? record.access : null;
    if (!access) {
      clearTokens();
      return false;
    }
    setTokens({
      access,
      refresh:
        record && typeof record.refresh === "string"
          ? record.refresh
          : undefined,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

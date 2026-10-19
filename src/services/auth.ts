// Authentication boundary for the Prime Edge backend.
//
// SimpleJWT bearer tokens are stored in localStorage (per the product
// decision) and refreshed automatically by `src/services/api.ts`. The
// backend user is `{ id, email }`; a display name is derived from the email
// because the deployed backend has no name field yet.

import {
  ApiError,
  apiBaseUrl,
  apiRequest,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./api";

export interface User {
  id: string | number;
  name: string;
  email: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export type RegistrationResult =
  { status: "authenticated"; user: User } | { status: "verification-required" };

export type AuthErrorCode =
  | "unavailable"
  | "invalid-credentials"
  | "email-in-use"
  | "network"
  | "validation";

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthService {
  getSession(): Promise<User | null>;
  login(input: LoginInput): Promise<User>;
  register(input: RegisterInput): Promise<RegistrationResult>;
  logout(): Promise<void>;
}

const UNAVAILABLE_MESSAGE =
  "Account access isn’t available yet. The authentication service has not been connected. Please try again once the platform is available.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const words = local.split(/[._-]+/).filter(Boolean);
  if (!words.length) return email;
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toUser(payload: unknown, fallbackName?: string): User {
  const record = asRecord(payload);
  const id = record?.id;
  const email = record && typeof record.email === "string" ? record.email : "";
  if ((typeof id !== "string" && typeof id !== "number") || !email)
    throw new AuthError(
      "validation",
      "The authentication service returned an unexpected response.",
    );
  const name = fallbackName?.trim() || nameFromEmail(email);
  return { id, name, email };
}

function applyTokens(record: Record<string, unknown> | null) {
  const access =
    record && typeof record.access === "string" ? record.access : null;
  if (!access) return;
  setTokens({
    access,
    refresh:
      record && typeof record.refresh === "string" ? record.refresh : undefined,
  });
}

function toAuthError(error: unknown, action: "login" | "register"): AuthError {
  if (error instanceof ApiError) {
    if (error.code === "unavailable")
      return new AuthError("unavailable", UNAVAILABLE_MESSAGE);
    if (error.code === "network" || error.code === "timeout")
      return new AuthError("network", error.message);
    if (action === "register" && error.fieldErrors?.email)
      return new AuthError(
        "email-in-use",
        error.fieldErrors.email,
        error.fieldErrors,
      );
    if (
      action === "login" &&
      (error.code === "unauthorized" || error.code === "validation")
    )
      return new AuthError(
        "invalid-credentials",
        "The email or password is incorrect.",
        error.fieldErrors,
      );
    return new AuthError("validation", error.message, error.fieldErrors);
  }
  if (error instanceof TypeError)
    return new AuthError(
      "network",
      "We couldn’t connect. Check your internet connection and try again.",
    );
  return new AuthError("validation", "Something went wrong. Please try again.");
}

export const authService: AuthService = {
  async getSession() {
    if (!apiBaseUrl() || !getAccessToken()) return null;
    try {
      return toUser(await apiRequest<unknown>("/auth/me", { auth: true }));
    } catch (error) {
      if (error instanceof ApiError && error.code === "unauthorized")
        return null;
      throw toAuthError(error, "login");
    }
  },
  async login(input) {
    const data = await apiRequest<unknown>("/auth/login", {
      method: "POST",
      body: {
        email: input.email.trim().toLowerCase(),
        password: input.password,
      },
    }).catch((error) => {
      throw toAuthError(error, "login");
    });
    const record = asRecord(data);
    applyTokens(record);
    return toUser(record?.user);
  },
  async register(input) {
    const data = await apiRequest<unknown>("/auth/register", {
      method: "POST",
      body: {
        name: input.name,
        email: input.email.trim().toLowerCase(),
        password: input.password,
      },
    }).catch((error) => {
      throw toAuthError(error, "register");
    });
    const record = asRecord(data);
    applyTokens(record);
    return {
      status: "authenticated",
      user: toUser(record?.user, input.name),
    } as RegistrationResult;
  },
  async logout() {
    const refresh = getRefreshToken();
    if (refresh && apiBaseUrl()) {
      await apiRequest("/auth/logout", {
        method: "POST",
        auth: true,
        body: { refresh },
      });
    }
    clearTokens();
  },
};

export function authErrorMessage(error: unknown) {
  if (error instanceof AuthError) return error.message;
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError)
    return "We couldn’t connect. Check your internet connection and try again.";
  return "Something went wrong. Please try again.";
}

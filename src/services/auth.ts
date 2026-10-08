// Implement this boundary with the real backend contract when it is available.
// No endpoints are assumed and credentials are never persisted by this adapter.
export interface User {
  id: string;
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
const unavailable = (): never => {
  throw new AuthError(
    "unavailable",
    "Account access isn’t available yet. The authentication service has not been connected. Please try again once the platform is available.",
  );
};
export const authService: AuthService = {
  async getSession() {
    return null;
  },
  async login() {
    return unavailable();
  },
  async register() {
    return unavailable();
  },
  async logout() {
    return unavailable();
  },
};
export function authErrorMessage(error: unknown) {
  if (error instanceof AuthError) return error.message;
  if (error instanceof TypeError)
    return "We couldn’t connect. Check your internet connection and try again.";
  return "Something went wrong. Please try again.";
}

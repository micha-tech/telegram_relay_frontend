import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { AuthPage } from "../src/views/AuthPage";
import { AccountPage } from "../src/views/AccountPage";
import { ProtectedAccount } from "../src/components/ProtectedAccount";
import { SessionProvider, useSession } from "../src/services/session";
import { AuthError, authService } from "../src/services/auth";
import type { AuthService, User } from "../src/services/auth";
import { safeRedirect } from "../src/services/redirect";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard",
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
afterEach(cleanup);

const user: User = {
  id: "fixture",
  name: "Test Analyst",
  email: "test@example.com",
};
function makeService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    login: vi.fn().mockResolvedValue(user),
    register: vi.fn().mockResolvedValue({ status: "authenticated", user }),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
function SessionProbe() {
  const { user } = useSession();
  return <output data-testid="session-user">{user?.id ?? "anonymous"}</output>;
}
function mount(children: ReactNode, service = makeService()) {
  render(
    <SessionProvider service={service}>
      {children}
      <SessionProbe />
    </SessionProvider>,
  );
  return service;
}
async function fillCredentials() {
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Email address") as HTMLInputElement).disabled,
    ).toBe(false),
  );
  await userEvent.type(
    screen.getByLabelText("Email address"),
    "test@example.com",
  );
  await userEvent.type(
    screen.getByLabelText("Password", { exact: true }),
    "test-password-only",
  );
}
async function fillRegistration() {
  await fillCredentials();
  await userEvent.type(screen.getByLabelText("Full name"), "Test Analyst");
  await userEvent.type(
    screen.getByLabelText("Confirm password", { exact: true }),
    "test-password-only",
  );
}

describe("preserved authentication behavior", () => {
  it("keeps the submit button disabled while authenticating, then redirects", async () => {
    let finish!: (value: User) => void;
    const service = makeService({
      login: vi.fn(
        () =>
          new Promise<User>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    mount(<AuthPage mode="login" />, service);
    await fillCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect(
      (screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(service.login).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "test-password-only",
    });
    await act(async () => finish(user));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/dashboard"),
    );
    expect(screen.getByTestId("session-user").textContent).toBe("fixture");
  });
  it("restores existing sessions and accepts only local dashboard redirects", async () => {
    mount(
      <AuthPage mode="signup" redirectTo="https://untrusted.example/" />,
      makeService({ getSession: vi.fn().mockResolvedValue(user) }),
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/dashboard"),
    );
    expect(safeRedirect("//untrusted.example")).toBe("/dashboard");
    expect(safeRedirect("/dashboard?view=signals")).toBe(
      "/dashboard?view=signals",
    );
  });
  it("preserves a valid return destination after login", async () => {
    mount(<AuthPage mode="login" redirectTo="/dashboard?view=signals" />);
    await fillCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/dashboard?view=signals",
      ),
    );
  });
  it("registers with the same contract and opens the authenticated workspace", async () => {
    const service = mount(<AuthPage mode="signup" />);
    await fillRegistration();
    await userEvent.click(
      screen.getByRole("button", { name: "Create Account" }),
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/dashboard"),
    );
    expect(service.register).toHaveBeenCalledWith({
      name: "Test Analyst",
      email: "test@example.com",
      password: "test-password-only",
    });
  });
  it("handles verification-required registration without creating a session", async () => {
    mount(
      <AuthPage mode="signup" />,
      makeService({
        register: vi
          .fn()
          .mockResolvedValue({ status: "verification-required" }),
      }),
    );
    await fillRegistration();
    await userEvent.click(
      screen.getByRole("button", { name: "Create Account" }),
    );
    await screen.findByRole("heading", { name: "Check your email" });
    expect(screen.getByTestId("session-user").textContent).toBe("anonymous");
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it("reports credential and network errors and allows retry", async () => {
    const login = vi
      .fn()
      .mockRejectedValueOnce(
        new AuthError(
          "invalid-credentials",
          "The email or password is incorrect.",
        ),
      )
      .mockRejectedValueOnce(new TypeError("Network unavailable"));
    mount(<AuthPage mode="login" />, makeService({ login }));
    await fillCredentials();
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "email or password is incorrect",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Check your internet connection",
      ),
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it("keeps the user signed in if logout fails, and clears them after success", async () => {
    const logout = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network unavailable"))
      .mockResolvedValueOnce(undefined);
    mount(
      <AccountPage />,
      makeService({ getSession: vi.fn().mockResolvedValue(user), logout }),
    );
    await screen.findByRole("heading", { name: "Welcome, Test Analyst." });
    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    await screen.findByRole("alert");
    expect(screen.getByTestId("session-user").textContent).toBe("fixture");
    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));
    await waitFor(() =>
      expect(screen.getByTestId("session-user").textContent).toBe("anonymous"),
    );
    expect(navigation.replace).toHaveBeenCalledWith("/login");
  });
  it("recovers a session lookup failure before deciding whether to redirect", async () => {
    const getSession = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Network unavailable"))
      .mockResolvedValueOnce(user);
    mount(<ProtectedAccount />, makeService({ getSession }));
    await screen.findByRole("alert");
    expect(navigation.replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Welcome, Test Analyst." });
  });
  it("never simulates authentication in the production service", async () => {
    expect(await authService.getSession()).toBe(null);
    await expect(
      authService.login({ email: user.email, password: "test-password-only" }),
    ).rejects.toMatchObject({ code: "unavailable" });
    await expect(
      authService.register({
        name: user.name,
        email: user.email,
        password: "test-password-only",
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});

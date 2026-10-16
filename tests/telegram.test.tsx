import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { TelegramAccountsView } from "../src/views/TelegramAccountsView";
import { RequireAuth } from "../src/components/ProtectedAccount";
import { SessionProvider } from "../src/services/session";
import { TelegramApiError } from "../src/services/telegram";
import type {
  TelegramAccount,
  TelegramConnection,
  TelegramService,
} from "../src/services/telegram";
import type { AuthService, User } from "../src/services/auth";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/dashboard/telegram-accounts",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => navigation.pathname,
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

const user: User = { id: "fixture", name: "Test Analyst", email: "a@b.co" };

function authService(): AuthService {
  return {
    getSession: vi.fn().mockResolvedValue(user),
    login: vi.fn().mockResolvedValue(user),
    register: vi.fn().mockResolvedValue({ status: "authenticated", user }),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

function connection(
  overrides: Partial<TelegramConnection> = {},
): TelegramConnection {
  return {
    connectionId: "cn_1",
    nextStep: "code",
    expiresAt: null,
    ...overrides,
  };
}

function account(overrides: Partial<TelegramAccount> = {}): TelegramAccount {
  return {
    id: "acc_1",
    telegramUserId: "1001",
    username: "analyst",
    displayName: "Test Analyst",
    maskedPhoneNumber: "+447 •••• 23",
    status: "connected",
    lastConnectedAt: "2026-01-02T10:00:00.000Z",
    lastActivityAt: "2026-01-02T10:05:00.000Z",
    lastError: null,
    ...overrides,
  };
}

function telegramService(
  overrides: Partial<TelegramService> = {},
): TelegramService {
  return {
    startConnection: vi
      .fn()
      .mockResolvedValue(connection({ nextStep: "code" })),
    sendCode: vi.fn().mockResolvedValue(connection({ nextStep: "code" })),
    verifyCode: vi
      .fn()
      .mockResolvedValue(connection({ nextStep: "completed" })),
    verifyPassword: vi
      .fn()
      .mockResolvedValue(connection({ nextStep: "completed" })),
    getConnection: vi
      .fn()
      .mockResolvedValue(connection({ nextStep: "completed" })),
    listAccounts: vi.fn().mockResolvedValue([]),
    getAccount: vi.fn().mockResolvedValue(account()),
    reconnectAccount: vi
      .fn()
      .mockResolvedValue(connection({ nextStep: "completed" })),
    disconnectAccount: vi.fn().mockResolvedValue(undefined),
    getAccountHealth: vi.fn().mockResolvedValue({
      accountId: "acc_1",
      status: "connected",
      lastCheckedAt: "2026-01-02T10:00:00.000Z",
      message: null,
    }),
    ...overrides,
  };
}

function mountView(service = telegramService()) {
  render(<TelegramAccountsView service={service} />);
  return service;
}

async function openWizard() {
  await userEvent.click(
    screen.getAllByRole("button", { name: /Connect Telegram/ })[0],
  );
  return screen.findByRole("dialog");
}

async function goToPhoneStep(dialog: HTMLElement) {
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Connect Telegram" }),
  );
  return screen.findByRole("heading", { name: /Telegram number/ });
}

async function submitPhone(number = "+447700900123") {
  const dialog = await openWizard();
  await goToPhoneStep(dialog);
  await userEvent.type(screen.getByLabelText("Telegram phone number"), number);
  await userEvent.click(screen.getByRole("button", { name: "Send code" }));
}

beforeEach(() => {
  navigation.replace.mockClear();
  navigation.pathname = "/dashboard/telegram-accounts";
});
afterEach(cleanup);

describe("telegram accounts view", () => {
  it("shows the empty state and connects an account through the full wizard", async () => {
    const service = mountView(
      telegramService({
        listAccounts: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValue([account()]),
      }),
    );
    expect(await screen.findByText("No Telegram accounts yet")).toBeTruthy();
    const dialog = await openWizard();
    await goToPhoneStep(dialog);
    await userEvent.type(
      screen.getByLabelText("Telegram phone number"),
      "+44 7700 900123",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(
      await screen.findByRole("heading", { name: "Enter your code" }),
    ).toBeTruthy();
    expect(service.startConnection).toHaveBeenCalledWith({
      phoneNumber: "+447700900123",
    });
    await userEvent.type(screen.getByLabelText("Verification code"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));
    expect(service.verifyCode).toHaveBeenCalledWith("cn_1", "12345");
    expect(
      await screen.findByRole("heading", { name: "Account connected" }),
    ).toBeTruthy();
    await waitFor(() => expect(service.listAccounts).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByRole("heading", { name: "Test Analyst" }),
    ).toBeTruthy();
  });

  it("asks for two-step verification only when the backend requires it", async () => {
    const service = mountView(
      telegramService({
        verifyCode: vi
          .fn()
          .mockResolvedValue(connection({ nextStep: "password" })),
      }),
    );
    await screen.findByText("No Telegram accounts yet");
    await submitPhone();
    await userEvent.type(screen.getByLabelText("Verification code"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));
    expect(
      await screen.findByRole("heading", { name: "Two-step verification" }),
    ).toBeTruthy();
    await userEvent.type(
      screen.getByLabelText("Telegram two-step verification password"),
      "cloud-password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Verify password" }),
    );
    expect(service.verifyPassword).toHaveBeenCalledWith(
      "cn_1",
      "cloud-password",
    );
    expect(
      await screen.findByRole("heading", { name: "Account connected" }),
    ).toBeTruthy();
  });

  it("validates the phone number before contacting the backend", async () => {
    const service = mountView();
    await screen.findByText("No Telegram accounts yet");
    const dialog = await openWizard();
    await goToPhoneStep(dialog);
    await userEvent.type(
      screen.getByLabelText("Telegram phone number"),
      "12345",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "international phone number",
    );
    expect(service.startConnection).not.toHaveBeenCalled();
  });

  it("clears the password and allows another attempt after a failure", async () => {
    const service = mountView(
      telegramService({
        verifyCode: vi
          .fn()
          .mockResolvedValue(connection({ nextStep: "password" })),
        verifyPassword: vi
          .fn()
          .mockRejectedValue(
            new TelegramApiError(
              "incorrect-password",
              "That password is incorrect.",
            ),
          ),
      }),
    );
    await screen.findByText("No Telegram accounts yet");
    await submitPhone();
    await userEvent.type(screen.getByLabelText("Verification code"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));
    const field = await screen.findByLabelText(
      "Telegram two-step verification password",
    );
    await userEvent.type(field, "wrong-password");
    await userEvent.click(
      screen.getByRole("button", { name: "Verify password" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "password is incorrect",
    );
    expect((field as HTMLInputElement).value).toBe("");
    expect(
      (
        screen.getByRole("button", {
          name: "Verify password",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    expect(service.verifyPassword).toHaveBeenCalledWith(
      "cn_1",
      "wrong-password",
    );
  });

  it("prevents duplicate code submissions while a request is in flight", async () => {
    let finish!: (value: TelegramConnection) => void;
    const verifyCode = vi.fn(
      () =>
        new Promise<TelegramConnection>((resolve) => {
          finish = resolve;
        }),
    );
    mountView(telegramService({ verifyCode }));
    await screen.findByText("No Telegram accounts yet");
    await submitPhone();
    await userEvent.type(screen.getByLabelText("Verification code"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));
    const pending = screen.getByRole("button", { name: "Verifying…" });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(pending);
    expect(verifyCode).toHaveBeenCalledTimes(1);
    await act(async () => finish(connection({ nextStep: "completed" })));
  });

  it("completes when the backend confirms through status polling", async () => {
    const service = mountView(
      telegramService({
        verifyCode: vi
          .fn()
          .mockResolvedValue(connection({ nextStep: "connecting" })),
        getConnection: vi
          .fn()
          .mockResolvedValue(connection({ nextStep: "completed" })),
      }),
    );
    await screen.findByText("No Telegram accounts yet");
    await submitPhone();
    await userEvent.type(screen.getByLabelText("Verification code"), "12345");
    await userEvent.click(screen.getByRole("button", { name: "Verify code" }));
    expect(
      await screen.findByRole("heading", { name: "Account connected" }),
    ).toBeTruthy();
    expect(service.getConnection).toHaveBeenCalledWith("cn_1");
  });

  it("renders multiple accounts with real statuses and summary counts", async () => {
    mountView(
      telegramService({
        listAccounts: vi.fn().mockResolvedValue([
          account({ id: "a1", displayName: "First Account" }),
          account({
            id: "a2",
            displayName: "Second Account",
            username: null,
            status: "requires_attention",
          }),
        ]),
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "First Account" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Second Account" }),
    ).toBeTruthy();
    const summary = screen.getByRole("region", { name: "Account summary" });
    expect(
      within(summary).getByText("Total accounts").previousSibling?.textContent,
    ).toBe("2");
    expect(
      within(summary).getByText("Connected").previousSibling?.textContent,
    ).toBe("1");
    expect(
      within(summary).getByText("Needs attention").previousSibling?.textContent,
    ).toBe("1");
  });

  it("shows an error state and retries without fabricating data", async () => {
    const service = mountView(
      telegramService({
        listAccounts: vi
          .fn()
          .mockRejectedValueOnce(new TelegramApiError("network", "Offline"))
          .mockResolvedValue([account()]),
      }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain("Offline");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Test Analyst" }),
    ).toBeTruthy();
    expect(service.listAccounts).toHaveBeenCalledTimes(2);
  });

  it("shows a configuration state when the backend url is missing", async () => {
    mountView(
      telegramService({
        listAccounts: vi
          .fn()
          .mockRejectedValue(
            new TelegramApiError("unavailable", "Not configured yet."),
          ),
      }),
    );
    expect(
      await screen.findByText("Telegram integration isn’t configured"),
    ).toBeTruthy();
    expect(screen.queryByText("Total accounts")).toBeNull();
  });

  it("disconnects an account only after confirmation and refreshes", async () => {
    const service = mountView(
      telegramService({
        listAccounts: vi.fn().mockResolvedValue([account()]),
      }),
    );
    await screen.findByRole("heading", { name: "Test Analyst" });
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(service.disconnectAccount).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm disconnect" }),
    );
    await waitFor(() =>
      expect(service.disconnectAccount).toHaveBeenCalledWith("acc_1"),
    );
    await waitFor(() => expect(service.listAccounts).toHaveBeenCalledTimes(2));
  });

  it("keeps the account visible when disconnecting fails", async () => {
    const service = mountView(
      telegramService({
        listAccounts: vi.fn().mockResolvedValue([account()]),
        disconnectAccount: vi
          .fn()
          .mockRejectedValue(new TelegramApiError("server", "Failed")),
      }),
    );
    await screen.findByRole("heading", { name: "Test Analyst" });
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm disconnect" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain("Failed");
    expect(screen.getByRole("heading", { name: "Test Analyst" })).toBeTruthy();
    expect(service.listAccounts).toHaveBeenCalledTimes(1);
  });

  it("reuses the wizard when reconnecting needs a verification code", async () => {
    const service = mountView(
      telegramService({
        listAccounts: vi
          .fn()
          .mockResolvedValue([account({ status: "disconnected" })]),
        reconnectAccount: vi
          .fn()
          .mockResolvedValue(connection({ nextStep: "code" })),
      }),
    );
    await screen.findByRole("heading", { name: "Test Analyst" });
    await userEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(
      await screen.findByRole("heading", { name: "Enter your code" }),
    ).toBeTruthy();
    expect(service.reconnectAccount).toHaveBeenCalledWith("acc_1");
  });

  it("refreshes in place when reconnect completes immediately", async () => {
    const service = mountView(
      telegramService({
        listAccounts: vi
          .fn()
          .mockResolvedValue([account({ status: "disconnected" })]),
        reconnectAccount: vi
          .fn()
          .mockResolvedValue(connection({ nextStep: "completed" })),
      }),
    );
    await screen.findByRole("heading", { name: "Test Analyst" });
    await userEvent.click(screen.getByRole("button", { name: "Reconnect" }));
    await waitFor(() => expect(service.listAccounts).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status").textContent).toContain(
      "The account was reconnected.",
    );
  });
});

describe("telegram route protection", () => {
  it("redirects anonymous visitors to the login flow with a return path", async () => {
    render(
      <SessionProvider
        service={{
          ...authService(),
          getSession: vi.fn().mockResolvedValue(null),
        }}
      >
        <RequireAuth>
          <p>private workspace</p>
        </RequireAuth>
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/login?next=%2Fdashboard%2Ftelegram-accounts",
      ),
    );
    expect(screen.queryByText("private workspace")).toBeNull();
  });
});

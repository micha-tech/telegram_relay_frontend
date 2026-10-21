import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { SignalsView } from "../src/views/SignalsView";
import { SignalSourcesView } from "../src/views/SignalSourcesView";
import { RequireSuperAdmin } from "../src/components/ProtectedAccount";
import { SessionProvider } from "../src/services/session";
import type {
  Signal,
  SignalPage,
  SignalSource,
  SignalStats,
  SignalsService,
} from "../src/services/signals";
import type {
  TelegramAccount,
  TelegramDialog,
  TelegramService,
} from "../src/services/telegram";
import type { AuthService, User } from "../src/services/auth";

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/dashboard/signals",
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

afterEach(cleanup);

const analyst: User = {
  id: "1",
  name: "Test Analyst",
  email: "analyst@example.com",
  isSuperAdmin: true,
};

const viewer: User = {
  id: "2",
  name: "Test Viewer",
  email: "viewer@example.com",
  isSuperAdmin: false,
};

function authService(user: User): AuthService {
  return {
    getSession: vi.fn().mockResolvedValue(user),
    login: vi.fn().mockResolvedValue(user),
    register: vi.fn().mockResolvedValue({ status: "authenticated", user }),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: "sig-1",
    accountId: "7",
    accountLabel: "Analyst",
    sourceId: "9",
    sourceName: "Betting tips",
    chatId: "-1001234567890",
    messageId: "512",
    text: "Over 2.5 goals confirmed",
    author: "Tipster",
    matchedTerms: ["over 2.5"],
    sentAt: "2026-01-02T10:00:00.000Z",
    createdAt: "2026-01-02T10:00:05.000Z",
    ...overrides,
  };
}

function signalPage(overrides: Partial<SignalPage> = {}): SignalPage {
  return {
    count: 1,
    page: 1,
    pageSize: 20,
    results: [signal()],
    hasNext: false,
    hasPrevious: false,
    ...overrides,
  };
}

function stats(overrides: Partial<SignalStats> = {}): SignalStats {
  return {
    total: 12,
    last24h: 4,
    activeSources: 3,
    bySource: [{ id: "9", name: "Betting tips", count: 12 }],
    byAccount: [{ id: "7", name: "Analyst", count: 12 }],
    ...overrides,
  };
}

function source(overrides: Partial<SignalSource> = {}): SignalSource {
  return {
    id: "src-1",
    accountId: "7",
    accountLabel: "Analyst",
    entityId: "3",
    chatTitle: "Betting tips",
    chatUsername: "tips",
    peerId: "-1001234567890",
    name: "Betting tips",
    enabled: true,
    rules: {
      keywords: ["over 2.5"],
      blockedPhrases: [],
      minLength: 0,
      caseSensitive: false,
    },
    backfillLimit: 200,
    lastScrapedAt: null,
    lastSignalAt: "2026-01-02T10:00:00.000Z",
    createdAt: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

function account(overrides: Partial<TelegramAccount> = {}): TelegramAccount {
  return {
    id: "acc-1",
    telegramUserId: "1001",
    username: "analyst",
    displayName: "Analyst",
    maskedPhoneNumber: "+44 •••• 23",
    status: "connected",
    lastConnectedAt: null,
    lastActivityAt: null,
    lastError: null,
    createdAt: null,
    ...overrides,
  };
}

function dialog(overrides: Partial<TelegramDialog> = {}): TelegramDialog {
  return {
    peerId: "-1001234567890",
    entityType: "channel",
    username: "tips",
    title: "Betting tips",
    sourceId: "3",
    destinationId: "4",
    ...overrides,
  };
}

function signalsService(
  overrides: Partial<SignalsService> = {},
): SignalsService {
  return {
    listSignals: vi.fn().mockResolvedValue(signalPage()),
    getStats: vi.fn().mockResolvedValue(stats()),
    listSources: vi.fn().mockResolvedValue([source()]),
    createSource: vi.fn().mockResolvedValue(source()),
    updateSource: vi.fn().mockResolvedValue(source()),
    deleteSource: vi.fn().mockResolvedValue(undefined),
    requestScrape: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function telegramService(
  overrides: Partial<TelegramService> = {},
): TelegramService {
  return {
    startConnection: vi.fn(),
    verifyCode: vi.fn(),
    verifyPassword: vi.fn(),
    listAccounts: vi.fn().mockResolvedValue([account()]),
    getAccount: vi.fn(),
    getAccountHealth: vi.fn(),
    getAccountEvents: vi.fn(),
    getAccountDialogs: vi.fn().mockResolvedValue([dialog()]),
    reconnectAccount: vi.fn(),
    disconnectAccount: vi.fn(),
    ...overrides,
  } as TelegramService;
}

describe("signals feed", () => {
  it("shows the summary and the matched messages", async () => {
    const service = signalsService();
    render(<SignalsView service={service} />);
    await waitFor(() =>
      expect(screen.getByText("Over 2.5 goals confirmed")).toBeTruthy(),
    );
    expect(screen.getByText("Betting tips · Analyst")).toBeTruthy();
    const summary = screen.getByLabelText("Signal summary");
    expect(within(summary).getByText("12")).toBeTruthy();
    expect(within(summary).getByText("Total signals")).toBeTruthy();
    expect(within(summary).getByText("Last 24 hours")).toBeTruthy();
  });

  it("passes the search filter to the api", async () => {
    const service = signalsService();
    render(<SignalsView service={service} />);
    await waitFor(() => expect(service.listSignals).toHaveBeenCalled());
    await userEvent.type(
      screen.getByPlaceholderText("Search signal text"),
      "a",
    );
    await waitFor(() =>
      expect(
        (service.listSignals as ReturnType<typeof vi.fn>).mock.calls.some(
          (call) => call[0]?.q === "a",
        ),
      ).toBe(true),
    );
  });

  it("reports an empty feed", async () => {
    const service = signalsService({
      listSignals: vi.fn().mockResolvedValue(signalPage({ results: [] })),
    });
    render(<SignalsView service={service} />);
    await waitFor(() =>
      expect(screen.getByText("No signals yet")).toBeTruthy(),
    );
  });
});

describe("signal sources administration", () => {
  it("lists the watched chats", async () => {
    const service = signalsService();
    render(
      <SignalSourcesView service={service} telegram={telegramService()} />,
    );
    await waitFor(() =>
      expect(screen.getByText("Watched chats (1)")).toBeTruthy(),
    );
    expect(screen.getByRole("heading", { name: "Betting tips" })).toBeTruthy();
    expect(screen.getByText("Enabled")).toBeTruthy();
  });

  it("adds a watched chat with its keywords", async () => {
    const service = signalsService();
    render(
      <SignalSourcesView service={service} telegram={telegramService()} />,
    );
    await waitFor(() => expect(service.listSources).toHaveBeenCalled());
    await userEvent.selectOptions(
      screen.getByLabelText("Chat"),
      await screen.findByRole("option", { name: "Betting tips" }),
    );
    await userEvent.type(
      screen.getByLabelText("Keywords"),
      "over 2.5, corners",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add watched chat" }),
    );
    await waitFor(() => expect(service.createSource).toHaveBeenCalled());
    expect(service.createSource).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-1",
        entityId: "3",
        keywords: ["over 2.5", "corners"],
      }),
    );
  });

  it("queues a backfill for a watched chat", async () => {
    const service = signalsService();
    render(
      <SignalSourcesView service={service} telegram={telegramService()} />,
    );
    await waitFor(() => expect(screen.getByText("Backfill")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: "Backfill" }));
    await waitFor(() => expect(service.requestScrape).toHaveBeenCalled());
    expect(service.requestScrape).toHaveBeenCalledWith("src-1");
  });
});

describe("super administrator guard", () => {
  it("blocks signed-in users without the super administrator role", async () => {
    render(
      <SessionProvider service={authService(viewer)}>
        <RequireSuperAdmin>
          <div>Super admin area</div>
        </RequireSuperAdmin>
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(
        screen.getByText("Super administrator access required"),
      ).toBeTruthy(),
    );
    expect(screen.queryByText("Super admin area")).toBeNull();
  });

  it("renders the admin area for super administrators", async () => {
    render(
      <SessionProvider service={authService(analyst)}>
        <RequireSuperAdmin>
          <div>Super admin area</div>
        </RequireSuperAdmin>
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByText("Super admin area")).toBeTruthy(),
    );
  });
});

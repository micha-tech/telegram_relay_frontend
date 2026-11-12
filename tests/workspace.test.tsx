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
import { WorkspaceView } from "../src/views/WorkspaceView";
import { SessionProvider } from "../src/services/session";
import type { AuthService, User } from "../src/services/auth";
import type {
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceService,
} from "../src/services/workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/workspace",
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

const owner: User = {
  id: "1",
  name: "Workspace Owner",
  email: "owner@example.com",
  role: "owner",
  tenant: {
    id: "tenant-1",
    name: "Acme Signals",
    slug: "acme-signals",
  },
  isAdmin: true,
  isSuperuser: false,
};

const member: User = {
  id: "7",
  name: "Workspace Member",
  email: "member@example.com",
  role: "member",
  tenant: {
    id: "tenant-1",
    name: "Acme Signals",
    slug: "acme-signals",
  },
  isAdmin: false,
  isSuperuser: false,
};

function authService(user: User): AuthService {
  return {
    getSession: vi.fn().mockResolvedValue(user),
    login: vi.fn().mockResolvedValue(user),
    register: vi.fn().mockResolvedValue({ status: "authenticated", user }),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

function workspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    id: "tenant-1",
    name: "Acme Signals",
    slug: "acme-signals",
    isActive: true,
    role: "owner",
    memberCount: 2,
    createdAt: "2026-01-01T09:00:00.000Z",
    ...overrides,
  };
}

function workspaceMember(
  overrides: Partial<WorkspaceMember> = {},
): WorkspaceMember {
  return {
    id: "7",
    email: "member@example.com",
    role: "member",
    isActive: true,
    createdAt: "2026-01-02T09:00:00.000Z",
    ...overrides,
  };
}

function invite(overrides: Partial<WorkspaceInvite> = {}): WorkspaceInvite {
  return {
    id: "invite-1",
    code: "invite-code-value",
    role: "member",
    email: "",
    createdByEmail: "owner@example.com",
    expiresAt: "2099-01-09T09:00:00.000Z",
    usedAt: null,
    isUsable: true,
    createdAt: "2026-01-02T09:00:00.000Z",
    ...overrides,
  };
}

function workspaceService(
  overrides: Partial<WorkspaceService> = {},
): WorkspaceService {
  return {
    getCurrent: vi.fn().mockResolvedValue(workspace()),
    rename: vi.fn().mockResolvedValue(workspace({ name: "Renamed" })),
    listMembers: vi.fn().mockResolvedValue([
      workspaceMember({
        id: "1",
        email: "owner@example.com",
        role: "owner",
      }),
      workspaceMember(),
    ]),
    createMember: vi
      .fn()
      .mockResolvedValue(
        workspaceMember({ id: "8", email: "new@example.com" }),
      ),
    updateMember: vi
      .fn()
      .mockImplementation((id: string, role: string) =>
        Promise.resolve(workspaceMember({ id, role: role as "member" })),
      ),
    removeMember: vi.fn().mockResolvedValue(undefined),
    listInvites: vi.fn().mockResolvedValue([invite()]),
    createInvite: vi
      .fn()
      .mockResolvedValue(invite({ id: "invite-2", code: "new-code" })),
    revokeInvite: vi.fn().mockResolvedValue(undefined),
    previewInvite: vi.fn(),
    ...overrides,
  };
}

function mount(children: ReactNode, service: WorkspaceService, user: User) {
  render(
    <SessionProvider service={authService(user)}>{children}</SessionProvider>,
  );
  return service;
}

describe("workspace administration", () => {
  it("shows the workspace, its members and usable invites", async () => {
    const service = workspaceService();
    mount(<WorkspaceView service={service} />, service, owner);
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Acme Signals" }),
      ).toBeTruthy(),
    );
    expect(screen.getByText("owner@example.com")).toBeTruthy();
    expect(screen.getByText("member@example.com")).toBeTruthy();
    expect(screen.getByText("invite-code-value")).toBeTruthy();
    expect(screen.getByText("Active invites")).toBeTruthy();
  });

  it("lets an owner add a member with a temporary password", async () => {
    const service = workspaceService();
    mount(<WorkspaceView service={service} />, service, owner);
    const heading = await screen.findByRole("heading", {
      name: "Add a member",
    });
    const form = heading.closest("form");
    expect(form).toBeTruthy();
    await userEvent.type(
      within(form as HTMLElement).getByLabelText("Email address"),
      "new@example.com",
    );
    await userEvent.type(
      within(form as HTMLElement).getByLabelText("Temporary password"),
      "a-strong-password",
    );
    await userEvent.click(
      within(form as HTMLElement).getByRole("button", { name: "Add member" }),
    );
    await waitFor(() =>
      expect(service.createMember).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "a-strong-password",
        role: "member",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("new@example.com")).toBeTruthy(),
    );
  });

  it("lets an owner change a member role", async () => {
    const service = workspaceService();
    mount(<WorkspaceView service={service} />, service, owner);
    const select = await screen.findByLabelText("Role for member@example.com");
    await userEvent.selectOptions(select, "admin");
    await waitFor(() =>
      expect(service.updateMember).toHaveBeenCalledWith("7", "admin"),
    );
  });

  it("creates a single-use invite with the chosen role and expiry", async () => {
    const service = workspaceService();
    mount(<WorkspaceView service={service} />, service, owner);
    const button = await screen.findByRole("button", {
      name: "Create invite",
    });
    const form = button.closest("form");
    expect(form).toBeTruthy();
    await userEvent.type(
      within(form as HTMLElement).getByLabelText("Email lock (optional)"),
      "friend@example.com",
    );
    await userEvent.selectOptions(
      within(form as HTMLElement).getByLabelText("Expires"),
      "14",
    );
    await userEvent.click(button);
    await waitFor(() =>
      expect(service.createInvite).toHaveBeenCalledWith({
        role: "member",
        email: "friend@example.com",
        expiresInDays: 14,
      }),
    );
    await waitFor(() => expect(screen.getByText("new-code")).toBeTruthy());
  });

  it("does not offer owner-only controls to a plain member", async () => {
    const service = workspaceService({
      getCurrent: vi.fn().mockResolvedValue(workspace({ role: "member" })),
    });
    mount(<WorkspaceView service={service} />, service, member);
    await waitFor(() =>
      expect(
        screen.getByText("Only the workspace owner can rename the workspace."),
      ).toBeTruthy(),
    );
    expect(screen.queryByLabelText("Role for member@example.com")).toBeNull();
  });
});

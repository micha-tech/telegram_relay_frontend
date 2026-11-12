import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkspaceService } from "../src/services/workspace";
import { clearTokens, setTokens } from "../src/services/api";

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
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function envelope(data: unknown, status = 200) {
  return jsonResponse(status, { success: true, data, message: null });
}

const workspacePayload = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  name: "Acme Signals",
  slug: "acme-signals",
  is_active: true,
  role: "owner",
  member_count: 2,
  created_at: "2026-01-01T09:00:00.000Z",
};

const memberPayload = {
  id: 7,
  email: "member@example.com",
  role: "member",
  is_active: true,
  created_at: "2026-01-02T09:00:00.000Z",
};

const invitePayload = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  code: "invite-code-value",
  role: "member",
  email: "",
  created_by_email: "owner@example.com",
  expires_at: "2026-01-09T09:00:00.000Z",
  used_at: null,
  is_usable: true,
  created_at: "2026-01-02T09:00:00.000Z",
};

let fetchMock: ReturnType<typeof vi.fn>;
const service = createWorkspaceService();

beforeEach(() => {
  vi.stubEnv(
    "NEXT_PUBLIC_TELEGRAM_API_BASE_URL",
    "https://api.example.test/api/v1/",
  );
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  clearTokens();
});
afterEach(() => {
  clearTokens();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("workspace api adapter", () => {
  it("reads the current workspace with bearer auth", async () => {
    setTokens({ access: "test-access" });
    fetchMock.mockResolvedValue(envelope(workspacePayload));
    const workspace = await service.getCurrent();
    expect(workspace).toMatchObject({
      name: "Acme Signals",
      slug: "acme-signals",
      role: "owner",
      memberCount: 2,
      isActive: true,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.test/api/v1/tenant/current/");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-access",
    );
  });

  it("lists and changes members", async () => {
    fetchMock
      .mockResolvedValueOnce(envelope([memberPayload]))
      .mockResolvedValueOnce(envelope({ ...memberPayload, role: "admin" }));
    const members = await service.listMembers();
    expect(members[0]).toMatchObject({
      id: "7",
      email: "member@example.com",
      role: "member",
    });
    const updated = await service.updateMember("7", "admin");
    expect(updated.role).toBe("admin");
    const [listUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [updateUrl, updateInit] = fetchMock.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(listUrl).toBe("https://api.example.test/api/v1/tenant/members/");
    expect(updateUrl).toBe("https://api.example.test/api/v1/tenant/members/7/");
    expect(updateInit.method).toBe("PATCH");
    expect(JSON.parse(String(updateInit.body))).toEqual({ role: "admin" });
  });

  it("creates members and invites with the backend field names", async () => {
    fetchMock
      .mockResolvedValueOnce(envelope(memberPayload, 201))
      .mockResolvedValueOnce(envelope(invitePayload, 201));
    await service.createMember({
      email: "member@example.com",
      password: "a-strong-password",
      role: "member",
    });
    await service.createInvite({
      role: "member",
      email: "friend@example.com",
      expiresInDays: 14,
    });

    const [, memberInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(memberInit.body))).toEqual({
      email: "member@example.com",
      password: "a-strong-password",
      role: "member",
    });
    const [, inviteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(String(inviteInit.body))).toEqual({
      role: "member",
      email: "friend@example.com",
      expires_in_days: 14,
    });
  });

  it("previews an invite without authentication", async () => {
    fetchMock.mockResolvedValue(
      envelope({
        tenant_name: "Acme Signals",
        tenant_slug: "acme-signals",
        role: "member",
        email: "",
        expires_at: "2026-01-09T09:00:00.000Z",
      }),
    );
    const preview = await service.previewInvite("invite-code-value");
    expect(preview.tenantName).toBe("Acme Signals");
    expect(preview.role).toBe("member");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.example.test/api/v1/auth/invites/invite-code-value",
    );
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
  });

  it("maps a forbidden response for non administrators", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        success: false,
        data: null,
        message: "This action requires workspace administrator rights.",
        error: { code: "permission_denied", details: null },
      }),
    );
    await expect(service.listInvites()).rejects.toMatchObject({
      code: "forbidden",
    });
  });
});

// Typed adapter for workspace (tenant) administration.
//
// Every user belongs to exactly one workspace. Owners and admins can manage
// members and invite codes; only owners can rename the workspace, create
// admins, or change roles. The backend enforces these rules — the UI mirrors
// them so the controls that would fail are not offered in the first place.

import { ApiError, apiRequest } from "./api";
import type { TenantRole } from "./auth";

export { ApiError as WorkspaceApiError };

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  role: TenantRole | null;
  memberCount: number;
  createdAt: string | null;
}

export interface WorkspaceMember {
  id: string;
  email: string;
  role: TenantRole;
  isActive: boolean;
  createdAt: string | null;
}

export interface WorkspaceInvite {
  id: string;
  code: string;
  role: TenantRole;
  email: string;
  createdByEmail: string;
  expiresAt: string | null;
  usedAt: string | null;
  isUsable: boolean;
  createdAt: string | null;
}

export interface InvitePreview {
  tenantName: string;
  tenantSlug: string;
  role: TenantRole;
  email: string;
  expiresAt: string | null;
}

export interface CreateMemberInput {
  email: string;
  password: string;
  role?: Exclude<TenantRole, "owner">;
}

export interface CreateInviteInput {
  role?: Exclude<TenantRole, "owner">;
  email?: string;
  expiresInDays?: number;
}

export interface WorkspaceService {
  getCurrent(): Promise<Workspace>;
  rename(name: string): Promise<Workspace>;
  listMembers(): Promise<WorkspaceMember[]>;
  createMember(input: CreateMemberInput): Promise<WorkspaceMember>;
  updateMember(id: string, role: TenantRole): Promise<WorkspaceMember>;
  removeMember(id: string): Promise<void>;
  listInvites(): Promise<WorkspaceInvite[]>;
  createInvite(input?: CreateInviteInput): Promise<WorkspaceInvite>;
  revokeInvite(id: string): Promise<void>;
  previewInvite(code: string): Promise<InvitePreview>;
}

export const INVITE_ROLES: Exclude<TenantRole, "owner">[] = ["member", "admin"];

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

function readNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return fallback;
}

function readRole(value: unknown): TenantRole {
  return value === "owner" || value === "admin" || value === "member"
    ? value
    : "member";
}

function parseWorkspace(value: unknown): Workspace {
  const record = asRecord(value);
  const id = record ? readId(record.id) : null;
  const name = record ? readString(record, "name") : null;
  if (!record || !id || !name)
    throw new ApiError({
      code: "server",
      message: "The workspace service returned an unexpected response.",
    });
  const role = record.role;
  return {
    id,
    name,
    slug: readString(record, "slug") ?? "",
    isActive: record.is_active !== false,
    role:
      role === "owner" || role === "admin" || role === "member" ? role : null,
    memberCount: readNumber(record.member_count, 0),
    createdAt: readString(record, "created_at"),
  };
}

function parseMember(value: unknown): WorkspaceMember {
  const record = asRecord(value);
  const id = record ? readId(record.id) : null;
  const email = record ? readString(record, "email") : null;
  if (!record || !id || !email)
    throw new ApiError({
      code: "server",
      message: "The workspace service returned an unexpected member.",
    });
  return {
    id,
    email,
    role: readRole(record.role),
    isActive: record.is_active !== false,
    createdAt: readString(record, "created_at"),
  };
}

function parseInvite(value: unknown): WorkspaceInvite {
  const record = asRecord(value);
  const id = record ? readId(record.id) : null;
  const code = record ? readString(record, "code") : null;
  if (!record || !id || !code)
    throw new ApiError({
      code: "server",
      message: "The workspace service returned an unexpected invite.",
    });
  return {
    id,
    code,
    role: readRole(record.role),
    email: readString(record, "email") ?? "",
    createdByEmail: readString(record, "created_by_email") ?? "",
    expiresAt: readString(record, "expires_at"),
    usedAt: readString(record, "used_at"),
    isUsable: record.is_usable === true,
    createdAt: readString(record, "created_at"),
  };
}

function parsePreview(value: unknown): InvitePreview {
  const record = asRecord(value);
  const tenantName = record ? readString(record, "tenant_name") : null;
  if (!record || !tenantName)
    throw new ApiError({
      code: "server",
      message: "The workspace service returned an unexpected invite.",
    });
  return {
    tenantName,
    tenantSlug: readString(record, "tenant_slug") ?? "",
    role: readRole(record.role),
    email: readString(record, "email") ?? "",
    expiresAt: readString(record, "expires_at"),
  };
}

function parseList<T>(payload: unknown, parse: (value: unknown) => T): T[] {
  const record = asRecord(payload);
  const list = Array.isArray(payload)
    ? payload
    : record && Array.isArray(record.results)
      ? record.results
      : null;
  if (!list)
    throw new ApiError({
      code: "server",
      message: "The workspace service returned an unexpected list.",
    });
  return list.map(parse);
}

const memberPath = (id: string) => `/tenant/members/${encodeURIComponent(id)}/`;
const invitePath = (id: string) => `/tenant/invites/${encodeURIComponent(id)}/`;

export function workspaceErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "forbidden")
      return "Only workspace administrators can manage this workspace.";
    if (error.code === "unavailable")
      return "Workspace management is not configured for this deployment yet.";
    return error.message;
  }
  if (error instanceof TypeError)
    return "We couldn’t reach the workspace service. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export function createWorkspaceService(): WorkspaceService {
  return {
    async getCurrent() {
      return parseWorkspace(
        await apiRequest<unknown>("/tenant/current/", { auth: true }),
      );
    },
    async rename(name) {
      return parseWorkspace(
        await apiRequest<unknown>("/tenant/rename/", {
          method: "PATCH",
          auth: true,
          body: { name },
        }),
      );
    },
    async listMembers() {
      return parseList(
        await apiRequest<unknown>("/tenant/members/", { auth: true }),
        parseMember,
      );
    },
    async createMember(input) {
      return parseMember(
        await apiRequest<unknown>("/tenant/members/", {
          method: "POST",
          auth: true,
          body: {
            email: input.email,
            password: input.password,
            role: input.role ?? "member",
          },
        }),
      );
    },
    async updateMember(id, role) {
      return parseMember(
        await apiRequest<unknown>(memberPath(id), {
          method: "PATCH",
          auth: true,
          body: { role },
        }),
      );
    },
    async removeMember(id) {
      await apiRequest<unknown>(memberPath(id), {
        method: "DELETE",
        auth: true,
      });
    },
    async listInvites() {
      return parseList(
        await apiRequest<unknown>("/tenant/invites/", { auth: true }),
        parseInvite,
      );
    },
    async createInvite(input = {}) {
      return parseInvite(
        await apiRequest<unknown>("/tenant/invites/", {
          method: "POST",
          auth: true,
          body: {
            role: input.role ?? "member",
            email: input.email ?? "",
            expires_in_days: input.expiresInDays ?? 7,
          },
        }),
      );
    },
    async revokeInvite(id) {
      await apiRequest<unknown>(invitePath(id), {
        method: "DELETE",
        auth: true,
      });
    },
    async previewInvite(code) {
      return parsePreview(
        await apiRequest<unknown>(
          `/auth/invites/${encodeURIComponent(code.trim())}`,
        ),
      );
    },
  };
}

export const workspaceService = createWorkspaceService();

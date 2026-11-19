"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSession } from "../services/session";
import { workspaceErrorMessage, workspaceService } from "../services/workspace";
import type {
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceService,
} from "../services/workspace";
import type { TenantRole } from "../services/auth";

const ROLE_LABELS: Record<TenantRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function formatWhen(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function alreadyExpired(invite: WorkspaceInvite) {
  if (!invite.expiresAt) return false;
  const parsed = new Date(invite.expiresAt);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() <= Date.now();
}

export function WorkspaceView({
  service = workspaceService,
}: {
  service?: WorkspaceService;
}) {
  const { user } = useSession();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const isOwner = user?.role === "owner" || user?.isSuperuser === true;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [current, memberList, inviteList] = await Promise.all([
        service.getCurrent(),
        service.listMembers(),
        service.listInvites(),
      ]);
      setWorkspace(current);
      setMembers(memberList);
      setInvites(inviteList);
      setName(current.name);
      setErrorMessage("");
    } catch (err) {
      setErrorMessage(workspaceErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void load();
  }, [load]);

  function flash(message: string) {
    setNotice(message);
    setActionError("");
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setActionError("");
    setNotice("");
    try {
      await action();
    } catch (err) {
      setActionError(workspaceErrorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !workspace || trimmed === workspace.name) return;
    await run("rename", async () => {
      const updated = await service.rename(trimmed);
      setWorkspace(updated);
      setName(updated.name);
      flash("Workspace name updated.");
    });
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("member-email") ?? "").trim();
    const password = String(values.get("member-password") ?? "");
    const role = String(values.get("member-role") ?? "member") as
      "admin" | "member";
    if (!email || !password) {
      setActionError("Enter an email address and a temporary password.");
      return;
    }
    await run("add-member", async () => {
      const member = await service.createMember({ email, password, role });
      setMembers((current) => [...current, member]);
      setWorkspace((current) =>
        current
          ? { ...current, memberCount: current.memberCount + 1 }
          : current,
      );
      form.reset();
      flash(`Added ${member.email}. Share the temporary password with them.`);
    });
  }

  async function changeRole(member: WorkspaceMember, role: TenantRole) {
    await run(`role-${member.id}`, async () => {
      const updated = await service.updateMember(member.id, role);
      setMembers((current) =>
        current.map((row) => (row.id === updated.id ? updated : row)),
      );
      flash(
        `${updated.email} is now ${ROLE_LABELS[updated.role].toLowerCase()}.`,
      );
    });
  }

  async function removeMember(member: WorkspaceMember) {
    await run(`remove-${member.id}`, async () => {
      await service.removeMember(member.id);
      setMembers((current) => current.filter((row) => row.id !== member.id));
      setWorkspace((current) =>
        current
          ? {
              ...current,
              memberCount: Math.max(0, current.memberCount - 1),
            }
          : current,
      );
      flash(`Removed ${member.email}. Their account is deactivated.`);
    });
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const role = String(values.get("invite-role") ?? "member") as
      "admin" | "member";
    const email = String(values.get("invite-email") ?? "").trim();
    const days = Number(values.get("invite-days") ?? 7);
    await run("create-invite", async () => {
      const invite = await service.createInvite({
        role,
        email,
        expiresInDays: days,
      });
      setInvites((current) => [invite, ...current]);
      form.reset();
      flash("Invite created. Copy the code or link and share it.");
    });
  }

  async function copyInvite(invite: WorkspaceInvite) {
    const link = `${window.location.origin}/signup?invite=${encodeURIComponent(invite.code)}`;
    try {
      await navigator.clipboard.writeText(link);
      flash("Invite link copied to the clipboard.");
    } catch {
      flash("Copy the invite code or link below and share it manually.");
    }
  }

  async function revokeInvite(invite: WorkspaceInvite) {
    await run(`revoke-${invite.id}`, async () => {
      await service.revokeInvite(invite.id);
      setInvites((current) => current.filter((row) => row.id !== invite.id));
      flash("Invite revoked.");
    });
  }

  if (loading && !workspace)
    return (
      <div className="ws-page" role="status">
        Loading your workspace…
      </div>
    );

  return (
    <div className="ws-page">
      <header className="tg-header">
        <div className="tg-header-copy">
          <span className="eyebrow">WORKSPACE</span>
          <h1>{workspace?.name ?? "Your workspace"}</h1>
          <p>
            Manage who can see this workspace’s signal feed and who can connect
            Telegram accounts and manage watched chats.
          </p>
        </div>
        <button
          type="button"
          className="button button-secondary tg-refresh"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {errorMessage && (
        <div className="form-alert" role="alert">
          <b>We couldn’t load this workspace.</b>
          <span>{errorMessage}</span>
        </div>
      )}
      {actionError && (
        <div className="form-alert" role="alert">
          <span>{actionError}</span>
        </div>
      )}
      {notice && (
        <div className="ws-notice" role="status">
          {notice}
        </div>
      )}

      {workspace && (
        <>
          <section className="tg-summary" aria-label="Workspace summary">
            <div className="tg-stat">
              <span className="tg-stat-value">{workspace.memberCount}</span>
              <span className="tg-stat-label">Members</span>
            </div>
            <div className="tg-stat">
              <span className="tg-stat-value">
                {invites.filter((invite) => invite.isUsable).length}
              </span>
              <span className="tg-stat-label">Active invites</span>
            </div>
            <div className="tg-stat">
              <span className="tg-stat-value">{user?.role ?? "member"}</span>
              <span className="tg-stat-label">Your role</span>
            </div>
            <div className="tg-stat">
              <span className="tg-stat-value">{workspace.slug}</span>
              <span className="tg-stat-label">Workspace ID</span>
            </div>
          </section>

          <section className="ws-section" aria-labelledby="ws-name-title">
            <div className="ws-section-head">
              <div>
                <h2 id="ws-name-title">Workspace name</h2>
                <p>Shown to every member and on invite links.</p>
              </div>
            </div>
            {isOwner ? (
              <form className="ws-inline-form" onSubmit={rename}>
                <label className="sig-field sig-field-grow">
                  <span>Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={255}
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={
                    busy === "rename" ||
                    !name.trim() ||
                    name.trim() === workspace.name
                  }
                >
                  {busy === "rename" ? "Saving…" : "Save name"}
                </button>
              </form>
            ) : (
              <p className="ws-muted">
                Only the workspace owner can rename the workspace.
              </p>
            )}
          </section>

          <section className="ws-section" aria-labelledby="ws-members-title">
            <div className="ws-section-head">
              <div>
                <h2 id="ws-members-title">Members ({members.length})</h2>
                <p>
                  Admins can connect Telegram accounts and manage signal
                  sources. Members read the signal feed.
                </p>
              </div>
            </div>

            <ul className="ws-list">
              {members.map((member) => {
                const self = String(member.id) === String(user?.id);
                const canChangeRole = isOwner && !self;
                const canRemove =
                  !self && (isOwner || member.role === "member");
                return (
                  <li className="ws-row" key={member.id}>
                    <div className="ws-row-main">
                      <b>{member.email}</b>
                      <span className="ws-muted">
                        {self ? "You · " : ""}
                        {ROLE_LABELS[member.role]} · joined{" "}
                        {formatWhen(member.createdAt)}
                        {member.isActive ? "" : " · deactivated"}
                      </span>
                    </div>
                    <div className="ws-row-actions">
                      {canChangeRole ? (
                        <label className="ws-role">
                          <span className="visually-hidden">
                            Role for {member.email}
                          </span>
                          <select
                            aria-label={`Role for ${member.email}`}
                            value={member.role}
                            disabled={busy === `role-${member.id}`}
                            onChange={(event) =>
                              void changeRole(
                                member,
                                event.target.value as TenantRole,
                              )
                            }
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                        </label>
                      ) : (
                        <span className="ws-badge">
                          {ROLE_LABELS[member.role]}
                        </span>
                      )}
                      {canRemove && (
                        <button
                          type="button"
                          className="text-button"
                          disabled={busy === `remove-${member.id}`}
                          onClick={() => void removeMember(member)}
                        >
                          {busy === `remove-${member.id}`
                            ? "Removing…"
                            : "Remove"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <form className="ws-form" onSubmit={addMember}>
              <h3>Add a member</h3>
              <p>
                Creates an account with a temporary password. No email service
                is required — share the password directly.
              </p>
              <div className="ws-form-grid">
                <label className="sig-field sig-field-grow">
                  <span>Email address</span>
                  <input
                    name="member-email"
                    type="email"
                    autoComplete="off"
                    required
                  />
                </label>
                <label className="sig-field">
                  <span>Temporary password</span>
                  <input
                    name="member-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>
                <label className="sig-field">
                  <span>Role</span>
                  <select name="member-role" defaultValue="member">
                    <option value="member">Member</option>
                    {isOwner && <option value="admin">Admin</option>}
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="button button-primary"
                disabled={busy === "add-member"}
              >
                {busy === "add-member" ? "Adding…" : "Add member"}
              </button>
            </form>
          </section>

          <section className="ws-section" aria-labelledby="ws-invites-title">
            <div className="ws-section-head">
              <div>
                <h2 id="ws-invites-title">Invite codes</h2>
                <p>
                  Single-use codes that let someone create their own account
                  inside this workspace.
                </p>
              </div>
            </div>

            <form className="ws-form" onSubmit={createInvite}>
              <div className="ws-form-grid">
                <label className="sig-field sig-field-grow">
                  <span>Email lock (optional)</span>
                  <input
                    name="invite-email"
                    type="email"
                    autoComplete="off"
                    placeholder="Only this address can use the code"
                  />
                </label>
                <label className="sig-field">
                  <span>Role</span>
                  <select name="invite-role" defaultValue="member">
                    <option value="member">Member</option>
                    {isOwner && <option value="admin">Admin</option>}
                  </select>
                </label>
                <label className="sig-field">
                  <span>Expires</span>
                  <select name="invite-days" defaultValue="7">
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                  </select>
                </label>
              </div>
              <button
                type="submit"
                className="button button-primary"
                disabled={busy === "create-invite"}
              >
                {busy === "create-invite" ? "Creating…" : "Create invite"}
              </button>
            </form>

            {invites.length === 0 ? (
              <p className="ws-muted">No invites yet.</p>
            ) : (
              <ul className="ws-list">
                {invites.map((invite) => {
                  const expired = alreadyExpired(invite);
                  const usable = invite.isUsable && !expired;
                  return (
                    <li className="ws-row" key={invite.id}>
                      <div className="ws-row-main">
                        <code className="ws-code">{invite.code}</code>
                        <span className="ws-muted">
                          {ROLE_LABELS[invite.role]} ·{" "}
                          {invite.email
                            ? `locked to ${invite.email}`
                            : "any email"}{" "}
                          · expires {formatWhen(invite.expiresAt)}
                          {invite.usedAt
                            ? ` · used ${formatWhen(invite.usedAt)}`
                            : expired
                              ? " · expired"
                              : ""}
                        </span>
                      </div>
                      <div className="ws-row-actions">
                        <button
                          type="button"
                          className="text-button"
                          disabled={!usable}
                          onClick={() => void copyInvite(invite)}
                        >
                          Copy link
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          disabled={
                            busy === `revoke-${invite.id}` || !!invite.usedAt
                          }
                          onClick={() => void revokeInvite(invite)}
                        >
                          {busy === `revoke-${invite.id}`
                            ? "Revoking…"
                            : "Revoke"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

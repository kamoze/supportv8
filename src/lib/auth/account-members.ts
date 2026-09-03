import { getAdminToken, getKeycloakConfig, supportOperatorDisplayName } from "./keycloak";
import type { RequestTenantContext } from "./request-tenant";
import type { TenantMember } from "@/lib/types/marketplace-types";
import { invitationStore } from "./invitation-store";
import { sendInvitationEmail } from "./invitation-email";
import { passwordPolicyError } from "./password-policy";
import { tenantSlugFromId } from "./request-tenant";

export class AccountError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

export const MEMBER_ROLES = {
  "Owner / CX Director": "support_superadmin",
  "CX Operations Lead": "support_cx_lead",
  "Contractor Lead": "support_contractor_lead",
  "Field Technician": "support_technician",
  "Tier 2 Escalation Agent": "support_operator",
  "Security & Compliance Auditor": "support_observer",
} as const;

type User = {
  id: string; username?: string; email?: string; firstName?: string; lastName?: string;
  enabled?: boolean; emailVerified?: boolean; totp?: boolean; serviceAccountClientId?: string;
  attributes?: Record<string, string[]>; requiredActions?: string[];
};
type Role = { id: string; name: string; composite?: boolean };

export function requireAccountIdentity(ctx: RequestTenantContext) {
  if (!ctx.authenticated || !ctx.userId || ctx.roles.includes("support_demo_operator")) {
    throw new AccountError("A signed-in staff account is required.", 403);
  }
}

export function requireAccountManager(ctx: RequestTenantContext) {
  requireAccountIdentity(ctx);
  if (!ctx.roles.some(r => r === "support_superadmin" || r === "support_cx_lead")) {
    throw new AccountError("Only workspace owners and CX leads can manage members.", 403);
  }
}

export function profileName(value: unknown, optional = false): string {
  if (typeof value !== "string") throw new AccountError("Enter a valid name.");
  const name = value.trim().replace(/\s+/g, " ");
  if ((!optional && !name) || name.length > 80 || /[@\x00-\x1f\x7f]/.test(name)) {
    throw new AccountError("Use a name up to 80 characters, not an email address.");
  }
  return name;
}

// Keycloak is the durable identity authority. Nothing here accepts a tenant,
// subject, role mapping, or security attribute from a profile form.
export class AccountMembers {
  private async api() {
    const config = getKeycloakConfig();
    const token = await getAdminToken();
    const base = `${config.adminBaseUrl}/admin/realms/${encodeURIComponent(config.realm || "supportv8")}`;
    return async <T>(path: string, method = "GET", body?: unknown): Promise<T> => {
      const response = await fetch(`${base}${path}`, {
        method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8_000),
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        throw new AccountError(response.status === 409 ? "An account with that email already exists." :
          "Account service could not complete the request. Refresh and try again.", response.status === 409 ? 409 : 503);
      }
      if (response.status === 204 || response.status === 201) return response as T;
      return response.json() as Promise<T>;
    };
  }

  private async user(api: Awaited<ReturnType<AccountMembers["api"]>>, ctx: RequestTenantContext, id: string) {
    const user = await api<User>(`/users/${encodeURIComponent(id)}`);
    if (user.serviceAccountClientId || user.attributes?.tenant_id?.length !== 1 || user.attributes.tenant_id[0] !== ctx.tenantId) {
      throw new AccountError("Member not found in this workspace.", 404);
    }
    return user;
  }

  private async manager(ctx: RequestTenantContext) {
    requireAccountManager(ctx);
    const api = await this.api();
    const actor = await this.user(api, ctx, ctx.userId!);
    const roles = await api<Role[]>(`/users/${encodeURIComponent(actor.id)}/role-mappings/realm/composite`);
    if (!actor.enabled || !roles.some(r => r.name === "support_superadmin" || r.name === "support_cx_lead")) {
      throw new AccountError("Your account no longer has member-management permission.", 403);
    }
    return { api, owner: roles.some(r => r.name === "support_superadmin") };
  }

  private member(user: User, roles: Role[]): TenantMember {
    const role = Object.entries(MEMBER_ROLES).find(([, value]) => roles.some(r => r.name === value))?.[0] as TenantMember["role"] | undefined;
    return {
      id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Staff member",
      email: user.email || user.username || "", role: role || "No SupportV8 Access",
      status: !user.enabled ? "disabled" : user.requiredActions?.length ? "invited" : "active",
      twoFactorEnabled: user.totp === true, lastActive: "Not currently online", avatarUrl: "",
    };
  }

  async list(ctx: RequestTenantContext, first = 0) {
    const { api, owner } = await this.manager(ctx);
    const users = await api<User[]>(`/users?q=${encodeURIComponent(`tenant_id:${ctx.tenantId}`)}&briefRepresentation=false&first=${first}&max=50`);
    const scoped = users.filter(u => !u.serviceAccountClientId && u.attributes?.tenant_id?.length === 1 && u.attributes.tenant_id[0] === ctx.tenantId);
    const members: TenantMember[] = [];
    // Bounded batches avoid one request per member running simultaneously.
    for (let i = 0; i < scoped.length; i += 5) {
      members.push(...await Promise.all(scoped.slice(i, i + 5).map(async user =>
        this.member(user, await api<Role[]>(`/users/${encodeURIComponent(user.id)}/role-mappings/realm/composite`)))));
    }
    return { members, hasMore: users.length === 50, owner, actorId: ctx.userId };
  }

  async profile(ctx: RequestTenantContext, updates?: { firstName: unknown; nickname: unknown }) {
    requireAccountIdentity(ctx);
    const api = await this.api();
    let user = await this.user(api, ctx, ctx.userId!);
    if (!user.enabled) throw new AccountError("This account is disabled.", 403);
    if (updates) {
      user = { ...user, firstName: profileName(updates.firstName), attributes: {
        ...user.attributes, nickname: [profileName(updates.nickname, true)],
      } };
      await api(`/users/${encodeURIComponent(user.id)}`, "PUT", {
        firstName: user.firstName, lastName: user.lastName, attributes: user.attributes,
      });
      user = await this.user(api, ctx, ctx.userId!);
      if (user.firstName !== profileName(updates.firstName) || (user.attributes?.nickname?.[0] || "") !== profileName(updates.nickname, true)) {
        throw new AccountError("Your identity provider has not enabled this profile field yet. Please contact your workspace administrator.", 503);
      }
    }
    return { firstName: user.firstName || "", nickname: user.attributes?.nickname?.[0] || "",
      name: supportOperatorDisplayName({ given_name: user.firstName, nickname: user.attributes?.nickname?.[0], preferred_username: user.username }) };
  }

  async update(ctx: RequestTenantContext, id: string, updates: Record<string, unknown>) {
    const { api, owner } = await this.manager(ctx);
    const user = await this.user(api, ctx, id);
    const path = `/users/${encodeURIComponent(id)}`;
    const roles = await api<Role[]>(`${path}/role-mappings/realm/composite`);
    const oldMember = this.member(user, roles);
    const role = updates.role as TenantMember["role"];
    if (!Object.hasOwn(MEMBER_ROLES, role) || !["active", "disabled", "invited"].includes(String(updates.status))) {
      throw new AccountError("Choose a supported role and account status.");
    }
    const changingAccess = role !== oldMember.role || updates.status !== oldMember.status;
    if (changingAccess && (id === ctx.userId || roles.some(r => r.name === "support_superadmin"))) {
      throw new AccountError("Your own access and owner accounts cannot be changed here.", 403);
    }
    if (!owner && (role === "Owner / CX Director" || role === "CX Operations Lead" || oldMember.role === "CX Operations Lead")) {
      throw new AccountError("Only an owner can manage leadership access.", 403);
    }
    const firstName = profileName(updates.name);
    if (changingAccess) {
      const next = await api<Role>(`/roles/${MEMBER_ROLES[role as keyof typeof MEMBER_ROLES]}`);
      if (next.composite) throw new AccountError("Composite roles must be managed by the identity administrator.", 403);
      const direct = await api<Role[]>(`${path}/role-mappings/realm`);
      // Refuse inherited or unfamiliar support roles instead of falsely claiming a downgrade.
      const inherited = roles.filter(r => r.name.startsWith("support_") && !direct.some(d => d.id === r.id));
      if (inherited.length) throw new AccountError("Inherited roles must be changed in the identity provider.", 409);
      const removable = direct.filter(r => r.name.startsWith("support_"));
      if (removable.length) await api(`${path}/role-mappings/realm`, "DELETE", removable);
      await api(`${path}/role-mappings/realm`, "POST", [next]);
    }
    await api(path, "PUT", { firstName, lastName: "", enabled: updates.status !== "disabled" });
    if (changingAccess) await api(`${path}/logout`, "POST");
    return this.member(await this.user(api, ctx, id), await api<Role[]>(`${path}/role-mappings/realm/composite`));
  }

  async invite(ctx: RequestTenantContext, input: Record<string, unknown>) {
    const { api, owner } = await this.manager(ctx);
    const name = profileName(input.name);
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
    const role = input.role as TenantMember["role"];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !Object.hasOwn(MEMBER_ROLES, role)) throw new AccountError("Enter a valid email and role.");
    if (!owner && (role === "Owner / CX Director" || role === "CX Operations Lead")) throw new AccountError("Only owners can invite leadership roles.", 403);
    const nextRole = await api<Role>(`/roles/${MEMBER_ROLES[role as keyof typeof MEMBER_ROLES]}`);
    if (nextRole.composite) throw new AccountError("Composite roles cannot be assigned here.", 403);
    const response = await api<Response>("/users", "POST", {
      username: email, email, firstName: name, enabled: true, emailVerified: false,
      attributes: { tenant_id: [ctx.tenantId] }, requiredActions: ["VERIFY_EMAIL", "UPDATE_PASSWORD"],
    });
    const id = response.headers.get("location")?.split("/").pop();
    if (!id) throw new AccountError("Account creation could not be confirmed. Refresh the roster before retrying.", 503);
    await this.user(api, ctx, id);
    await api(`/users/${encodeURIComponent(id)}/role-mappings/realm`, "POST", [nextRole]);
    let invitationSent = false;
    try {
      const token = await invitationStore.issue({ tenantId: ctx.tenantId, userId: id, email });
      invitationSent = await sendInvitationEmail(email, tenantSlugFromId(ctx.tenantId), token);
    } catch { /* Account exists; the manager can resend after the service recovers. */ }
    return { member: this.member(await this.user(api, ctx, id), [nextRole]), invitationSent };
  }

  async resendInvite(ctx: RequestTenantContext, id: string) {
    const { api, owner } = await this.manager(ctx);
    const user = await this.user(api, ctx, id);
    const roles = await api<Role[]>(`/users/${encodeURIComponent(id)}/role-mappings/realm/composite`);
    if (!owner && roles.some(r => ["support_superadmin", "support_cx_lead"].includes(r.name))) throw new AccountError("Only owners can manage leadership invitations.", 403);
    if (!user.enabled || user.emailVerified || !user.requiredActions?.includes("VERIFY_EMAIL") || !user.email) throw new AccountError("This account has no pending invitation.");
    const token = await invitationStore.issue({ tenantId: ctx.tenantId, userId: user.id, email: user.email });
    if (!await sendInvitationEmail(user.email, tenantSlugFromId(ctx.tenantId), token)) throw new AccountError("Invitation email could not be delivered. Please retry in one minute.", 503);
  }

  async acceptInvitation(tenantId: string, token: string, password: unknown, ip: string) {
    const invalidPassword = passwordPolicyError(password);
    if (invalidPassword || (password as string).length > 256) throw new AccountError(invalidPassword || "Password must be no longer than 256 characters.");
    const claim = await invitationStore.consume(tenantId, token, ip);
    try {
      const api = await this.api();
      const ctx: RequestTenantContext = { tenantId, tenantSlug: tenantSlugFromId(tenantId), authenticated: false, roles: [] };
      const user = await this.user(api, ctx, claim.invitation.userId);
      const actions = user.requiredActions || [];
      if (!user.enabled || user.emailVerified || user.email?.toLowerCase() !== claim.invitation.email.toLowerCase() ||
          !actions.includes("VERIFY_EMAIL") || actions.some(action => !["VERIFY_EMAIL", "UPDATE_PASSWORD"].includes(action))) {
        throw new AccountError("This invitation can no longer activate the account. Sign in or contact your workspace administrator.", 409);
      }
      const path = `/users/${encodeURIComponent(user.id)}`;
      // Do not enable users or assign roles here. Those remain manager-controlled.
      await api(`${path}/reset-password`, "PUT", { type: "password", value: password, temporary: false });
      await api(path, "PUT", { emailVerified: true, requiredActions: [] });
      const confirmed = await this.user(api, ctx, user.id);
      if (!confirmed.emailVerified || confirmed.requiredActions?.length) throw new AccountError("Setup could not be confirmed. Please contact your workspace administrator.", 503);
      return { success: true };
    } catch (error) {
      if (error instanceof AccountError && error.status < 500) throw error;
      throw new AccountError("Account setup could not be completed. Ask your administrator for a new invitation, or try signing in if setup already completed.", 503);
    } finally {
      try { await claim.release(); } catch { /* The short processing lease expires automatically. */ }
    }
  }
}

export const accountMembers = new AccountMembers();

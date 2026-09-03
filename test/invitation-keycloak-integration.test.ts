import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Redis from "ioredis";
vi.mock("@/lib/auth/invitation-email", () => ({ sendInvitationEmail: vi.fn(async () => true) }));
import { sendInvitationEmail } from "@/lib/auth/invitation-email";
import { AccountMembers } from "@/lib/auth/account-members";
import type { RequestTenantContext } from "@/lib/auth/request-tenant";

const enabled = process.env.SUPPORTV8_RUN_IDENTITY_INTEGRATION === "true";
describe.skipIf(!enabled)("real Keycloak 26 first-party invitations", () => {
  const base = "http://127.0.0.1:18089";
  const realm = `invitation-test-${randomUUID()}`;
  const tenantId = `tenant_${randomUUID().replaceAll("-", "")}`;
  let masterToken = "";
  let realmCreated = false;
  let ctx: RequestTenantContext;
  async function admin(path: string, method = "GET", body?: unknown): Promise<any> {
    const response = await fetch(`${base}/admin/${path}`, { method,
      headers: { Authorization: `Bearer ${masterToken}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body) });
    expect(response.ok, `${method} ${path}: ${response.status}`).toBe(true);
    if (response.status === 204 || response.status === 201) return response;
    return response.json();
  }
  beforeAll(async () => {
    // Deliberately fixed loopback endpoints: this test must never mutate a live realm.
    expect(process.env.REDIS_URL).toBe("redis://127.0.0.1:56380");
    const response = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
      method: "POST", body: new URLSearchParams({ grant_type: "password", client_id: "admin-cli",
        username: "local-test-admin", password: "local-invitation-test-only" }),
    });
    expect(response.ok).toBe(true); masterToken = (await response.json()).access_token;
    await admin("realms", "POST", { realm, enabled: true }); realmCreated = true;
    const profile = await admin(`realms/${realm}/users/profile`);
    for (const attr of profile.attributes) if (["firstName", "lastName"].includes(attr.name)) delete attr.required;
    profile.attributes.push({ name: "tenant_id", multivalued: false, permissions: { view: ["admin"], edit: ["admin"] } });
    await admin(`realms/${realm}/users/profile`, "PUT", profile);
    for (const name of ["support_superadmin", "support_operator"]) await admin(`realms/${realm}/roles`, "POST", { name });
    await admin(`realms/${realm}/clients`, "POST", { clientId: "supportv8-app", publicClient: true, directAccessGrantsEnabled: true, standardFlowEnabled: false });
    const secret = randomUUID();
    await admin(`realms/${realm}/clients`, "POST", { clientId: "supportv8-admin-sa", secret, publicClient: false, serviceAccountsEnabled: true, standardFlowEnabled: false });
    const [service] = await admin(`realms/${realm}/clients?clientId=supportv8-admin-sa`);
    const serviceUser = await admin(`realms/${realm}/clients/${service.id}/service-account-user`);
    const [management] = await admin(`realms/${realm}/clients?clientId=realm-management`);
    const permissions = await Promise.all(["manage-users", "view-realm"].map(name => admin(`realms/${realm}/clients/${management.id}/roles/${name}`)));
    await admin(`realms/${realm}/users/${serviceUser.id}/role-mappings/clients/${management.id}`, "POST", permissions);
    const created = await admin(`realms/${realm}/users`, "POST", { username: "owner@example.test", email: "owner@example.test", firstName: "Owner", enabled: true, emailVerified: true, attributes: { tenant_id: [tenantId] } });
    const ownerId = created.headers.get("location").split("/").pop();
    const role = await admin(`realms/${realm}/roles/support_superadmin`);
    await admin(`realms/${realm}/users/${ownerId}/role-mappings/realm`, "POST", [role]);
    vi.stubEnv("KEYCLOAK_ADMIN_BASE_URL", base); vi.stubEnv("SUPPORTV8_OIDC_REALM", realm);
    vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_ID", "supportv8-admin-sa"); vi.stubEnv("KEYCLOAK_ADMIN_CLIENT_SECRET", secret);
    ctx = { tenantId, tenantSlug: tenantId.slice(7), authenticated: true, userId: ownerId, roles: ["support_superadmin"] };
  }, 30_000);
  afterAll(async () => {
    if (realmCreated) await admin(`realms/${realm}`, "DELETE");
    if (process.env.REDIS_URL === "redis://127.0.0.1:56380") {
      const redis = new Redis(process.env.REDIS_URL);
      const keys = await redis.keys(`supportv8:auth:invitation:{${tenantId}}:*`);
      if (keys.length) await redis.del(...keys); await redis.quit();
    }
    vi.unstubAllEnvs();
  });
  it("invites, activates, logs in, then rejects replay using the real realm-scoped service account", async () => {
    const accounts = new AccountMembers();
    const result = await accounts.invite(ctx, { name: "Jamie", email: "jamie@example.test", role: "Tier 2 Escalation Agent" });
    expect(result.invitationSent).toBe(true); expect(result.member.status).toBe("invited");
    const token = vi.mocked(sendInvitationEmail).mock.calls[0][2];
    const password = "local-invitation-passphrase";
    await expect(accounts.acceptInvitation(tenantId, token, password, "local-ip")).resolves.toEqual({ success: true });
    const user = await admin(`realms/${realm}/users/${result.member.id}`);
    expect(user.emailVerified).toBe(true); expect(user.requiredActions).toEqual([]);
    expect(user.attributes.tenant_id).toEqual([tenantId]);
    const login = await fetch(`${base}/realms/${realm}/protocol/openid-connect/token`, {
      method: "POST", body: new URLSearchParams({ grant_type: "password", client_id: "supportv8-app", username: "jamie@example.test", password }),
    });
    expect(login.ok, `direct sign-in status ${login.status}`).toBe(true);
    await expect(accounts.acceptInvitation(tenantId, token, "different-password", "local-ip")).rejects.toThrow(/already used/);
    await expect(accounts.resendInvite(ctx, result.member.id)).rejects.toThrow(/no pending invitation/);
  }, 30_000);
});

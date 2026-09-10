import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/keycloak", async original => ({ ...await original<typeof import("@/lib/auth/keycloak")>(),
  getAdminToken: vi.fn(async () => "admin-test-token"), getKeycloakConfig: () => ({ adminBaseUrl: "http://identity.test", realm: "supportv8" }) }));
import { AccountMembers, profileName } from "@/lib/auth/account-members";
import type { RequestTenantContext } from "@/lib/auth/request-tenant";
vi.mock("@/lib/auth/invitation-store", () => ({ invitationStore: { issue: vi.fn(async () => "test-invite"), consume: vi.fn() } }));
vi.mock("@/lib/auth/invitation-email", () => ({ sendInvitationEmail: vi.fn() }));
import { invitationStore } from "@/lib/auth/invitation-store";
import { sendInvitationEmail } from "@/lib/auth/invitation-email";

const ctx: RequestTenantContext = { tenantId: "tenant_alpha", tenantSlug: "alpha", authenticated: true, userId: "owner", roles: ["support_superadmin"] };
const ownerRole = { id: "r1", name: "support_superadmin" };
const operatorRole = { id: "r2", name: "support_operator" };
let users: Record<string, any>;
let mappings: Record<string, any[]>;
let calls: Array<{ path: string; method: string; body: any }>;
beforeEach(() => {
  vi.clearAllMocks(); calls = [];
  vi.mocked(sendInvitationEmail).mockResolvedValue(true);
  users = {
    owner: { id: "owner", username: "owner@alpha.com", firstName: "Robin", enabled: true, attributes: { tenant_id: ["tenant_alpha"] } },
    agent: { id: "agent", username: "agent@alpha.com", firstName: "Casey", enabled: true, attributes: { tenant_id: ["tenant_alpha"], existing: ["keep"] } },
    other: { id: "other", username: "other@beta.com", enabled: true, attributes: { tenant_id: ["tenant_beta"] } },
  };
  mappings = { owner: [ownerRole], agent: [operatorRole], other: [operatorRole] };
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname.replace("/admin/realms/supportv8", "");
    const method = init?.method || "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ path, method, body });
    const parts = path.split("/"); const id = parts[2];
    if (path === "/users" && method === "GET") return Response.json(Object.values(users)); // Simulate an ignored provider filter.
    if (path === "/users" && method === "POST") {
      users.new = { id: "new", ...body }; mappings.new = [];
      return new Response(null, { status: 201, headers: { location: "http://identity.test/admin/realms/supportv8/users/new" } });
    }
    if (path.startsWith("/roles/")) return Response.json({ id: "new-role", name: id, composite: false });
    if (path.endsWith("/logout")) return new Response(null, { status: 204 });
    if (path.includes("role-mappings")) {
      if (method === "GET") return Response.json(mappings[id] || []);
      if (method === "DELETE") mappings[id] = mappings[id].filter(r => !body.some((removed: any) => removed.id === r.id));
      if (method === "POST") mappings[id].push(...body);
      return new Response(null, { status: 204 });
    }
    if (method === "GET") return Response.json(users[id]);
    if (method === "PUT") { users[id] = { ...users[id], ...body }; return new Response(null, { status: 204 }); }
    throw new Error("Unexpected API call: " + path);
  }));
});
afterEach(() => vi.unstubAllGlobals());
describe("durable account permissions and profile", () => {
  it.each([[], ["support_operator"], ["support_observer"], ["support_demo_operator", "support_superadmin"]].map(roles => ({ roles })))("rejects non-managers before calling Keycloak: %j", async ({ roles }) => {
    await expect(new AccountMembers().list({ ...ctx, roles })).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(0);
  });
  it("checks current permissions instead of trusting stale admin claims", async () => {
    mappings.owner = [operatorRole];
    await expect(new AccountMembers().list(ctx)).rejects.toMatchObject({ status: 403 });
  });
  it("never returns other tenants even if the provider ignores its filter", async () => {
    const result = await new AccountMembers().list(ctx);
    expect(result.members.map(m => m.id)).toEqual(["owner", "agent"]);
    expect(calls.some(c => c.path.includes("other/role-mappings"))).toBe(false);
  });
  it("rejects cross-tenant edits without any writes", async () => {
    await expect(new AccountMembers().update(ctx, "other", { name: "Hijacked", role: "Tier 2 Escalation Agent", status: "disabled" })).rejects.toMatchObject({ status: 404 });
    expect(calls.every(c => c.method === "GET")).toBe(true);
  });
  it("protects the owner's access and self-demotion", async () => {
    await expect(new AccountMembers().update(ctx, "owner", { name: "Robin", role: "Tier 2 Escalation Agent", status: "active" })).rejects.toMatchObject({ status: 403 });
  });
  it("CX leads cannot elevate themselves or others to leadership", async () => {
    mappings.owner = [{ id: "lead", name: "support_cx_lead" }];
    await expect(new AccountMembers().update({ ...ctx, roles: ["support_cx_lead"] }, "agent", { name: "Casey", role: "Owner / CX Director", status: "active" })).rejects.toMatchObject({ status: 403 });
  });
  it("updates actual role mappings and revokes renewable sessions", async () => {
    await new AccountMembers().update(ctx, "agent", { name: "Casey", role: "Security & Compliance Auditor", status: "disabled", tenantId: "tenant_beta", email: "attacker@example.com" });
    expect(users.agent.enabled).toBe(false);
    expect(users.agent.attributes.tenant_id).toEqual(["tenant_alpha"]);
    expect(users.agent.username).toBe("agent@alpha.com");
    expect(mappings.agent.map(r => r.name)).toEqual(["support_observer"]);
    expect(calls.some(c => c.path === "/users/agent/logout" && c.method === "POST")).toBe(true);
  });
  it("self-profile writes preserve tenant/security attributes and use only the signed subject", async () => {
    const result = await new AccountMembers().profile({ ...ctx, userId: "agent", roles: ["support_operator"] }, { firstName: "Casey", nickname: "Kay" });
    expect(result.name).toBe("Kay");
    expect(users.agent.attributes).toEqual({ tenant_id: ["tenant_alpha"], existing: ["keep"], nickname: ["Kay"] });
    expect(calls.filter(c => c.method !== "GET")).toEqual([{ path: "/users/agent", method: "PUT", body: { firstName: "Casey", attributes: users.agent.attributes } }]);
  });
  it("reports failed invitation delivery instead of pretending an email was sent", async () => {
    vi.mocked(sendInvitationEmail).mockResolvedValue(false);
    const result = await new AccountMembers().invite(ctx, { name: "New Staff", email: "new@alpha.com", role: "Tier 2 Escalation Agent" });
    expect(result.invitationSent).toBe(false); expect(result.member.status).toBe("invited");
    expect(users.new.attributes.tenant_id).toEqual(["tenant_alpha"]);
  });
  it("sends tenant-bound invitations through SupportV8, never identity-provider action emails", async () => {
    const result = await new AccountMembers().invite({ ...ctx, tenantSlug: "attacker.test" }, { name: "New Staff", email: "new@alpha.com", role: "Tier 2 Escalation Agent" });
    expect(result.invitationSent).toBe(true);
    expect(invitationStore.issue).toHaveBeenCalledWith({ tenantId: "tenant_alpha", userId: "new", email: "new@alpha.com" });
    expect(sendInvitationEmail).toHaveBeenCalledWith("new@alpha.com", "alpha", "test-invite");
    expect(calls.some(c => c.path.includes("execute-actions-email"))).toBe(false);
  });
  it("resends only unverified pending accounts in this tenant", async () => {
    users.agent.email = "agent@alpha.com";
    users.agent.emailVerified = false;
    users.agent.requiredActions = ["VERIFY_EMAIL", "UPDATE_PASSWORD"];
    await new AccountMembers().resendInvite(ctx, "agent");
    expect(sendInvitationEmail).toHaveBeenCalledWith("agent@alpha.com", "alpha", "test-invite");
    users.agent.emailVerified = true;
    await expect(new AccountMembers().resendInvite(ctx, "agent")).rejects.toMatchObject({ status: 400 });
    await expect(new AccountMembers().resendInvite(ctx, "other")).rejects.toMatchObject({ status: 404 });
    expect(sendInvitationEmail).toHaveBeenCalledTimes(1);
  });
  it("verifies email and sets credentials without changing roles, tenant, or enabled status", async () => {
    users.agent.email = "agent@alpha.com"; users.agent.emailVerified = false;
    users.agent.requiredActions = ["VERIFY_EMAIL", "UPDATE_PASSWORD"];
    const release = vi.fn(async () => {});
    vi.mocked(invitationStore.consume).mockResolvedValue({ invitation: { tenantId: "tenant_alpha", userId: "agent", email: "agent@alpha.com" }, release });
    await new AccountMembers().acceptInvitation("tenant_alpha", "opaque-token", "long-test-password", "test-ip");
    const writes = calls.filter(c => c.method !== "GET");
    expect(writes).toEqual([
      { path: "/users/agent/reset-password", method: "PUT", body: { type: "password", value: "long-test-password", temporary: false } },
      { path: "/users/agent", method: "PUT", body: { emailVerified: true, requiredActions: [] } },
    ]);
    expect(users.agent.attributes.tenant_id).toEqual(["tenant_alpha"]);
    expect(release).toHaveBeenCalledOnce();
  });
  it.each([
    { emailVerified: true }, { enabled: false }, { email: "changed@alpha.com" },
    { attributes: { tenant_id: ["tenant_beta"] } }, { requiredActions: ["VERIFY_EMAIL", "CONFIGURE_TOTP"] },
  ])("rejects an obsolete or changed invitation without credential writes: %j", async patch => {
    users.agent = { ...users.agent, email: "agent@alpha.com", emailVerified: false, requiredActions: ["VERIFY_EMAIL", "UPDATE_PASSWORD"], ...patch };
    vi.mocked(invitationStore.consume).mockResolvedValue({ invitation: { tenantId: "tenant_alpha", userId: "agent", email: "agent@alpha.com" }, release: vi.fn(async () => {}) });
    await expect(new AccountMembers().acceptInvitation("tenant_alpha", "opaque-token", "long-test-password", "test-ip")).rejects.toThrow();
    expect(calls.every(c => c.method === "GET")).toBe(true);
  });
  it("validates passwords before consuming the invitation", async () => {
    await expect(new AccountMembers().acceptInvitation("tenant_alpha", "token", "short", "ip")).rejects.toThrow();
    expect(invitationStore.consume).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
  it.each(["", "agent@example.com", "x".repeat(81), "Name\u0000"])("validates display names: %j", value => expect(() => profileName(value)).toThrow());
});

import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/account-members", async original => ({ ...await original<typeof import("@/lib/auth/account-members")>(), accountMembers: { acceptInvitation: vi.fn(async () => ({ success: true })) } }));
import { accountMembers } from "@/lib/auth/account-members";
import * as route from "@/app/api/auth/invitation/route";
const request = (host = "alpha.support.servicev8.com", origin = `https://${host}`, body: unknown = { token: "opaque-token", password: "long-password", tenantId: "tenant_attacker" }) => new Request("http://0.0.0.0:3005/api/auth/invitation", {
  method: "POST", headers: { host, origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
afterEach(() => vi.clearAllMocks());
describe("invitation acceptance HTTP boundary", () => {
  it("uses only the workspace hostname, not tenant fields in the request body", async () => {
    expect((await route.POST(request())).status).toBe(200);
    expect(accountMembers.acceptInvitation).toHaveBeenCalledWith("tenant_alpha", "opaque-token", "long-password", "unknown");
  });
  it.each(["support.servicev8.com", "keycloak.servicev8.com", "alpha.evil.test"])("rejects a non-workspace host %s", async host => {
    expect((await route.POST(request(host))).status).toBe(403);
    expect(accountMembers.acceptInvitation).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests", async () => {
    expect((await route.POST(request("alpha.support.servicev8.com", "https://beta.support.servicev8.com"))).status).toBe(403);
    expect(accountMembers.acceptInvitation).not.toHaveBeenCalled();
  });
  it("does not expose an activation action on GET", () => expect("GET" in route).toBe(false));
});

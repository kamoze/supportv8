import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/request-tenant", async original => ({ ...await original<typeof import("@/lib/auth/request-tenant")>(), resolveRequestTenant: vi.fn() }));
vi.mock("@/lib/auth/keycloak", async original => ({ ...await original<typeof import("@/lib/auth/keycloak")>(), getAdminToken: vi.fn() }));
import { resolveRequestTenant, RequestAuthError } from "@/lib/auth/request-tenant";
import { getAdminToken } from "@/lib/auth/keycloak";
import { requireSameOrigin } from "@/lib/auth/account-error";
import * as members from "@/app/api/members/route";
import * as profile from "@/app/api/auth/profile/route";
import * as presence from "@/app/api/presence/route";
import * as groups from "@/app/api/groups/route";

const endpoints = [
  { path: "/api/members", method: "GET", run: members.GET },
  { path: "/api/members", method: "POST", run: members.POST },
  { path: "/api/members", method: "PUT", run: members.PUT },
  { path: "/api/auth/profile", method: "GET", run: profile.GET },
  { path: "/api/auth/profile", method: "PUT", run: profile.PUT },
  { path: "/api/presence", method: "GET", run: presence.GET },
  { path: "/api/presence", method: "POST", run: presence.POST },
  { path: "/api/groups", method: "GET", run: groups.GET },
  { path: "/api/groups", method: "POST", run: groups.POST },
];
const request = (path: string, method: string, origin = "https://alpha.support.servicev8.com") => new Request(`http://0.0.0.0:3005${path}`, {
  method, headers: { host: "alpha.support.servicev8.com", origin, "content-type": "application/json" },
  ...(method !== "GET" ? { body: JSON.stringify({ memberId: "agent", updates: {}, firstName: "Robin", nickname: "Ro" }) } : {}),
});
beforeEach(() => { vi.mocked(resolveRequestTenant).mockResolvedValue({
  authenticated: true, tenantId: "tenant_alpha", tenantSlug: "alpha", userId: "operator", roles: ["support_operator"],
}); });
afterEach(() => vi.clearAllMocks());

describe("account API authorization boundaries", () => {
  it.each(endpoints)("$method $path rejects missing authentication", async ({ path, method, run }) => {
    vi.mocked(resolveRequestTenant).mockRejectedValue(new RequestAuthError("Operator authentication is required"));
    expect((await run(request(path, method))).status).toBe(401);
    expect(getAdminToken).not.toHaveBeenCalled();
  });
  it.each(endpoints.filter(e => e.path === "/api/members" || e.path === "/api/groups"))("$method $path rejects ordinary operators", async ({ path, method, run }) => {
    expect((await run(request(path, method))).status).toBe(403);
    expect(getAdminToken).not.toHaveBeenCalled();
  });
  it.each(endpoints.filter(e => e.method !== "GET" && e.path !== "/api/groups"))("$method $path rejects cross-workspace browser requests before authentication", async ({ path, method, run }) => {
    expect((await run(request(path, method, "https://beta.support.servicev8.com"))).status).toBe(403);
    expect(resolveRequestTenant).not.toHaveBeenCalled();
    expect(getAdminToken).not.toHaveBeenCalled();
  });
});

describe("browser-origin checks behind TLS ingress", () => {
  it("accepts the matching public Host despite Next's internal URL", () => {
    expect(() => requireSameOrigin(request("/api/members", "POST"))).not.toThrow();
  });
  it.each(["null", "https://attacker.test", "http://alpha.support.servicev8.com", "https://alpha.support.servicev8.com/path"])("rejects invalid or mismatched origin %s", origin => {
    expect(() => requireSameOrigin(request("/api/members", "POST", origin))).toThrow();
  });
  it("does not trust an attacker-supplied forwarded host", () => {
    const req = request("/api/members", "POST", "https://attacker.test");
    req.headers.set("x-forwarded-host", "attacker.test");
    expect(() => requireSameOrigin(req)).toThrow();
  });
  it("permits local HTTP browser testing", () => {
    expect(() => requireSameOrigin(new Request("http://127.0.0.1:3005/api/members", { headers: { origin: "http://127.0.0.1:3005" } }))).not.toThrow();
  });
});

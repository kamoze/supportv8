import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/request-tenant", () => ({ resolveRequestTenant: vi.fn() }));
vi.mock("@/lib/chat/staff-presence", () => ({ staffPresence: { remove: vi.fn() } }));
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { staffPresence } from "@/lib/chat/staff-presence";
import { POST } from "@/app/api/auth/logout/route";
const ctx = { tenantId: "tenant_alpha", tenantSlug: "alpha", authenticated: true, userId: "staff", roles: ["support_operator"] };
afterEach(() => vi.resetAllMocks());
describe("logout presence cleanup", () => {
  it("removes only the authenticated staff member's presence", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue(ctx);
    const response = await POST(new Request("https://alpha.support.servicev8.com/api/auth/logout", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(staffPresence.remove).toHaveBeenCalledWith(ctx);
    expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
  });
  it("still clears both authentication cookies if Redis is unavailable", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue(ctx);
    vi.mocked(staffPresence.remove).mockRejectedValue(new Error("Redis unavailable"));
    const response = await POST(new Request("https://alpha.support.servicev8.com/api/auth/logout", { method: "POST" }));
    const cookies = response.headers.getSetCookie();
    expect(response.status).toBe(200);
    expect(cookies).toHaveLength(2);
    expect(cookies.every(cookie => cookie.includes("Max-Age=0"))).toBe(true);
  });
});

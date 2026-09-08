import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/request-tenant", () => ({
  resolveRequestTenant: vi.fn(),
  RequestAuthError: class RequestAuthError extends Error {
    status: number;
    constructor(message: string, status = 401) { super(message); this.status = status; }
  },
}));
vi.mock("@/lib/voice/support-platform", () => ({
  supportPlatformEnvironment: vi.fn(() => ({ configured: true })),
  resolveSophiaLaunch: vi.fn(),
}));
vi.mock("@/lib/db/pg-client", () => ({
  pgClient: { withTenantSession: vi.fn() },
}));

import { GET } from "@/app/api/voice/sophia/launch/route";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { pgClient } from "@/lib/db/pg-client";
import { resolveSophiaLaunch } from "@/lib/voice/support-platform";

describe("GET /api/voice/sophia/launch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme", tenantSlug: "acme", authenticated: true,
      userId: "user-1", roles: ["tenant_admin"],
    });
    vi.mocked(resolveSophiaLaunch).mockResolvedValue({
      kind: "marketplace", url: "https://marketplace.test/auth/handoff?token=signed",
      accountId: "account-acme", registryTenantId: "tenant_acme",
    });
    vi.mocked(pgClient.withTenantSession).mockImplementation(async (_tenantId, callback) =>
      callback({ tenantId: "tenant_acme", query: vi.fn().mockResolvedValue([{ id: "tenant_acme" }]) }),
    );
  });

  it("binds the canonical account before redirecting to Marketplace or Studio", async () => {
    const response = await GET(new NextRequest("https://acme.support.test/api/voice/sophia/launch"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://marketplace.test/auth/handoff?token=signed");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(pgClient.withTenantSession).toHaveBeenCalledWith("tenant_acme", expect.any(Function));
  });

  it("requires a verified immutable identity subject", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme", tenantSlug: "acme", authenticated: true, roles: [],
    });
    const response = await GET(new NextRequest("https://acme.support.test/api/voice/sophia/launch"));
    expect(response.status).toBe(401);
    expect(resolveSophiaLaunch).not.toHaveBeenCalled();
  });
});

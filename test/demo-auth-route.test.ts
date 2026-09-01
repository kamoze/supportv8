import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/auth/demo-rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/demo-rate-limit")>();
  return {
    ...actual,
    demoRateLimiter: { enforce: vi.fn() },
  };
});

vi.mock("../src/lib/auth/keycloak", () => ({
  issueKeycloakDemoAccessToken: vi.fn(),
  supportRolesFromClaims: vi.fn((claims: { realm_access?: { roles?: string[] } }) =>
    claims.realm_access?.roles || [],
  ),
  mapRealmRolesToSupportRole: vi.fn((roles: string[]) =>
    roles.includes("support_demo_operator") ? "operator" : null,
  ),
}));

import {
  DemoRateLimitError,
  DemoRateLimitUnavailableError,
  demoRateLimiter,
} from "../src/lib/auth/demo-rate-limit";
import { issueKeycloakDemoAccessToken } from "../src/lib/auth/keycloak";
import { POST } from "../src/app/api/auth/demo/route";

const validToken = {
  ok: true as const,
  accessToken: "signed-demo-token",
  expiresIn: 600,
  decodedClaims: {
    tenant_id: "tenant_acme",
    realm_access: { roles: ["support_demo_operator"] },
  },
};

function request(tenantSlug: string) {
  return new NextRequest("https://support.servicev8.com/api/auth/demo", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": "203.0.113.10",
    },
    body: JSON.stringify({ tenantSlug }),
  });
}

describe("restricted demo authentication route", () => {
  beforeEach(() => {
    vi.mocked(demoRateLimiter.enforce).mockResolvedValue();
    vi.mocked(issueKeycloakDemoAccessToken).mockResolvedValue(validToken);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects any workspace outside the explicit demo allowlist", async () => {
    const response = await POST(request("customer-one"));

    expect(response.status).toBe(400);
    expect(demoRateLimiter.enforce).not.toHaveBeenCalled();
    expect(issueKeycloakDemoAccessToken).not.toHaveBeenCalled();
  });

  it("issues a short-lived secure HttpOnly cookie for a restricted demo identity", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(request("acme"));
    const payload = await response.json();
    const cookie = response.headers.get("set-cookie") || "";

    expect(response.status).toBe(200);
    expect(payload.user).toMatchObject({ tenantSlug: "acme", role: "operator", demo: true });
    expect(demoRateLimiter.enforce).toHaveBeenCalledWith(expect.objectContaining({
      action: "access",
      tenantId: "tenant_acme",
      clientIdentity: "203.0.113.10",
      perMinute: 5,
      perHour: 20,
    }));
    expect(issueKeycloakDemoAccessToken).toHaveBeenCalledWith("acme");
    expect(cookie).toContain("sv8_access_token=signed-demo-token");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Max-Age=600");
  });

  it("fails closed when Keycloak cannot issue the demo identity", async () => {
    vi.mocked(issueKeycloakDemoAccessToken).mockResolvedValue({
      ok: false,
      reason: "demo_identity_unreachable",
    });
    const response = await POST(request("acme"));

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects a token that lacks the restricted demo role", async () => {
    vi.mocked(issueKeycloakDemoAccessToken).mockResolvedValue({
      ...validToken,
      decodedClaims: {
        tenant_id: "tenant_acme",
        realm_access: { roles: ["support_operator"] },
      },
    });
    const response = await POST(request("acme"));

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("returns Retry-After when the access rate limit is exceeded", async () => {
    vi.mocked(demoRateLimiter.enforce).mockRejectedValue(new DemoRateLimitError(60));
    const response = await POST(request("acme"));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(issueKeycloakDemoAccessToken).not.toHaveBeenCalled();
  });

  it("fails closed when shared rate limiting is unavailable", async () => {
    vi.mocked(demoRateLimiter.enforce).mockRejectedValue(new DemoRateLimitUnavailableError());
    const response = await POST(request("acme"));

    expect(response.status).toBe(503);
    expect(issueKeycloakDemoAccessToken).not.toHaveBeenCalled();
  });
});

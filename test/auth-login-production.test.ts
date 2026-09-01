import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const keycloakMocks = vi.hoisted(() => ({
  verifyKeycloakPassword: vi.fn(),
}));

vi.mock("@/lib/auth/keycloak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/keycloak")>();
  return {
    ...actual,
    verifyKeycloakPassword: keycloakMocks.verifyKeycloakPassword,
  };
});

import { POST } from "../src/app/api/auth/login/route";

function loginRequest() {
  return new NextRequest("https://alpha.support.servicev8.com/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "admin@example.com",
      password: "StrongPassword#2026",
      tenantSlug: "alpha",
    }),
  });
}

describe("production login identity boundaries", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    keycloakMocks.verifyKeycloakPassword.mockReset();
  });

  it("denies a tenant user who only has a generic shared-realm admin role", async () => {
    vi.stubEnv("NODE_ENV", "production");
    keycloakMocks.verifyKeycloakPassword.mockResolvedValue({
      ok: true,
      accessToken: "token",
      decodedClaims: {
        sub: "user-1",
        tenant_id: "tenant_alpha",
        realm_access: { roles: ["admin"] },
      },
    });

    const response = await POST(loginRequest());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ success: false });
  });

  it("accepts an explicit namespaced SupportV8 role", async () => {
    vi.stubEnv("NODE_ENV", "production");
    keycloakMocks.verifyKeycloakPassword.mockResolvedValue({
      ok: true,
      accessToken: "token",
      decodedClaims: {
        sub: "user-1",
        exp: Math.floor(Date.now() / 1000) + 3600,
        tenant_id: "tenant_alpha",
        realm_access: { roles: ["support_operator"] },
      },
    });

    const response = await POST(loginRequest());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      user: { tenantSlug: "alpha", role: "operator" },
    });
  });

  it("rejects a missing or malformed authoritative tenant claim", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const tenantId of [undefined, "alpha", "tenant_Invalid!"]) {
      keycloakMocks.verifyKeycloakPassword.mockResolvedValueOnce({
        ok: true,
        accessToken: "token",
        decodedClaims: {
          sub: "user-1",
          tenant_id: tenantId,
          realm_access: { roles: ["support_operator"] },
        },
      });
      const response = await POST(loginRequest());
      expect(response.status).toBe(403);
    }
  });

  it("rejects a requested workspace that differs from the signed tenant claim", async () => {
    vi.stubEnv("NODE_ENV", "production");
    keycloakMocks.verifyKeycloakPassword.mockResolvedValue({
      ok: true,
      accessToken: "token",
      decodedClaims: {
        sub: "user-1",
        tenant_id: "tenant_other",
        realm_access: { roles: ["support_operator"] },
      },
    });

    const response = await POST(loginRequest());
    expect(response.status).toBe(403);
  });
});

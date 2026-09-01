import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const keycloak = vi.hoisted(() => ({
  refreshKeycloakAccessToken: vi.fn(),
}));

vi.mock("@/lib/auth/keycloak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/keycloak")>();
  return { ...actual, refreshKeycloakAccessToken: keycloak.refreshKeycloakAccessToken };
});

import { POST } from "../src/app/api/auth/refresh/route";

describe("operator session renewal", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rotates the access and refresh cookies without changing tenant identity", async () => {
    vi.stubEnv("NODE_ENV", "production");
    keycloak.refreshKeycloakAccessToken.mockResolvedValue({
      ok: true,
      accessToken: "next-access",
      refreshToken: "next-refresh",
      expiresIn: 300,
      refreshExpiresIn: 28_800,
      decodedClaims: {
        sub: "operator-1",
        tenant_id: "tenant_alpha",
        preferred_username: "jordan@alpha.example",
        given_name: "Jordan",
        realm_access: { roles: ["support_operator"] },
      },
    });
    const response = await POST(new NextRequest("https://alpha.support.servicev8.com/api/auth/refresh", {
      method: "POST",
      headers: { cookie: "sv8_refresh_token=current-refresh" },
    }));
    const payload = await response.json();
    const cookies = response.headers.getSetCookie().join("\n");

    expect(response.status).toBe(200);
    expect(keycloak.refreshKeycloakAccessToken).toHaveBeenCalledWith("current-refresh");
    expect(payload.session).toMatchObject({ tenantSlug: "alpha", name: "Jordan", role: "operator" });
    expect(cookies).toContain("sv8_access_token=next-access");
    expect(cookies).toContain("sv8_refresh_token=next-refresh");
  });

  it("fails closed when no renewable credential is present", async () => {
    const response = await POST(new NextRequest("https://alpha.support.servicev8.com/api/auth/refresh", {
      method: "POST",
    }));

    expect(response.status).toBe(401);
    expect(keycloak.refreshKeycloakAccessToken).not.toHaveBeenCalled();
  });
});

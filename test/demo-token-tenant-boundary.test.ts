import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/auth/keycloak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/keycloak")>();
  return { ...actual, verifySupportAccessToken: vi.fn() };
});

import { verifySupportAccessToken } from "../src/lib/auth/keycloak";
import { resolveRequestTenant } from "../src/lib/auth/request-tenant";

const demoClaims = {
  sub: "demo-acme-service-account",
  preferred_username: "service-account-supportv8-demo-acme",
  tenant_id: "tenant_acme",
  azp: "supportv8-demo-acme",
  realm_access: { roles: ["support_demo_operator"] },
};

describe("demo token tenant boundary", () => {
  afterEach(() => vi.clearAllMocks());

  it("preserves the restricted role on the matching hosted workspace", async () => {
    vi.mocked(verifySupportAccessToken).mockResolvedValue(demoClaims);
    const tenant = await resolveRequestTenant(new NextRequest(
      "https://acme.support.servicev8.com/api/issues",
      { headers: {
        host: "acme.support.servicev8.com",
        cookie: "sv8_access_token=signed-demo-token",
      } },
    ), { requireAuthentication: true });

    expect(tenant).toMatchObject({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      roles: expect.arrayContaining(["support_demo_operator"]),
    });
  });

  it("rejects the same signed token on another tenant hostname", async () => {
    vi.mocked(verifySupportAccessToken).mockResolvedValue(demoClaims);
    await expect(resolveRequestTenant(new NextRequest(
      "https://meridian.support.servicev8.com/api/issues",
      { headers: {
        host: "meridian.support.servicev8.com",
        cookie: "sv8_access_token=signed-demo-token",
      } },
    ), { requireAuthentication: true })).rejects.toMatchObject({ status: 403 });
  });
});

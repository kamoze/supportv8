import { afterEach, describe, expect, it, vi } from "vitest";
import { verifySupportEmailTenantAccount } from "../src/lib/messaging/tenant-account";

afterEach(() => vi.unstubAllEnvs());

describe("Support email tenant account verification", () => {
  it("verifies a non-Sophia Support tenant directly against Registry", async () => {
    vi.stubEnv("SERVICEV8_OIDC_ISSUER", "https://keycloak.servicev8.com/realms/servicev8");
    vi.stubEnv("SUPPORTV8_EMAIL_CLIENT_ID", "supportv8-messaging-email");
    vi.stubEnv("SUPPORTV8_EMAIL_CLIENT_SECRET", "dedicated-secret");
    vi.stubEnv("REGISTRY_URL", "https://registry.servicev8.internal");
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ access_token: "registry-token" })).mockResolvedValueOnce(Response.json({ id: "tenant_new", accountId: "account-new", status: "active" }));
    await expect(verifySupportEmailTenantAccount({ tenantId: "tenant_new", accountId: "account-new", fetcher })).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenNthCalledWith(2, new URL("https://registry.servicev8.internal/v1/tenants/tenant_new?accountId=account-new"), expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer registry-token" }) }));
  });
});

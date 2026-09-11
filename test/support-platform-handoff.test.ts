import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveSophiaLaunch,
  type SupportPlatformEnvironment,
} from "@/lib/voice/support-platform";

const env: SupportPlatformEnvironment = {
  oidcIssuer: "https://identity.test/realms/servicev8",
  clientId: "supportv8-platform-reference",
  clientSecret: "client-secret",
  registryUrl: "https://registry.test",
  marketplaceUrl: "https://marketplace.test",
  marketplaceHandoffSecret: "marketplace-secret",
  studioUrl: "https://studio.test",
  studioHandoffSecret: "studio-secret",
};

function decode(token: string, secret: string) {
  const [header, payload, signature] = token.split(".");
  expect(signature).toBe(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url"),
  );
  return JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
}

afterEach(() => vi.restoreAllMocks());

describe("Sophia platform launch", () => {
  it("sends an unhired SupportV8 tenant to Marketplace with canonical Registry scope", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/protocol/openid-connect/token")) {
        return Response.json({ access_token: "workload-token", expires_in: 60 });
      }
      if (url.endsWith("/v1/tenants/by-slug/acme")) {
        return Response.json({ id: "tenant-acme", accountId: "account-acme", slug: "acme", status: "active" });
      }
      if (url.includes("/v1/tenants/tenant-acme/memberships/user-1")) {
        return Response.json({ tenantId: "tenant-acme", accountId: "account-acme", identitySubject: "user-1", status: "active" });
      }
      if (url.includes("/v1/projections/installations")) return Response.json({ installations: [] });
      return new Response(null, { status: 404 });
    }));

    const launch = await resolveSophiaLaunch({
      env,
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      identitySubject: "user-1",
      nowSeconds: 1_800_000_000,
      nonce: "nonce-1",
    });

    expect(launch.kind).toBe("marketplace");
    expect(launch.registryTenantId).toBe("tenant-acme");
    expect(requests.some((url) => url.includes("accountId=account-acme") && url.includes("tenantId=tenant-acme") && url.includes("verticalId=supportv8"))).toBe(true);
    const destination = new URL(launch.url);
    expect(destination.origin).toBe("https://marketplace.test");
    const claims = decode(destination.searchParams.get("token")!, "marketplace-secret");
    expect(claims).toMatchObject({
      iss: "supportv8",
      aud: "marketplacev8-handoff",
      sub: "user-1",
      accountId: "account-acme",
      tenantId: "tenant-acme",
      tenantDomain: "acme",
      verticalId: "supportv8",
      origin: "supportv8",
      returnPath: "/",
    });
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(60);
  });

  it("sends an exact active Sophia hire to Studio configuration", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/protocol/openid-connect/token")) return Response.json({ access_token: "workload-token", expires_in: 60 });
      if (url.endsWith("/v1/tenants/by-slug/acme")) return Response.json({ id: "tenant-acme", accountId: "account-acme", slug: "acme", status: "active" });
      if (url.includes("/memberships/user-1")) return Response.json({ tenantId: "tenant-acme", accountId: "account-acme", identitySubject: "user-1", status: "active" });
      if (url.includes("/v1/projections/installations")) return Response.json({ installations: [
        { accountId: "account-other", tenantId: "tenant-acme", verticalId: "supportv8", productId: "servicev8.ai-support-agent", entitlementStatus: "active", installationId: "wrong", hireId: "wrong" },
        { accountId: "account-acme", tenantId: "tenant-acme", verticalId: "supportv8", productId: "servicev8.ai-support-agent", entitlementStatus: "active", installationId: "installation-sophia", hireId: "hire-sophia" },
      ] });
      return new Response(null, { status: 404 });
    }));

    const launch = await resolveSophiaLaunch({
      env,
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      identitySubject: "user-1",
      nowSeconds: 1_800_000_000,
      nonce: "nonce-2",
    });

    expect(launch.kind).toBe("studio");
    expect(launch.installationId).toBe("installation-sophia");
    expect(launch.hireId).toBe("hire-sophia");
    const destination = new URL(launch.url);
    const claims = decode(destination.searchParams.get("token")!, "studio-secret");
    expect(claims).toMatchObject({
      iss: "supportv8",
      aud: "studio-handoff",
      accountId: "account-acme",
      tenantId: "tenant-acme",
      vertical: "supportv8",
      next: "/?manage=hire-sophia#employee-workspace",
    });
  });

  it("fails closed when Registry identity scope disagrees with SupportV8", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/protocol/openid-connect/token")) return Response.json({ access_token: "token" });
      if (url.endsWith("/v1/tenants/by-slug/acme")) return Response.json({ id: "tenant-other", accountId: "account-acme", slug: "meridian", status: "active" });
      return new Response(null, { status: 404 });
    }));
    await expect(resolveSophiaLaunch({ env, tenantId: "tenant_acme", tenantSlug: "acme", identitySubject: "user-1" }))
      .rejects.toThrow("Registry tenant does not match");
  });
});

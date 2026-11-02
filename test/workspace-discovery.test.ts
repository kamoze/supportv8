import { describe, expect, it, vi } from "vitest";
import { createWorkspaceDiscovery } from "../src/lib/auth/workspace-discovery";
const env = { REGISTRY_URL: "https://registry.example.test", SERVICEV8_OIDC_ISSUER: "https://identity.example.test/realms/servicev8", SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID: "registered-support-reader", SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET: "synthetic-test-secret" };
const record = { schemaVersion: 1, productAppKey: "support", tenantId: "canonical-tenant", accountId: "canonical-account", slug: "alpha", companyName: "Alpha Incorporated", origin: "https://alpha.support.servicev8.com" };
const token = () => Response.json({ access_token: "synthetic-owner-token", token_type: "Bearer", expires_in: 120 });
describe("Registry-owned workspace discovery", () => {
  it("uses the registered membership reader and fresh exact owner response without synthesizing hosts", async () => {
    const request = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(Response.json(record)).mockResolvedValueOnce(token()).mockResolvedValueOnce(new Response(null, { status: 404 }));
    const lookup = createWorkspaceDiscovery(env, request);
    expect(await lookup("alpha")).toEqual({ id: record.tenantId, accountId: record.accountId, slug: "alpha", name: record.companyName, status: "active", url: `${record.origin}/` });
    expect(new URLSearchParams(request.mock.calls[0][1].body).get("scope")).toBe("registry:memberships:read");
    expect(String(request.mock.calls[1][0])).toBe("https://registry.example.test/v1/workspace-hosts/resolve?productAppKey=support&slug=alpha");
    expect(request.mock.calls[1][1]).toMatchObject({ cache: "no-store", redirect: "error", headers: { authorization: "Bearer synthetic-owner-token" } });
    expect(await lookup("alpha")).toBeNull();
  });
  it("rejects wrong product/slug, unregistered/malformed destinations, shape drift and unavailable configuration", async () => {
    for (const change of [{ productAppKey: "voice" }, { slug: "other" }, { origin: "https://other.support.servicev8.com" }, { origin: `${record.origin}/path` }, { origin: "https://alpha.support.servicev8.com:8443" }, { extra: true }, { companyName: "" }]) {
      const request = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(Response.json({ ...record, ...change }));
      await expect(createWorkspaceDiscovery(env, request)("alpha")).rejects.toMatchObject({ status: 503 });
    }
    await expect(createWorkspaceDiscovery({}, vi.fn())("alpha")).rejects.toMatchObject({ status: 503 });
  });
  it("bounds a stalled owner stream without falling back to local tenants", async () => {
    {
      const request = vi.fn().mockResolvedValueOnce(token()).mockResolvedValueOnce(new Response(new ReadableStream({ start() {}, cancel() {} })));
      const promise = createWorkspaceDiscovery(env, request)("acme"); const checked = expect(promise).rejects.toMatchObject({ status: 503 });
      await checked;
    }
  }, 10_000);
});

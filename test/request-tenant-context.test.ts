import { describe, expect, it } from "vitest";
import {
  normalizeTenantSlug,
  tenantIdFromSlug,
  tenantSlugFromHostname,
  tenantSlugFromId,
} from "@/lib/auth/request-tenant";
import {
  browserTenantSlugFromHostname,
  resolveBrowserWorkspace,
} from "@/lib/tenant-host";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";

describe("trusted request tenant normalization", () => {
  it("maps hosted tenant domains to canonical database IDs", () => {
    expect(tenantSlugFromHostname("acme-movers.support.servicev8.com")).toBe("acme-movers");
    expect(tenantIdFromSlug("acme-movers")).toBe("tenant_acme_movers");
    expect(tenantSlugFromId("tenant_acme_movers")).toBe("acme-movers");
  });

  it("does not assign a tenant from the shared root host", () => {
    expect(tenantSlugFromHostname("support.servicev8.com")).toBeNull();
    expect(tenantSlugFromHostname("localhost:3005")).toBeNull();
  });

  it("locks the browser workspace to every valid hosted tenant, including acme", () => {
    expect(browserTenantSlugFromHostname("acme.support.servicev8.com")).toBe("acme");
    expect(browserTenantSlugFromHostname("fresh-customer.support.servicev8.com")).toBe("fresh-customer");
    expect(browserTenantSlugFromHostname("ACME.support.servicev8.internal:3005")).toBe("acme");
    expect(browserTenantSlugFromHostname("support.servicev8.com")).toBeNull();
    expect(browserTenantSlugFromHostname("www.support.servicev8.com")).toBeNull();
    expect(browserTenantSlugFromHostname("victim.support.attacker.tld")).toBeNull();
  });

  it("rejects chat intake from a forged or unknown Host header", () => {
    const response = middleware(
      new NextRequest("https://victim.support.attacker.tld/api/chat/session", {
        headers: { host: "victim.support.attacker.tld" },
      }),
    );

    expect(response.status).toBe(421);
  });

  it("accepts a valid tenant host and stamps its canonical tenant context", () => {
    const response = middleware(
      new NextRequest("https://acme.support.servicev8.com/api/chat/session", {
        headers: { host: "acme.support.servicev8.com" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-servicev8-tenant-domain")).toBe("acme");
  });

  it("keeps the hosted tenant authoritative across URL and saved-session state", () => {
    expect(
      resolveBrowserWorkspace({
        hostname: "acme.support.servicev8.com",
        tenantParam: "meridian",
        activeTenant: "meridian",
      }),
    ).toEqual({ tenantSlug: "acme", viewMode: "tenant_landing" });

    expect(
      resolveBrowserWorkspace({
        hostname: "acme.support.servicev8.com",
        activeTenant: "acme",
      }),
    ).toEqual({ tenantSlug: "acme", viewMode: "cockpit" });
  });

  it("rejects empty and malformed tenant domains", () => {
    expect(() => normalizeTenantSlug("---")).toThrow("Invalid tenant domain");
    expect(() => tenantSlugFromId("postgres")).toThrow("valid tenant claim");
  });
});

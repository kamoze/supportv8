import { describe, expect, it } from "vitest";
import {
  normalizeTenantSlug,
  tenantIdFromSlug,
  tenantSlugFromHostname,
  tenantSlugFromId,
} from "@/lib/auth/request-tenant";

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

  it("rejects empty and malformed tenant domains", () => {
    expect(() => normalizeTenantSlug("---")).toThrow("Invalid tenant domain");
    expect(() => tenantSlugFromId("postgres")).toThrow("valid tenant claim");
  });
});

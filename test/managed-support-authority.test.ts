import { it, expect } from "vitest";
import { ManagedSupportAuthority } from "@/lib/service-app/managed-support-authority";
import { target, projection } from "./managed-support-source-fixture";
it("control readiness verifies exact current destination and local mapping", async () => {
  let current: unknown = projection;
  const authority = new ManagedSupportAuthority({
    local: async () => true,
    get: async () => ({ installations: [current] }),
  });
  expect(await authority.verify(target)).toBe(true);
  for (const drift of [
    { entitlementStatus: "revoked" },
    { installationState: "provisioning" },
    { serviceAppPlanAccess: { state: "excluded" } },
    { tenantId: "other" },
    {
      serviceAppBinding: {
        ...projection.serviceAppBinding,
        externalWorkspaceId: "tenant_other",
      },
    },
  ]) {
    current = { ...projection, ...drift };
    expect(await authority.verify(target)).toBe(false);
  }
});
it("absent and ambiguous control projections deny", async () => {
  for (const rows of [[], [projection, projection]])
    expect(
      await new ManagedSupportAuthority({
        local: async () => true,
        get: async () => ({ installations: rows }),
      }).verify(target),
    ).toBe(false);
});

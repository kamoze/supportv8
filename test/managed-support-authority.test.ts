import { it, expect } from "vitest";
import { ManagedSupportAuthority } from "@/lib/service-app/managed-support-authority";
const target = {
  accountId: "account-test",
  tenantId: "registry-test",
  verticalId: "runtime" as const,
  installationId: "support-install",
  workspaceId: "tenant_support_test",
};
const grant = {
  connectionId: "00000000-0000-8000-8000-000000000001",
  generation: 1,
  employeeId: "hire-test",
  employeeInstallationId: "employee-install",
  employeeEntitlementId: "employee-entitlement",
  principalId: "member-test",
  destinationInstallationId: target.installationId,
  workspaceId: target.workspaceId,
};
const actor = {
  accountId: target.accountId,
  tenantId: target.tenantId,
  actorId: grant.employeeId,
  grant,
  correlationId: "trace-test",
};
it("verifies live exact binding and canonical consumer before allowing an employee, then denies revoked entitlement", async () => {
  let active = true;
  const projection = {
    ...target,
    productKind: "service_app",
    productId: "servicev8.service-app.supportv8",
    productVersion: "1.0.0",
    entitlementStatus: "active",
    installationState: "active",
    serviceAppReadiness: { state: "ready" },
    serviceAppPlanAccess: { state: "included" },
    serviceAppBinding: {
      schemaVersion: "servicev8.service-app-binding.v1",
      appKey: "supportv8",
      externalWorkspaceId: target.workspaceId,
      poolAccountId: target.accountId,
      provisioningState: "provisioned",
      poolBindingState: "verified",
    },
  };
  const authority = new ManagedSupportAuthority({
    local: async () => true,
    verifyGrant: async () => true,
    get: async (url) => {
      if (url.pathname === "/v1/employee-consumer-bindings")
        return {
          bindings: [
            {
              accountId: target.accountId,
              tenantId: target.tenantId,
              consumerAppId: "supportv8",
              ownerAppId: "runtime",
              canonicalInstallationId: grant.employeeInstallationId,
              canonicalEntitlementId: grant.employeeEntitlementId,
              canonicalHireId: grant.employeeId,
              productId: "servicev8.ai-support-agent",
              state: "consumer_bound",
            },
          ],
        };
      if (url.searchParams.get("installationId") === target.installationId)
        return { installations: [projection] };
      return {
        installations: [
          {
            accountId: target.accountId,
            tenantId: target.tenantId,
            installationId: grant.employeeInstallationId,
            entitlementId: grant.employeeEntitlementId,
            hireId: grant.employeeId,
            principalId: grant.principalId,
            productKind: "ai_employee",
            productId: "servicev8.ai-support-agent",
            verticalId: "runtime",
            entitlementStatus: active ? "active" : "revoked",
            installationState: "active",
            requiredCapabilities: ["ticket.read"],
            missingCapabilities: [],
          },
        ],
      };
    },
  });
  expect(await authority.verify(target)).toBe(true);
  expect(await authority.authorize(target, actor)).toBe(true);
  active = false;
  expect(await authority.authorize(target, actor)).toBe(false);
  expect(
    await authority.authorize(target, {
      ...actor,
      grant: { ...grant, employeeId: "other-hire" },
    }),
  ).toBe(false);
});
it("does not authorize a missing or ambiguous destination binding", async () => {
  const authority = new ManagedSupportAuthority({
    local: async () => true,
    verifyGrant: async () => true,
    get: async () => ({ installations: [] }),
  });
  expect(await authority.verify(target)).toBe(false);
});

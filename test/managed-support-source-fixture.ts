import {
  supportSourceDigest,
  supportProofConnectionId,
} from "../src/lib/service-app/managed-support-source";
export const target = {
  accountId: "account-test",
  tenantId: "registry-test",
  verticalId: "runtime" as const,
  installationId: "support-install",
  workspaceId: "tenant_support_test",
};
export const connectionId = supportProofConnectionId(target);
export function invocation() {
  const context = {
    schemaVersion: "servicev8.support-invocation.v1",
    source: "runtime",
    originatingClientId: "runtime-support",
    invocationId: "11111111-1111-4111-8111-111111111111",
    authority: "human_session",
    channel: "runtime_chat",
    purpose: "staff_ticket_read",
    accountId: target.accountId,
    tenantId: target.tenantId,
    subject: "member-test",
    threadId: "22222222-2222-4222-8222-222222222222",
    turnId: "33333333-3333-4333-8333-333333333333",
    employeeInstallationId: "employee-install",
    employeeId: "hire-test",
    employeeEntitlementId: "employee-entitlement",
    connectionId,
    destinationInstallationId: target.installationId,
    workspaceId: target.workspaceId,
    capability: "support_ticket_lookup",
    parameters: { ticketReference: "CASE-7" },
    channelGeneration: 1,
    expiresAt: Date.now() + 60000,
  };
  return { ...context, digest: supportSourceDigest(context) };
}
export function disclosure(purpose = "initial_delivery") {
  const inv = invocation();
  const {
    authority,
    capability,
    parameters,
    digest,
    schemaVersion,
    ...common
  } = inv;
  const context = {
    ...common,
    schemaVersion: "servicev8.support-disclosure.v1",
    disclosureId: "44444444-4444-4444-8444-444444444444",
    purpose,
    invocationDigest: digest,
    resultDigest: "a".repeat(64),
  };
  return { ...context, digest: supportSourceDigest(context) };
}
export function policy() {
  return {
    configured: true,
    dataReady: false,
    policy: {
      schemaVersion: "servicev8.support-grant.v2",
      accountId: target.accountId,
      tenantId: target.tenantId,
      installationId: "employee-install",
      employeeId: "hire-test",
      employeeEntitlementId: "employee-entitlement",
      connectionId,
      destinationInstallationId: target.installationId,
      workspaceId: target.workspaceId,
      capability: "support_ticket_lookup",
      generation: 3,
      channels: {
        runtime_chat: {
          state: "active",
          generation: 1,
          authority: {
            kind: "human_session",
            audience: "tenant_staff",
            permission: "support.tickets.read",
          },
        },
      },
    },
  };
}
export const projection = {
  ...target,
  productId: "servicev8.service-app.supportv8",
  productVersion: "1.0.0",
  productKind: "service_app",
  entitlementStatus: "active",
  installationState: "active",
  tenantDomain: "test",
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
export const member = {
  accountId: target.accountId,
  tenantId: target.tenantId,
  identitySubject: "member-test",
  email: "member@example.test",
  role: "STAFF",
  status: "active",
  slug: "test",
};
export const sourceConfig = {
  runtimeUrl: "https://runtime.test",
  registryUrl: "https://registry.test",
  tokenUrl: "https://keycloak.test/token",
  clientId: "proof-reader",
  clientSecret: "fixture",
  registryTokenUrl: "https://keycloak.test/registry-token",
  registryClientId: "registry-reader",
  registryClientSecret: "fixture",
  allowedOriginatingClientIds: ["runtime-support"],
};
export const ownerEnv = {
  SUPPORT_RUNTIME_URL: sourceConfig.runtimeUrl,
  REGISTRY_URL: sourceConfig.registryUrl,
  SUPPORTV8_SOURCE_TOKEN_URL: sourceConfig.tokenUrl,
  SUPPORTV8_SOURCE_CLIENT_ID: sourceConfig.clientId,
  SUPPORTV8_SOURCE_CLIENT_SECRET: sourceConfig.clientSecret,
  SUPPORTV8_MANAGED_TOKEN_URL: sourceConfig.registryTokenUrl,
  SUPPORTV8_MANAGED_CLIENT_ID: sourceConfig.registryClientId,
  SUPPORTV8_MANAGED_CLIENT_SECRET: sourceConfig.registryClientSecret,
  SUPPORTV8_RUNTIME_INVOCATION_CLIENT_IDS: "runtime-support",
  SERVICEV8_OIDC_ISSUER: "https://keycloak.test",
  SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID: "rbac-reader",
  SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET: "fixture",
};
export function selectors(
  proof: ReturnType<typeof invocation> | ReturnType<typeof disclosure>,
) {
  return {
    accountId: proof.accountId,
    tenantId: proof.tenantId,
    ...("disclosureId" in proof
      ? { disclosureId: proof.disclosureId }
      : { invocationId: proof.invocationId }),
    digest: proof.digest,
  };
}

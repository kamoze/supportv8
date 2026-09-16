import { expect, it, vi } from "vitest";
import { ManagedSupportAuthority } from "@/lib/service-app/managed-support-authority";
import type { PostgresClient } from "@/lib/db/pg-client";
import { reconcileManagedSupportRegistration } from "@/lib/service-app/managed-support-registration";
const target = {
  accountId: "a",
  tenantId: "t",
  installationId: "i",
  workspaceId: "tenant_a",
  verticalId: "runtime" as const,
};
function authority(
  rows: unknown[],
  get = vi.fn(async () => {
    throw Error("Registry unavailable");
  }),
) {
  return new ManagedSupportAuthority({
    client: {
      withWorkspaceProvisioningSession: async (
        _: unknown,
        run: (db: unknown) => unknown,
      ) => run({ query: async () => rows }),
    } as unknown as PostgresClient,
    get,
  });
}
it("permanent proof requires an observed exact tombstone, never Registry status", async () => {
  const get = vi.fn(async () => {
    throw Error("Registry unavailable");
  });
  const proof = await authority(
    [
      {
        state: "tombstoned",
        deleted_at: "now",
        desired_state: "permanently_revoked",
        observed_generation: 1,
      },
    ],
    get,
  ).lifecycle(target);
  expect(proof).toMatchObject({
    decision: "permanently_revoked",
    reasonCode: "workspace_tombstoned",
    observedGeneration: 1,
  });
  expect(get).not.toHaveBeenCalled();
  for (const rows of [
    [],
    [
      {
        state: "tombstoned",
        deleted_at: "now",
        desired_state: "active",
        observed_generation: 0,
      },
    ],
    [
      {
        state: "workspace_created",
        desired_state: "permanently_revoked",
        observed_generation: 1,
      },
    ],
  ])
    await expect(authority(rows).lifecycle(target)).rejects.toThrow();
  for (const state of ["workspace_created", "reserved", "tombstoned"])
    expect(
      await authority([
        {
          state,
          deleted_at: null,
          desired_state: "active",
          observed_generation: 0,
        },
      ]).lifecycle(target),
    ).toMatchObject({
      decision: "temporarily_unavailable",
      observedGeneration: 0,
    });
});
it("revocation retries preserve generation and only exact disable acknowledgement completes", async () => {
  const job = {
    installationId: "i",
    acquisitionId: "acq",
    accountId: "a",
    registryTenantId: "t",
    verticalId: "runtime" as const,
    workspaceId: "tenant_a",
    state: "revocation_pending" as const,
    desiredState: "permanently_revoked" as const,
    observedGeneration: 1,
    attemptCount: 8,
  };
  for (const response of [
    { status: 503, body: {} },
    {
      status: 200,
      body: { status: "disabled", connectionId: "id", observedGeneration: 2 },
    },
    {
      status: 200,
      body: { status: "disabled", connectionId: "id", observedGeneration: 1 },
    },
  ]) {
    const call = vi.fn(async () => response),
      update = vi.fn();
    await reconcileManagedSupportRegistration(job, {
      call,
      update,
      connectionId: () => "id",
    });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith("disable", target, "id", 1);
    expect(update.mock.calls[0][0].state).toBe(
      response.status === 200 && response.body.observedGeneration === 1
        ? "revoked"
        : "revocation_pending",
    );
  }
});

it("lifecycle scope is distinct and Keycloak tokens need no nbf", async () => {
  const { generateKeyPair, SignJWT } = await import("jose");
  const { createManagedSupportAuthenticator } = await import(
    "@/lib/service-app/managed-support-auth"
  );
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const auth = createManagedSupportAuthenticator({
    issuer: "https://keycloak.test",
    allowedClientIds: ["gateway-lifecycle"],
    key: publicKey,
  });
  const sign = (scope: string) =>
    new SignJWT({ azp: "gateway-lifecycle", scope })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://keycloak.test")
      .setAudience("supportv8")
      .setSubject("service-account")
      .setJti("test-jti")
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(privateKey);
  for (const scope of [
    "supportv8:managed:lifecycle",
    "supportv8:managed:connect",
    "supportv8:managed:readiness",
    "supportv8:tickets:read",
  ]) {
    const actor = await auth(
      new Request("https://support.test", {
        headers: { authorization: `Bearer ${await sign(scope)}` },
      }),
      "connection.lifecycle",
    );
    expect(!!actor).toBe(scope === "supportv8:managed:lifecycle");
  }
});

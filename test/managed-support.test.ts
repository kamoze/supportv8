import { describe, it, expect } from "vitest";
import { handleManagedSupport } from "@/lib/service-app/managed-support";
import { createManagedSupportAuthenticator } from "@/lib/service-app/managed-support-auth";
import { generateKeyPair, SignJWT } from "jose";
const target = {
  accountId: "account-test",
  tenantId: "registry-test",
  verticalId: "runtime",
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
const request = (body: unknown, token = "signed") =>
  new Request("https://support.test/internal/service-apps/support/invoke", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
describe("managed Support owner boundary", () => {
  it("requires current employee grant before the exact ticket read and reduces the result", async () => {
    let reads = 0;
    let allowed = true;
    const deps = {
      authenticate: async () => ({
        accountId: target.accountId,
        tenantId: target.tenantId,
        actorId: grant.employeeId,
        grant,
        correlationId: "trace-test",
      }),
      verify: async () => true,
      authorize: async () => allowed,
      lookup: async (_target: unknown, ref: string) => {
        reads++;
        expect(ref).toBe("CASE-7");
        return {
          ticketRef: ref,
          status: "open",
          priority: "normal",
          summary: "private",
        };
      },
    };
    const body = {
      target,
      operation: "support_ticket_lookup",
      parameters: { ticketRef: "CASE-7" },
    };
    const first = await handleManagedSupport(request(body), deps);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      ok: true,
      target,
      ticket: { reference: "CASE-7", status: "open", priority: "normal" },
    });
    allowed = false;
    expect((await handleManagedSupport(request(body), deps)).status).toBe(403);
    expect(reads).toBe(1);
  });
  it("does not allow request fields to replace signed actor or target authority", async () => {
    let queried = false;
    const deps = {
      authenticate: async () => ({
        accountId: "other",
        tenantId: target.tenantId,
        actorId: grant.employeeId,
        grant,
        correlationId: "trace",
      }),
      verify: async () => true,
      authorize: async () => true,
      lookup: async () => {
        queried = true;
        return null;
      },
    };
    expect(
      (
        await handleManagedSupport(
          request({
            target,
            operation: "support_ticket_lookup",
            parameters: { ticketRef: "CASE-7" },
          }),
          deps,
        )
      ).status,
    ).toBe(403);
    expect(queried).toBe(false);
  });
  it("accepts signed read context and denies missing actor, broadened scope, changed audience and expired tokens", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const now = Math.floor(Date.now() / 1000);
    const auth = createManagedSupportAuthenticator({
      issuer: "https://identity.test",
      allowedClientIds: ["gateway-support"],
      key: publicKey,
    });
    const payload = {
      sub: "service:action-gateway",
      azp: "gateway-support",
      aud: "supportv8",
      iss: "https://identity.test",
      iat: now,
      nbf: now,
      exp: now + 120,
      jti: "token-test",
      account_id: target.accountId,
      tenant_id: target.tenantId,
      scope: "supportv8:tickets:read",
      capabilities: ["ticket.read"],
      actor: { type: "ai_employee", id: grant.employeeId },
      support_grant: grant,
      correlation_id: "trace-test",
      purpose: "direct_read",
    };
    for (const [patch, expected] of [
      [{}, true],
      [{ actor: undefined }, false],
      [{ scope: "supportv8:tickets:read support:manage" }, false],
      [{ aud: "other" }, false],
      [{ exp: now - 10 }, false],
    ] as const) {
      const token = await new SignJWT({ ...payload, ...patch })
        .setProtectedHeader({ alg: "RS256" })
        .sign(privateKey);
      expect(!!(await auth(request({}, token), "support_ticket_lookup"))).toBe(
        expected,
      );
    }
  });
});
it("bounds streamed input and rejects unknown operation parameters before any data query", async () => {
  let reads = 0;
  const deps = {
    authenticate: async () => ({
      accountId: target.accountId,
      tenantId: target.tenantId,
      actorId: grant.employeeId,
      grant,
      correlationId: "trace",
    }),
    verify: async () => true,
    authorize: async () => true,
    lookup: async () => {
      reads++;
      return null;
    },
  };
  for (const body of [
    {
      target,
      operation: "support_ticket_lookup",
      parameters: { ticketRef: "CASE-7", customerId: "extra" },
    },
    {
      target,
      operation: "support_ticket_lookup",
      parameters: { ticketRef: "CASE-7" },
      actor: "fake",
    },
    { target, operation: "ticket.list" },
    {
      target,
      operation: "support_ticket_lookup",
      parameters: { ticketRef: "x".repeat(9000) },
    },
  ])
    expect((await handleManagedSupport(request(body), deps)).status).toBe(400);
  expect(reads).toBe(0);
});
it("control scopes cannot read ticket data and signed grant drift is denied", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256"),
    now = Math.floor(Date.now() / 1000);
  const auth = createManagedSupportAuthenticator({
    issuer: "https://identity.test",
    allowedClientIds: ["gateway-support"],
    key: publicKey,
  });
  const base = {
    iss: "https://identity.test",
    aud: "supportv8",
    sub: "service:action-gateway",
    azp: "gateway-support",
    iat: now,
    nbf: now,
    exp: now + 120,
    jti: "token-test",
    scope: "supportv8:managed:connect",
  };
  const control = await new SignJWT(base)
    .setProtectedHeader({ alg: "RS256" })
    .sign(privateKey);
  expect(await auth(request({}, control), "connection.verify")).toMatchObject({
    correlationId: "token-test",
  });
  expect(await auth(request({}, control), "support_ticket_lookup")).toBeNull();
  const payload = {
    ...base,
    account_id: target.accountId,
    tenant_id: target.tenantId,
    scope: "supportv8:tickets:read",
    capabilities: ["ticket.read"],
    actor: { type: "ai_employee", id: grant.employeeId },
    support_grant: grant,
    correlation_id: "trace",
    purpose: "direct_read",
  };
  for (const patch of [
    { iss: "https://evil.test" },
    { azp: "provisioner" },
    { iat: now - 400, exp: now + 100 },
    { nbf: now + 50 },
    { jti: undefined },
    { account_id: undefined },
    { tenant_id: undefined },
    { capabilities: ["ticket.read", "ticket.write"] },
    { support_grant: { ...grant, employeeId: "other" } },
    { support_grant: { ...grant, generation: 0 } },
  ]) {
    const token = await new SignJWT({ ...payload, ...patch })
      .setProtectedHeader({ alg: "RS256" })
      .sign(privateKey);
    expect(await auth(request({}, token), "support_ticket_lookup")).toBeNull();
  }
});

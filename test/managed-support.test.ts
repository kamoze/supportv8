import { it, expect, vi } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { handleManagedSupport } from "@/lib/service-app/managed-support";
import { createManagedSupportAuthenticator } from "@/lib/service-app/managed-support-auth";
import { target } from "./managed-support-source-fixture";
const req = (body: unknown, token = "fixture") =>
  new Request("https://support.test/internal/service-apps/support/invoke", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
it("control verification cannot substitute for independent data source proof", async () => {
  const lookup = vi.fn();
  const deps = {
    authenticate: async () => ({ clientId: "gateway", correlationId: "trace" }),
    verify: async () => true,
    lookup,
  };
  expect(
    (
      await handleManagedSupport(
        req({ target, operation: "connection.verify" }),
        deps,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await handleManagedSupport(
        req({
          target,
          operation: "support_ticket_lookup",
          parameters: { ticketRef: "CASE-7" },
        }),
        deps,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await handleManagedSupport(
        req({
          target,
          operation: "support_ticket_lookup",
          source: { kind: "runtime", invocationId: "fake", digest: "fake" },
          parameters: { ticketRef: "CASE-7" },
        }),
        deps,
      )
    ).status,
  ).toBe(403);
  expect(lookup).not.toHaveBeenCalled();
});
it("read/output tokens are workload-only, purpose scoped,120seconds and nbf optional", async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const auth = createManagedSupportAuthenticator({
    issuer: "https://keycloak.test",
    allowedClientIds: ["gateway", "control"],
    allowedDataClientIds: ["gateway"],
    key: publicKey,
  });
  const now = Math.floor(Date.now() / 1000);
  for (const [extra, operation, allowed] of [
    [{}, "support_ticket_lookup", true],
    [{ scope: "supportv8:output:authorize" }, "support_output_access", true],
    [{ scope: "supportv8:output:authorize" }, "support_ticket_lookup", false],
    [{ scope: "supportv8:tickets:read" }, "support_output_access", false],
    [{ exp: now + 121 }, "support_ticket_lookup", false],
    [{ azp: "control" }, "support_ticket_lookup", false],
    [{ aud: "other" }, "support_ticket_lookup", false],
    [{ scope: "supportv8:managed:connect" }, "support_ticket_lookup", false],
    [{ nbf: now + 60 }, "support_ticket_lookup", false],
  ] as const) {
    const token = await new SignJWT({
      iss: "https://keycloak.test",
      aud: "supportv8",
      azp: "gateway",
      sub: "service-account",
      jti: "test",
      iat: now,
      exp: now + 120,
      scope: "supportv8:tickets:read",
      ...extra,
    })
      .setProtectedHeader({ alg: "RS256" })
      .sign(privateKey);
    expect(!!(await auth(req({}, token), operation))).toBe(allowed);
  }
});

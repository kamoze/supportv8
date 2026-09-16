import { it, expect, vi } from "vitest";
import { ManagedSupportAuthority } from "@/lib/service-app/managed-support-authority";
import { handleManagedSupport } from "@/lib/service-app/managed-support";
import {
  parseSupportSourceProof,
  supportSourceDigest,
} from "@/lib/service-app/managed-support-source";
import type { PostgresClient } from "@/lib/db/pg-client";
import {
  target,
  invocation,
  disclosure,
  policy,
  projection,
  member,
  ownerEnv,
} from "./managed-support-source-fixture";
const local = {
  installation_id: target.installationId,
  account_id: target.accountId,
  registry_tenant_id: target.tenantId,
  vertical_id: "runtime",
  native_tenant_id: target.workspaceId,
  native_domain: "test",
  subject: "creator",
  servicev8_account_id: target.accountId,
};
it("owner independently verifies sources, current channel and native staff RBAC; output never queries tickets", async () => {
  let inv = invocation(),
    disc = disclosure("history_replay"),
    currentPolicy: unknown = policy(),
    currentMember: unknown = member,
    sourceAvailable = true;
  const queries: string[] = [];
  const client = {
    withWorkspaceProvisioningSession: async (
      _: unknown,
      run: (db: unknown) => unknown,
    ) =>
      run({
        query: async (sql: string) => {
          queries.push(sql);
          return [local];
        },
      }),
  } as unknown as PostgresClient;
  const request: typeof fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    if (path.endsWith("/token") || path.endsWith("/registry-token"))
      return Response.json({
        access_token: "fixture",
        token_type: "Bearer",
        expires_in: 120,
      });
    if (path.startsWith("/internal/")) {
      if (!sourceAvailable) return new Response("{}", { status: 403 });
      const expected = path.includes("disclosures") ? disc : inv;
      expect(JSON.parse(String(init?.body)).digest).toBe(expected.digest);
      return Response.json({
        ok: true,
        [path.includes("disclosures") ? "disclosure" : "invocation"]: expected,
      });
    }
    if (path.endsWith("/configured")) return Response.json(currentPolicy);
    if (path.includes("/memberships/")) {
      expect(path.endsWith("/member-test")).toBe(true);
      return Response.json(currentMember);
    }
    return Response.json({ installations: [projection] });
  };
  const authority = new ManagedSupportAuthority({
    env: ownerEnv,
    request,
    client,
  });
  const lookup = vi.fn(async () => ({
    ticketRef: "CASE-7",
    status: "open",
    priority: "normal",
  }));
  const deps = {
    authenticate: async () => ({ clientId: "gateway", correlationId: "trace" }),
    verify: async () => true,
    verifySource: authority.verifySource.bind(authority),
    lookup,
  };
  const call = (output = false, extra: Record<string, unknown> = {}) =>
    handleManagedSupport(
      new Request("https://support.test/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target,
          operation: output ? "support_output_access" : "support_ticket_lookup",
          source: output
            ? {
                kind: "runtime",
                disclosureId: disc.disclosureId,
                digest: disc.digest,
              }
            : {
                kind: "runtime",
                invocationId: inv.invocationId,
                digest: inv.digest,
              },
          ...(!output ? { parameters: { ticketRef: "CASE-7" } } : {}),
          ...extra,
        }),
      }),
      deps,
    );
  expect((await call()).status).toBe(200);
  expect(lookup).toHaveBeenCalledTimes(1);
  expect((await call(true)).status).toBe(200);
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(queries.length).toBe(2);
  for (const role of ["CUSTOMER", "UNKNOWN"]) {
    currentMember = { ...member, role };
    expect((await call()).status).toBe(403);
    expect((await call(true)).status).toBe(403);
  }
  currentMember = { ...member, status: "inactive" };
  expect((await call(true)).status).toBe(403);
  currentMember = member;
  currentPolicy = {
    ...policy(),
    policy: {
      ...policy().policy,
      channels: {
        runtime_chat: {
          ...policy().policy.channels.runtime_chat,
          generation: 2,
        },
      },
    },
  };
  expect((await call()).status).toBe(403);
  currentPolicy = policy();
  sourceAvailable = false;
  expect((await call()).status).toBe(403);
  expect((await call(true)).status).toBe(403);
  sourceAvailable = true;
  expect(
    (
      await call(false, {
        source: {
          kind: "runtime",
          invocationId: inv.invocationId,
          digest: disc.digest,
        },
      })
    ).status,
  ).toBe(403);
  expect(lookup).toHaveBeenCalledTimes(1);
});
it("strict proof purposes,digests,expiry,reference and immutable target deny drift", () => {
  const inv = invocation(),
    disc = disclosure();
  expect(parseSupportSourceProof(inv, "lookup").subject).toBe("member-test");
  expect(parseSupportSourceProof(disc, "output").purpose).toBe(
    "initial_delivery",
  );
  expect(() => parseSupportSourceProof(disc, "lookup")).toThrow();
  expect(() => parseSupportSourceProof(inv, "output")).toThrow();
  for (const change of [
    { source: "voice" },
    { extra: true },
    { expiresAt: Date.now() - 1 },
    { expiresAt: Date.now() + 130000 },
    { channelGeneration: 1.5 },
    { parameters: { ticketReference: "CASE 7" } },
    { workspaceId: "tenant_other" },
    { connectionId: "11111111-1111-8111-8111-111111111111" },
  ]) {
    const { digest, ...context } = { ...inv, ...change };
    expect(() =>
      parseSupportSourceProof(
        { ...context, digest: supportSourceDigest(context) },
        "lookup",
      ),
    ).toThrow();
  }
});

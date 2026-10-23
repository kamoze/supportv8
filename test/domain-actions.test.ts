import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  executeSupportDomainAction,
  mintTestDelegatedToken,
} from "../src/lib/service-app/domain-actions";
import { emitSupportTicketCreatedSignal } from "../src/lib/signals/signal-agent";
import type { DatabaseSession, PostgresClient } from "../src/lib/db/pg-client";

const SECRET = "test-domain-action-secret-32chars!";
const ACCOUNT_ID = "acct_5c88ae327c3a";
const TENANT_ID = "tenant_5c88ae327c3a";
const INSTALLATION_ID = "inst:acq_435de4b5668d5e1bb09e5f499bdb030a3773ea39";
const WORKSPACE_ID = "tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559";

type StoredIssue = {
  id: string;
  tenant_id: string;
  source: string;
  external_id: string;
  source_url: string;
  customer_ref: string;
  customer_name: string;
  summary: string;
  priority: string;
  source_status: string;
  tags: string[];
  recommended_action: string | null;
  created_at: string;
  updated_at: string;
};

function createFakeClient(options?: { workspaceActive?: boolean }) {
  const workspaceActive = options?.workspaceActive ?? true;
  const issues = new Map<string, StoredIssue>();
  const audits: Array<Record<string, unknown>> = [];

  const session: DatabaseSession = {
    tenantId: WORKSPACE_ID,
    query: async <T>(sql: string, params: unknown[] = []): Promise<T[]> => {
      if (sql.includes("FROM supportv8.runtime_support_workspaces")) {
        if (!workspaceActive) return [];
        const [nativeId, accountId, registryTenantId] = params;
        if (
          nativeId === WORKSPACE_ID &&
          accountId === ACCOUNT_ID &&
          registryTenantId === TENANT_ID
        ) {
          return [
            {
              installation_id: INSTALLATION_ID,
              native_tenant_id: WORKSPACE_ID,
              native_domain: "runtime-acceptance",
              account_id: ACCOUNT_ID,
              registry_tenant_id: TENANT_ID,
            } as unknown as T,
          ];
        }
        return [];
      }
      if (sql.includes("pg_advisory_xact_lock")) {
        return [];
      }
      if (sql.includes("SELECT id,external_id") && sql.includes("FROM supportv8.issues")) {
        const [tenantId, id] = params as [string, string];
        const found = issues.get(`${tenantId}:${id}`);
        return found ? ([found] as unknown as T[]) : [];
      }
      if (sql.includes("INSERT INTO supportv8.issues")) {
        const [
          id,
          tenantId,
          externalId,
          sourceUrl,
          customerRef,
          customerName,
          summary,
          priority,
          tags,
          recommendedAction,
        ] = params as [
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string,
          string[],
          string | null,
        ];
        const row: StoredIssue = {
          id,
          tenant_id: tenantId,
          source: "governed_action",
          external_id: externalId,
          source_url: sourceUrl,
          customer_ref: customerRef,
          customer_name: customerName,
          summary,
          priority,
          source_status: "open",
          tags,
          recommended_action: recommendedAction,
          created_at: "2026-10-21T22:00:00.000Z",
          updated_at: "2026-10-21T22:00:00.000Z",
        };
        issues.set(`${tenantId}:${id}`, row);
        return [row as unknown as T];
      }
      if (sql.includes("INSERT INTO supportv8.action_audit_records")) {
        audits.push({ params });
        return [];
      }
      if (sql.includes("UPDATE supportv8.issues") && sql.includes("signal_emitted")) {
        const [tenantId, id] = params as [string, string];
        const found = issues.get(`${tenantId}:${id}`);
        if (found && !found.tags.includes("signal_emitted")) {
          found.tags = [...found.tags, "signal_emitted"];
        }
        return [];
      }
      return [];
    },
  };

  const client = {
    withWorkspaceProvisioningSession: async <T>(
      _scope: unknown,
      cb: (db: DatabaseSession) => Promise<T>,
    ): Promise<T> => cb(session),
    withTenantSession: async <T>(
      _tenantId: string,
      cb: (db: DatabaseSession) => Promise<T>,
    ): Promise<T> => cb(session),
  } as unknown as PostgresClient;

  return { client, issues, audits };
}

describe("SupportV8 governed domain actions (support.ticket.create)", () => {
  it("creates one ticket, emits deterministic OLG CloudEvent ID, and deduplicates replay without re-emitting signal", async () => {
    const { client, issues } = createFakeClient();
    const emittedSignals: Array<Record<string, unknown>> = [];
    const token = mintTestDelegatedToken({
      secret: SECRET,
      targetApp: "supportv8",
      capability: "support.ticket.create",
      accountId: ACCOUNT_ID,
      tenantId: TENANT_ID,
      idempotencyKey: "gov_action_act_101",
      actorId: "arthur",
    });

    const makeRequest = (payloadOverride?: Record<string, unknown>) =>
      new Request("http://supportv8:3005/v1/domain-actions/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-source-app": "assistant",
          "x-idempotency-key": "gov_action_act_101",
          "x-tenant-id": TENANT_ID,
        },
        body: JSON.stringify({
          capability: "support.ticket.create",
          target: {
            accountId: ACCOUNT_ID,
            tenantId: TENANT_ID,
            verticalId: "runtime",
            installationId: INSTALLATION_ID,
            workspaceId: WORKSPACE_ID,
          },
          payload: payloadOverride ?? {
            customerName: "Eleanor Vance",
            customerEmail: "eleanor.vance@example.com",
            summary: "Follow-up on Order ORD-UAT-1001 shipment status",
            description: "Executive assistant requested priority carrier confirmation.",
            priority: "high",
          },
        }),
      });

    const first = await executeSupportDomainAction(makeRequest(), {
      client,
      env: { SERVICEV8_TOKEN_SECRET: SECRET },
      emitSignal: async (params) => {
        emittedSignals.push(params as unknown as Record<string, unknown>);
        return { ok: true, receiptId: "rcpt_1" };
      },
    });
    expect(first.status).toBe(200);
    const firstBody = (await first.json()) as Record<string, unknown>;
    expect(firstBody.ok).toBe(true);
    expect(firstBody.replayed).toBe(false);
    expect(String(firstBody.id)).toMatch(/^iss_cmd_[a-f0-9]{24}$/);
    expect(String(firstBody.ticketRef)).toMatch(/^SV8-TKT-[A-F0-9]{12}$/);
    expect(firstBody.ticketNumber).toBe(firstBody.ticketRef);
    expect(firstBody.ticketUrl).toBe(firstBody.sourceUrl);
    expect(firstBody.signalId).toBe(`evt_supportv8_ticket_created_${firstBody.id}`);
    expect(issues.size).toBe(1);
    expect(emittedSignals.length).toBe(1);

    // Replay with identical payload -> returns same ticket, does not re-insert or re-emit
    const second = await executeSupportDomainAction(makeRequest(), {
      client,
      env: { SERVICEV8_TOKEN_SECRET: SECRET },
      emitSignal: async (params) => {
        emittedSignals.push(params as unknown as Record<string, unknown>);
        return { ok: true, receiptId: "rcpt_2" };
      },
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as Record<string, unknown>;
    expect(secondBody.id).toBe(firstBody.id);
    expect(secondBody.ticketRef).toBe(firstBody.ticketRef);
    expect(secondBody.replayed).toBe(true);
    expect(issues.size).toBe(1);
    expect(emittedSignals.length).toBe(1);

    // Mutated payload with same idempotencyKey -> 409 conflict
    const conflict = await executeSupportDomainAction(
      makeRequest({
        customerName: "Eleanor Vance",
        summary: "TAMPERED SUMMARY",
        priority: "urgent",
      }),
      {
        client,
        env: { SERVICEV8_TOKEN_SECRET: SECRET },
      },
    );
    expect(conflict.status).toBe(409);
    const conflictBody = (await conflict.json()) as Record<string, unknown>;
    expect(conflictBody.error).toBe("ticket_idempotency_conflict");
    expect(issues.size).toBe(1);
  });

  it("denies unauthorized actor/tenant and missing workspace assignment before side effect", async () => {
    const { client, issues } = createFakeClient({ workspaceActive: false });
    const badSigToken = `${mintTestDelegatedToken({
      secret: "wrong-secret-key-32-chars-long!!",
      targetApp: "supportv8",
      capability: "support.ticket.create",
      accountId: ACCOUNT_ID,
      tenantId: TENANT_ID,
      idempotencyKey: "gov_action_act_102",
      actorId: "arthur",
    })}`;

    const unauthResp = await executeSupportDomainAction(
      new Request("http://supportv8:3005/v1/domain-actions/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${badSigToken}`,
          "x-idempotency-key": "gov_action_act_102",
          "x-tenant-id": TENANT_ID,
        },
        body: JSON.stringify({
          capability: "support.ticket.create",
          payload: { customerName: "Alice", summary: "Test" },
        }),
      }),
      { client, env: { SERVICEV8_TOKEN_SECRET: SECRET } },
    );
    expect(unauthResp.status).toBe(401);
    expect(issues.size).toBe(0);

    // Valid token but cross-tenant header mismatch
    const validToken = mintTestDelegatedToken({
      secret: SECRET,
      targetApp: "supportv8",
      capability: "support.ticket.create",
      accountId: ACCOUNT_ID,
      tenantId: TENANT_ID,
      idempotencyKey: "gov_action_act_102",
      actorId: "arthur",
    });
    const crossTenantResp = await executeSupportDomainAction(
      new Request("http://supportv8:3005/v1/domain-actions/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${validToken}`,
          "x-idempotency-key": "gov_action_act_102",
          "x-tenant-id": "tenant_other",
        },
        body: JSON.stringify({
          capability: "support.ticket.create",
          payload: { customerName: "Alice", summary: "Test" },
        }),
      }),
      { client, env: { SERVICEV8_TOKEN_SECRET: SECRET } },
    );
    expect(crossTenantResp.status).toBe(403);
    expect(issues.size).toBe(0);

    // Valid token + matching tenant, but workspace assignment inactive
    const unassignedResp = await executeSupportDomainAction(
      new Request("http://supportv8:3005/v1/domain-actions/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${validToken}`,
          "x-idempotency-key": "gov_action_act_102",
          "x-tenant-id": TENANT_ID,
        },
        body: JSON.stringify({
          capability: "support.ticket.create",
          target: {
            accountId: ACCOUNT_ID,
            tenantId: TENANT_ID,
            verticalId: "runtime",
            installationId: INSTALLATION_ID,
            workspaceId: WORKSPACE_ID,
          },
          payload: { customerName: "Alice", summary: "Test" },
        }),
      }),
      { client, env: { SERVICEV8_TOKEN_SECRET: SECRET } },
    );
    expect(unassignedResp.status).toBe(403);
    const unassignedBody = (await unassignedResp.json()) as Record<string, unknown>;
    expect(unassignedBody.error).toBe("support_workspace_not_active");
    expect(issues.size).toBe(0);
  });

  it("uses deterministic CloudEvent IDs in emitSupportTicketCreatedSignal", async () => {
    const sentBodies: Array<Record<string, unknown>> = [];
    const res = await emitSupportTicketCreatedSignal(
      {
        tenantId: TENANT_ID,
        accountId: ACCOUNT_ID,
        ticket: {
          id: "iss_cmd_abc123",
          ticketRef: "SV8-TKT-ABC123",
          customerName: "Eleanor Vance",
          summary: "Shipment status check",
          priority: "high",
        },
      },
      {
        env: {
          SERVICEV8_RUNTIME_CLUSTER_URL: "http://runtime.internal",
          RUNTIME_SIGNALS_SECRET: "sig-secret",
        },
        fetchImpl: (async (_url, init) => {
          sentBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
          return new Response(
            JSON.stringify({ ok: true, receiptId: "rcpt_sig_1", status: "accepted" }),
            { status: 202, headers: { "content-type": "application/json" } },
          );
        }) as typeof fetch,
      },
    );
    expect(res.ok).toBe(true);
    expect(sentBodies.length).toBe(1);
    expect(sentBodies[0]?.id).toBe("evt_supportv8_ticket_created_iss_cmd_abc123");
  });

  it("retries OLG signal emission on replay if initial signal delivery failed, and rejects forged HMAC even with valid workload token", async () => {
    const { client, issues } = createFakeClient();
    const token = mintTestDelegatedToken({
      secret: SECRET,
      targetApp: "supportv8",
      capability: "support.ticket.create",
      accountId: ACCOUNT_ID,
      tenantId: TENANT_ID,
      idempotencyKey: "gov_action_act_103",
      actorId: "arthur",
    });

    const forgedToken = mintTestDelegatedToken({
      secret: "wrong-secret-key-32-chars-long!!",
      targetApp: "supportv8",
      capability: "support.ticket.create",
      accountId: ACCOUNT_ID,
      tenantId: TENANT_ID,
      idempotencyKey: "gov_action_act_103",
      actorId: "arthur",
    });

    // Forged HMAC token must be rejected with 401 even when workload auth succeeds
    const forgedResp = await executeSupportDomainAction(
      new Request("http://supportv8:3005/v1/domain-actions/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${forgedToken}`,
          "x-servicev8-workload-token": "valid-workload-token",
          "x-idempotency-key": "gov_action_act_103",
          "x-tenant-id": TENANT_ID,
        },
        body: JSON.stringify({
          capability: "support.ticket.create",
          target: {
            accountId: ACCOUNT_ID,
            tenantId: TENANT_ID,
            verticalId: "runtime",
            installationId: INSTALLATION_ID,
            workspaceId: WORKSPACE_ID,
          },
          payload: {
            customerName: "Eleanor Vance",
            summary: "Carrier confirmation check",
            priority: "medium",
          },
        }),
      }),
      {
        client,
        env: { SERVICEV8_TOKEN_SECRET: SECRET },
        authenticateWorkload: async () => ({
          clientId: "action-gateway-support",
          subject: "service:action-gateway",
          scopes: ["connection.verify"],
          correlationId: "corr_test_1",
        }),
      },
    );
    expect(forgedResp.status).toBe(401);
    expect(issues.size).toBe(0);

    const makeValidReq = () =>
      new Request("http://supportv8:3005/v1/domain-actions/execute", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-idempotency-key": "gov_action_act_103",
          "x-tenant-id": TENANT_ID,
        },
        body: JSON.stringify({
          capability: "support.ticket.create",
          target: {
            accountId: ACCOUNT_ID,
            tenantId: TENANT_ID,
            verticalId: "runtime",
            installationId: INSTALLATION_ID,
            workspaceId: WORKSPACE_ID,
          },
          payload: {
            customerName: "Eleanor Vance",
            summary: "Carrier confirmation check",
            priority: "medium",
          },
        }),
      });

    // First call: signal emission fails -> 502 signal_emission_failed
    let signalAttempts = 0;
    const firstAttempt = await executeSupportDomainAction(makeValidReq(), {
      client,
      env: { SERVICEV8_TOKEN_SECRET: SECRET },
      emitSignal: async () => {
        signalAttempts += 1;
        return { ok: false, error: "olg_ingest_timeout" };
      },
    });
    expect(firstAttempt.status).toBe(502);
    expect(signalAttempts).toBe(1);
    expect(issues.size).toBe(1);

    // Second call (replay): retries signal emission, succeeds, marks signal_emitted
    const secondAttempt = await executeSupportDomainAction(makeValidReq(), {
      client,
      env: { SERVICEV8_TOKEN_SECRET: SECRET },
      emitSignal: async () => {
        signalAttempts += 1;
        return { ok: true, receiptId: "rcpt_recovered_1" };
      },
    });
    expect(secondAttempt.status).toBe(200);
    const secondBody = (await secondAttempt.json()) as Record<string, unknown>;
    expect(secondBody.ok).toBe(true);
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.priority).toBe("medium");
    expect(secondBody.signalReceiptId).toBe("rcpt_recovered_1");
    expect(signalAttempts).toBe(2);

    // Third call (replay after signal_emitted): does not re-emit
    const thirdAttempt = await executeSupportDomainAction(makeValidReq(), {
      client,
      env: { SERVICEV8_TOKEN_SECRET: SECRET },
      emitSignal: async () => {
        signalAttempts += 1;
        return { ok: true, receiptId: "rcpt_extra" };
      },
    });
    expect(thirdAttempt.status).toBe(200);
    expect(signalAttempts).toBe(2);
  });
});

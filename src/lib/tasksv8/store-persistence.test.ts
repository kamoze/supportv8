import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { PostgresClient } from "../db/pg-client";
import {
  PostgresTasksv8Store,
  getTasksv8Store,
  setTasksv8Store,
  resetTasksv8Store,
} from "./store";
import type { CloudEventV1, WorkOutcomeV1 } from "./contracts";

describe("SupportV8 TaskV8 Store Durable Persistence & Restart Recovery (PostgreSQL)", () => {
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.SUPPORTV8_DATABASE_URL ||
    "postgres://localhost:5432/support_records_review_test";

  const tenantId = `tenant_uat_${Date.now()}`;
  const accountId = `${tenantId}-account`;
  const ticketId = `ticket_${Date.now()}`;
  const eventId = `evt_persist_${Date.now()}`;

  let client: PostgresClient;
  let store: PostgresTasksv8Store;

  const validOutcomeEvent: CloudEventV1<WorkOutcomeV1> = {
    specversion: "1.0",
    id: eventId,
    source: `urn:servicev8:tasks:supportv8:${ticketId}`,
    type: "servicev8.work-outcome.v1",
    time: new Date().toISOString(),
    datacontenttype: "application/json",
    data: {
      schema: "servicev8.work-outcome.v1",
      eventId,
      workId: `work_${Date.now()}`,
      projectId: "proj_uat",
      acceptedSpecVersion: 1,
      acceptedBy: "support_agent_uat",
      acceptedAt: new Date().toISOString(),
      outcomeSummary: "Root cause found and resolved in database persistence test",
      sourceReferences: [
        {
          system: "supportv8",
          recordId: ticketId,
          uri: `https://${tenantId}.support.servicev8.com/runtime?ticket=${ticketId}`,
        },
      ],
      execution: {
        dispatchId: `disp_${Date.now()}`,
        runId: `run_${Date.now()}`,
        state: "succeeded",
      },
      verification: [
        {
          system: "supportv8",
          receiptId: `rcpt_verif_${Date.now()}`,
          result: "passed",
          evidenceUris: ["https://support.internal/evidence/ticket_123"],
        },
      ],
      artifacts: [],
      correlationId: ticketId,
    },
  };

  beforeAll(async () => {
    client = new PostgresClient(databaseUrl);
    store = new PostgresTasksv8Store(client);
    setTasksv8Store(store);

    // 1. Seed initial issue with open status
    await client.withTenantSession(tenantId, async (db) => {
      await db.query(
        `INSERT INTO supportv8.issues (
           id, tenant_id, source_status, priority, summary, created_at, updated_at
         ) VALUES ($1, $2, 'open', 'high', 'Test escalation for persistence', NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET source_status = 'open'`,
        [ticketId, tenantId]
      );
    });

    // 2. Record escalation link
    await store.recordEscalation(
      { tenantId, accountId },
      { id: ticketId, summary: "Test escalation for persistence", priority: "high" }
    );
  });

  afterAll(async () => {
    resetTasksv8Store();
    if (client) {
      await client.withTenantSession(tenantId, async (db) => {
        await db.query("DELETE FROM supportv8.tasksv8_outcome_receipts WHERE tenant_id = $1", [tenantId]).catch(() => {});
        await db.query("DELETE FROM supportv8.tasksv8_outbox WHERE tenant_id = $1", [tenantId]).catch(() => {});
        await db.query("DELETE FROM supportv8.tasksv8_links WHERE tenant_id = $1", [tenantId]).catch(() => {});
        await db.query("DELETE FROM supportv8.issues WHERE tenant_id = $1", [tenantId]).catch(() => {});
      }).catch(() => {});

      const pool = (client as any).pool;
      if (pool && typeof pool.end === "function") {
        await pool.end();
      }
    }
  });

  it("persists outcome receipt to PostgreSQL and survives process/cache restart", async () => {
    // 1. Record outcome in store
    const initialResult = await store.recordOutcome(
      { tenantId, accountId },
      validOutcomeEvent
    );

    expect(initialResult.state).toBe("recorded");
    expect(initialResult.eventId).toBe(eventId);
    expect(initialResult.receiptId).toBeDefined();

    // 2. Simulate store / cache reset & reopening connection
    resetTasksv8Store();
    const freshClient = new PostgresClient(databaseUrl);
    const freshStore = new PostgresTasksv8Store(freshClient);

    try {
      // 3. Query receipt from fresh store
      const persistedReceipt = await freshStore.outcomeReceipt(tenantId, eventId);
      expect(persistedReceipt).not.toBeNull();
      expect(persistedReceipt!.receiptId).toBe(initialResult.receiptId);
      expect(persistedReceipt!.eventId).toBe(eventId);
      expect(persistedReceipt!.tenantId).toBe(tenantId);

      // 4. Verify link state updated
      const link = await freshStore.getLink({ tenantId }, ticketId);
      expect(link).not.toBeNull();
      expect(link!.outcomeState).toBe("succeeded");
      expect(link!.lastReceiptId).toBe(initialResult.receiptId);

      // 5. Critical invariant: verify ticket status was NEVER closed or resolved
      await freshClient.withTenantSession(tenantId, async (db) => {
        const issues = await db.query<any>(
          "SELECT source_status FROM supportv8.issues WHERE tenant_id = $1 AND id = $2",
          [tenantId, ticketId]
        );
        expect(issues).toHaveLength(1);
        expect(issues[0].source_status).toBe("open"); // Non-closing invariant!
      });

      // 6. Exact replay returns original receipt with state: "duplicate"
      const replayResult = await freshStore.recordOutcome(
        { tenantId, accountId },
        validOutcomeEvent
      );
      expect(replayResult.state).toBe("duplicate");
      expect(replayResult.receiptId).toBe(initialResult.receiptId);
      expect(replayResult.eventId).toBe(eventId);

      // 7. Conflicting payload throws idempotency_conflict
      const conflictingEvent: CloudEventV1<WorkOutcomeV1> = {
        ...validOutcomeEvent,
        data: {
          ...validOutcomeEvent.data,
          outcomeSummary: "Altered summary that produces different hash",
          acceptedSpecVersion: 2,
        },
      };

      await expect(
        freshStore.recordOutcome({ tenantId, accountId }, conflictingEvent)
      ).rejects.toThrow(/idempotency_conflict/);
    } finally {
      const pool = (freshClient as any).pool;
      if (pool && typeof pool.end === "function") {
        await pool.end();
      }
    }
  });
});

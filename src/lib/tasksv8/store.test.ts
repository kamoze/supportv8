import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { RuntimeSupportTicketReader } from "@/lib/service-app/runtime-ticket-reader";
import type { SupportRuntimeScope } from "@/lib/service-app/runtime-access";
import { PostgresClient, type DatabasePool } from "@/lib/db/pg-client";
import {
  MemoryTasksv8Store,
  getTasksv8Store,
  setTasksv8Store,
  type Tasksv8Store,
} from "./store";
import { Tasksv8Client } from "./client";
import { Tasksv8OutboxWorker } from "./worker";
import type { CloudEventV1, WorkOutcomeV1 } from "./contracts";

describe("SupportV8 TaskV8 Store & Escalation Bridge", () => {
  const originalEnv = process.env.SUPPORTV8_TASKSV8_ENABLED;
  const originalSecret = process.env.TASKSV8_JWT_SECRET;

  const scope: SupportRuntimeScope = {
    accountId: "acct-test-1",
    tenantId: "tenant_rt_1234567890abcdef1234567890abcdef1234567890abcdef",
    verticalId: "runtime",
    installationId: "install-test-1",
    workspaceId: "tenant_rt_1234567890abcdef1234567890abcdef1234567890abcdef",
    subject: "member-test-1",
  };
  const access = {
    ...scope,
    capability: "support:manage" as const,
    email: "operator@example.test",
    domain: "acme-support",
  };

  let store: Tasksv8Store;
  let reader: RuntimeSupportTicketReader;
  let mockIssues: Map<string, any>;

  function buildReaderHarness(initialRows: any[] = []) {
    mockIssues = new Map();
    for (const r of initialRows) {
      mockIssues.set(r.id, { ...r });
    }

    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("supportv8.issues") && sql.startsWith("SELECT")) {
        const id = params[1] as string;
        const row = mockIssues.get(id);
        return { rows: row ? [row] : [] };
      }
      if (sql.includes("supportv8.issues") && sql.startsWith("UPDATE")) {
        const id = params[1] as string;
        const summary = params[2] as string | null;
        const priority = params[3] as string | null;
        const status = params[4] as string | null;
        const row = mockIssues.get(id);
        if (row) {
          if (summary !== null) row.summary = summary;
          if (priority !== null) row.priority = priority;
          if (status !== null) row.source_status = status;
          row.updated_at = new Date().toISOString();
        }
        return { rows: row ? [row] : [] };
      }
      return { rows: [] };
    });

    const pool = {
      connect: vi.fn(async () => ({ query, release: vi.fn() })),
    } as unknown as DatabasePool;

    reader = new RuntimeSupportTicketReader({
      client: new PostgresClient(undefined, pool),
      resolve: vi.fn(async () => access),
      tasksv8Store: store,
    });
  }

  const initialTicketRow = {
    id: "iss_runtime_123",
    external_id: "ref-iss_runtime_123",
    customer_ref: "customer-123",
    customer_name: "Customer 123",
    source_status: "open",
    priority: "urgent",
    summary: "Critical billing calculation failure",
    source: "runtime_manual",
    created_at: "2026-10-20T12:00:00.000Z",
    updated_at: "2026-10-20T12:00:00.000Z",
  };

  const outcomeFixture: CloudEventV1<WorkOutcomeV1> = {
    specversion: "1.0",
    id: "evt_outcome_101",
    source: "urn:servicev8:tasks",
    type: "servicev8.work-outcome.v1",
    time: "2026-10-20T13:00:00.000Z",
    datacontenttype: "application/json",
    data: {
      schema: "servicev8.work-outcome.v1",
      eventId: "evt_outcome_101",
      workId: "work_sv8_999",
      projectId: "proj_billing_core",
      acceptedSpecVersion: 1,
      acceptedBy: "agent:auto-remediation",
      acceptedAt: "2026-10-20T13:00:00.000Z",
      outcomeSummary: "Hotfix deployed and verified successfully",
      sourceReferences: [
        {
          system: "supportv8",
          recordId: "iss_runtime_123",
          uri: "https://acme-support.support.servicev8.com/runtime?ticket=iss_runtime_123",
        },
      ],
      execution: {
        dispatchId: "disp_777",
        runId: "run_888",
        state: "succeeded",
      },
      verification: [
        {
          system: "supportv8",
          receiptId: "rcpt_verif_001",
          result: "passed",
          evidenceUris: ["https://artifacts.servicev8.internal/verif/001.log"],
        },
      ],
      artifacts: [
        {
          artifactId: "art_patch_001",
          uri: "https://artifacts.servicev8.internal/artifacts/patch.diff",
          sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        },
      ],
      correlationId: "corr_sv8_123",
    },
  };

  beforeEach(() => {
    process.env.SUPPORTV8_TASKSV8_ENABLED = "true";
    process.env.TASKSV8_JWT_SECRET = "test-secret-key-1234567890abcdef";
    store = new MemoryTasksv8Store();
    setTasksv8Store(store);
    buildReaderHarness([initialTicketRow]);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SUPPORTV8_TASKSV8_ENABLED = originalEnv;
    } else {
      delete process.env.SUPPORTV8_TASKSV8_ENABLED;
    }
    if (originalSecret !== undefined) {
      process.env.TASKSV8_JWT_SECRET = originalSecret;
    } else {
      delete process.env.TASKSV8_JWT_SECRET;
    }
  });

  it("commits an escalation and one TaskV8 intake event together", async () => {
    const updated = await reader.update(scope, "iss_runtime_123", { status: "escalated" });
    expect(updated?.status).toBe("escalated");

    const pending = await store.pending(scope.tenantId);
    expect(pending).toEqual([
      expect.objectContaining({
        tenantId: scope.tenantId,
        sourceRecordId: "iss_runtime_123",
        status: "pending",
      }),
    ]);

    const link = await store.getLink(scope, "iss_runtime_123");
    expect(link).toBeDefined();
    expect(link?.ticketId).toBe("iss_runtime_123");
    expect(link?.sourceRevision).toBe(1);
    expect(link?.lastEventId).toBe(pending[0].eventId);
  });

  it("records accepted work without closing the ticket", async () => {
    // 1. Escalate first to establish link
    await reader.update(scope, "iss_runtime_123", { status: "escalated" });
    expect((await reader.get(scope, "iss_runtime_123"))?.status).toBe("escalated");

    // 2. Record outcome from TaskV8
    const receipt = await store.recordOutcome(scope, outcomeFixture);
    expect(receipt.state).toBe("recorded");
    expect(receipt.eventId).toBe(outcomeFixture.id);

    // 3. CRITICAL INVARIANT: Ticket status MUST remain 'escalated', NOT closed or resolved!
    const ticketAfterOutcome = await reader.get(scope, "iss_runtime_123");
    expect(ticketAfterOutcome?.status).toBe("escalated");

    // 4. Link outcome_state is updated to 'succeeded'
    const link = await store.getLink(scope, "iss_runtime_123");
    expect(link?.outcomeState).toBe("succeeded");
    expect(link?.lastReceiptId).toBe(receipt.receiptId);
  });

  it("returns original receipt on exact outcome replay (idempotency)", async () => {
    await reader.update(scope, "iss_runtime_123", { status: "escalated" });

    const first = await store.recordOutcome(scope, outcomeFixture);
    expect(first.state).toBe("recorded");

    // Replay with exact same payload
    const second = await store.recordOutcome(scope, outcomeFixture);
    expect(second.state).toBe("duplicate");
    expect(second.receiptId).toBe(first.receiptId);
    expect(second.eventId).toBe(first.eventId);
  });

  it("throws idempotency conflict on mismatched payload with same event_id", async () => {
    await reader.update(scope, "iss_runtime_123", { status: "escalated" });
    await store.recordOutcome(scope, outcomeFixture);

    const conflictingFixture: CloudEventV1<WorkOutcomeV1> = {
      ...outcomeFixture,
      data: {
        ...outcomeFixture.data,
        outcomeSummary: "Completely different outcome content",
      },
    };

    await expect(store.recordOutcome(scope, conflictingFixture)).rejects.toThrow(
      "idempotency_conflict"
    );
  });

  it("claims and acks outbox items properly", async () => {
    await reader.update(scope, "iss_runtime_123", { status: "escalated" });

    const claimed = await store.claimOutbox(10, 5000, scope.tenantId);
    expect(claimed.length).toBe(1);
    expect(claimed[0].status).toBe("leased");
    expect(claimed[0].attemptCount).toBe(1);

    await store.ackOutbox(
      scope,
      claimed[0].eventId,
      "rcpt_intake_555",
      "work_task_123",
      "https://tasks.servicev8.internal/app/work/work_task_123"
    );

    const pendingAfterAck = await store.pending(scope.tenantId);
    expect(pendingAfterAck.length).toBe(0);

    const link = await store.getLink(scope, "iss_runtime_123");
    expect(link?.taskId).toBe("work_task_123");
    expect(link?.taskUri).toBe("https://tasks.servicev8.internal/app/work/work_task_123");
    expect(link?.lastReceiptId).toBe("rcpt_intake_555");
  });

  it("worker delivers outbox item via client and marks link acknowledged", async () => {
    await reader.update(scope, "iss_runtime_123", { status: "escalated" });

    const mockPublish = vi.fn(async () => ({
      receiptId: "rcpt_mock_001",
      workId: "work_mock_999",
      state: "created" as const,
      sourceRevision: 1,
    }));

    const client = new Tasksv8Client({
      baseUrl: "http://tasksv8.internal",
      jwtSecret: "test-secret-key-1234567890abcdef",
    });
    vi.spyOn(client, "publishIntakeEvent").mockImplementation(mockPublish);

    const worker = new Tasksv8OutboxWorker({
      store,
      client,
      batchSize: 5,
      leaseMs: 5000,
    });

    const deliveredCount = await worker.deliverOnce(scope.tenantId);
    expect(deliveredCount).toBe(1);
    expect(mockPublish).toHaveBeenCalledTimes(1);

    const link = await store.getLink(scope, "iss_runtime_123");
    expect(link?.taskId).toBe("work_mock_999");
    expect(link?.lastReceiptId).toBe("rcpt_mock_001");
  });
});

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";
import {
  MemoryTasksv8Store,
  setTasksv8Store,
  type Tasksv8Store,
} from "@/lib/tasksv8/store";
import { signWorkloadToken } from "@/lib/tasksv8/auth";
import type { CloudEventV1, WorkOutcomeV1 } from "@/lib/tasksv8/contracts";

describe("POST /api/internal/tasksv8/outcomes", () => {
  const originalEnv = process.env.SUPPORTV8_TASKSV8_ENABLED;
  const originalSecret = process.env.TASKSV8_JWT_SECRET;

  const tenantId = "tenant_rt_1234567890abcdef1234567890abcdef1234567890abcdef";
  const accountId = "acct-test-1";
  const ticketId = "iss_runtime_456";

  let store: Tasksv8Store;

  const validOutcomeEvent: CloudEventV1<WorkOutcomeV1> = {
    specversion: "1.0",
    id: "evt_outcome_202",
    source: "urn:servicev8:tasks",
    type: "servicev8.work-outcome.v1",
    time: "2026-10-20T14:00:00.000Z",
    datacontenttype: "application/json",
    data: {
      schema: "servicev8.work-outcome.v1",
      eventId: "evt_outcome_202",
      workId: "work_sv8_888",
      projectId: "proj_support_remediation",
      acceptedSpecVersion: 1,
      acceptedBy: "agent:remediation-worker",
      acceptedAt: "2026-10-20T14:00:00.000Z",
      outcomeSummary: "Root cause isolated and patched",
      sourceReferences: [
        {
          system: "supportv8",
          recordId: ticketId,
          uri: `https://support.servicev8.com/runtime?ticket=${ticketId}`,
        },
      ],
      execution: {
        dispatchId: "disp_999",
        runId: "run_999",
        state: "succeeded",
      },
      verification: [
        {
          system: "supportv8",
          receiptId: "rcpt_verif_002",
          result: "passed",
          evidenceUris: ["https://artifacts.servicev8.internal/verif/002.log"],
        },
      ],
      artifacts: [
        {
          artifactId: "art_002",
          uri: "https://artifacts.servicev8.internal/artifacts/patch-002.diff",
          sha256: "b".repeat(64),
        },
      ],
      correlationId: "corr_outcome_202",
    },
  };

  beforeEach(async () => {
    process.env.SUPPORTV8_TASKSV8_ENABLED = "true";
    process.env.TASKSV8_JWT_SECRET = "test-secret-key-1234567890abcdef";
    store = new MemoryTasksv8Store();
    setTasksv8Store(store);

    // Pre-populate link by escalating
    await store.recordEscalation(
      { tenantId, accountId },
      { id: ticketId, summary: "Database connectivity error", priority: "urgent" }
    );
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

  async function makeRequest(
    body: unknown,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const defaultHeaders: Record<string, string> = {
      "content-type": "application/json",
      "x-tenant-id": tenantId,
      "x-account-id": accountId,
      "x-workload-client": "servicev8-tasks",
      "x-workload-scope": "supportv8:task-outcomes",
      "x-workload-purpose": "event_publish",
      ...headers,
    };

    const req = new Request("http://localhost:3000/api/internal/tasksv8/outcomes", {
      method: "POST",
      headers: defaultHeaders,
      body: JSON.stringify(body),
    });

    return POST(req);
  }

  it("returns 404 when SUPPORTV8_TASKSV8_ENABLED is not 'true'", async () => {
    process.env.SUPPORTV8_TASKSV8_ENABLED = "false";
    const res = await makeRequest(validOutcomeEvent);
    expect(res.status).toBe(404);
  });

  it("returns 401 when no auth is provided", async () => {
    const req = new Request("http://localhost:3000/api/internal/tasksv8/outcomes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validOutcomeEvent),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when workload client is not 'servicev8-tasks'", async () => {
    const res = await makeRequest(validOutcomeEvent, {
      "x-workload-client": "unauthorized-service",
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when workload scope is invalid", async () => {
    const res = await makeRequest(validOutcomeEvent, {
      "x-workload-scope": "wrong:scope",
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when workload purpose is invalid", async () => {
    const res = await makeRequest(validOutcomeEvent, {
      "x-workload-purpose": "direct_read",
    });
    expect(res.status).toBe(403);
  });

  it("returns 403 when tenant in token/header does not match link tenant (foreign tenant)", async () => {
    const foreignTenantId = "tenant_foreign_999999999999999999999999999999999999";
    const res = await makeRequest(validOutcomeEvent, {
      "x-tenant-id": foreignTenantId,
    });
    expect(res.status).toBe(403);
  });

  it("authenticates successfully with signed JWT Bearer token", async () => {
    const token = await signWorkloadToken(
      {
        tenantId,
        accountId,
        audience: "supportv8",
        scope: "supportv8:task-outcomes",
        purpose: "event_publish",
        client: "servicev8-tasks",
      },
      process.env.TASKSV8_JWT_SECRET!
    );

    const req = new Request("http://localhost:3000/api/internal/tasksv8/outcomes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validOutcomeEvent),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.state).toBe("recorded");
    expect(body.eventId).toBe(validOutcomeEvent.id);
  });

  it("records accepted outcome and returns 200 with receipt", async () => {
    const res = await makeRequest(validOutcomeEvent);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.state).toBe("recorded");
    expect(body.eventId).toBe(validOutcomeEvent.id);
    expect(typeof body.receiptId).toBe("string");

    const link = await store.getLink({ tenantId }, ticketId);
    expect(link?.outcomeState).toBe("succeeded");
    expect(link?.lastReceiptId).toBe(body.receiptId);
  });

  it("returns 200 with original receipt on exact duplicate replay", async () => {
    const firstRes = await makeRequest(validOutcomeEvent);
    expect(firstRes.status).toBe(200);
    const firstBody = await firstRes.json();

    const secondRes = await makeRequest(validOutcomeEvent);
    expect(secondRes.status).toBe(200);
    const secondBody = await secondRes.json();

    expect(secondBody.state).toBe("duplicate");
    expect(secondBody.receiptId).toBe(firstBody.receiptId);
    expect(secondBody.eventId).toBe(firstBody.eventId);
  });

  it("returns 409 idempotency_conflict when same eventId has conflicting payload", async () => {
    const firstRes = await makeRequest(validOutcomeEvent);
    expect(firstRes.status).toBe(200);

    const conflictingEvent: CloudEventV1<WorkOutcomeV1> = {
      ...validOutcomeEvent,
      data: {
        ...validOutcomeEvent.data,
        outcomeSummary: "Conflicting summary payload",
      },
    };

    const conflictRes = await makeRequest(conflictingEvent);
    expect(conflictRes.status).toBe(409);
    const conflictBody = await conflictRes.json();
    expect(conflictBody.error).toBe("idempotency_conflict");
  });

  it("returns 404 when ticket link does not exist", async () => {
    const nonExistentEvent: CloudEventV1<WorkOutcomeV1> = {
      ...validOutcomeEvent,
      id: "evt_outcome_other",
      data: {
        ...validOutcomeEvent.data,
        eventId: "evt_outcome_other",
        sourceReferences: [
          {
            system: "supportv8",
            recordId: "iss_nonexistent_999",
            uri: "https://support.servicev8.com/runtime?ticket=iss_nonexistent_999",
          },
        ],
      },
    };

    const res = await makeRequest(nonExistentEvent);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("link_not_found");
  });
});

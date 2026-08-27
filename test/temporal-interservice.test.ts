import { describe, it, expect } from "vitest";
import { isTemporalEnabled, TASK_QUEUE } from "../src/lib/temporal/config";
import {
  enqueueSupportTriage,
  enqueueProactiveBroadcast,
  enqueueInterServiceDispatch,
} from "../src/lib/temporal/client";
import {
  KnowledgeV8Client,
  GrowthV8Client,
  DominionClient,
  ForgeSymphonyClient,
} from "../src/lib/services/interservice-client";

describe("Temporal Infrastructure & Inter-Service Mesh", () => {
  it("should have valid task queue and environment helper", () => {
    expect(TASK_QUEUE).toBe("supportv8-spine");
    expect(typeof isTemporalEnabled()).toBe("boolean");
  });

  it("should execute support triage workflow with inline fallback when Temporal address is unset", async () => {
    const result = await enqueueSupportTriage({
      tenantId: "acme",
      sessionId: "sess_test_123",
      stream: "customers",
      customerName: "Marcus Vance",
      customerEmail: "marcus@meridian.com",
      query: "Need $420 refund token for damaged item",
      priority: "normal",
    });

    expect(result.sessionId).toBe("sess_test_123");
    expect(result.triageStatus).toBe("autonomous_resolved");
    expect(result.growthV8Synced).toBe(true);
    expect(result.ragCitations.length).toBeGreaterThan(0);
    expect(result.dominionEventId).toBeDefined();
  });

  it("should escalate support triage workflow when priority is urgent", async () => {
    const result = await enqueueSupportTriage({
      tenantId: "acme",
      sessionId: "sess_urgent_999",
      stream: "contractors",
      customerName: "Apex Technicians",
      customerEmail: "tech@apex.com",
      query: "Emergency lockbox access code failure on site",
      priority: "urgent",
    });

    expect(result.sessionId).toBe("sess_urgent_999");
    expect(result.triageStatus).toBe("escalated_to_human");
    expect(result.assignedTarget).toBe("group_support");
  });

  it("should dispatch proactive broadcast workflow", async () => {
    const res = await enqueueProactiveBroadcast({
      tenantId: "acme",
      problemId: "PRB-401",
      affectedAccountsCount: 28,
      subject: "Temporary Payment Gateway Latency Resolved",
      body: "All transactions have reconciled successfully.",
    });

    expect(res.success).toBe(true);
    expect(res.broadcastId).toBeDefined();
  });

  it("should query KnowledgeV8 vector embeddings via client adapter", async () => {
    const res = await KnowledgeV8Client.searchEmbeddings({
      tenantId: "acme",
      query: "Okta SAML configuration runbook",
      stream: "enquiries",
      topK: 3,
    });

    expect(res.success).toBe(true);
    expect(res.service).toBe("knowledgev8");
    expect(res.data?.citations.length).toBeGreaterThan(0);
    expect(res.data?.citations[0].similarity).toBeGreaterThan(0.9);
  });

  it("should attribute customer interactions via GrowthV8 client adapter", async () => {
    const res = await GrowthV8Client.attributeSupportInteraction({
      tenantId: "acme",
      customerEmail: "marcus@meridian.com",
      sentimentScore: 0.92,
      issueUrgency: "normal",
    });

    expect(res.success).toBe(true);
    expect(res.service).toBe("growthv8");
    expect(res.data?.accountTier).toContain("Enterprise");
    expect(res.data?.churnRiskScore).toBeLessThan(0.3);
  });

  it("should emit alert telemetry via Dominion AIOps client adapter", async () => {
    const res = await DominionClient.emitAlert({
      tenantId: "acme",
      severity: "high",
      title: "Elevated 504 Gateway Timeouts",
      description: "Ingress proxy reporting latency spikes",
    });

    expect(res.success).toBe(true);
    expect(res.service).toBe("dominion");
    expect(res.data?.status).toBe("logged_and_correlated");
  });

  it("should dispatch cryptographic actions via ForgeGW/Symphony client adapter", async () => {
    const res = await ForgeSymphonyClient.dispatchAction({
      tenantId: "acme",
      operation: "orderv8.refund",
      payload: { orderId: "ORD-94021", amount: 420.0 },
    });

    expect(res.success).toBe(true);
    expect(res.service).toBe("forge_symphony");
    expect(res.data?.transactionRef).toBeDefined();
    expect(res.data?.auditHash).toContain("sha256");
  });
});

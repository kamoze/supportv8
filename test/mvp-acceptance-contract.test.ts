import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { issueService } from "@/lib/services/issue-service";
import { problemService } from "@/lib/services/problem-service";
import { db } from "@/lib/db/mock-data";
import { ChatbotTelemetry } from "@/lib/chatbot/observability/telemetry";
import { globalActionGateway } from "@/lib/runtime/action-gateway-client";
import { PostgresClient } from "@/lib/db/pg-client";
import { MockPostgresClient } from "./fixtures/mock-db-client";

export type MvpReceipt = {
  eventId: string;
  issueId: string;
  problemId?: string;
  actionExecutionId?: string;
};

export interface MvpVerticalSliceContract {
  deliverProviderEvent(envelope: {
    eventId: string;
    tenantId: string;
    source: "zendesk";
    sourceReference: string;
    customerReference: string;
    customerName?: string;
    customerTier?: "standard" | "pro" | "enterprise";
    text: string;
    occurredAt: string;
  }): Promise<MvpReceipt>;

  correlateIssues(
    tenantId: string,
    issueIds: string[],
    title: string,
    suspectedCause: string,
  ): Promise<{ problemId: string }>;

  getIssue(tenantId: string, issueId: string): Promise<{ id: string; tenantId?: string } | undefined>;
  getProblem(tenantId: string, problemId: string): Promise<{ id: string; tenantId?: string } | undefined>;
  getSources(tenantId: string): Promise<Array<{ id: string; name: string }>>;
  getTraces(tenantId: string): Promise<Array<{ traceId: string; tenantId?: string }>>;
  getActionReceipt(tenantId: string, actionExecutionId: string): Promise<MvpReceipt | undefined>;

  updateConnectedSource(params: {
    tenantId: string;
    issueId: string;
    action: "update" | "close";
    status?: "open" | "pending" | "solved" | "closed";
    internalNote?: string;
    resolutionSummary?: string;
  }): Promise<MvpReceipt>;
}

/**
 * Adapter test double that exercises current SupportV8 service implementations
 * to verify acceptance contracts. Demonstrates current mock-backed and unauthenticated behavior.
 */
export class CurrentSystemMvpDouble implements MvpVerticalSliceContract {
  async deliverProviderEvent(envelope: {
    eventId: string;
    tenantId: string;
    source: "zendesk";
    sourceReference: string;
    customerReference: string;
    customerName?: string;
    customerTier?: "standard" | "pro" | "enterprise";
    text: string;
    occurredAt: string;
  }): Promise<MvpReceipt> {
    const tenantSlug = envelope.tenantId.replace(/^tenant_/, "");
    const issue = await issueService.createFromInteraction({
      source: envelope.source,
      externalId: envelope.sourceReference,
      customerRef: envelope.customerReference,
      customerName: envelope.customerName || "Customer",
      customerTier: envelope.customerTier || "pro",
      text: envelope.text,
      tenant: tenantSlug,
    });
    return {
      eventId: envelope.eventId,
      issueId: issue.id,
    };
  }

  async correlateIssues(
    tenantId: string,
    issueIds: string[],
    title: string,
    suspectedCause: string,
  ): Promise<{ problemId: string }> {
    const problem = await problemService.correlateIssues(tenantId, issueIds, title, suspectedCause);
    return { problemId: problem.id };
  }

  async getIssue(tenantId: string, issueId: string) {
    const tenantSlug = tenantId.replace(/^tenant_/, "");
    const issue = await issueService.getById(issueId, tenantSlug);
    return issue ?? undefined;
  }

  async getProblem(tenantId: string, problemId: string) {
    const tenantSlug = tenantId.replace(/^tenant_/, "");
    const problem = await problemService.getById(problemId, tenantSlug);
    return problem ?? undefined;
  }

  async getSources(tenantId: string) {
    const tenantSlug = tenantId.replace(/^tenant_/, "");
    return db.getTenantData(tenantSlug).sources;
  }

  async getTraces(tenantId: string) {
    return ChatbotTelemetry.getTraces({ tenantId });
  }

  async getActionReceipt(tenantId: string, actionExecutionId: string) {
    const audits = globalActionGateway.getAuditHistory(tenantId);
    const match = audits.find((a) => a.auditId === actionExecutionId);
    if (!match) return undefined;
    return {
      eventId: "ephemeral",
      issueId: "ephemeral",
      actionExecutionId: match.auditId,
    };
  }

  async updateConnectedSource(params: {
    tenantId: string;
    issueId: string;
    action: "update" | "close";
    status?: "open" | "pending" | "solved" | "closed";
    internalNote?: string;
    resolutionSummary?: string;
  }): Promise<MvpReceipt> {
    // Current system lacks governed writeback recording to action_receipts
    return {
      eventId: "ephemeral",
      issueId: params.issueId,
      actionExecutionId: undefined,
    };
  }
}

describe("MVP vertical slice acceptance contract", () => {
  let mvp: MvpVerticalSliceContract;
  let mockClient: MockPostgresClient;

  beforeEach(() => {
    mockClient = new MockPostgresClient();
    PostgresClient.setTestClient(mockClient);
    mvp = new CurrentSystemMvpDouble();
  });

  afterEach(() => {
    PostgresClient.setTestClient(null);
  });

  describe("Contract 1: Duplicate provider delivery idempotency", () => {
    it("duplicate provider delivery returns the same event and issue identifiers", async () => {
      const envelope = {
        eventId: "evt_zd_duplicate_probe_01",
        tenantId: "tenant_acme",
        source: "zendesk" as const,
        sourceReference: "ZD-TICKET-77110",
        customerReference: "CUST-9901",
        text: "Payment processing failed with error code ERR_CARD_DECLINE",
        occurredAt: "2026-10-21T12:00:00Z",
      };

      const firstReceipt = await mvp.deliverProviderEvent(envelope);
      const secondReceipt = await mvp.deliverProviderEvent(envelope);

      expect(secondReceipt.eventId).toBe(firstReceipt.eventId);
      // Contract: duplicate delivery must return the same Issue identifier, not mint a new one
      expect(secondReceipt.issueId).toBe(firstReceipt.issueId);
    });
  });

  describe("Contract 2: Cross-tenant isolation across all intelligence entities", () => {
    it("guarantees a second tenant cannot read Tenant A's Issue, Problem, source, trace, or action receipt", async () => {
      const tenantA = "tenant_acme";
      const tenantB = "tenant_meridian";

      // 1. Deliver interaction for Tenant A
      const receiptA = await mvp.deliverProviderEvent({
        eventId: "evt_zd_tenant_a_secret",
        tenantId: tenantA,
        source: "zendesk",
        sourceReference: "ZD-TICKET-A-999",
        customerReference: "CUST-A-1",
        text: "Confidential Tenant A enterprise incident report",
        occurredAt: "2026-10-21T12:05:00Z",
      });

      // 2. Correlate into a Problem for Tenant A
      const { problemId } = await mvp.correlateIssues(
        tenantA,
        [receiptA.issueId],
        "Confidential Tenant A Infrastructure Outage",
        "Root cause in Tenant A private cluster",
      );

      // 3. Record trace span for Tenant A
      ChatbotTelemetry.recordTrace({
        traceId: "tr_tenant_a_secret_1",
        spanId: "span_tenant_a_1",
        tenantId: tenantA,
        sessionId: "sess_tenant_a_1",
        channel: "web_chat",
        model: "gpt-4o",
        promptTokens: 300,
        completionTokens: 150,
        totalTokens: 450,
        costUsd: 0.009,
        latencyMs: 120,
        guardrailTriggered: false,
        toolsInvoked: [],
        timestamp: new Date().toISOString(),
      });

      // 4. Request action in Action Gateway for Tenant A
      const actionResult = await globalActionGateway.requestAction({
        tenantId: tenantA,
        actor: { id: "human_a", type: "human", name: "Operator A" },
        operationId: "ticket.update_priority",
        input: { ticketId: receiptA.issueId, priority: "urgent" },
      });
      receiptA.actionExecutionId = actionResult.auditId;

      // Assertions for Tenant B:
      // A second tenant cannot read Tenant A's Issue
      const tenantBIssue = await mvp.getIssue(tenantB, receiptA.issueId);
      expect(tenantBIssue).toBeUndefined();

      // A second tenant cannot read Tenant A's Problem
      const tenantBProblem = await mvp.getProblem(tenantB, problemId);
      expect(tenantBProblem).toBeUndefined();

      // A second tenant cannot read Tenant A's sources
      const tenantBSources = await mvp.getSources("tenant_fresh_isolated");
      expect(tenantBSources.some((s) => s.id === "src_zd_01" || s.name?.includes("Zendesk"))).toBe(false);

      // A second tenant cannot read Tenant A's traces
      const tenantBTraces = await mvp.getTraces(tenantB);
      expect(tenantBTraces.some((t) => t.traceId === "tr_tenant_a_secret_1")).toBe(false);

      // A second tenant cannot read Tenant A's action receipt
      const tenantBReceipt = await mvp.getActionReceipt(tenantB, receiptA.actionExecutionId);
      expect(tenantBReceipt).toBeUndefined();
    });
  });

  describe("Contract 3: Governed write-back recording Action Gateway execution ID", () => {
    it("a connected-source update records an Action Gateway execution identifier", async () => {
      const receipt = await mvp.updateConnectedSource({
        tenantId: "tenant_acme",
        issueId: "ISS-1001",
        action: "update",
        status: "solved",
        internalNote: "Mitigated via Action Gateway writeback",
      });

      // Contract: write-back must return and record the Action Gateway execution identifier
      expect(receipt.actionExecutionId).toBeDefined();
      expect(receipt.actionExecutionId).toMatch(/^(ag_exec_|aud_)/);
    });
  });
});

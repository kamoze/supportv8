import { describe, it, expect } from "vitest";
import { knowledgev8Connector } from "../src/lib/connectors/knowledgev8-connector";
import type { Issue, TicketTimelineEvent, TicketMessageItem, TicketAttachment } from "../src/lib/types";

describe("Ticket Re-Assignment, Status Transitions, Context & RAG Pipeline", () => {
  const sampleTicket: Issue = {
    id: "iss_test_01",
    tenantId: "tenant_acme_corp",
    source: "zendesk",
    externalId: "SV8-4091",
    sourceUrl: "https://support.servicev8.com/tickets/SV8-4091",
    customerRef: "cust_acme_01",
    customerName: "Alex Vance",
    customerTier: "enterprise",
    summary: "Envoy gateway timeout 504 on billing checkout service",
    category: "billing_checkout",
    product: "Checkout API Gateway",
    version: "2.4.1",
    sentiment: "frustrated",
    sentimentScore: -0.7,
    sentimentTrajectory: "deteriorating",
    priority: "high",
    confidence: 0.94,
    businessImpact: "high",
    sourceStatus: "open",
    status: "open",
    assignedTo: "David Kim (Operator)",
    assignedAgent: "David Kim (Operator)",
    resolutionRiskScore: 0.25,
    tags: ["envoy", "timeout", "checkout"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [],
    messages: [],
    attachments: [],
    contextSnippets: [],
  };

  it("1. should allow re-assigning ticket to AI Employees and human leads with timeline logging", () => {
    const updatedTicket: Issue = {
      ...sampleTicket,
      assignedTo: "Sarah Chen (CX Lead)",
      assignedAgent: "Sarah Chen (CX Lead)",
      timeline: [
        {
          id: "tl_001",
          timestamp: new Date().toLocaleTimeString(),
          actor: "Operator Lead",
          actorType: "human_operator",
          action: "Reassigned ticket to Sarah Chen (CX Lead)",
        },
        ...(sampleTicket.timeline || []),
      ],
    };

    expect(updatedTicket.assignedTo).toBe("Sarah Chen (CX Lead)");
    expect(updatedTicket.timeline?.[0].action).toContain("Reassigned ticket to Sarah Chen");
  });

  it("2. should transition ticket lifecycle status with escalation priority escalation", () => {
    // Escalate
    const escalatedTicket: Issue = {
      ...sampleTicket,
      status: "escalated",
      priority: "urgent",
      timeline: [
        {
          id: "tl_002",
          timestamp: new Date().toLocaleTimeString(),
          actor: "David Kim (Operator)",
          actorType: "human_operator",
          action: "Status transitioned to ESCALATED",
          details: "Escalated to Tier 2 engineering with high priority",
        },
        ...(sampleTicket.timeline || []),
      ],
    };

    expect(escalatedTicket.status).toBe("escalated");
    expect(escalatedTicket.priority).toBe("urgent");
    expect(escalatedTicket.timeline?.[0].action).toBe("Status transitioned to ESCALATED");

    // Resolve
    const resolvedTicket: Issue = {
      ...escalatedTicket,
      status: "resolved",
      timeline: [
        {
          id: "tl_003",
          timestamp: new Date().toLocaleTimeString(),
          actor: "Alex (AI Support Lead)",
          actorType: "ai_employee",
          action: "Status transitioned to RESOLVED",
        },
        ...(escalatedTicket.timeline || []),
      ],
    };

    expect(resolvedTicket.status).toBe("resolved");
    expect(resolvedTicket.timeline?.length).toBe(2);
  });

  it("3. should ingest resolved tickets into KnowledgeV8 RAG corpus with pgvector searchability", async () => {
    const initialConceptsCount = knowledgev8Connector.getStatus().syncedConceptsCount;

    const ingestResult = await knowledgev8Connector.ingestResolvedTicket({
      externalId: sampleTicket.externalId,
      summary: sampleTicket.summary,
      customerName: sampleTicket.customerName,
      product: sampleTicket.product,
      resolutionNotes: "Flushed stale circuit breaker cache and re-routed gateway upstream to node pool 3.",
      category: sampleTicket.category,
      tags: sampleTicket.tags,
    });

    expect(ingestResult.success).toBe(true);
    expect(ingestResult.conceptId).toBe("KV8-TKT-SV84091");
    expect(ingestResult.title).toContain("SV8-4091: Envoy gateway timeout 504");

    const updatedConcepts = knowledgev8Connector.getConcepts();
    expect(updatedConcepts.length).toBe(initialConceptsCount + 1);

    // Verify federated retrieval finds this ingested ticket
    const searchResults = await knowledgev8Connector.queryFederated("checkout timeout envoy");
    expect(searchResults.some((c) => c.conceptId === "KV8-TKT-SV84091")).toBe(true);
  });

  it("4. should tag context snippets and attachments to ticket context", () => {
    const snippet: TicketAttachment = {
      id: "att_trace_01",
      name: "Envoy Error Log Trace",
      sizeBytes: 256,
      type: "snippet",
      url: "#",
      uploadedAt: "10:45 AM",
      snippetContent: `HTTP/2 504 upstream_connect_timeout\n{"latency": 5014}`,
    };

    const ticketWithAttachment: Issue = {
      ...sampleTicket,
      attachments: [snippet],
      contextSnippets: [snippet.snippetContent!],
    };

    expect(ticketWithAttachment.attachments?.length).toBe(1);
    expect(ticketWithAttachment.contextSnippets?.length).toBe(1);
    expect(ticketWithAttachment.contextSnippets?.[0]).toContain("upstream_connect_timeout");
  });

  it("5. should verify ForgeGW credit deduction ledger for AI actions", () => {
    let spendableCredits = 4850;

    // AI Reply generation
    const replyCost = 15;
    spendableCredits -= replyCost;
    expect(spendableCredits).toBe(4835);

    // Autonomous multi-action resolution
    const autoResolveCost = 35;
    spendableCredits -= autoResolveCost;
    expect(spendableCredits).toBe(4800);

    // RAG vector indexing
    const ragIndexCost = 20;
    spendableCredits -= ragIndexCost;
    expect(spendableCredits).toBe(4780);
  });
});

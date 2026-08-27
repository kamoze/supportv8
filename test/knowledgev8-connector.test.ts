import { describe, it, expect } from "vitest";
import { knowledgev8Connector } from "@/lib/connectors/knowledgev8-connector";
import { kv8RetrievalEngine } from "@/lib/rag/retrieval";

describe("KnowledgeV8 as an Advanced RAG Source", () => {
  it("queries remote KnowledgeV8 enterprise concepts with federated ranking", async () => {
    const results = await knowledgev8Connector.queryFederated("circuit breaker database pool failover");

    expect(results.length).toBeGreaterThanOrEqual(1);
    const dbRunbook = results.find((c) => c.conceptId === "KV8-CPT-401");
    expect(dbRunbook).toBeDefined();
    expect(dbRunbook?.title).toContain("Zero-Downtime Database Migration");
    expect(dbRunbook?.trustTier).toBe("human-reviewed");
  });

  it("filters remote concepts by trust-tier floor (human-reviewed vs machine-confirmed)", async () => {
    const humanOnly = await knowledgev8Connector.queryFederated("refund authorization policy", {
      minTrust: "human-reviewed",
    });

    // KV8-CPT-403 is machine-confirmed, so it should not appear when minTrust is human-reviewed
    const machineOnlyDoc = humanOnly.find((c) => c.conceptId === "KV8-CPT-403");
    expect(machineOnlyDoc).toBeUndefined();

    const machineAllowed = await knowledgev8Connector.queryFederated("refund authorization policy", {
      minTrust: "machine-confirmed",
    });
    const found = machineAllowed.find((c) => c.conceptId === "KV8-CPT-403");
    expect(found).toBeDefined();
  });

  it("synchronizes concepts from KnowledgeV8 workspace into local KB articles", async () => {
    const syncResult = await knowledgev8Connector.syncWorkspaceConcepts("ws_enterprise_core");
    expect(syncResult.syncedCount).toBeGreaterThanOrEqual(1);
    expect(syncResult.timestamp).toBeDefined();
  });

  it("escalates support knowledge gaps back to KnowledgeV8 as proposals", async () => {
    const gap: import("@/lib/types").KnowledgeGap = {
      id: "GAP-201",
      topic: "Hardware Security Keys (FIDO2 / YubiKey)",
      recurringIssueCount: 86,
      confidence: 0.92,
      sampleQueries: ["How to bind YubiKey 5 Series?"],
      suggestedAction: "Author step-by-step setup guide for enterprise customers",
      status: "detected",
      firstDetected: new Date().toISOString(),
    };

    const escalation = await knowledgev8Connector.submitKnowledgeGapProposal(gap);
    expect(escalation.proposalId).toBeDefined();
    expect(escalation.status).toBe("submitted");
    expect(escalation.targetWorkspace).toBe("ws_enterprise_core");
  });

  it("seamlessly blends local support articles and remote KnowledgeV8 concepts in unified retrieval", async () => {
    const unifiedResults = await kv8RetrievalEngine.query("circuit breaker failover 504", { topK: 5 });
    expect(unifiedResults.length).toBeGreaterThanOrEqual(1);

    const kv8Match = unifiedResults.find((r) => r.title.includes("KnowledgeV8"));
    expect(kv8Match).toBeDefined();
    expect(kv8Match?.status).toBe("authoritative");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { knowledgev8Connector } from "@/lib/connectors/knowledgev8-connector";
import { KnowledgeV8Client } from "@/lib/services/interservice-client";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { ragService } from "@/lib/services/rag-service";
import { db } from "@/lib/db/mock-data";

const TEST_API_KEY = `kv8_${"b".repeat(64)}`;

describe("Central Tenant KnowledgeV8 RAG & Auto-Curation Integration", () => {
  beforeEach(() => {
    process.env.KNOWLEDGEV8_QUERY_API_KEY = `acme=${TEST_API_KEY},runtime-acceptance=${TEST_API_KEY}`;
    process.env.KNOWLEDGEV8_API_KEY = `acme=${TEST_API_KEY},runtime-acceptance=${TEST_API_KEY}`;
  });

  afterEach(() => {
    delete process.env.KNOWLEDGEV8_QUERY_API_KEY;
    delete process.env.KNOWLEDGEV8_API_KEY;
    vi.unstubAllGlobals();
  });

  it("resolves tenant-bound API keys and generates strict workspace headers", () => {
    const acmeKey = knowledgev8Connector.getTenantApiKey("acme");
    expect(acmeKey).toBe(TEST_API_KEY);

    const headers = knowledgev8Connector.getTenantHeaders("acme");
    expect(headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`);
    expect(headers["x-knowledgev8-expected-workspace"]).toBe("acme");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("queries Central KnowledgeV8 via embedded API access with tenant isolation", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe(`Bearer ${TEST_API_KEY}`);
      expect(headers.get("x-knowledgev8-expected-workspace")).toBe("acme");

      return new Response(
        JSON.stringify({
          workspace: "acme",
          results: [
            {
              conceptId: "KV8-CPT-900",
              title: "Active-Active Multi-Region Database Sharding Runbook",
              description: "Distributed shard rebalancing and raft consensus recovery procedure.",
              body: "# Multi-Region Database Sharding\n\nAutomated shard routing and consensus quorum verification.",
              status: "authoritative",
              trustTier: "human-reviewed",
              score: 0.96,
            },
          ],
        }),
        { status: 200 }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const results = await knowledgev8Connector.queryFederated("multi-region database sharding", {
      tenantSlug: "acme",
      topK: 3,
      fetchImpl: fetchMock as any,
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].conceptId).toBe("KV8-CPT-900");
    expect(results[0].title).toContain("Database Sharding Runbook");
    expect(results[0].trustTier).toBe("human-reviewed");
    expect(results[0].status).toBe("authoritative");
  });

  it("auto-curates uploaded technical documents into active reviewed articles", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await ragIngestion.ingestDocument({
      tenantId: "acme",
      filename: "Envoy_Circuit_Breaker_Tuning.md",
      content: "# Envoy Circuit Breakers\n\nConfigure max_connections and max_pending_requests to prevent upstream exhaustion.",
      category: "infrastructure",
      title: "Envoy Circuit Breaker Tuning",
      tags: ["envoy", "networking"],
    });

    // Ingestion succeeds with S3 storage and pgvector chunks
    expect(result.document).toBeDefined();
    expect(result.document.curatedStatus).toBe("curated");
    expect(result.document.curatedConceptId).toBeDefined();
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);

    // Auto-curation created an active KnowledgeArticle in the vault
    const autoArticle = db.articles.find((a) => a.title === "Envoy Circuit Breaker Tuning");
    expect(autoArticle).toBeDefined();
    expect(autoArticle?.status).toBe("active");
    expect(autoArticle?.articleType).toBe("runbook");
    expect(autoArticle?.tags).toContain("auto-curated");
    expect(autoArticle?.tags).toContain("authoritative");
  });

  it("auto-curates resolved tickets into authoritative KnowledgeV8 concepts and articles", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await ragIngestion.ingestTicketToRag({
      tenantId: "acme",
      ticket: {
        externalId: "SV8-TICKET-AUTO-9988",
        summary: "Stripe 3DS verification timeout on Safari iOS",
        customerName: "Acme Mobile Shopper",
        product: "checkout-v8",
        resolutionNotes: "Updated WebKit CSP directive for iframe parent redirection.",
        category: "billing",
        tags: ["stripe", "ios", "checkout"],
      },
    });

    expect(result.document).toBeDefined();
    expect(result.document.curatedStatus).toBe("curated");
    expect(result.document.curatedConceptId).toContain("SV8TICKETAUTO9988");

    // Auto-curation created authoritative KnowledgeArticle
    const ticketArticle = db.articles.find((a) => a.id.includes("SV8TICKETAUTO9988") || a.id.includes("sv8_ticket_auto_9988"));
    expect(ticketArticle).toBeDefined();
    expect(ticketArticle?.status).toBe("active");
    expect(ticketArticle?.tags).toContain("auto-curated");
    expect(ticketArticle?.tags).toContain("authoritative");
    expect(ticketArticle?.body).toContain("Verified Resolution");
  });

  it("queries KnowledgeV8 through interservice client adapter with tenant headers", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("x-knowledgev8-expected-workspace")).toBe("acme");
      expect(headers.get("x-tenant-id")).toBe("acme");

      return new Response(
        JSON.stringify({
          citations: [
            {
              id: "cit_auto_001",
              title: "Authoritative Redis Eviction Protocol",
              snippet: "Configure maxmemory-policy volatile-lru for session stores.",
              similarity: 0.978,
            },
          ],
        }),
        { status: 200 }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const res = await KnowledgeV8Client.searchEmbeddings({
      tenantId: "acme",
      query: "redis eviction configuration",
      stream: "engineering" as any,
    });

    expect(res.success).toBe(true);
    expect(res.service).toBe("knowledgev8");
    expect(res.data?.citations.length).toBeGreaterThanOrEqual(1);
    expect(res.data?.citations[0].similarity).toBeGreaterThan(0.9);
  });

  it("executes queryRag with central KnowledgeV8 and produces grounded citations", async () => {
    // Ingest ticket into RAG
    await ragIngestion.ingestTicketToRag({
      tenantId: "acme",
      ticket: {
        externalId: "SV8-KV8-GROUNDED-100",
        summary: "Federated SAML clock drift tolerance setting",
        customerName: "Cloud Identity Corp",
        product: "auth-gateway",
        resolutionNotes: "Set clockSkewAdjustment: 300 in identity provider profile.",
        category: "auth",
      },
    });

    const response = await ragIngestion.queryRag({
      tenantId: "acme",
      query: "Federated SAML clock drift tolerance",
      limit: 3,
    });

    expect(response.query).toBe("Federated SAML clock drift tolerance");
    expect(response.matchCount).toBeGreaterThanOrEqual(1);
    expect(response.citations.length).toBeGreaterThanOrEqual(1);
    expect(response.citations[0].type).toBe("document_chunk");
    expect(response.answer).toContain("Based on semantic retrieval from the SupportV8 Knowledge Base");
  });
});

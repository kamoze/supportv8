import { describe, it, expect, vi } from "vitest";
import { RagIngestionService } from "@/lib/services/rag-ingestion-service";
import { POST as queryPost } from "@/app/api/knowledge/query/route";
import { POST as chatPost } from "@/app/api/chat/route";
import { NextRequest } from "next/server";

describe("SupportV8 RAG Semantic Retrieval & Query Engine", () => {
  it("performs 1536-dim vector cosine similarity search on ingested ticket chunks", async () => {
    const service = new RagIngestionService();
    // 1. Ingest runtime ticket into RAG
    await service.ingestTicketToRag({
      tenantId: "runtime-acceptance",
      ticket: {
        externalId: "SV8-RUNTIME-8604E07096ED",
        summary: "Want to check on your inventory",
        customerName: "Runtime Acceptance Customer",
        product: "servicev8-runtime",
        resolutionNotes: "Synchronized inventory levels via Warehouse Inventory Protocol.",
        category: "inventory",
        tags: ["runtime", "inventory"],
      },
    });

    // 2. Query for inventory
    const result = await service.queryRag({
      tenantId: "runtime-acceptance",
      query: "Want to check on your inventory",
      limit: 5,
    });

    expect(result.query).toBe("Want to check on your inventory");
    expect(result.matchCount).toBeGreaterThanOrEqual(1);
    expect(result.results[0].documentTitle).toContain("Want to check on your inventory");
    expect(result.results[0].similarity).toBeGreaterThan(0.50);
    expect(result.citations.length).toBeGreaterThanOrEqual(1);
    expect(result.citations[0].type).toBe("document_chunk");
    expect(result.answer).toContain("Based on semantic retrieval from the SupportV8 Knowledge Base");
    expect(result.answer).toContain("Want to check on your inventory");
  });

  it("handles POST /api/knowledge/query with query string", async () => {
    const req = new NextRequest("https://runtime-acceptance.support.servicev8.com/api/knowledge/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-slug": "runtime-acceptance",
      },
      body: JSON.stringify({
        query: "Want to check on your inventory",
        limit: 3,
        minSimilarity: 0.5,
      }),
    });

    const res = await queryPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.query).toBe("Want to check on your inventory");
    expect(json.data.matchCount).toBeGreaterThanOrEqual(1);
    expect(json.data.results[0].content).toContain("Ticket Resolution");
  });

  it("handles POST /api/chat with employeeId 'emp_rag_intelligence' for runtime tenant", async () => {
    const req = new NextRequest("https://runtime-acceptance.support.servicev8.com/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-slug": "runtime-acceptance",
      },
      body: JSON.stringify({
        query: "Want to check on your inventory",
        employeeId: "emp_rag_intelligence",
      }),
    });

    const res = await chatPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.employeeId).toBe("emp_rag_intelligence");
    expect(json.data.employeeName).toBe("SupportV8 RAG Intelligence");
    expect(json.data.runtime).toBe("pgvector_rag");
    expect(json.data.answer).toContain("Based on semantic retrieval from the SupportV8 Knowledge Base");
    expect(json.data.citations.length).toBeGreaterThanOrEqual(1);
  });
});

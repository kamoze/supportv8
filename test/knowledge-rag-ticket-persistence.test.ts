import { describe, it, expect, vi } from "vitest";
import { RagIngestionService } from "@/lib/services/rag-ingestion-service";
import { POST as knowledgePost, GET as knowledgeGet } from "@/app/api/knowledge/route";
import { GET as chunksGet } from "@/app/api/knowledge/chunks/route";
import { NextRequest } from "next/server";
import type { PostgresClient } from "@/lib/db/pg-client";

describe("SupportV8 RAG Ticket Ingestion & Persistence", () => {
  it("ingests a support ticket into RAG corpus with 1536-dim vector embeddings", async () => {
    const service = new RagIngestionService();
    const result = await service.ingestTicketToRag({
      tenantId: "tenant_runtime_acceptance",
      ticket: {
        externalId: "SV8-RUNTIME-8604E07096ED",
        summary: "Want to check on your inventory",
        customerName: "Runtime Storefront",
        product: "servicev8-runtime",
        resolutionNotes: "Synchronized inventory levels via Warehouse Inventory Protocol.",
        category: "inventory",
        tags: ["runtime", "inventory"],
      },
    });

    expect(result.document).toBeDefined();
    expect(result.document.id).toBe("doc_tkt_sv8_runtime_8604e07096ed");
    expect(result.document.title).toContain("SV8-RUNTIME-8604E07096ED");
    expect(result.document.title).toContain("Want to check on your inventory");
    expect(result.document.body).toContain("# Ticket Resolution: SV8-RUNTIME-8604E07096ED");
    expect(result.document.body).toContain("Synchronized inventory levels");
    expect(result.document.tags).toContain("rag-grounded");
    expect(result.document.tags).toContain("inventory");

    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    expect(result.chunks[0].embedding).toBeDefined();
    expect(result.chunks[0].embedding.length).toBe(1536);
    expect(result.chunks[0].content).toContain("Ticket Resolution");
  });

  it("handles POST /api/knowledge with action 'ingest_ticket'", async () => {
    const req = new NextRequest("https://runtime-acceptance.support.servicev8.com/api/knowledge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-slug": "runtime-acceptance",
      },
      body: JSON.stringify({
        action: "ingest_ticket",
        ticket: {
          externalId: "SV8-RUNTIME-9999ABCD",
          summary: "Order status reconciliation",
          customerName: "Jane Doe",
          product: "orderv8",
          category: "billing",
          tags: ["orders"],
        },
      }),
    });

    const res = await knowledgePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.document.id).toBe("doc_tkt_sv8_runtime_9999abcd");
    expect(json.data.chunks.length).toBeGreaterThanOrEqual(1);
    expect(json.data.chunks[0].embedding.length).toBe(1536);
  });

  it("returns ingested documents in GET /api/knowledge and chunks in GET /api/knowledge/chunks", async () => {
    // 1. Fetch knowledge data
    const getReq = new NextRequest("https://runtime-acceptance.support.servicev8.com/api/knowledge?tenant=runtime-acceptance", {
      headers: {
        "x-tenant-slug": "runtime-acceptance",
      },
    });
    const getRes = await knowledgeGet(getReq);
    const getJson = await getRes.json();

    expect(getRes.status).toBe(200);
    expect(getJson.success).toBe(true);
    expect(Array.isArray(getJson.data.documents)).toBe(true);
    const doc = getJson.data.documents.find((d: any) => d.id === "doc_tkt_sv8_runtime_9999abcd");
    expect(doc).toBeDefined();
    expect(doc.title).toContain("Order status reconciliation");

    // 2. Fetch chunks
    const chunkReq = new NextRequest("https://runtime-acceptance.support.servicev8.com/api/knowledge/chunks?documentId=doc_tkt_sv8_runtime_9999abcd", {
      headers: {
        "x-tenant-slug": "runtime-acceptance",
      },
    });
    const chunkRes = await chunksGet(chunkReq);
    const chunkJson = await chunkRes.json();

    expect(chunkRes.status).toBe(200);
    expect(chunkJson.success).toBe(true);
    expect(chunkJson.data.length).toBeGreaterThanOrEqual(1);
    expect(chunkJson.data[0].documentId).toBe("doc_tkt_sv8_runtime_9999abcd");
    expect(chunkJson.data[0].embedding.length).toBe(1536);
  });

  it("executes PostgreSQL queries in withTenantSession and auto-projects RAG issues", async () => {
    const executedQueries: string[] = [];
    const mockPostgresClient: PostgresClient = {
      withTenantSession: vi.fn(async (tenantId: string, callback: any) => {
        const mockSession = {
          tenantId,
          query: vi.fn(async (sql: string, params?: any[]) => {
            executedQueries.push(sql);
            if (sql.includes("FROM supportv8.knowledge_documents")) {
              return [];
            }
            if (sql.includes("FROM supportv8.issues")) {
              return [
                {
                  id: "iss_runtime_8604e07096ed4e99a05fd1d5d6f39fb9",
                  external_id: "SV8-RUNTIME-8604E07096ED",
                  summary: "Want to check on your inventory",
                  customer_name: "Runtime Storefront",
                  product: "servicev8-runtime",
                  category: "inventory",
                  recommended_action: "Verified warehouse stock levels.",
                  tags: ["runtime", "inventory"],
                  timeline: [{ action: "1-Click RAG Vector Corpus Ingestion" }],
                },
              ];
            }
            return [];
          }),
        };
        return callback(mockSession);
      }),
    } as unknown as PostgresClient;

    const originalEnv = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://mock:mock@localhost:5432/mock";

    try {
      const service = new RagIngestionService(mockPostgresClient);

      // Ingest ticket
      await service.ingestTicketToRag({
        tenantId: "tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559",
        ticket: {
          externalId: "SV8-RUNTIME-8604E07096ED",
          summary: "Want to check on your inventory",
          customerName: "Runtime Storefront",
          product: "servicev8-runtime",
        },
      });

      expect(mockPostgresClient.withTenantSession).toHaveBeenCalled();
      expect(executedQueries.some((q) => q.includes("INSERT INTO supportv8.knowledge_documents"))).toBe(true);
      expect(executedQueries.some((q) => q.includes("INSERT INTO supportv8.knowledge_document_chunks"))).toBe(true);

      // Verify auto-projection of issues in getDurableDocuments
      const docs = await service.getDurableDocuments("tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559");
      expect(docs.length).toBeGreaterThanOrEqual(1);
      expect(docs[0].id).toBe("doc_tkt_sv8_runtime_8604e07096ed");
      expect(docs[0].title).toContain("SV8-RUNTIME-8604E07096ED");
    } finally {
      process.env.DATABASE_URL = originalEnv;
    }
  });
});

import { describe, it, expect } from "vitest";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { ragService } from "@/lib/services/rag-service";

describe("supportV8 RAG S3 File Ingestion & Retrieval", () => {
  it("chunks long technical documentation semantically", () => {
    const markdownContent = `
# Troubleshooting Stripe Webhook 504 Timeouts

When checkout experiences high concurrency, webhook delivery may encounter 504 Gateway Timeouts.

## Root Cause Analysis
The payment processor webhook handler acquires a synchronous database row lock. Under load, connection pool exhaustion triggers timeout errors.

## Mitigation Procedure
1. Increase pgBouncer pool size to 50 connections.
2. Switch webhook worker to asynchronous queue ingestion with Redis.
3. Enable idempotency verification on transaction IDs.
    `;

    const chunks = ragIngestion.chunkText(markdownContent, 200, 30);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0]).toContain("Troubleshooting Stripe Webhook");
  });

  it("ingests document with S3 upload and creates pgvector embeddings", async () => {
    const docResult = await ragIngestion.ingestDocument({
      tenantId: "tenant_test_kb",
      filename: "Database_Connection_Scaling_Guide.md",
      content: "# Database Scaling\n\nEnsure idle connection timeout is set to 30 seconds to prevent connection leakage.",
      category: "infrastructure",
      title: "Database Connection Scaling Guide",
    });

    expect(docResult.document.id).toBeDefined();
    expect(docResult.document.s3Key).toContain("Database_Connection_Scaling_Guide.md");
    expect(docResult.document.s3Url).toBeDefined();
    expect(docResult.chunks.length).toBeGreaterThanOrEqual(1);
    expect(docResult.chunks[0].embedding.length).toBe(1536);
  });

  it("retrieves uploaded S3 document through RAG semantic search", async () => {
    await ragIngestion.ingestDocument({
      tenantId: "tenant_default",
      filename: "Hardware_FIDO2_YubiKey_Setup.md",
      content: "Step-by-step guide for registering YubiKey 5 NFC hardware security keys for enterprise admin access.",
      category: "auth_mfa",
      title: "Hardware Security Key Registration Runbook",
    });

    const searchResults = await ragService.searchSemantic("How do I register a YubiKey security key?");
    expect(searchResults.length).toBeGreaterThanOrEqual(1);

    const matched = searchResults.find(
      (r) => r.title.includes("Hardware Security Key") || r.content.includes("YubiKey")
    );
    expect(matched).toBeDefined();
    expect(matched?.similarity).toBeGreaterThan(0.7);
    expect(matched?.metadata?.source).toBe("s3_upload");
  });
});

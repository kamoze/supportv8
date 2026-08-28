import { describe, it, expect } from "vitest";
import { ragIngestion, MAX_UPLOAD_BYTES, MAX_BATCH_BYTES } from "../src/lib/services/rag-ingestion-service";

describe("Knowledge Suite - 25MB File Upload Limit & S3 Large Files Ingestion", () => {
  it("should have MAX_UPLOAD_BYTES defined as exactly 25MB (knowledgev8 specification)", () => {
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(MAX_BATCH_BYTES).toBe(60 * 1024 * 1024);
  });

  it("should ingest files under 25MB into S3 and vector index", async () => {
    const content = "# SAML 2.0 Identity Federation Guide\n\nConfigure Okta SSO with SupportV8.";
    const result = await ragIngestion.ingestDocument({
      tenantId: "tenant_default",
      filename: "saml_guide.md",
      content,
      category: "auth_sso",
      title: "SAML 2.0 Guide",
      groups: ["support-tier1"],
      tags: ["saml", "okta"],
    });

    expect(result.document.id).toBeDefined();
    expect(result.document.fileSizeBytes).toBe(Buffer.from(content).length);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.s3Url).toContain("supportv8-kb-documents");
    expect(result.document.s3Key).toBeDefined();
  });

  it("should connect an S3 bucket source for large dataset ingestion", () => {
    const newSource = ragIngestion.connectS3Source({
      tenantId: "tenant_default",
      bucketName: "acme-large-dataset-vault",
      prefix: "manuals/2026/",
      region: "us-east-1",
      endpoint: "http://minio.default.svc.cluster.local:9000",
      targetCategory: "infrastructure",
      groups: ["support-tier1", "infra-ops"],
    });

    expect(newSource.id).toBeDefined();
    expect(newSource.bucketName).toBe("acme-large-dataset-vault");
    expect(newSource.prefix).toBe("manuals/2026/");
    expect(newSource.status).toBe("connected");
  });

  it("should sync S3 bucket source objects directly into pgvector chunks without pod OOM", async () => {
    const sources = ragIngestion.getS3Sources("tenant_default");
    expect(sources.length).toBeGreaterThan(0);
    const target = sources[0];

    const syncResult = await ragIngestion.syncS3Source(target.id);
    expect(syncResult.success).toBe(true);
    expect(syncResult.syncedCount).toBeGreaterThan(0);
    expect(syncResult.message).toContain("Successfully synced");
  });
});

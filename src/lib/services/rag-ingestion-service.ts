/**
 * supportV8 RAG Document Ingestion Service
 * Ingests files (Markdown, PDF text, JSON, TXT) via S3 upload, parses semantic chunks,
 * generates 1536-dimensional pgvector embeddings, and indexes them for RAG search.
 */

import { s3Storage } from "../storage/s3-client";
import { ragService } from "./rag-service";
import { chunkBody } from "../rag/chunker";
import { db } from "../db/mock-data";
import type { KnowledgeDocument, KnowledgeDocumentChunk, KnowledgeArticle, KnowledgeS3Source } from "../types";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB per file — aligned with knowledgev8 pod memory guard
export const MAX_BATCH_BYTES = 60 * 1024 * 1024;  // 60MB per batch upload request

export interface IngestionResult {
  document: KnowledgeDocument;
  chunks: KnowledgeDocumentChunk[];
  s3Url: string;
}

export class RagIngestionService {
  /**
   * Split document text into semantic chunks using KnowledgeV8 heading-based chunker.
   */
  public chunkText(text: string, _chunkSize = 200, _overlap = 30): string[] {
    const rawChunks = chunkBody(text);
    if (!rawChunks || rawChunks.length === 0) {
      return text.trim() ? [text.trim()] : [];
    }
    return rawChunks.map((c) => (c.section ? `[Section: ${c.section}]\n${c.content}` : c.content));
  }

  private ensureInitialChunks() {
    if (!db.documentChunks || db.documentChunks.length === 0) {
      db.documentChunks = [
        {
          id: "chk_doc_s3_001_0",
          documentId: "doc_s3_001",
          tenantId: "tenant_default",
          chunkIndex: 0,
          section: "Okta SAML Overview & Metadata Exchange",
          content: "To configure Okta SAML 2.0 with supportV8, ensure your Identity Provider Single Sign-On URL is set to https://auth.supportv8.com/saml/sso and the SP Entity ID is urn:supportv8:saml:sp. Upload the x509 public signing certificate exported from Okta Admin.",
          weight: 1.0,
          tokenCount: 48,
          updatedAt: new Date().toISOString(),
          embedding: ragService.generateEmbedding("To configure Okta SAML 2.0 with supportV8, ensure your Identity Provider Single Sign-On URL is set to https://auth.supportv8.com/saml/sso"),
        },
        {
          id: "chk_doc_s3_001_1",
          documentId: "doc_s3_001",
          tenantId: "tenant_default",
          chunkIndex: 1,
          section: "Clock Skew & Token Expiry Troubleshooting",
          content: "Clock skew errors (code SAML_CLOCK_SKEW_EXCEEDED) occur when client server time drifts more than 300 seconds from Okta NTP time. Verify system chrony or systemd-timesyncd is synchronized on your host.",
          weight: 1.2,
          tokenCount: 42,
          updatedAt: new Date().toISOString(),
          embedding: ragService.generateEmbedding("Clock skew errors occur when client server time drifts more than 300 seconds from Okta NTP time."),
        },
        {
          id: "chk_doc_s3_002_0",
          documentId: "doc_s3_002",
          tenantId: "tenant_default",
          chunkIndex: 0,
          section: "504 Gateway Timeout Diagnostics",
          content: "A 504 Gateway Timeout on /v1/checkout/charge indicates upstream Stripe webhook processing queue starvation. Check Redis connection saturation and verify pgBouncer pool count exceeds 50 concurrent connections.",
          weight: 1.5,
          tokenCount: 45,
          updatedAt: new Date().toISOString(),
          embedding: ragService.generateEmbedding("A 504 Gateway Timeout on /v1/checkout/charge indicates upstream Stripe webhook processing queue starvation."),
        },
        {
          id: "chk_doc_s3_002_1",
          documentId: "doc_s3_002",
          tenantId: "tenant_default",
          chunkIndex: 1,
          section: "Circuit Breaker Mitigation & Auto-Refund",
          content: "When circuit breaker trips for payment gateways, switch traffic to secondary Adyen gateway or invoke OrderV8 refund voucher idempotency dispatch with auth key SEC-04.",
          weight: 1.0,
          tokenCount: 38,
          updatedAt: new Date().toISOString(),
          embedding: ragService.generateEmbedding("When circuit breaker trips for payment gateways, switch traffic to secondary Adyen gateway or invoke OrderV8 refund."),
        },
      ];
    }
  }

  /**
   * Ingest an uploaded document into S3 and vector index.
   */
  public async ingestDocument(params: {
    tenantId: string;
    filename: string;
    content: string | Buffer;
    category?: string;
    title?: string;
    groups?: string[];
    tags?: string[];
  }): Promise<IngestionResult> {
    const { tenantId, filename, category = "general", title, groups = ["support-tier1"], tags = [] } = params;
    const buffer = Buffer.isBuffer(params.content) ? params.content : Buffer.from(params.content, "utf-8");
    const textContent = buffer.toString("utf-8");

    // 1. Upload to S3 / MinIO
    const s3Result = await s3Storage.uploadDocument({
      tenantId,
      filename,
      buffer,
      contentType: filename.endsWith(".md")
        ? "text/markdown"
        : filename.endsWith(".json")
        ? "application/json"
        : "text/plain",
    });

    // 2. Generate chunks
    const textChunks = this.chunkText(textContent);
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const docTitle = title || filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");

    const document: KnowledgeDocument = {
      id: docId,
      tenantId,
      filename,
      fileType: filename.split(".").pop() || "txt",
      fileSizeBytes: buffer.length,
      s3Key: s3Result.s3Key,
      s3Url: s3Result.s3Url,
      category,
      title: docTitle,
      chunkCount: Math.max(1, textChunks.length),
      status: "indexed",
      uploadedAt: new Date().toISOString(),
      summary: textChunks[0]?.slice(0, 200) + "..." || docTitle,
      body: textContent,
      groups,
      tags: tags.length ? tags : [category, "ingested"],
      curatedStatus: "raw",
    };

    // 3. Generate pgvector embeddings for each chunk
    const chunks: KnowledgeDocumentChunk[] = (textChunks.length ? textChunks : [textContent]).map(
      (chunkContent, idx) => {
        let section = `Section ${idx + 1}`;
        if (chunkContent.startsWith("[Section:")) {
          const match = chunkContent.match(/^\[Section:\s*([^\]]+)\]/);
          if (match) section = match[1].trim();
        }

        return {
          id: `chk_${docId}_${idx}`,
          documentId: docId,
          tenantId,
          chunkIndex: idx,
          section,
          content: chunkContent,
          weight: 1.0,
          tokenCount: Math.ceil(chunkContent.length / 4),
          updatedAt: new Date().toISOString(),
          embedding: ragService.generateEmbedding(chunkContent),
        };
      }
    );

    // 4. Store in memory database / pgvector store
    if (!db.documents) db.documents = [];
    if (!db.documentChunks) db.documentChunks = [];
    db.documents.unshift(document);
    db.documentChunks.push(...chunks);

    return {
      document,
      chunks,
      s3Url: s3Result.s3Url,
    };
  }

  public getDocuments(tenantId: string): KnowledgeDocument[] {
    this.ensureInitialChunks();
    if (!db.documents) return [];
    return db.documents.filter((d) => d.tenantId === tenantId);
  }

  public getDocumentChunks(documentId: string): KnowledgeDocumentChunk[] {
    this.ensureInitialChunks();
    return (db.documentChunks || []).filter((c) => c.documentId === documentId);
  }

  public updateChunk(
    chunkId: string,
    updates: { content?: string; section?: string; weight?: number }
  ): KnowledgeDocumentChunk {
    this.ensureInitialChunks();
    const chunk = (db.documentChunks || []).find((c) => c.id === chunkId);
    if (!chunk) throw new Error(`Chunk ${chunkId} not found`);

    if (updates.content !== undefined) {
      chunk.content = updates.content;
      chunk.tokenCount = Math.ceil(updates.content.length / 4);
      chunk.embedding = ragService.generateEmbedding(updates.content);
    }
    if (updates.section !== undefined) chunk.section = updates.section;
    if (updates.weight !== undefined) chunk.weight = updates.weight;
    chunk.updatedAt = new Date().toISOString();

    return { ...chunk };
  }

  public addChunk(documentId: string, content: string, section?: string): KnowledgeDocumentChunk {
    this.ensureInitialChunks();
    const doc = (db.documents || []).find((d) => d.id === documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const existing = (db.documentChunks || []).filter((c) => c.documentId === documentId);
    const newIdx = existing.length;

    const newChunk: KnowledgeDocumentChunk = {
      id: `chk_${documentId}_${Date.now()}_${newIdx}`,
      documentId,
      tenantId: doc.tenantId,
      chunkIndex: newIdx,
      section: section || `Section ${newIdx + 1}`,
      content,
      weight: 1.0,
      tokenCount: Math.ceil(content.length / 4),
      updatedAt: new Date().toISOString(),
      embedding: ragService.generateEmbedding(content),
    };

    if (!db.documentChunks) db.documentChunks = [];
    db.documentChunks.push(newChunk);
    doc.chunkCount = (db.documentChunks.filter((c) => c.documentId === documentId)).length;

    return newChunk;
  }

  public deleteChunk(chunkId: string): boolean {
    this.ensureInitialChunks();
    const idx = (db.documentChunks || []).findIndex((c) => c.id === chunkId);
    if (idx === -1) return false;
    const [removed] = db.documentChunks.splice(idx, 1);
    const doc = (db.documents || []).find((d) => d.id === removed.documentId);
    if (doc) {
      doc.chunkCount = db.documentChunks.filter((c) => c.documentId === removed.documentId).length;
    }
    return true;
  }

  public updateDocumentTags(documentId: string, groups: string[], tags: string[]): KnowledgeDocument {
    this.ensureInitialChunks();
    const doc = (db.documents || []).find((d) => d.id === documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);
    doc.groups = groups;
    doc.tags = tags;

    // Propagate to curated concept if linked
    if (doc.curatedConceptId && db.articles) {
      const art = db.articles.find((a) => a.id === doc.curatedConceptId);
      if (art) {
        art.groups = groups;
        art.tags = tags;
      }
    }
    return { ...doc };
  }

  public curateDocument(
    documentId: string,
    params: {
      title: string;
      articleType: "runbook" | "faq" | "architecture" | "api_reference" | "policy";
      category: string;
      groups: string[];
      tags: string[];
      summary: string;
      body?: string;
    }
  ): { document: KnowledgeDocument; article: KnowledgeArticle } {
    this.ensureInitialChunks();
    const doc = (db.documents || []).find((d) => d.id === documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    doc.curatedStatus = "curated";
    doc.groups = params.groups;
    doc.tags = params.tags;

    const articleId = doc.curatedConceptId || `art_curated_${Date.now()}`;
    doc.curatedConceptId = articleId;

    const article: KnowledgeArticle = {
      id: articleId,
      source: "supportv8_vault",
      title: params.title,
      url: `/knowledge#${articleId}`,
      category: params.category,
      usageCount: 0,
      csatScore: 98,
      status: "active",
      lastUpdated: new Date().toISOString(),
      summary: params.summary,
      body: params.body || doc.body || params.summary,
      groups: params.groups,
      tags: params.tags,
      curatedFromDocId: documentId,
      articleType: params.articleType,
    };

    if (!db.articles) db.articles = [];
    const existingIdx = db.articles.findIndex((a) => a.id === articleId);
    if (existingIdx >= 0) {
      db.articles[existingIdx] = article;
    } else {
      db.articles.unshift(article);
    }

    return { document: { ...doc }, article };
  }

  // --- S3 Source Connector for Large Datasets & Bulk Storage Sync ---
  private initialS3Sources: KnowledgeS3Source[] = [
    {
      id: "s3_src_01",
      tenantId: "tenant_default",
      bucketName: "supportv8-kb-documents",
      prefix: "enterprise-runbooks/",
      region: "us-east-1",
      endpoint: "http://minio.default.svc.cluster.local:9000",
      fileCount: 24,
      totalSizeBytes: 345 * 1024 * 1024, // 345MB
      status: "connected",
      lastSyncedAt: new Date(Date.now() - 3600000).toISOString(),
      targetCategory: "auth_sso",
      groups: ["support-tier1", "infra-ops"],
    },
    {
      id: "s3_src_02",
      tenantId: "tenant_default",
      bucketName: "acme-engineering-vault",
      prefix: "postmortems/2026/",
      region: "us-east-1",
      fileCount: 88,
      totalSizeBytes: 1240 * 1024 * 1024, // 1.24GB
      status: "connected",
      lastSyncedAt: new Date(Date.now() - 86400000).toISOString(),
      targetCategory: "checkout_failure",
      groups: ["support-tier1", "vip-escalations"],
    },
  ];

  public getS3Sources(tenantId: string): KnowledgeS3Source[] {
    return this.initialS3Sources.filter((s) => s.tenantId === tenantId);
  }

  public connectS3Source(params: {
    tenantId: string;
    bucketName: string;
    prefix?: string;
    region?: string;
    endpoint?: string;
    targetCategory?: string;
    groups?: string[];
  }): KnowledgeS3Source {
    const newSource: KnowledgeS3Source = {
      id: `s3_src_${Date.now()}`,
      tenantId: params.tenantId,
      bucketName: params.bucketName,
      prefix: params.prefix || "",
      region: params.region || "us-east-1",
      endpoint: params.endpoint,
      fileCount: 12,
      totalSizeBytes: 156 * 1024 * 1024,
      status: "connected",
      lastSyncedAt: new Date().toISOString(),
      targetCategory: params.targetCategory || "general",
      groups: params.groups || ["support-tier1"],
    };
    this.initialS3Sources.unshift(newSource);
    return newSource;
  }

  public async syncS3Source(sourceId: string): Promise<{ success: boolean; syncedCount: number; message: string }> {
    const source = this.initialS3Sources.find((s) => s.id === sourceId);
    if (!source) throw new Error(`S3 Source ${sourceId} not found`);

    source.status = "syncing";
    
    // Simulate streaming ingestion of objects under S3 prefix without buffering full archive into pod heap
    const simulatedFiles = [
      { name: `s3_${source.bucketName}_arch_01.md`, size: 14 * 1024 * 1024, title: "Okta Federation & SAML IdP Failover Architecture" },
      { name: `s3_${source.bucketName}_arch_02.pdf`, size: 48 * 1024 * 1024, title: "OrderV8 High Volume Transaction Reconciliation Runbook" },
    ];

    for (const f of simulatedFiles) {
      await this.ingestDocument({
        tenantId: source.tenantId,
        filename: f.name,
        content: `# ${f.title}\n\nIngested from S3 bucket ${source.bucketName}/${source.prefix}.\n\nContains architectural guidelines, disaster recovery procedures, and deep telemetry references.`,
        category: source.targetCategory,
        title: f.title,
        groups: source.groups,
        tags: [source.targetCategory, "s3_bulk_sync"],
      });
    }

    source.status = "connected";
    source.lastSyncedAt = new Date().toISOString();
    source.fileCount += simulatedFiles.length;

    return {
      success: true,
      syncedCount: simulatedFiles.length,
      message: `Successfully synced ${simulatedFiles.length} objects from s3://${source.bucketName}/${source.prefix} and indexed into pgvector chunks.`,
    };
  }
}

export const ragIngestion = new RagIngestionService();

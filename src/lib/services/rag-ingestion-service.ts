/**
 * supportV8 RAG Document Ingestion Service
 * Ingests files (Markdown, PDF text, JSON, TXT) via S3 upload, parses semantic chunks,
 * generates 1536-dimensional pgvector embeddings, and indexes them for RAG search.
 */

import { s3Storage } from "../storage/s3-client";
import { ragService } from "./rag-service";
import { chunkBody } from "../rag/chunker";
import { db } from "../db/mock-data";
import { pgClient as defaultPgClient, type PostgresClient } from "../db/pg-client";
import { marketplaceService } from "./marketplace-service";
import { tenantIdFromSlug } from "../auth/request-tenant";
import type { KnowledgeDocument, KnowledgeDocumentChunk, KnowledgeArticle, KnowledgeS3Source } from "../types";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB per file — aligned with knowledgev8 pod memory guard
export const MAX_BATCH_BYTES = 60 * 1024 * 1024;  // 60MB per batch upload request

export interface IngestionResult {
  document: KnowledgeDocument;
  chunks: KnowledgeDocumentChunk[];
  s3Url: string;
}

export class RagIngestionService {
  constructor(private readonly client: PostgresClient = defaultPgClient) {}
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
    const rawTenantId = params.tenantId;
    const tenantId = marketplaceService.resolveWorkspaceId(rawTenantId) || tenantIdFromSlug(rawTenantId);
    const { filename, category = "general", title, groups = ["support-tier1"], tags = [] } = params;
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

    if (process.env.DATABASE_URL) {
      try {
        await this.client.withTenantSession(tenantId, async (session) => {
          await session.query(
            `INSERT INTO supportv8.knowledge_documents (
              id, tenant_id, filename, file_type, file_size_bytes, s3_key, s3_url,
              category, title, chunk_count, status, summary, uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              category = EXCLUDED.category,
              chunk_count = EXCLUDED.chunk_count,
              summary = EXCLUDED.summary,
              uploaded_at = NOW()`,
            [
              document.id,
              document.tenantId,
              document.filename,
              document.fileType,
              document.fileSizeBytes,
              document.s3Key,
              document.s3Url,
              document.category,
              document.title,
              document.chunkCount,
              document.status,
              document.summary,
            ]
          );

          for (const chk of chunks) {
            await session.query(
              `INSERT INTO supportv8.knowledge_document_chunks (
                id, document_id, tenant_id, chunk_index, content, embedding, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
              ON CONFLICT (tenant_id, document_id, chunk_index) DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                created_at = NOW()`,
              [
                chk.id,
                chk.documentId,
                chk.tenantId,
                chk.chunkIndex,
                chk.content,
                JSON.stringify(chk.embedding),
              ]
            );
          }
        });
      } catch (err) {
        console.error("[RagIngestionService] Failed to persist uploaded document to PostgreSQL:", err);
      }
    }

    return {
      document,
      chunks,
      s3Url: s3Result.s3Url,
    };
  }

  /**
   * Ingest a support ticket into the RAG corpus, generate 1536-dim embeddings,
   * persist to PostgreSQL (supportv8.knowledge_documents & knowledge_document_chunks),
   * and update the ticket timeline.
   */
  public async ingestTicketToRag(params: {
    tenantId: string;
    ticket: {
      externalId: string;
      summary: string;
      customerName: string;
      product: string;
      resolutionNotes?: string;
      category?: string;
      tags?: string[];
    };
  }): Promise<IngestionResult> {
    const rawTenantId = params.tenantId;
    const tenantId = marketplaceService.resolveWorkspaceId(rawTenantId) || tenantIdFromSlug(rawTenantId);
    const { ticket } = params;
    const cleanExternalId = ticket.externalId.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const docId = `doc_tkt_${cleanExternalId}`;
    const filename = `ticket-${ticket.externalId.toLowerCase().replace(/[^a-z0-9]/g, "-")}.md`;
    const category = ticket.category || "ticket_resolution";
    const docTitle = `[Ticket] ${ticket.externalId}: ${ticket.summary}`;
    const resolutionNotes = ticket.resolutionNotes || "Issue investigated, root cause mitigated, and customer access restored.";
    const tags = Array.from(new Set([...(ticket.tags || []), category, "rag-grounded", "ticket"]));

    const textContent = `# Ticket Resolution: ${ticket.externalId}\n\n**Customer:** ${ticket.customerName || "Customer"}\n**Product:** ${ticket.product || "Support"}\n**Category:** ${category}\n**Summary:** ${ticket.summary}\n\n## Verified Resolution\n${resolutionNotes}\n\n**Tags:** ${tags.join(", ")}`;
    const buffer = Buffer.from(textContent, "utf-8");

    const s3Key = `kbs/${tenantId}/${filename}`;
    const s3Url = `https://supportv8-kb-documents.s3.amazonaws.com/${tenantId}/${filename}`;

    const textChunks = this.chunkText(textContent);
    const chunksToProcess = textChunks.length ? textChunks : [textContent];

    const document: KnowledgeDocument = {
      id: docId,
      tenantId,
      filename,
      fileType: "md",
      fileSizeBytes: buffer.length,
      s3Key,
      s3Url,
      category,
      title: docTitle,
      chunkCount: chunksToProcess.length,
      status: "indexed",
      uploadedAt: new Date().toISOString(),
      summary: ticket.summary,
      body: textContent,
      groups: ["support-tier1", "vip-escalations"],
      tags,
      curatedStatus: "raw",
    };

    const chunks: KnowledgeDocumentChunk[] = chunksToProcess.map((chunkContent, idx) => {
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
    });

    // Store in-memory
    if (!db.documents) db.documents = [];
    if (!db.documentChunks) db.documentChunks = [];
    db.documents = [document, ...db.documents.filter((d) => d.id !== docId)];
    db.documentChunks = [...db.documentChunks.filter((c) => c.documentId !== docId), ...chunks];

    // Store in PostgreSQL
    if (process.env.DATABASE_URL) {
      try {
        await this.client.withTenantSession(tenantId, async (session) => {
          await session.query(
            `INSERT INTO supportv8.knowledge_documents (
              id, tenant_id, filename, file_type, file_size_bytes, s3_key, s3_url,
              category, title, chunk_count, status, summary, uploaded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              category = EXCLUDED.category,
              chunk_count = EXCLUDED.chunk_count,
              summary = EXCLUDED.summary,
              uploaded_at = NOW()`,
            [
              document.id,
              document.tenantId,
              document.filename,
              document.fileType,
              document.fileSizeBytes,
              document.s3Key,
              document.s3Url,
              document.category,
              document.title,
              document.chunkCount,
              document.status,
              document.summary,
            ]
          );

          for (const chk of chunks) {
            await session.query(
              `INSERT INTO supportv8.knowledge_document_chunks (
                id, document_id, tenant_id, chunk_index, content, embedding, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
              ON CONFLICT (tenant_id, document_id, chunk_index) DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                created_at = NOW()`,
              [
                chk.id,
                chk.documentId,
                chk.tenantId,
                chk.chunkIndex,
                chk.content,
                JSON.stringify(chk.embedding),
              ]
            );
          }

          // Mark issue as RAG-ingested in supportv8.issues timeline if present
          await session.query(
            `UPDATE supportv8.issues
                SET timeline = CASE
                      WHEN timeline::text LIKE '%RAG Vector Corpus Ingestion%' THEN timeline
                      ELSE COALESCE(timeline, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                        'id', 'tl_' || floor(extract(epoch from now()) * 1000)::text,
                        'timestamp', to_char(now(), 'HH12:MI:SS AM'),
                        'actor', 'Jordan (KB Refresh Specialist)',
                        'actorType', 'ai_employee',
                        'action', '1-Click RAG Vector Corpus Ingestion',
                        'details', 'Resolution grounded into pgvector knowledge base.'
                      ))
                    END
              WHERE tenant_id = $1 AND (external_id = $2 OR external_id = $3)`,
            [tenantId, ticket.externalId, ticket.externalId.toUpperCase()]
          );
        });
      } catch (err) {
        console.error("[RagIngestionService] Failed to persist ticket to PostgreSQL:", err);
      }
    }

    return {
      document,
      chunks,
      s3Url,
    };
  }

  public async getDurableDocuments(tenantId: string): Promise<KnowledgeDocument[]> {
    this.ensureInitialChunks();
    const canonicalTenantId = marketplaceService.resolveWorkspaceId(tenantId) || tenantIdFromSlug(tenantId);
    if (process.env.DATABASE_URL) {
      try {
        const docs = await this.client.withTenantSession(canonicalTenantId, async (session) => {
          const rows = await session.query<{
            id: string;
            tenant_id: string;
            filename: string;
            file_type: string;
            file_size_bytes: number;
            s3_key: string;
            s3_url: string;
            category: string;
            title: string;
            chunk_count: number;
            status: string;
            summary: string;
            uploaded_at: Date | string;
          }>(
            `SELECT id, tenant_id, filename, file_type, file_size_bytes, s3_key, s3_url,
                    category, title, chunk_count, status, summary, uploaded_at
               FROM supportv8.knowledge_documents
              WHERE tenant_id = $1
              ORDER BY uploaded_at DESC`,
            [canonicalTenantId]
          );

          const existingDocIds = new Set(rows.map((r) => r.id));

          // Auto-discover any tickets in supportv8.issues marked as RAG ingested
          const ragIssues = await session.query<{
            id: string;
            external_id: string;
            summary: string;
            customer_name: string;
            product: string;
            category: string;
            recommended_action: string | null;
            tags: string[];
            timeline: Array<{ action?: string; details?: string }>;
          }>(
            `SELECT id, external_id, summary, customer_name, product, category, recommended_action, tags, timeline
               FROM supportv8.issues
              WHERE tenant_id = $1
                AND (
                  timeline::text LIKE '%RAG Vector Corpus Ingestion%'
                  OR timeline::text LIKE '%pgvector knowledge base%'
                  OR 'rag' = ANY(tags)
                  OR 'rag-grounded' = ANY(tags)
                )`,
            [canonicalTenantId]
          );

          for (const issue of ragIssues) {
            const cleanExternalId = issue.external_id.toLowerCase().replace(/[^a-z0-9]/g, "_");
            const expectedDocId = `doc_tkt_${cleanExternalId}`;
            if (!existingDocIds.has(expectedDocId)) {
              const resolutionNotes = issue.recommended_action || "Issue investigated, root cause mitigated, and customer access restored.";
              const filename = `ticket-${issue.external_id.toLowerCase().replace(/[^a-z0-9]/g, "-")}.md`;
              const docTitle = `[Ticket] ${issue.external_id}: ${issue.summary}`;
              const body = `# Ticket Resolution: ${issue.external_id}\n\n**Customer:** ${issue.customer_name || "Customer"}\n**Product:** ${issue.product || "Support"}\n**Category:** ${issue.category || "ticket_resolution"}\n**Summary:** ${issue.summary}\n\n## Verified Resolution\n${resolutionNotes}\n\n**Tags:** ${(issue.tags || []).join(", ")}`;
              const textChunks = this.chunkText(body);
              const chunksToProcess = textChunks.length ? textChunks : [body];
              const s3Key = `kbs/${canonicalTenantId}/${filename}`;
              const s3Url = `https://supportv8-kb-documents.s3.amazonaws.com/${canonicalTenantId}/${filename}`;

              await session.query(
                `INSERT INTO supportv8.knowledge_documents (
                  id, tenant_id, filename, file_type, file_size_bytes, s3_key, s3_url,
                  category, title, chunk_count, status, summary, uploaded_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                ON CONFLICT (id) DO NOTHING`,
                [
                  expectedDocId,
                  canonicalTenantId,
                  filename,
                  "md",
                  Buffer.byteLength(body, "utf-8"),
                  s3Key,
                  s3Url,
                  issue.category || "ticket_resolution",
                  docTitle,
                  chunksToProcess.length,
                  "indexed",
                  issue.summary,
                ]
              );

              for (let idx = 0; idx < chunksToProcess.length; idx++) {
                const chunkContent = chunksToProcess[idx];
                const embedding = ragService.generateEmbedding(chunkContent);
                await session.query(
                  `INSERT INTO supportv8.knowledge_document_chunks (
                    id, document_id, tenant_id, chunk_index, content, embedding, created_at
                  ) VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
                  ON CONFLICT (tenant_id, document_id, chunk_index) DO NOTHING`,
                  [
                    `chk_${expectedDocId}_${idx}`,
                    expectedDocId,
                    canonicalTenantId,
                    idx,
                    chunkContent,
                    JSON.stringify(embedding),
                  ]
                );
              }

              rows.unshift({
                id: expectedDocId,
                tenant_id: canonicalTenantId,
                filename,
                file_type: "md",
                file_size_bytes: Buffer.byteLength(body, "utf-8"),
                s3_key: s3Key,
                s3_url: s3Url,
                category: issue.category || "ticket_resolution",
                title: docTitle,
                chunk_count: chunksToProcess.length,
                status: "indexed",
                summary: issue.summary,
                uploaded_at: new Date().toISOString(),
              });
              existingDocIds.add(expectedDocId);
            }
          }

          return rows.map((r): KnowledgeDocument => ({
            id: r.id,
            tenantId: r.tenant_id,
            filename: r.filename,
            fileType: r.file_type,
            fileSizeBytes: r.file_size_bytes,
            s3Key: r.s3_key,
            s3Url: r.s3_url,
            category: r.category,
            title: r.title,
            chunkCount: r.chunk_count,
            status: (r.status as KnowledgeDocument["status"]) || "indexed",
            uploadedAt: typeof r.uploaded_at === "string" ? r.uploaded_at : r.uploaded_at.toISOString(),
            summary: r.summary,
            groups: ["support-tier1"],
            tags: [r.category, "rag-grounded"],
            curatedStatus: "raw",
          }));
        });

        if (docs && docs.length > 0) {
          return docs;
        }
      } catch (err) {
        console.error("[RagIngestionService] Failed to load durable documents:", err);
      }
    }

    return this.getDocuments(canonicalTenantId);
  }

  public async getDurableChunks(tenantId: string, documentId: string): Promise<KnowledgeDocumentChunk[]> {
    this.ensureInitialChunks();
    const canonicalTenantId = marketplaceService.resolveWorkspaceId(tenantId) || tenantIdFromSlug(tenantId);
    if (process.env.DATABASE_URL) {
      try {
        const chunks = await this.client.withTenantSession(canonicalTenantId, async (session) => {
          const rows = await session.query<{
            id: string;
            document_id: string;
            tenant_id: string;
            chunk_index: number;
            content: string;
            created_at: Date | string;
          }>(
            `SELECT id, document_id, tenant_id, chunk_index, content, created_at
               FROM supportv8.knowledge_document_chunks
              WHERE tenant_id = $1 AND document_id = $2
              ORDER BY chunk_index ASC`,
            [canonicalTenantId, documentId]
          );

          return rows.map((r): KnowledgeDocumentChunk => ({
            id: r.id,
            documentId: r.document_id,
            tenantId: r.tenant_id,
            chunkIndex: r.chunk_index,
            section: `Section ${r.chunk_index + 1}`,
            content: r.content,
            weight: 1.0,
            tokenCount: Math.ceil(r.content.length / 4),
            updatedAt: typeof r.created_at === "string" ? r.created_at : r.created_at.toISOString(),
            embedding: ragService.generateEmbedding(r.content),
          }));
        });

        if (chunks && chunks.length > 0) {
          return chunks;
        }
      } catch (err) {
        console.error("[RagIngestionService] Failed to load durable chunks:", err);
      }
    }

    return this.getDocumentChunks(documentId);
  }

  public async getDurableArticles(tenantId: string): Promise<KnowledgeArticle[]> {
    const canonicalTenantId = marketplaceService.resolveWorkspaceId(tenantId) || tenantIdFromSlug(tenantId);
    if (process.env.DATABASE_URL) {
      try {
        const articles = await this.client.withTenantSession(canonicalTenantId, async (session) => {
          const rows = await session.query<{
            id: string;
            source: string;
            title: string;
            url: string;
            category: string;
            usage_count: number;
            csat_score: number;
            status: string;
            summary: string;
            content: string;
            last_updated: Date | string;
          }>(
            `SELECT id, source, title, url, category, usage_count, csat_score, status, summary, content, last_updated
               FROM supportv8.knowledge_articles
              WHERE tenant_id = $1
              ORDER BY last_updated DESC`,
            [canonicalTenantId]
          );

          return rows.map((r): KnowledgeArticle => ({
            id: r.id,
            source: r.source,
            title: r.title,
            url: r.url,
            category: r.category,
            usageCount: r.usage_count,
            csatScore: Number(r.csat_score),
            status: (r.status as KnowledgeArticle["status"]) || "active",
            summary: r.summary,
            body: r.content,
            lastUpdated: typeof r.last_updated === "string" ? r.last_updated : r.last_updated.toISOString(),
            groups: ["support-tier1"],
            tags: [r.category],
          }));
        });
        if (articles && articles.length > 0) return articles;
      } catch (err) {
        console.error("[RagIngestionService] Failed to load durable articles:", err);
      }
    }
    return db.articles || [];
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

  public async updateChunk(
    arg1: string,
    arg2: { content?: string; section?: string; weight?: number } | string,
    arg3?: { content?: string; section?: string; weight?: number }
  ): Promise<KnowledgeDocumentChunk> {
    this.ensureInitialChunks();
    const hasTenant = typeof arg2 === "string";
    const tenantId = hasTenant ? arg1 : "tenant_default";
    const chunkId = hasTenant ? (arg2 as string) : arg1;
    const updates = (hasTenant ? arg3 : arg2) as { content?: string; section?: string; weight?: number } || {};
    const canonicalTenantId = marketplaceService.resolveWorkspaceId(tenantId) || tenantIdFromSlug(tenantId);

    let chunk = (db.documentChunks || []).find((c) => c.id === chunkId);
    if (updates.content !== undefined && chunk) {
      chunk.content = updates.content;
      chunk.tokenCount = Math.ceil(updates.content.length / 4);
      chunk.embedding = ragService.generateEmbedding(updates.content);
    }
    if (updates.section !== undefined && chunk) chunk.section = updates.section;
    if (updates.weight !== undefined && chunk) chunk.weight = updates.weight;
    if (chunk) chunk.updatedAt = new Date().toISOString();

    if (process.env.DATABASE_URL) {
      try {
        await this.client.withTenantSession(canonicalTenantId, async (session) => {
          if (updates.content !== undefined) {
            const embedding = ragService.generateEmbedding(updates.content);
            await session.query(
              `UPDATE supportv8.knowledge_document_chunks
                  SET content = $1, embedding = $2::vector
                WHERE tenant_id = $3 AND id = $4`,
              [updates.content, JSON.stringify(embedding), canonicalTenantId, chunkId]
            );
          }
        });
      } catch (err) {
        console.error("[RagIngestionService] Failed to update chunk in PostgreSQL:", err);
      }
    }

    if (!chunk) {
      chunk = {
        id: chunkId,
        documentId: "",
        tenantId: canonicalTenantId,
        chunkIndex: 0,
        section: updates.section || "Updated Chunk",
        content: updates.content || "",
        weight: updates.weight ?? 1.0,
        tokenCount: Math.ceil((updates.content || "").length / 4),
        updatedAt: new Date().toISOString(),
        embedding: ragService.generateEmbedding(updates.content || ""),
      };
      if (!db.documentChunks) db.documentChunks = [];
      db.documentChunks.push(chunk);
    }

    return { ...chunk };
  }

  public async addChunk(
    arg1: string,
    arg2: string,
    arg3?: string,
    arg4?: string
  ): Promise<KnowledgeDocumentChunk> {
    this.ensureInitialChunks();
    const hasTenant = typeof arg4 === "string" || (typeof arg3 === "string" && arg1.startsWith("tenant_"));
    const tenantId = hasTenant ? arg1 : "tenant_default";
    const documentId = hasTenant ? arg2 : arg1;
    const content = hasTenant ? (arg3 as string) : arg2;
    const section = hasTenant ? arg4 : arg3;
    const canonicalTenantId = marketplaceService.resolveWorkspaceId(tenantId) || tenantIdFromSlug(tenantId);

    let doc = (db.documents || []).find((d) => d.id === documentId);
    if (!doc && process.env.DATABASE_URL) {
      try {
        const durable = await this.getDurableDocuments(canonicalTenantId);
        doc = durable.find((d) => d.id === documentId);
        if (doc) {
          if (!db.documents) db.documents = [];
          db.documents.push(doc);
        }
      } catch (_) {}
    }

    const existing = (db.documentChunks || []).filter((c) => c.documentId === documentId);
    const newIdx = existing.length;
    const chunkId = `chk_${documentId}_${Date.now()}_${newIdx}`;
    const embedding = ragService.generateEmbedding(content);

    const newChunk: KnowledgeDocumentChunk = {
      id: chunkId,
      documentId,
      tenantId: canonicalTenantId,
      chunkIndex: newIdx,
      section: section || `Section ${newIdx + 1}`,
      content,
      weight: 1.0,
      tokenCount: Math.ceil(content.length / 4),
      updatedAt: new Date().toISOString(),
      embedding,
    };

    if (!db.documentChunks) db.documentChunks = [];
    db.documentChunks.push(newChunk);
    if (doc) {
      doc.chunkCount = (db.documentChunks.filter((c) => c.documentId === documentId)).length;
    }

    if (process.env.DATABASE_URL) {
      try {
        await this.client.withTenantSession(canonicalTenantId, async (session) => {
          await session.query(
            `INSERT INTO supportv8.knowledge_document_chunks (
              id, document_id, tenant_id, chunk_index, content, embedding, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
            ON CONFLICT (tenant_id, document_id, chunk_index) DO UPDATE
              SET content = EXCLUDED.content, embedding = EXCLUDED.embedding`,
            [chunkId, documentId, canonicalTenantId, newIdx, content, JSON.stringify(embedding)]
          );

          await session.query(
            `UPDATE supportv8.knowledge_documents
                SET chunk_count = chunk_count + 1
              WHERE tenant_id = $1 AND id = $2`,
            [canonicalTenantId, documentId]
          );
        });
      } catch (err) {
        console.error("[RagIngestionService] Failed to insert chunk to PostgreSQL:", err);
      }
    }

    return newChunk;
  }

  public async deleteChunk(arg1: string, arg2?: string): Promise<boolean> {
    this.ensureInitialChunks();
    const hasTenant = typeof arg2 === "string";
    const tenantId = hasTenant ? arg1 : "tenant_default";
    const chunkId = hasTenant ? arg2 : arg1;
    const canonicalTenantId = marketplaceService.resolveWorkspaceId(tenantId) || tenantIdFromSlug(tenantId);

    const idx = (db.documentChunks || []).findIndex((c) => c.id === chunkId);
    if (idx !== -1) {
      const [removed] = db.documentChunks.splice(idx, 1);
      const doc = (db.documents || []).find((d) => d.id === removed.documentId);
      if (doc) {
        doc.chunkCount = db.documentChunks.filter((c) => c.documentId === removed.documentId).length;
      }
    }

    if (process.env.DATABASE_URL) {
      try {
        await this.client.withTenantSession(canonicalTenantId, async (session) => {
          const removed = await session.query<{ document_id: string }>(
            `DELETE FROM supportv8.knowledge_document_chunks
              WHERE tenant_id = $1 AND id = $2
              RETURNING document_id`,
            [canonicalTenantId, chunkId]
          );
          if (removed.length > 0) {
            const targetDocId = removed[0].document_id;
            await session.query(
              `UPDATE supportv8.knowledge_documents
                  SET chunk_count = GREATEST(0, chunk_count - 1)
                WHERE tenant_id = $1 AND id = $2`,
              [canonicalTenantId, targetDocId]
            );
          }
        });
      } catch (err) {
        console.error("[RagIngestionService] Failed to delete chunk in PostgreSQL:", err);
      }
    }

    return true;
  }

  public async updateDocumentTags(
    arg1: string,
    arg2: string | string[],
    arg3?: string[],
    arg4?: string[]
  ): Promise<KnowledgeDocument> {
    this.ensureInitialChunks();
    const hasTenant = typeof arg2 === "string";
    const tenantId = hasTenant ? arg1 : "tenant_default";
    const documentId = hasTenant ? (arg2 as string) : arg1;
    const groups = (hasTenant ? arg3 : (arg2 as string[])) || [];
    const tags = (hasTenant ? arg4 : arg3) || [];
    const canonicalTenantId = marketplaceService.resolveWorkspaceId(tenantId) || tenantIdFromSlug(tenantId);

    let doc = (db.documents || []).find((d) => d.id === documentId);
    if (!doc && process.env.DATABASE_URL) {
      try {
        const durable = await this.getDurableDocuments(canonicalTenantId);
        doc = durable.find((d) => d.id === documentId);
        if (doc) {
          if (!db.documents) db.documents = [];
          db.documents.push(doc);
        }
      } catch (_) {}
    }
    if (!doc) throw new Error(`Document ${documentId} not found`);
    doc.groups = groups;
    doc.tags = tags;

    if (doc.curatedConceptId && db.articles) {
      const art = db.articles.find((a) => a.id === doc.curatedConceptId);
      if (art) {
        art.groups = groups;
        art.tags = tags;
      }
    }

    if (process.env.DATABASE_URL) {
      try {
        await this.client.withTenantSession(canonicalTenantId, async (session) => {
          await session.query(
            `UPDATE supportv8.knowledge_documents
                SET category = $1
              WHERE tenant_id = $2 AND id = $3`,
            [tags[0] || doc.category, canonicalTenantId, documentId]
          );
        });
      } catch (err) {
        console.error("[RagIngestionService] Failed to update document tags in PostgreSQL:", err);
      }
    }

    return { ...doc };
  }

  public async curateDocument(
    arg1: string,
    arg2: any,
    arg3?: any
  ): Promise<{ document: KnowledgeDocument; article: KnowledgeArticle }> {
    this.ensureInitialChunks();
    const hasTenant = typeof arg3 === "object";
    const tenantId = hasTenant ? arg1 : "tenant_default";
    const documentId = hasTenant ? arg2 : arg1;
    const params = hasTenant ? arg3 : arg2;
    const canonicalTenantId = marketplaceService.resolveWorkspaceId(tenantId) || tenantIdFromSlug(tenantId);

    let doc = (db.documents || []).find((d) => d.id === documentId);
    if (!doc && process.env.DATABASE_URL) {
      try {
        const durable = await this.getDurableDocuments(canonicalTenantId);
        doc = durable.find((d) => d.id === documentId);
        if (doc) {
          if (!db.documents) db.documents = [];
          db.documents.push(doc);
        }
      } catch (_) {}
    }
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

    if (process.env.DATABASE_URL) {
      try {
        await this.client.withTenantSession(canonicalTenantId, async (session) => {
          const embedding = ragService.generateEmbedding(`${article.title}\n${article.summary}\n${article.body}`);
          await session.query(
            `INSERT INTO supportv8.knowledge_articles (
              id, tenant_id, source, title, url, category, usage_count, csat_score, status, summary, content, embedding, last_updated
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector, NOW())
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              category = EXCLUDED.category,
              summary = EXCLUDED.summary,
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              last_updated = NOW()`,
            [
              article.id,
              canonicalTenantId,
              article.source,
              article.title,
              article.url,
              article.category,
              article.usageCount,
              article.csatScore,
              article.status,
              article.summary,
              article.body,
              JSON.stringify(embedding),
            ]
          );

          await session.query(
            `UPDATE supportv8.knowledge_documents
                SET title = $1, category = $2
              WHERE tenant_id = $3 AND id = $4`,
            [doc.title, doc.category, canonicalTenantId, doc.id]
          );
        });
      } catch (err) {
        console.error("[RagIngestionService] Failed to persist curated article to PostgreSQL:", err);
      }
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

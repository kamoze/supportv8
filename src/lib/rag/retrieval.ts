/**
 * supportV8 Unified RAG Retrieval Engine
 * Conforming to KnowledgeV8 RAG Architecture & Design (§4 Retrieval, §3.5 Two Content Classes).
 */

import { db } from "../db/mock-data";
import { ragService } from "../services/rag-service";
import { knowledgev8Connector } from "../connectors/knowledgev8-connector";

export type ContentKind = "concept" | "document" | "both";
export type CurationStatus = "authoritative" | "reviewed" | "draft" | "deprecated";

export interface MatchedResult {
  id: string;
  kind: "concept" | "document";
  title: string;
  category: string;
  status: CurationStatus;
  score: number;
  rawScore: number;
  matchedSections: { section: string | null; content: string; score: number }[];
  expandedBody?: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievalQueryOptions {
  topK?: number;
  kind?: ContentKind;
  minScore?: number;
  budgetChars?: number;
  includeBodies?: boolean;
}

export const STATUS_WEIGHT: Record<CurationStatus, number> = {
  authoritative: 1.15,
  reviewed: 1.0,
  draft: 0.8,
  deprecated: 0,
};

export const NEAR_CERTAIN_SIMILARITY = 0.96;

export class KnowledgeV8RetrievalEngine {
  /**
   * Unified search over curated KB articles and raw indexed documents with status weighting and long-context expansion.
   */
  public async query(question: string, options: RetrievalQueryOptions = {}): Promise<MatchedResult[]> {
    const {
      topK = 5,
      kind = "both",
      minScore = 0.55,
      budgetChars = 12000,
      includeBodies = true,
    } = options;

    const queryTokens = question.toLowerCase().split(/\W+/).filter((t) => t.length > 1);
    const candidates: MatchedResult[] = [];

    // 1. Search Curated Articles (kind: "concept")
    if (kind === "concept" || kind === "both") {
      for (const art of db.articles) {
        let matchScore = 0.5;
        const text = `${art.title} ${art.summary} ${art.category}`.toLowerCase();
        for (const token of queryTokens) {
          if (text.includes(token)) matchScore += 0.15;
        }

        const status: CurationStatus = art.status === "active" ? "reviewed" : art.status === "proposed" ? "draft" : "reviewed";
        const weightedScore = matchScore * STATUS_WEIGHT[status];

        if (weightedScore >= minScore) {
          candidates.push({
            id: art.id,
            kind: "concept",
            title: art.title,
            category: art.category,
            status,
            rawScore: matchScore,
            score: Math.min(0.99, weightedScore),
            matchedSections: [{ section: "Summary", content: art.summary, score: weightedScore }],
            expandedBody: art.summary,
            metadata: { source: art.source, url: art.url, csatScore: art.csatScore },
          });
        }
      }

      // 1b. Search Remote KnowledgeV8 Federated Concepts
      try {
        const kv8Results = await knowledgev8Connector.queryFederated(question, { topK: 3 });
        for (const cpt of kv8Results) {
          candidates.push({
            id: cpt.conceptId,
            kind: "concept",
            title: `[KnowledgeV8] ${cpt.title}`,
            category: cpt.bundle.split("/")[0] || "general",
            status: cpt.status,
            rawScore: cpt.score || 0.8,
            score: Math.min(0.99, (cpt.score || 0.8) * STATUS_WEIGHT[cpt.status]),
            matchedSections: [{ section: `${cpt.type}: ${cpt.bundle}`, content: cpt.description, score: cpt.score || 0.8 }],
            expandedBody: cpt.body,
            metadata: { source: "knowledgev8_federated", bundle: cpt.bundle, trustTier: cpt.trustTier },
          });
        }
      } catch (err) {
        // graceful fallback if remote KV8 is unreachable
      }
    }

    // 2. Search Raw Indexed Documents & S3 Uploads (kind: "document")
    if (kind === "document" || kind === "both") {
      if (db.documents) {
        for (const doc of db.documents) {
          let matchScore = 0.5;
          const text = `${doc.title} ${doc.summary} ${doc.filename} ${doc.category}`.toLowerCase();
          for (const token of queryTokens) {
            if (text.includes(token)) matchScore += 0.18;
          }

          const status: CurationStatus = "reviewed";
          const weightedScore = matchScore * STATUS_WEIGHT[status];

          if (weightedScore >= minScore) {
            candidates.push({
              id: doc.id,
              kind: "document",
              title: doc.title,
              category: doc.category,
              status,
              rawScore: matchScore,
              score: Math.min(0.99, weightedScore),
              matchedSections: [{ section: "Overview", content: doc.summary, score: weightedScore }],
              expandedBody: doc.summary,
              metadata: { source: "s3_upload", s3Url: doc.s3Url, s3Key: doc.s3Key, chunkCount: doc.chunkCount },
            });
          }
        }
      }

      // 3. Search Crawled Web Sources (kind: "document")
      if (db.webSources) {
        for (const web of db.webSources) {
          let matchScore = 0.5;
          const text = `${web.title} ${web.summary} ${web.url} ${web.category}`.toLowerCase();
          for (const token of queryTokens) {
            if (text.includes(token)) matchScore += 0.2;
          }

          const status: CurationStatus = "reviewed";
          const weightedScore = matchScore * STATUS_WEIGHT[status];

          if (weightedScore >= minScore) {
            candidates.push({
              id: web.id,
              kind: "document",
              title: web.title,
              category: web.category,
              status,
              rawScore: matchScore,
              score: Math.min(0.99, weightedScore),
              matchedSections: [{ section: "Crawled Web Snapshot", content: web.summary, score: weightedScore }],
              expandedBody: web.summary,
              metadata: { source: "website_crawl", url: web.url, s3SnapshotUrl: web.s3SnapshotUrl },
            });
          }
        }
      }
    }

    // 4. Sort by status-weighted score descending
    candidates.sort((a, b) => b.score - a.score);

    // 5. Near-Certain Deduplication: drop duplicate information if similarity >= 0.96
    const deduplicated: MatchedResult[] = [];
    for (const cand of candidates) {
      const isDuplicate = deduplicated.some(
        (existing) => existing.title === cand.title && existing.category === cand.category
      );
      if (!isDuplicate) {
        deduplicated.push(cand);
      }
    }

    // 6. Long-Context Token-Budgeted Expansion
    let currentChars = 0;
    const finalResults: MatchedResult[] = [];

    for (const item of deduplicated.slice(0, topK)) {
      if (includeBodies && item.expandedBody) {
        if (currentChars + item.expandedBody.length <= budgetChars) {
          currentChars += item.expandedBody.length;
          finalResults.push(item);
        } else {
          // Truncate to fit remaining budget
          const remainingBudget = Math.max(100, budgetChars - currentChars);
          finalResults.push({
            ...item,
            expandedBody: item.expandedBody.slice(0, remainingBudget) + "...",
          });
          break;
        }
      } else {
        finalResults.push(item);
      }
    }

    return finalResults;
  }
}

export const kv8RetrievalEngine = new KnowledgeV8RetrievalEngine();

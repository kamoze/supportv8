/**
 * supportV8 RAG & pgvector Semantic Retrieval Service
 * Embeds customer interactions, issues, and articles for context grounding and incident matching.
 */

import { db } from "../db/mock-data";
import type { Issue, KnowledgeArticle, Problem } from "../types";

export interface SemanticSearchResult {
  itemType: "issue" | "article" | "problem";
  id: string;
  title: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export class RagService {
  /**
   * Mock deterministic 1536-dimensional vector embedding generator.
   */
  public generateEmbedding(text: string): number[] {
    const vector: number[] = new Array(1536).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const hash = words[i].split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const index = hash % 1536;
      vector[index] = (vector[index] + 1) / Math.sqrt(words.length);
    }
    return vector;
  }

  /**
   * Perform semantic similarity search across knowledge articles, issues, and problems.
   */
  public async searchSemantic(query: string, limit = 5): Promise<SemanticSearchResult[]> {
    const qLower = query.toLowerCase();
    const queryTokens = qLower.split(/\W+/).filter(Boolean);
    const results: SemanticSearchResult[] = [];

    // 1. Search Articles & Uploaded S3 Documents
    for (const article of db.articles) {
      let matchScore = 0.5;
      const text = `${article.title} ${article.summary} ${article.category}`.toLowerCase();
      for (const token of queryTokens) {
        if (text.includes(token)) matchScore += 0.15;
      }
      if (matchScore > 0.6) {
        results.push({
          itemType: "article",
          id: article.id,
          title: article.title,
          content: article.summary,
          similarity: Math.min(0.98, matchScore),
          metadata: { source: article.source, url: article.url },
        });
      }
    }

    if (db.documents) {
      for (const doc of db.documents) {
        let matchScore = 0.5;
        const text = `${doc.title} ${doc.summary} ${doc.filename} ${doc.category}`.toLowerCase();
        for (const token of queryTokens) {
          if (token.length > 1 && text.includes(token)) matchScore += 0.2;
        }
        if (matchScore > 0.55) {
          results.push({
            itemType: "article",
            id: doc.id,
            title: doc.title,
            content: `[S3 Document: ${doc.filename}] ${doc.summary}`,
            similarity: Math.min(0.99, matchScore),
            metadata: { source: "s3_upload", s3Url: doc.s3Url, s3Key: doc.s3Key, chunkCount: doc.chunkCount },
          });
        }
      }
    }

    if (db.webSources) {
      for (const web of db.webSources) {
        let matchScore = 0.5;
        const text = `${web.title} ${web.summary} ${web.url} ${web.category}`.toLowerCase();
        for (const token of queryTokens) {
          if (token.length > 1 && text.includes(token)) matchScore += 0.2;
        }
        if (matchScore > 0.55) {
          results.push({
            itemType: "article",
            id: web.id,
            title: web.title,
            content: `[Website Source: ${web.url}] ${web.summary}`,
            similarity: Math.min(0.99, matchScore),
            metadata: { source: "website_crawl", url: web.url, s3SnapshotUrl: web.s3SnapshotUrl, chunkCount: web.chunkCount },
          });
        }
      }
    }

    if (db.documentChunks) {
      for (const chunk of db.documentChunks) {
        let matchScore = 0.5;
        const text = chunk.content.toLowerCase();
        for (const token of queryTokens) {
          if (token.length > 1 && text.includes(token)) matchScore += 0.25;
        }
        if (matchScore > 0.6) {
          const parentDoc = db.documents?.find((d) => d.id === chunk.documentId);
          results.push({
            itemType: "article",
            id: chunk.id,
            title: parentDoc ? `${parentDoc.title} (Chunk #${chunk.chunkIndex + 1})` : `Document Chunk ${chunk.id}`,
            content: chunk.content,
            similarity: Math.min(0.99, matchScore),
            metadata: { source: "s3_upload", s3Url: parentDoc?.s3Url, chunkIndex: chunk.chunkIndex },
          });
        }
      }
    }

    // 2. Search Problems
    for (const problem of db.problems) {
      let matchScore = 0.5;
      const text = `${problem.title} ${problem.summary} ${problem.suspectedCause}`.toLowerCase();
      for (const token of queryTokens) {
        if (text.includes(token)) matchScore += 0.18;
      }
      if (matchScore > 0.6) {
        results.push({
          itemType: "problem",
          id: problem.id,
          title: problem.title,
          content: problem.summary,
          similarity: Math.min(0.99, matchScore),
          metadata: { impact: problem.impact, exposure: problem.estimatedRevenueExposure },
        });
      }
    }

    // 3. Search Historical Issues
    for (const issue of db.issues) {
      let matchScore = 0.5;
      const text = `${issue.summary} ${issue.category} ${issue.tags.join(" ")}`.toLowerCase();
      for (const token of queryTokens) {
        if (text.includes(token)) matchScore += 0.12;
      }
      if (matchScore > 0.6) {
        results.push({
          itemType: "issue",
          id: issue.id,
          title: issue.summary,
          content: `Customer ${issue.customerName} (${issue.customerTier}): ${issue.summary}`,
          similarity: Math.min(0.95, matchScore),
          metadata: { sentiment: issue.sentiment, externalId: issue.externalId },
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }
}

export const ragService = new RagService();

import { queryPublicTenantKnowledge } from "@/lib/portal/knowledgev8-public";

export interface PublicKnowledgeCitation {
  id: string;
  title: string;
  snippet: string;
  similarity: number;
}

export class PortalQueryError extends Error {
  constructor(message: string, readonly status: 400 | 503) {
    super(message);
    this.name = "PortalQueryError";
  }
}

export function boundedPublicQuestion(value: unknown): string {
  if (typeof value !== "string") throw new PortalQueryError("Enter a support question.", 400);
  const query = value.trim().replace(/\s+/g, " ");
  if (query.length < 2 || query.length > 500) {
    throw new PortalQueryError("Support questions must contain between 2 and 500 characters.", 400);
  }
  return query;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim().slice(0, max);
}

export async function runPublicKnowledgeQuery(input: {
  tenantId: string;
  tenantSlug: string;
  question: unknown;
  categories?: string[];
}): Promise<{ query: string; citations: PublicKnowledgeCitation[] }> {
  const query = boundedPublicQuestion(input.question);
  const response = await queryPublicTenantKnowledge({
    tenantSlug: input.tenantSlug,
    question: query,
    categories: input.categories,
    topK: 5,
  });
  if (!response.ok) {
    throw new PortalQueryError("Verified support search is temporarily unavailable. Start a chat for help.", 503);
  }

  const citations = response.citations
    .slice(0, 5)
    .map((citation) => ({
      id: cleanText(citation.id, 128),
      title: cleanText(citation.title, 240),
      snippet: cleanText(citation.snippet, 1_000),
      similarity: Math.max(0, Math.min(1, Number(citation.similarity) || 0)),
    }))
    .filter((citation) => citation.id && citation.title && citation.snippet);

  return { query, citations };
}

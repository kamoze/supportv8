const WORKSPACE_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const WORKSPACE_KEY = /^kv8_[0-9a-f]{64}$/i;

export type PublicKnowledgeFailure = "not-configured" | "unavailable" | "workspace-mismatch";

export interface PublicKnowledgeHit {
  id: string;
  title: string;
  snippet: string;
  similarity: number;
}

type RawKnowledgeHit = {
  conceptId?: unknown;
  title?: unknown;
  description?: unknown;
  score?: unknown;
  matchedSections?: Array<{ content?: unknown }>;
};

export type PublicKnowledgeResult =
  | { ok: true; citations: PublicKnowledgeHit[] }
  | { ok: false; reason: PublicKnowledgeFailure };

export function parseKnowledgeWorkspaceKeys(raw: string | undefined): Map<string, string> {
  const keys = new Map<string, string>();
  for (const item of (raw || "").split(/[,\n]/)) {
    const entry = item.trim();
    const separator = entry.indexOf("=");
    if (separator <= 0) continue;
    const workspace = entry.slice(0, separator).trim().toLowerCase();
    const key = entry.slice(separator + 1).trim();
    if (!WORKSPACE_SLUG.test(workspace) || !WORKSPACE_KEY.test(key)) continue;
    keys.set(workspace, key);
  }
  return keys;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function snippetFor(hit: RawKnowledgeHit): string {
  const section = hit.matchedSections?.find((candidate) => cleanText(candidate?.content, 1_000));
  return cleanText(section?.content || hit.description, 1_000);
}

export async function queryPublicTenantKnowledge(
  input: { tenantSlug: string; question: string; categories?: string[]; topK?: number },
  fetchImpl: typeof fetch = fetch,
): Promise<PublicKnowledgeResult> {
  const tenantSlug = input.tenantSlug.trim().toLowerCase();
  if (!WORKSPACE_SLUG.test(tenantSlug)) return { ok: false, reason: "not-configured" };

  // Selection occurs before the request. A bare/shared key is never accepted:
  // KnowledgeV8 keys are workspace-bound, so a global key could leak the
  // customer's question into another tenant before a response check runs.
  const key = parseKnowledgeWorkspaceKeys(process.env.KNOWLEDGEV8_QUERY_API_KEY).get(tenantSlug);
  if (!key) return { ok: false, reason: "not-configured" };

  const baseUrl = process.env.KNOWLEDGEV8_URL || "http://knowledgev8.default.svc.cluster.local:3000";
  const url = new URL("/v1/query", baseUrl);
  const categories = (input.categories || []).slice(0, 8);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        // KnowledgeV8 checks this before parsing/logging the question. It
        // prevents a wrongly mapped key from receiving another tenant's text.
        "x-knowledgev8-expected-workspace": tenantSlug,
      },
      body: JSON.stringify({
        question: input.question,
        top_k: Math.max(1, Math.min(input.topK || 5, 5)),
        include_bodies: false,
        expand_links: false,
        status: ["reviewed", "authoritative"],
        tags: ["public"],
        ...(categories.length ? { bundle: categories } : {}),
      }),
      signal: AbortSignal.timeout(process.env.NODE_ENV === "test" ? 100 : 3_000),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (response.status === 409) return { ok: false, reason: "workspace-mismatch" };
  if (!response.ok) return { ok: false, reason: "unavailable" };

  const payload = await response.json().catch(() => null) as { workspace?: unknown; results?: unknown } | null;
  if (!payload || typeof payload.workspace !== "string" || !Array.isArray(payload.results)) {
    return { ok: false, reason: "unavailable" };
  }
  if (payload.workspace.trim().toLowerCase() !== tenantSlug) {
    return { ok: false, reason: "workspace-mismatch" };
  }

  const citations = (payload.results as RawKnowledgeHit[])
    .slice(0, 5)
    .map((hit) => ({
      id: cleanText(hit.conceptId, 128),
      title: cleanText(hit.title, 240),
      snippet: snippetFor(hit),
      similarity: Math.max(0, Math.min(1, Number(hit.score) || 0)),
    }))
    .filter((citation) => citation.id && citation.title && citation.snippet);

  return { ok: true, citations };
}

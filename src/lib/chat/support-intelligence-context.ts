/**
 * Bounded Support Intelligence Context Builder for Agentic Chat
 *
 * Grounded in durable PostgreSQL tables (supportv8.issues, supportv8.problems)
 * operating under forced PostgreSQL Row Level Security (RLS).
 *
 * Bounded to:
 * - At most 20 Issues
 * - At most 10 Problems
 * - At most 10 Trends
 *
 * Excludes raw interaction payloads and customer PII not needed by the query.
 * Citations link back to internal IDs and external source URLs.
 */

import { issueService } from "@/lib/services/issue-service";
import { problemService } from "@/lib/services/problem-service";
import { trendAnomalyService } from "@/lib/services/trend-anomaly-service";

export interface SupportIntelligenceCitation {
  type: "issue" | "problem" | "trend" | "document_chunk";
  id: string;
  title: string;
  sourceUrl?: string;
  confidence?: number;
}

export interface BoundedIssueContext {
  id: string;
  summary: string;
  status: string;
  priority: string;
  category: string;
  confidence?: number;
  updatedAt: string;
  sourceUrl?: string;
  externalId?: string;
}

export interface BoundedProblemContext {
  id: string;
  title: string;
  status: string;
  severity?: string;
  confidence?: number;
  updatedAt: string;
  affectedCustomers: number;
  revenueExposure: number;
}

export interface BoundedTrendContext {
  id: string;
  category: string;
  changePct: number;
  confidence: number;
  baselineCount: number;
  currentCount: number;
  windowEnd: string;
}

export interface SupportIntelligenceContext {
  prompt: string;
  citations: SupportIntelligenceCitation[];
  hasIntelligence: boolean;
  issuesCount: number;
  problemsCount: number;
  trendsCount: number;
  issues: BoundedIssueContext[];
  problems: BoundedProblemContext[];
  trends: BoundedTrendContext[];
}

function normalizeTenantId(tenant: string): string {
  if (!tenant) return "tenant_default";
  const clean = tenant.toLowerCase().trim();
  const slug = clean.startsWith("tenant_") ? clean.slice(7) : clean;
  return `tenant_${slug.replace(/[^a-z0-9_]/g, "_")}`;
}

function resolveWorkspaceName(tenantSlug: string): string {
  if (tenantSlug === "acme") return "Acme Corp";
  if (tenantSlug === "meridian") return "Meridian Logistics";
  return tenantSlug;
}

/**
 * Builds a bounded, tenant-isolated context from durable support intelligence.
 * Does not expose raw interaction payloads or customer PII.
 */
export async function buildSupportIntelligenceContext(
  tenantParam: string,
  query: string = ""
): Promise<SupportIntelligenceContext> {
  const canonicalTenantId = normalizeTenantId(tenantParam);
  const tenantSlug = canonicalTenantId.replace(/^tenant_/, "");
  const workspaceName = resolveWorkspaceName(tenantSlug);

  let rawIssues: any[] = [];
  let rawProblems: any[] = [];
  let rawTrends: any[] = [];

  try {
    const trimmedQuery = query.trim();
    const searchOptions = trimmedQuery
      ? { tenant: canonicalTenantId, search: trimmedQuery }
      : { tenant: canonicalTenantId };

    const [fetchedIssues, fetchedProblems, fetchedTrends] = await Promise.all([
      issueService.getAll(searchOptions).catch(() => []),
      problemService.getAll(canonicalTenantId).catch(() => []),
      trendAnomalyService.getTrends(canonicalTenantId).catch(() => []),
    ]);

    rawIssues = fetchedIssues || [];
    // If search with query returned 0, fallback to general tenant issues to provide context
    if (rawIssues.length === 0 && trimmedQuery) {
      rawIssues = (await issueService.getAll({ tenant: canonicalTenantId }).catch(() => [])) || [];
    }
    rawProblems = fetchedProblems || [];
    rawTrends = fetchedTrends || [];
  } catch (err) {
    console.warn(`[buildSupportIntelligenceContext] Error fetching intelligence for ${canonicalTenantId}:`, err);
    rawIssues = [];
    rawProblems = [];
    rawTrends = [];
  }

  // Bound to at most 20 Issues
  const boundedIssues: BoundedIssueContext[] = rawIssues.slice(0, 20).map((issue) => ({
    id: issue.id,
    summary: issue.summary,
    status: issue.status || issue.sourceStatus || "open",
    priority: issue.priority,
    category: issue.category,
    confidence: typeof issue.confidence === "number" ? issue.confidence : 0.85,
    updatedAt: issue.updatedAt || issue.createdAt || new Date().toISOString(),
    sourceUrl: issue.sourceUrl || undefined,
    externalId: issue.externalId || undefined,
  }));

  // Bound to at most 10 Problems
  const boundedProblems: BoundedProblemContext[] = rawProblems.slice(0, 10).map((prob) => ({
    id: prob.id,
    title: prob.title,
    status: prob.status,
    severity: prob.severity,
    confidence: 0.9,
    updatedAt: prob.updatedAt || prob.createdAt || new Date().toISOString(),
    affectedCustomers: prob.affectedCustomerCount ?? prob.affectedCustomers ?? 0,
    revenueExposure: prob.estimatedRevenueExposure ?? prob.revenueExposure ?? 0,
  }));

  // Bound to at most 10 Trends
  const boundedTrends: BoundedTrendContext[] = rawTrends.slice(0, 10).map((trend, idx) => ({
    id: `trend_${idx + 1}`,
    category: trend.category,
    changePct: trend.changePct,
    confidence: trend.confidence,
    baselineCount: trend.baselineCount,
    currentCount: trend.currentCount,
    windowEnd: trend.windowEnd || new Date().toISOString(),
  }));

  // Build citations pointing to durable records
  const citations: SupportIntelligenceCitation[] = [];

  // Add top matching issues as citations (up to 5)
  for (const issue of boundedIssues.slice(0, 5)) {
    citations.push({
      type: "issue",
      id: issue.id,
      title: issue.summary,
      sourceUrl: issue.sourceUrl,
      confidence: issue.confidence,
    });
  }

  // Add top problems as citations (up to 3)
  for (const prob of boundedProblems.slice(0, 3)) {
    citations.push({
      type: "problem",
      id: prob.id,
      title: prob.title,
      confidence: prob.confidence,
    });
  }

  // Add top trends as citations (up to 2)
  for (const trend of boundedTrends.slice(0, 2)) {
    citations.push({
      type: "trend",
      id: trend.id,
      title: `${trend.category} trend (${trend.changePct > 0 ? "+" : ""}${trend.changePct}%)`,
      confidence: trend.confidence,
    });
  }

  const hasIntelligence =
    boundedIssues.length > 0 || boundedProblems.length > 0 || boundedTrends.length > 0;

  const prompt = JSON.stringify({
    workspace: {
      tenantId: canonicalTenantId,
      name: workspaceName,
    },
    issues: boundedIssues,
    problems: boundedProblems,
    trends: boundedTrends,
  });

  return {
    prompt,
    citations,
    hasIntelligence,
    issuesCount: boundedIssues.length,
    problemsCount: boundedProblems.length,
    trendsCount: boundedTrends.length,
    issues: boundedIssues,
    problems: boundedProblems,
    trends: boundedTrends,
  };
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";
import { chatRepository } from "@/lib/db/chat-repository";
import { resolveRequestTenant, tenantIdFromSlug } from "@/lib/auth/request-tenant";
import type { Issue, OverviewMetrics } from "@/lib/types";

const hasDurableDatabase = () => Boolean(process.env.DATABASE_URL);

function computeOverviewMetricsFromIssues(issues: Issue[]): OverviewMetrics {
  const total = issues.length;
  if (total === 0) {
    return {
      csat: 0,
      csatChange: 0,
      issueVolume: 0,
      issueVolumeChange: 0,
      activeProblems: 0,
      varrRate: 0,
      businessExposure: 0,
      needsAttention: [],
      aiDiscovered: [],
      recentActivity: [],
      aiWorkforce: [],
    };
  }

  const positiveIssues = issues.filter(
    (i) => (i.sentimentScore ?? 0) >= -0.3 && i.sentiment !== "angry" && i.sentiment !== "urgent"
  ).length;
  const csat = parseFloat(((positiveIssues / total) * 100).toFixed(1));

  const autonomousResolvedCount = issues.filter(
    (i) =>
      i.tags?.includes("autonomous_resolved") ||
      ((i.confidence ?? 0) >= 0.85 && (i.sourceStatus === "closed" || (i.resolutionRiskScore ?? 1) < 0.25))
  ).length;
  const varrRate = parseFloat(((autonomousResolvedCount / total) * 100).toFixed(1));

  const needsAttention = issues
    .filter((i) => i.status === "escalated" || i.priority === "urgent")
    .slice(0, 5)
    .map((iss) => ({
      id: iss.id,
      severity: "critical" as const,
      title: `${iss.externalId} — ${iss.customerName}`,
      description: iss.summary,
      impactText: `${iss.priority} priority`,
      actionText: "Review ticket",
      targetTab: "workspace",
      targetId: iss.id,
    }));

  const aiDiscovered = issues
    .filter((i) => i.confidence && i.confidence >= 0.85)
    .slice(0, 5)
    .map((iss) => ({
      id: iss.id,
      type: "sentiment" as const,
      title: `Pattern in ${iss.externalId}`,
      description: iss.recommendedAction || iss.summary,
      confidence: iss.confidence || 0.9,
      actionText: "View insights",
      targetTab: "insights",
    }));

  const recentActivity = issues.slice(0, 5).map((iss, idx) => ({
    id: `act_${iss.id}_${idx}`,
    timestamp: "Recently",
    type: "action_executed" as const,
    description: `Ticket ${iss.externalId} (${iss.customerName}): ${iss.summary}`,
    actor: iss.assignedAgent || "Support System",
    badgeColor: iss.status === "resolved" ? "emerald" : "blue",
  }));

  return {
    csat,
    csatChange: 0,
    issueVolume: total,
    issueVolumeChange: 0,
    activeProblems: 0,
    varrRate,
    businessExposure: 0,
    needsAttention,
    aiDiscovered,
    recentActivity,
    aiWorkforce: [],
  };
}

export async function GET(req: NextRequest) {
  try {
    const tenantCtx = await resolveRequestTenant(req).catch(() => null);
    const { searchParams } = new URL(req.url);
    const tenantSlug = tenantCtx?.tenantSlug || searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
    const tenantId = tenantCtx?.tenantId || tenantIdFromSlug(tenantSlug);
    const tenantData = db.getTenantData(tenantSlug);

    let overview: OverviewMetrics;
    if (hasDurableDatabase()) {
      const issues = tenantCtx?.runtimeLinked
        ? await chatRepository.listWorkspaceIssues(tenantId)
        : await chatRepository.listChatIssues(tenantId, undefined, true);
      overview = computeOverviewMetricsFromIssues(issues);
    } else if (tenantData.isClean || tenantCtx?.runtimeLinked) {
      overview = computeOverviewMetricsFromIssues(tenantData.issues || []);
    } else {
      overview = db.getOverviewMetrics(tenantSlug);
    }

    return NextResponse.json({
      success: true,
      data: overview,
      tenant: tenantData.tenant,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load overview" },
      { status: 500 }
    );
  }
}

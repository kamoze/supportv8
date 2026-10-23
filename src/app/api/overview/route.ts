import { NextRequest, NextResponse } from "next/server";
import { pgClient } from "@/lib/db/pg-client";
import {
  authorizeMvpRead,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";
import type { OverviewMetrics } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeMvpRead(req);
    const tenantId = auth.tenantId;

    const overview: OverviewMetrics = await pgClient.withTenantSession(
      tenantId,
      async (session) => {
        // 1. Fetch issues
        const issues = await session.query<any>(
          `SELECT id, external_id, customer_name, summary, priority, sentiment,
                  sentiment_score, source, source_status, confidence,
                  resolution_risk_score, tags, recommended_action, assigned_agent,
                  created_at
           FROM supportv8.issues
           WHERE tenant_id = $1
           ORDER BY created_at DESC`,
          [tenantId]
        );

        // 2. Fetch problems
        const problems = await session.query<any>(
          `SELECT id, title, summary, status, impact, confidence,
                  affected_customer_count, estimated_revenue_exposure, created_at
           FROM supportv8.problems
           WHERE tenant_id = $1
           ORDER BY created_at DESC`,
          [tenantId]
        );

        const totalIssues = issues.length;
        const activeProblems = problems.filter(
          (p) => p.status === "active" || p.status === "investigating"
        );

        // Calculate business exposure from problems and/or issues
        let businessExposure = 0;
        for (const p of problems) {
          businessExposure += Number(p.estimated_revenue_exposure || 0);
        }

        if (totalIssues === 0 && problems.length === 0) {
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

        const positiveCount = issues.filter((i) => {
          const score =
            typeof i.sentiment_score === "number"
              ? i.sentiment_score
              : parseFloat(i.sentiment_score ?? "0");
          return (
            i.sentiment === "positive" ||
            i.sentiment === "happy" ||
            (score >= 0 && i.sentiment !== "frustrated" && i.sentiment !== "angry")
          );
        }).length;

        const csat =
          totalIssues > 0
            ? parseFloat(((positiveCount / totalIssues) * 100).toFixed(1))
            : 0;

        const resolvedCount = issues.filter(
          (i) =>
            i.source_status === "resolved" ||
            i.source_status === "closed" ||
            (Array.isArray(i.tags) && i.tags.includes("autonomous_resolved"))
        ).length;

        const varrRate =
          totalIssues > 0
            ? parseFloat(((resolvedCount / totalIssues) * 100).toFixed(1))
            : 0;

        // Needs attention: open issues with high/urgent priority or negative sentiment
        const needsAttention = issues
          .filter(
            (i) =>
              i.source_status !== "closed" &&
              i.source_status !== "resolved" &&
              (i.priority === "urgent" ||
                i.priority === "high" ||
                i.sentiment === "frustrated" ||
                i.sentiment === "angry" ||
                i.sentiment === "urgent")
          )
          .slice(0, 5)
          .map((iss) => ({
            id: iss.id,
            severity: (iss.priority === "urgent" || iss.sentiment === "angry"
              ? "critical"
              : "warning") as "critical" | "warning",
            title: `${iss.external_id} — ${iss.customer_name || "Customer"}`,
            description: iss.summary,
            impactText: `${iss.priority} priority`,
            actionText: "Review ticket",
            targetTab: "workspace",
            targetId: iss.id,
          }));

        // AI discovered: issues derived from external source interactions
        const aiDiscovered = issues
          .filter(
            (i) =>
              i.source === "zendesk" ||
              i.source === "intercom" ||
              i.source === "twilio_voice" ||
              Number(i.confidence ?? 0) >= 0.85
          )
          .slice(0, 5)
          .map((iss) => ({
            id: iss.id,
            type: "sentiment" as const,
            title: `Pattern in ${iss.external_id}`,
            description: iss.recommended_action || iss.summary,
            confidence: Number(iss.confidence || 0.85),
            actionText: "View insights",
            targetTab: "insights",
          }));

        // Recent activity
        const recentActivity = issues.slice(0, 5).map((iss, idx) => ({
          id: `act_${iss.id}_${idx}`,
          timestamp: "Recently",
          type: "action_executed" as const,
          description: `Ticket ${iss.external_id} (${iss.customer_name || "Customer"}): ${iss.summary}`,
          actor: iss.assigned_agent || "Support Intelligence Engine",
          badgeColor:
            iss.source_status === "resolved" || iss.source_status === "closed"
              ? "emerald"
              : "blue",
        }));

        return {
          csat,
          csatChange: 0,
          issueVolume: totalIssues,
          issueVolumeChange: 0,
          activeProblems: activeProblems.length,
          varrRate,
          businessExposure,
          needsAttention,
          aiDiscovered,
          recentActivity,
          aiWorkforce: [],
        };
      }
    );

    return NextResponse.json({
      success: true,
      data: overview,
    });
  } catch (error: unknown) {
    const authRes = requestAuthResponse(error);
    if (authRes) return authRes;
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load overview",
      },
      { status: 500 }
    );
  }
}

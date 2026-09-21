/**
 * supportV8 VoC Driver Analytics & AI Shift Handoff Digest Service
 * Analyzes Voice of the Customer sentiment clusters, CSAT/CES 1-5 star distributions,
 * top-performing KB article delight drivers, and overnight shift briefing synthesis.
 */

import { db } from "../db/mock-data";
import { slaEngine } from "./sla-engine-service";
import { customerHealth } from "./customer-health-service";
import type {
  CsatDistribution,
  ShiftHandoffDigest,
  TopDelightKbArticle,
  VocDriverCluster,
} from "../types/cx-types";

export const INITIAL_VOC_CLUSTERS: VocDriverCluster[] = [
  {
    id: "voc_neg_01",
    category: "negative_discontent",
    topic: "Payment Gateway 504 Timeouts & Double Charge Fears",
    percentageShare: 38.5,
    ticketCount: 187,
    sentimentImpact: "-28% CSAT Drop",
    topQuote: '"Refund took 3 attempts before the system credited our card."',
    suggestedOperationalFix: "Deploy checkout worker connection pool expansion & enable auto-refund retry queue",
  },
  {
    id: "voc_neg_02",
    category: "negative_discontent",
    topic: "Okta SAML 2.0 Identity Assertion Rejections",
    percentageShare: 24.2,
    ticketCount: 94,
    sentimentImpact: "-14% CSAT Drop",
    topQuote: '"Okta SSO error message is completely unclear on clock skew mismatch."',
    suggestedOperationalFix: "Publish Okta SAML 2.0 clock skew troubleshooting guide and notify Enterprise tier clients",
  },
  {
    id: "voc_pos_01",
    category: "positive_delight",
    topic: "Instant AI Autonomous Ticket Resolution (VARR)",
    percentageShare: 46.8,
    ticketCount: 312,
    sentimentImpact: "+34% CSAT Boost",
    topQuote: '"Issue was diagnosed and resolved within 45 seconds without waiting on hold."',
    suggestedOperationalFix: "Expand autonomous refund threshold to $50 for Pro accounts",
  },
  {
    id: "voc_pos_02",
    category: "positive_delight",
    topic: "Proactive Outage Broadcast Notifications",
    percentageShare: 32.1,
    ticketCount: 140,
    sentimentImpact: "+22% CSAT Boost",
    topQuote: '"Appreciate getting the status notification before we even had to ask."',
    suggestedOperationalFix: "Keep proactive broadcast automation enabled in Temporal schedule",
  },
];

export const INITIAL_CSAT_DISTRIBUTION: CsatDistribution[] = [
  { score: 5, count: 1248, percentage: 67.8 },
  { score: 4, count: 435, percentage: 23.6 },
  { score: 3, count: 72, percentage: 3.9 },
  { score: 2, count: 51, percentage: 2.8 },
  { score: 1, count: 36, percentage: 1.9 },
];

export const TOP_DELIGHT_ARTICLES: TopDelightKbArticle[] = [
  {
    articleId: "KB-101",
    title: "Resolving Stripe 3DS Card Authentication Errors in Sandbox",
    category: "Billing & Invoicing",
    csatBoost: 98.4,
    resolutionCount: 284,
  },
  {
    articleId: "KB-102",
    title: "Zero-Downtime Database Migration & Failover Runbook",
    category: "Infrastructure",
    csatBoost: 96.2,
    resolutionCount: 196,
  },
  {
    articleId: "KB-103",
    title: "FIDO2 & Hardware Security Keys (YubiKey) Setup",
    category: "Authentication",
    csatBoost: 95.8,
    resolutionCount: 142,
  },
];

export class VocDigestService {
  private vocClusters: VocDriverCluster[] = [...INITIAL_VOC_CLUSTERS];
  private csatDistribution: CsatDistribution[] = [...INITIAL_CSAT_DISTRIBUTION];
  private topArticles: TopDelightKbArticle[] = [...TOP_DELIGHT_ARTICLES];

  public getVocOverview(tenantSlug?: string): {
    overallCsat: number;
    customerEffortScore: number;
    netPromoterScore: number;
    topDiscontentDriver: string;
    topDelightDriver: string;
    csatDistribution: CsatDistribution[];
    topDelightArticles: TopDelightKbArticle[];
    clusters: VocDriverCluster[];
  } {
    const clean = (tenantSlug || "acme").toLowerCase().trim();
    if (clean !== "acme" && clean !== "meridian") {
      return {
        overallCsat: 0,
        customerEffortScore: 0,
        netPromoterScore: 0,
        topDiscontentDriver: "",
        topDelightDriver: "",
        csatDistribution: [],
        topDelightArticles: [],
        clusters: [],
      };
    }

    const tenantData = db.getTenantData(clean);
    const issues = tenantData.issues;
    if (issues.length === 0) {
      return {
        overallCsat: 0,
        customerEffortScore: 0,
        netPromoterScore: 0,
        topDiscontentDriver: "None detected",
        topDelightDriver: "None detected",
        csatDistribution: [],
        topDelightArticles: [],
        clusters: [],
      };
    }

    // Map each issue's sentiment to 1-5 star CSAT rating
    const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const iss of issues) {
      const s = iss.sentimentScore ?? 0;
      if (s >= 0.6) starCounts[5]++;
      else if (s >= 0.2) starCounts[4]++;
      else if (s >= -0.2) starCounts[3]++;
      else if (s >= -0.6) starCounts[2]++;
      else starCounts[1]++;
    }

    const totalRated = issues.length;
    const csatDistribution: CsatDistribution[] = [5, 4, 3, 2, 1].map((score) => ({
      score,
      count: starCounts[score],
      percentage: Math.round((starCounts[score] / totalRated) * 100),
    }));

    const positiveCount = starCounts[5] + starCounts[4];
    const overallCsat = Number(((positiveCount / totalRated) * 100).toFixed(1));

    const avgScore = issues.reduce((sum, iss) => {
      const s = iss.sentimentScore ?? 0;
      const stars = s >= 0.6 ? 5 : s >= 0.2 ? 4 : s >= -0.2 ? 3 : s >= -0.6 ? 2 : 1;
      return sum + stars;
    }, 0) / totalRated;
    const customerEffortScore = Number(avgScore.toFixed(1));

    const promoterPct = (starCounts[5] / totalRated) * 100;
    const detractorPct = ((starCounts[1] + starCounts[2]) / totalRated) * 100;
    const netPromoterScore = Math.round(promoterPct - detractorPct);

    const neg = this.vocClusters.find((c) => c.category === "negative_discontent");
    const pos = this.vocClusters.find((c) => c.category === "positive_delight");

    return {
      overallCsat,
      customerEffortScore,
      netPromoterScore,
      topDiscontentDriver: neg?.topic || "Checkout latency",
      topDelightDriver: pos?.topic || "Instant AI resolution",
      csatDistribution,
      topDelightArticles: this.topArticles,
      clusters: this.vocClusters,
    };
  }

  public generateShiftDigest(tenantSlug?: string): ShiftHandoffDigest {
    const clean = (tenantSlug || "acme").toLowerCase().trim();
    const isClean = clean !== "acme" && clean !== "meridian";
    const sla = slaEngine.getSlaOverview(tenantSlug);
    const health = customerHealth.getHealthRadar(tenantSlug);
    const metrics = db.getOverviewMetrics(tenantSlug);
    const tenantData = db.getTenantData(clean);
    const totalIssues = tenantData.issues.length;
    const resolvedIssues = tenantData.issues.filter((i) => i.status === "resolved" || i.sourceStatus === "closed");
    const autonomousResolved = resolvedIssues.filter(
      (i) => (i.tags && i.tags.includes("autonomous_resolved")) || i.assignedTo?.toLowerCase().includes("ai")
    );
    const activeProblems = tenantData.problems.filter((p) => p.status !== "resolved");
    const estimatedSavings = Math.round(autonomousResolved.length * 18.08);
    const hoursSaved = Math.round(autonomousResolved.length * 0.45);

    let summaryText: string;
    if (isClean || totalIssues === 0) {
      summaryText = `No customer conversations have been recorded for **${tenantData.tenant.name}** yet. This briefing will populate after the first interaction.`;
    } else if (autonomousResolved.length === 0) {
      summaryText = `supportV8 operations tracked **${totalIssues} customer tickets** for **${tenantData.tenant.name}**. No tickets have been autonomously resolved yet (0.0% VARR). **${activeProblems.length} active systemic problems** are identified with $${metrics.businessExposure.toLocaleString()} in revenue exposure. **${sla.atRiskCount} tickets** are currently tracked by the SLA Breach Predictor.`;
    } else {
      summaryText = `supportV8 autonomous operations achieved a **${metrics.varrRate}% VARR** across **${totalIssues} tickets** (${autonomousResolved.length} autonomous resolves), saving an estimated **${hoursSaved} engineering hours** ($${estimatedSavings.toLocaleString()}). **${activeProblems.length} active systemic problems** are undergoing mitigation with $${metrics.businessExposure.toLocaleString()} in revenue exposure. **${sla.atRiskCount} tickets** are currently flagged by the SLA Breach Predictor.`;
    }

    return {
      id: `digest_${Date.now().toString().slice(-4)}`,
      shiftName: "Morning Standup & CX Operations Briefing",
      generatedAt: new Date().toISOString(),
      executiveSummary: summaryText,
      keyMetrics: {
        varrRate: metrics.varrRate,
        totalTicketsResolved: resolvedIssues.length,
        hoursSaved,
        openCriticalProblems: activeProblems.length,
        atRiskSlaTickets: sla.atRiskCount,
        vipWaitingCount: health.activeVipChurnAlerts.length,
      },
      ongoingProblems: activeProblems.map((p) => ({
        id: p.id,
        title: p.title,
        eta: "Under active mitigation (< 45 mins)",
        impact: p.impact,
      })),
      vipAtRiskAccounts: health.accounts
        .filter((a) => a.riskLevel !== "healthy")
        .map((a) => ({
          accountName: a.accountName,
          arr: a.arrExposure,
          reason: a.primaryFrustrationDriver || "Elevated support volume",
        })),
      topOvernightPainPoints: (isClean || totalIssues === 0)
        ? []
        : [
            { rank: 1, topic: "Payment Gateway 504 Timeouts During Checkout", count: 4, sentiment: "Urgent Frustration" },
            { rank: 2, topic: "Okta SAML Clock Skew Rejection", count: 2, sentiment: "Urgent Lockout" },
            { rank: 3, topic: "EMEA MFA 2FA SMS Delay", count: 1, sentiment: "Moderate Delay" },
          ],
      staleTicketsSwept: isClean ? 0 : (typeof db.getStaleWork === "function" ? db.getStaleWork().length : (db.staleWork || []).length),
      recommendedFocusAreas: (isClean || totalIssues === 0)
        ? []
        : [
            "Monitor Stripe 3DS checkout latency and ensure proactive advisory remains live",
            "Engage with Acme Cloud Infrastructure (Health: 58%) via VIP CSM Outreach",
            "Review Chip's confidence calibration in Auto-Triage to prevent refund drift",
          ],
    };
  }
}

export const vocDigest = new VocDigestService();

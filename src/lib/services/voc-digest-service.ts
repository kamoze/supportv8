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

    const neg = this.vocClusters.find((c) => c.category === "negative_discontent");
    const pos = this.vocClusters.find((c) => c.category === "positive_delight");

    return {
      overallCsat: 91.4,
      customerEffortScore: 4.6, // out of 5.0
      netPromoterScore: 54, // +54 NPS
      topDiscontentDriver: neg?.topic || "Checkout latency",
      topDelightDriver: pos?.topic || "Instant AI resolution",
      csatDistribution: this.csatDistribution,
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
    const activeProblems = tenantData.problems.filter((p) => p.status !== "resolved");
    const estimatedSavings = isClean ? 0 : 38400;

    const summaryText = isClean
      ? `No customer conversations have been recorded for **${tenantData.tenant.name}** yet. This briefing will populate after the first interaction.`
      : `supportV8 autonomous operations maintained a **${metrics.varrRate}% VARR** over the past 24 hours, saving an estimated **142 engineering hours** ($${estimatedSavings.toLocaleString()}). **${activeProblems.length} active systemic problems** are undergoing mitigation with $${metrics.businessExposure.toLocaleString()} in revenue exposure. **${sla.atRiskCount} tickets** are currently flagged by the SLA Breach Predictor.`;

    return {
      id: `digest_${Date.now().toString().slice(-4)}`,
      shiftName: "Morning Standup & CX Operations Briefing",
      generatedAt: new Date().toISOString(),
      executiveSummary: summaryText,
      keyMetrics: {
        varrRate: metrics.varrRate,
        totalTicketsResolved: metrics.issueVolume,
        hoursSaved: isClean ? 0 : 142,
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
      topOvernightPainPoints: isClean
        ? []
        : [
            { rank: 1, topic: "Payment Gateway 504 Timeouts During Checkout", count: 86, sentiment: "Urgent Frustration" },
            { rank: 2, topic: "Okta SAML Clock Skew Rejection", count: 42, sentiment: "Urgent Lockout" },
            { rank: 3, topic: "EMEA MFA 2FA SMS Delay", count: 28, sentiment: "Moderate Delay" },
          ],
      staleTicketsSwept: isClean ? 0 : 43,
      recommendedFocusAreas: isClean
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

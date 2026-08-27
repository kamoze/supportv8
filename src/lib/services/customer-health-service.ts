/**
 * supportV8 Customer Health Score & 360° Account Risk Radar
 * Aggregates multi-channel customer sentiment, open problem exposure,
 * calculates churn probability, triggers VIP churn alerts (>2 frustrated in 48h),
 * and orchestrates proactive VIP account outreach.
 */

import crypto from "crypto";
import type { AccountHealthProfile, VipChurnAlert } from "../types/cx-types";

export const INITIAL_ACCOUNT_HEALTH_PROFILES: AccountHealthProfile[] = [
  {
    accountId: "acc_acme_01",
    accountName: "Acme Cloud Infrastructure",
    tier: "enterprise",
    healthScore: 58,
    riskLevel: "critical_at_risk",
    arrExposure: 180000,
    lifetimeTicketVolume: 142,
    openIssuesCount: 4,
    recentFrustratedCount48h: 3,
    sentimentTrajectory: "declining",
    avgSentimentScore: 0.38,
    csatAverage: 78,
    lastIncidentImpacted: "PRB-218 (Payment Gateway 504)",
    churnProbability: 0.68,
    primaryFrustrationDriver: "Repeated checkout timeouts impacting revenue operations",
    assignedCsm: "Samantha Vance (VP Customer Success)",
  },
  {
    accountId: "acc_fintech_02",
    accountName: "FinTech Global Payments",
    tier: "enterprise",
    healthScore: 71,
    riskLevel: "concerning",
    arrExposure: 240000,
    lifetimeTicketVolume: 89,
    openIssuesCount: 2,
    recentFrustratedCount48h: 2,
    sentimentTrajectory: "declining",
    avgSentimentScore: 0.52,
    csatAverage: 84,
    lastIncidentImpacted: "PRB-219 (Okta SAML 2.0 Login)",
    churnProbability: 0.34,
    primaryFrustrationDriver: "Enterprise SSO assertion failure during team onboarding",
    assignedCsm: "David Sterling (Enterprise CSM)",
  },
  {
    accountId: "acc_nexus_03",
    accountName: "Nexus Retail Systems",
    tier: "pro",
    healthScore: 88,
    riskLevel: "healthy",
    arrExposure: 64000,
    lifetimeTicketVolume: 34,
    openIssuesCount: 1,
    recentFrustratedCount48h: 0,
    sentimentTrajectory: "stable",
    avgSentimentScore: 0.76,
    csatAverage: 92,
    churnProbability: 0.12,
    assignedCsm: "Alex Martinez (Growth & Scale CSM)",
  },
  {
    accountId: "acc_biohealth_04",
    accountName: "BioHealth Diagnostics",
    tier: "enterprise",
    healthScore: 94,
    riskLevel: "healthy",
    arrExposure: 320000,
    lifetimeTicketVolume: 61,
    openIssuesCount: 0,
    recentFrustratedCount48h: 0,
    sentimentTrajectory: "improving",
    avgSentimentScore: 0.91,
    csatAverage: 98,
    churnProbability: 0.04,
    assignedCsm: "Samantha Vance (VP Customer Success)",
  },
];

export class CustomerHealthService {
  private profiles: AccountHealthProfile[] = [...INITIAL_ACCOUNT_HEALTH_PROFILES];

  public getHealthRadar(): {
    avgHealthScore: number;
    totalArrAtRisk: number;
    criticalCount: number;
    concerningCount: number;
    healthyCount: number;
    activeVipChurnAlerts: VipChurnAlert[];
    accounts: AccountHealthProfile[];
  } {
    const totalArrAtRisk = this.profiles
      .filter((p) => p.riskLevel !== "healthy")
      .reduce((sum, p) => sum + p.arrExposure, 0);

    const criticalCount = this.profiles.filter((p) => p.riskLevel === "critical_at_risk").length;
    const concerningCount = this.profiles.filter((p) => p.riskLevel === "concerning").length;
    const healthyCount = this.profiles.filter((p) => p.riskLevel === "healthy").length;

    const avgHealthScore = Math.round(
      this.profiles.reduce((sum, p) => sum + p.healthScore, 0) / this.profiles.length
    );

    // Detect VIP Churn Alerts: Enterprise accounts with >= 2 frustrated interactions in 48 hours
    const activeVipChurnAlerts: VipChurnAlert[] = this.profiles
      .filter((p) => p.tier === "enterprise" && p.recentFrustratedCount48h >= 2)
      .map((p) => ({
        id: `alt_churn_${p.accountId}`,
        accountId: p.accountId,
        accountName: p.accountName,
        tier: p.tier,
        frustratedInteractions48h: p.recentFrustratedCount48h,
        triggerReason: `${p.recentFrustratedCount48h} frustrated interactions in past 48h with $${p.arrExposure.toLocaleString()} ARR exposure`,
        arrExposure: p.arrExposure,
        detectedAt: new Date().toISOString(),
        status: "active",
      }));

    return {
      avgHealthScore,
      totalArrAtRisk,
      criticalCount,
      concerningCount,
      healthyCount,
      activeVipChurnAlerts,
      accounts: this.profiles,
    };
  }

  /**
   * Trigger proactive VIP outreach for an at-risk customer.
   * Generates a signed cross-vertical handoff token for the CSM.
   */
  public triggerVipOutreach(accountId: string): {
    success: boolean;
    message: string;
    account: AccountHealthProfile;
    handoffToken: string;
    handoffPayload: Record<string, unknown>;
  } {
    const account = this.profiles.find((p) => p.accountId === accountId);
    if (!account) throw new Error(`Account '${accountId}' not found`);

    const handoffPayload = {
      accountId: account.accountId,
      accountName: account.accountName,
      tier: account.tier,
      csm: account.assignedCsm,
      healthScore: account.healthScore,
      lifetimeTickets: account.lifetimeTicketVolume,
      openIssues: account.openIssuesCount,
      frustrated48h: account.recentFrustratedCount48h,
      recommendedAction: "Schedule emergency executive review & deliver SLA rebate credit",
      timelineSummary: `Account health degraded to ${account.healthScore}% due to ${account.primaryFrustrationDriver || "open support incidents"}.`,
    };

    const tokenPayload = Buffer.from(JSON.stringify(handoffPayload)).toString("base64url");
    const sig = crypto.createHmac("sha256", "s8_csm_secret").update(tokenPayload).digest("hex").slice(0, 16);
    const handoffToken = `${tokenPayload}.${sig}`;

    return {
      success: true,
      message: `Proactive VIP outreach briefing dispatched to ${account.assignedCsm} for ${account.accountName}.`,
      account,
      handoffToken,
      handoffPayload,
    };
  }
}

export const customerHealth = new CustomerHealthService();

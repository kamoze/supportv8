/**
 * supportV8 Trend & Anomaly Detection Service
 * Basis: EP13 (SV8-120 to SV8-124)
 */

import { db } from "../db/mock-data";

export interface TrendDataPoint {
  date: string;
  totalVolume: number;
  checkoutFailures: number;
  ssoAuth: number;
  billing: number;
  mfaSms: number;
  csat: number;
  sentimentNegativePct: number;
}

export interface AnomalyAlert {
  id: string;
  category: string;
  changePct: number;
  severity: "high" | "medium" | "low";
  description: string;
  timestamp: string;
}

export class TrendAnomalyService {
  public getTrendSeries(tenantSlug?: string): TrendDataPoint[] {
    const clean = (tenantSlug || "acme").toLowerCase().trim();
    const tenantData = db.getTenantData(clean);
    const issues = tenantData?.issues || [];

    if (!issues || issues.length === 0) {
      return [];
    }

    const timestamps = issues
      .map((i) => new Date(i.createdAt).getTime())
      .filter((t) => !isNaN(t));
    const maxTime = timestamps.length > 0 ? Math.max(...timestamps) : Date.now();
    const endDate = new Date(maxTime);

    const series: TrendDataPoint[] = [];
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const targetDate = new Date(endDate);
      targetDate.setUTCDate(endDate.getUTCDate() - dayOffset);
      const isoPrefix = targetDate.toISOString().slice(0, 10);
      const dateLabel = targetDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });

      const dayIssues = issues.filter(
        (i) => (i.createdAt || "").slice(0, 10) === isoPrefix
      );

      const totalVolume = dayIssues.length;
      const checkoutFailures = dayIssues.filter((i) =>
        /checkout|payment|order|cart/i.test(i.category || i.summary || "")
      ).length;
      const ssoAuth = dayIssues.filter((i) =>
        /auth|sso|login|saml|okta/i.test(i.category || i.summary || "")
      ).length;
      const billing = dayIssues.filter((i) =>
        /billing|invoice|refund|charge/i.test(i.category || i.summary || "")
      ).length;
      const mfaSms = dayIssues.filter((i) =>
        /mfa|sms|token|2fa/i.test(i.category || i.summary || "")
      ).length;

      const posCount = dayIssues.filter(
        (i) =>
          i.sentiment === "positive" ||
          i.sentiment === "happy" ||
          (typeof i.sentimentScore === "number" && i.sentimentScore >= 0)
      ).length;
      const negCount = dayIssues.filter(
        (i) =>
          i.sentiment === "frustrated" ||
          i.sentiment === "angry" ||
          i.sentiment === "urgent" ||
          (typeof i.sentimentScore === "number" && i.sentimentScore < 0)
      ).length;

      const csat =
        totalVolume > 0
          ? Math.round((posCount / totalVolume) * 1000) / 10
          : 100;
      const sentimentNegativePct =
        totalVolume > 0
          ? Math.round((negCount / totalVolume) * 100)
          : 0;

      series.push({
        date: dateLabel,
        totalVolume,
        checkoutFailures,
        ssoAuth,
        billing,
        mfaSms,
        csat,
        sentimentNegativePct,
      });
    }

    return series;
  }

  public getAnomalies(tenantSlug?: string): AnomalyAlert[] {
    const clean = (tenantSlug || "acme").toLowerCase().trim();
    const tenantData = db.getTenantData(clean);
    const issues = tenantData?.issues || [];

    if (!issues || issues.length === 0) {
      return [];
    }

    const anomalies: AnomalyAlert[] = [];

    const checkoutIssues = issues.filter((i) =>
      /checkout|payment|order|cart/i.test(i.category || i.summary || "")
    );
    if (checkoutIssues.length > 0) {
      const urgentCount = checkoutIssues.filter(
        (i) => i.sentiment === "angry" || i.sentiment === "urgent" || i.priority === "urgent"
      ).length;
      const changePct = Math.round((checkoutIssues.length / issues.length) * 100);
      const latest = checkoutIssues[checkoutIssues.length - 1];
      anomalies.push({
        id: "anom_checkout",
        category: "Checkout Failures",
        changePct,
        severity: urgentCount > 0 ? "high" : "medium",
        description: `${checkoutIssues.length} checkout failure ticket${checkoutIssues.length > 1 ? "s" : ""} detected in current queue (${urgentCount} urgent or frustrated).`,
        timestamp: latest.createdAt || new Date().toISOString(),
      });
    }

    const authIssues = issues.filter((i) =>
      /auth|sso|login|saml|mfa|sms/i.test(i.category || i.summary || "")
    );
    if (authIssues.length > 0) {
      const urgentCount = authIssues.filter(
        (i) => i.sentiment === "angry" || i.sentiment === "urgent" || i.priority === "urgent"
      ).length;
      const changePct = Math.round((authIssues.length / issues.length) * 100);
      const latest = authIssues[authIssues.length - 1];
      anomalies.push({
        id: "anom_auth",
        category: "Authentication & MFA",
        changePct,
        severity: urgentCount > 0 ? "high" : "medium",
        description: `${authIssues.length} authentication or MFA token inquir${authIssues.length > 1 ? "ies" : "y"} active in current queue.`,
        timestamp: latest.createdAt || new Date().toISOString(),
      });
    }

    const frustratedIssues = issues.filter(
      (i) =>
        i.sentiment === "angry" ||
        i.sentiment === "frustrated" ||
        (typeof i.sentimentScore === "number" && i.sentimentScore < -0.5)
    );
    if (frustratedIssues.length >= 2) {
      const latest = frustratedIssues[frustratedIssues.length - 1];
      const changePct = Math.round((frustratedIssues.length / issues.length) * 100);
      anomalies.push({
        id: "anom_sentiment",
        category: "Customer Frustration",
        changePct,
        severity: frustratedIssues.length >= 5 ? "high" : "medium",
        description: `${frustratedIssues.length} tickets currently flagged with elevated customer frustration or negative sentiment.`,
        timestamp: latest.createdAt || new Date().toISOString(),
      });
    }

    const opsIssues = issues.filter((i) =>
      /contractor|dispatch|logistics|lockbox/i.test(i.category || i.summary || "")
    );
    if (opsIssues.length > 0 && clean === "meridian") {
      const latest = opsIssues[opsIssues.length - 1];
      const changePct = Math.round((opsIssues.length / issues.length) * 100);
      anomalies.push({
        id: "anom_ops",
        category: "Contractor Dispatch",
        changePct,
        severity: opsIssues.some((i) => i.priority === "urgent") ? "high" : "medium",
        description: `${opsIssues.length} field contractor dispatch issue${opsIssues.length > 1 ? "s" : ""} pending review.`,
        timestamp: latest.createdAt || new Date().toISOString(),
      });
    }

    return anomalies;
  }
}

export const trendAnomalyService = new TrendAnomalyService();

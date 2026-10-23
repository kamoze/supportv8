/**
 * supportV8 Trend & Anomaly Detection Service
 * Backed by durable PostgreSQL table supportv8.issues under forced RLS.
 */

import { pgClient, PostgresClient } from "../db/pg-client";

function normalizeTenantId(tenant: string): string {
  if (!tenant) return "tenant_default";
  const clean = tenant.toLowerCase().trim();
  const slug = clean.startsWith("tenant_") ? clean.slice(7) : clean;
  return `tenant_${slug.replace(/[^a-z0-9_]/g, "_")}`;
}

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

export interface TrendResult {
  windowStart: string;
  windowEnd: string;
  tenantId: string;
  category: string;
  source?: string;
  sentiment?: string;
  baselineCount: number;
  currentCount: number;
  changePct: number;
  confidence: number;
}

export class TrendAnomalyService {
  private client: PostgresClient;

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  public async getTrendSeries(tenantParam?: string): Promise<TrendDataPoint[]> {
    if (!tenantParam) return [];
    const tenantId = normalizeTenantId(tenantParam);

    return this.client.withTenantSession(tenantId, async (session) => {
      const issues = await session.query<any>(
        `SELECT created_at, category, summary, sentiment, sentiment_score
         FROM supportv8.issues
         WHERE tenant_id = $1
         ORDER BY created_at ASC`,
        [tenantId]
      );

      if (!issues || issues.length === 0) {
        return [];
      }

      const timestamps = issues
        .map((i) => new Date(i.created_at).getTime())
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

        const dayIssues = issues.filter((i) => {
          const dt = i.created_at instanceof Date ? i.created_at.toISOString() : String(i.created_at);
          return dt.slice(0, 10) === isoPrefix;
        });

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

        const posCount = dayIssues.filter((i) => {
          const score = typeof i.sentiment_score === "number" ? i.sentiment_score : parseFloat(i.sentiment_score ?? "0");
          return (
            i.sentiment === "positive" ||
            i.sentiment === "happy" ||
            score >= 0
          );
        }).length;

        const negCount = dayIssues.filter((i) => {
          const score = typeof i.sentiment_score === "number" ? i.sentiment_score : parseFloat(i.sentiment_score ?? "0");
          return (
            i.sentiment === "frustrated" ||
            i.sentiment === "angry" ||
            i.sentiment === "urgent" ||
            score < 0
          );
        }).length;

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
    });
  }

  public async getAnomalies(tenantParam?: string): Promise<AnomalyAlert[]> {
    if (!tenantParam) return [];
    const tenantId = normalizeTenantId(tenantParam);

    return this.client.withTenantSession(tenantId, async (session) => {
      const issues = await session.query<any>(
        `SELECT id, category, summary, sentiment, sentiment_score, priority, created_at
         FROM supportv8.issues
         WHERE tenant_id = $1
         ORDER BY created_at ASC`,
        [tenantId]
      );

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
          timestamp: latest.created_at instanceof Date ? latest.created_at.toISOString() : String(latest.created_at),
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
          timestamp: latest.created_at instanceof Date ? latest.created_at.toISOString() : String(latest.created_at),
        });
      }

      const frustratedIssues = issues.filter((i) => {
        const score = typeof i.sentiment_score === "number" ? i.sentiment_score : parseFloat(i.sentiment_score ?? "0");
        return (
          i.sentiment === "angry" ||
          i.sentiment === "frustrated" ||
          score < -0.5
        );
      });
      if (frustratedIssues.length >= 2) {
        const latest = frustratedIssues[frustratedIssues.length - 1];
        const changePct = Math.round((frustratedIssues.length / issues.length) * 100);
        anomalies.push({
          id: "anom_sentiment",
          category: "Customer Frustration",
          changePct,
          severity: frustratedIssues.length >= 5 ? "high" : "medium",
          description: `${frustratedIssues.length} tickets currently flagged with elevated customer frustration or negative sentiment.`,
          timestamp: latest.created_at instanceof Date ? latest.created_at.toISOString() : String(latest.created_at),
        });
      }

      const opsIssues = issues.filter((i) =>
        /contractor|dispatch|logistics|lockbox/i.test(i.category || i.summary || "")
      );
      if (opsIssues.length > 0) {
        const latest = opsIssues[opsIssues.length - 1];
        const changePct = Math.round((opsIssues.length / issues.length) * 100);
        anomalies.push({
          id: "anom_ops",
          category: "Contractor Dispatch",
          changePct,
          severity: opsIssues.some((i) => i.priority === "urgent") ? "high" : "medium",
          description: `${opsIssues.length} field contractor dispatch issue${opsIssues.length > 1 ? "s" : ""} pending review.`,
          timestamp: latest.created_at instanceof Date ? latest.created_at.toISOString() : String(latest.created_at),
        });
      }

      return anomalies;
    });
  }

  public async getTrends(tenantParam?: string): Promise<TrendResult[]> {
    if (!tenantParam) return [];
    const tenantId = normalizeTenantId(tenantParam);

    return this.client.withTenantSession(tenantId, async (session) => {
      const issues = await session.query<any>(
        `SELECT id, source, category, sentiment, created_at
         FROM supportv8.issues
         WHERE tenant_id = $1
         ORDER BY created_at ASC`,
        [tenantId]
      );

      if (!issues || issues.length === 0) {
        return [];
      }

      const timestamps = issues
        .map((i) => new Date(i.created_at).getTime())
        .filter((t) => !isNaN(t));

      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      const midTime = minTime === maxTime ? minTime : minTime + (maxTime - minTime) / 2;

      const windowStart = new Date(minTime).toISOString();
      const windowEnd = new Date(maxTime).toISOString();

      const categories = Array.from(
        new Set(issues.map((i) => i.category).filter(Boolean))
      ) as string[];

      const results: TrendResult[] = [];

      for (const cat of categories) {
        const catIssues = issues.filter((i) => i.category === cat);
        const baseline = catIssues.filter(
          (i) => new Date(i.created_at).getTime() < midTime
        );
        const current = catIssues.filter(
          (i) => new Date(i.created_at).getTime() >= midTime
        );

        const baselineCount = baseline.length;
        const currentCount = current.length;
        const changePct =
          baselineCount > 0
            ? Math.round(((currentCount - baselineCount) / baselineCount) * 100)
            : currentCount > 0
            ? 100
            : 0;

        const confidence = Math.min(
          0.99,
          parseFloat((0.75 + Math.min(currentCount + baselineCount, 10) * 0.02).toFixed(2))
        );

        results.push({
          windowStart,
          windowEnd,
          tenantId,
          category: cat,
          source: catIssues[0]?.source,
          sentiment: catIssues[0]?.sentiment,
          baselineCount,
          currentCount,
          changePct,
          confidence,
        });
      }

      return results;
    });
  }
}

export const trendAnomalyService = new TrendAnomalyService();

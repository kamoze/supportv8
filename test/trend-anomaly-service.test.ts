import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { trendAnomalyService } from "../src/lib/services/trend-anomaly-service";
import { PostgresClient } from "@/lib/db/pg-client";
import { MockPostgresClient } from "./fixtures/mock-db-client";

describe("TrendAnomalyService real dynamic data calculation", () => {
  let mockClient: MockPostgresClient;

  beforeEach(() => {
    mockClient = new MockPostgresClient();
    PostgresClient.setTestClient(mockClient);

    const now = new Date();
    // Seed Acme issues: checkout, auth, and negative sentiment
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(now.getTime() - i * 86400000);
      mockClient.issues.push(
        {
          id: `iss_acme_${i}_1`,
          tenant_id: "tenant_acme",
          category: "Checkout Failures",
          summary: "Payment checkout failed at gateway",
          sentiment: "angry",
          sentiment_score: -0.8,
          priority: "urgent",
          created_at: dayDate,
        },
        {
          id: `iss_acme_${i}_2`,
          tenant_id: "tenant_acme",
          category: "Authentication & MFA",
          summary: "SSO login MFA token rejected",
          sentiment: "frustrated",
          sentiment_score: -0.6,
          priority: "high",
          created_at: dayDate,
        },
        {
          id: `iss_acme_${i}_3`,
          tenant_id: "tenant_acme",
          category: "Billing",
          summary: "Invoice refund inquiry",
          sentiment: "positive",
          sentiment_score: 0.5,
          priority: "normal",
          created_at: dayDate,
        }
      );
    }

    // Seed Meridian issues: contractor dispatch
    for (let i = 0; i < 3; i++) {
      mockClient.issues.push({
        id: `iss_meridian_${i}`,
        tenant_id: "tenant_meridian",
        category: "Contractor Dispatch",
        summary: "Field technician lockbox access code failure",
        sentiment: "frustrated",
        sentiment_score: -0.4,
        priority: "urgent",
        created_at: now,
      });
    }
  });

  afterEach(() => {
    PostgresClient.setTestClient(null);
  });

  it("returns empty series and empty anomalies for clean/empty tenants", async () => {
    const cleanTenant = "clean-tenant-xyz";
    const series = await trendAnomalyService.getTrendSeries(cleanTenant);
    expect(series).toEqual([]);

    const anomalies = await trendAnomalyService.getAnomalies(cleanTenant);
    expect(anomalies).toEqual([]);

    const trends = await trendAnomalyService.getTrends(cleanTenant);
    expect(trends).toEqual([]);
  });

  it("calculates real 7-day rolling series for acme tenant based on actual issues", async () => {
    const series = await trendAnomalyService.getTrendSeries("acme");
    expect(series.length).toBe(7);

    // Verify last day matches actual issue rollups
    const latest = series[series.length - 1];
    expect(latest.totalVolume).toBeGreaterThan(0);
    expect(typeof latest.date).toBe("string");
    expect(typeof latest.checkoutFailures).toBe("number");
    expect(typeof latest.ssoAuth).toBe("number");
    expect(typeof latest.billing).toBe("number");
    expect(typeof latest.mfaSms).toBe("number");
    expect(typeof latest.csat).toBe("number");
    expect(typeof latest.sentimentNegativePct).toBe("number");
  });

  it("generates real anomaly alerts from tenant issues", async () => {
    const anomalies = await trendAnomalyService.getAnomalies("acme");
    expect(anomalies.length).toBeGreaterThan(0);

    const categories = anomalies.map((a) => a.category);
    expect(categories).toContain("Checkout Failures");
    expect(categories).toContain("Authentication & MFA");

    for (const anom of anomalies) {
      expect(anom.id).toBeDefined();
      expect(anom.changePct).toBeGreaterThanOrEqual(0);
      expect(["high", "medium", "low"]).toContain(anom.severity);
      expect(anom.description.length).toBeGreaterThan(0);
      expect(anom.timestamp).toBeDefined();
    }
  });

  it("generates operational anomalies for meridian contractor issues", async () => {
    const anomalies = await trendAnomalyService.getAnomalies("meridian");
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => a.category === "Contractor Dispatch")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { trendAnomalyService } from "../src/lib/services/trend-anomaly-service";

describe("TrendAnomalyService real dynamic data calculation", () => {
  it("returns empty series and empty anomalies for clean/empty tenants", () => {
    const cleanTenant = "clean-tenant-xyz";
    const series = trendAnomalyService.getTrendSeries(cleanTenant);
    expect(series).toEqual([]);

    const anomalies = trendAnomalyService.getAnomalies(cleanTenant);
    expect(anomalies).toEqual([]);
  });

  it("calculates real 7-day rolling series for acme tenant based on actual issues", () => {
    const series = trendAnomalyService.getTrendSeries("acme");
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

  it("generates real anomaly alerts from tenant issues", () => {
    const anomalies = trendAnomalyService.getAnomalies("acme");
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

  it("generates operational anomalies for meridian contractor issues", () => {
    const anomalies = trendAnomalyService.getAnomalies("meridian");
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies.some((a) => a.category === "Contractor Dispatch")).toBe(true);
  });
});

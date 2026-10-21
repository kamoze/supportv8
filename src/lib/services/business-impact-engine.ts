/**
 * supportV8 Business Impact Engine
 * Calculates multi-dimensional business effect across revenue exposure, enterprise tiers, and SLAs.
 */

import { pgClient, PostgresClient } from "../db/pg-client";
import type { BusinessImpactLevel, Issue } from "../types";
import { mapRowToIssue } from "./issue-service";

export interface ImpactCalculation {
  impact: BusinessImpactLevel;
  score: number;
  estimatedRevenueExposure: number;
  affectedEnterpriseCount: number;
  rationale: string;
}

export class BusinessImpactEngine {
  private client: PostgresClient;

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  public calculate(linkedIssues: Issue[]): ImpactCalculation {
    if (linkedIssues.length === 0) {
      return {
        impact: "low",
        score: 0.1,
        estimatedRevenueExposure: 0,
        affectedEnterpriseCount: 0,
        rationale: "No linked issues.",
      };
    }

    const enterpriseCount = linkedIssues.filter((i) => i.customerTier === "enterprise").length;
    const proCount = linkedIssues.filter((i) => i.customerTier === "pro").length;
    const urgentCount = linkedIssues.filter((i) => i.priority === "urgent" || i.sentiment === "urgent").length;

    // Estimate Revenue Exposure ($):
    // Enterprise issue avg exposure: $15,000; Pro: $1,500; Standard: $250
    const estimatedExposure =
      enterpriseCount * 15000 +
      proCount * 1500 +
      (linkedIssues.length - enterpriseCount - proCount) * 250;

    let impact: BusinessImpactLevel = "low";
    let score = 0.2;

    if (estimatedExposure >= 30000 || enterpriseCount >= 2 || urgentCount >= 2) {
      impact = "critical";
      score = 0.95;
    } else if (estimatedExposure >= 10000 || enterpriseCount >= 1 || urgentCount >= 1) {
      impact = "high";
      score = 0.75;
    } else if (estimatedExposure >= 3000 || proCount >= 2) {
      impact = "medium";
      score = 0.5;
    } else {
      impact = "low";
      score = 0.25;
    }

    return {
      impact,
      score,
      estimatedRevenueExposure: estimatedExposure,
      affectedEnterpriseCount: enterpriseCount,
      rationale: `${linkedIssues.length} linked issues (${enterpriseCount} enterprise, ${proCount} pro). Estimated financial exposure: $${estimatedExposure.toLocaleString()}. Impact level: ${impact.toUpperCase()}.`,
    };
  }

  public async computeTenantImpact(
    tenantId: string
  ): Promise<ImpactCalculation> {
    const canonicalTenantId = tenantId.startsWith("tenant_")
      ? tenantId
      : `tenant_${tenantId.replace(/[^a-z0-9_]/g, "_")}`;

    return this.client.withTenantSession(canonicalTenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.issues WHERE tenant_id = $1`,
        [canonicalTenantId]
      );
      if (!rows || rows.length === 0) {
        return this.calculate([]);
      }
      const issues = rows.map(mapRowToIssue);
      return this.calculate(issues);
    });
  }
}

export const businessImpactEngine = new BusinessImpactEngine();

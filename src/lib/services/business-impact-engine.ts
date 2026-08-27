/**
 * supportV8 Business Impact Engine
 * Basis: EP08 (SV8-070 to SV8-074)
 * Calculates multi-dimensional business effect across revenue exposure, enterprise tiers, and SLAs.
 */

import type { BusinessImpactLevel, Issue, Problem } from "../types";

export interface ImpactCalculation {
  impact: BusinessImpactLevel;
  score: number;
  estimatedRevenueExposure: number;
  affectedEnterpriseCount: number;
  rationale: string;
}

export class BusinessImpactEngine {
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
    const estimatedExposure = enterpriseCount * 15000 + proCount * 1500 + (linkedIssues.length - enterpriseCount - proCount) * 250;

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
}

export const businessImpactEngine = new BusinessImpactEngine();

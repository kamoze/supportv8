/**
 * supportV8 Reporting & Economics Service
 * Basis: EP18 (SV8-170 to SV8-177)
 */

import { db } from "../db/mock-data";

export interface ReportKPIs {
  varr: number; // Verified Autonomous Resolution Rate (%)
  csatAverage: number;
  slaAttainmentPct: number;
  totalInteractions: number;
  autonomousResolved: number;
  copilotAssisted: number;
  humanEscalated: number;
  avgResolutionTimeMins: number;
  costPerResolutionHuman: number;
  costPerResolutionAI: number;
  humanMinutesSaved: number;
  totalCostSavings: number;
}

export class ReportingService {
  public getScorecard(): ReportKPIs {
    const total = 2840;
    const autonomous = 2124; // ~74.8%
    const copilot = 480;
    const human = 236;

    const humanCostPerTicket = 18.5; // $18.50 per manual ticket
    const aiCostPerTicket = 0.42; // $0.42 per agentic resolution
    const minutesSaved = autonomous * 16.5; // 16.5 avg minutes saved per autonomous ticket
    const savings = autonomous * (humanCostPerTicket - aiCostPerTicket);

    return {
      varr: 74.8,
      csatAverage: 91.4,
      slaAttainmentPct: 98.2,
      totalInteractions: total,
      autonomousResolved: autonomous,
      copilotAssisted: copilot,
      humanEscalated: human,
      avgResolutionTimeMins: 3.4,
      costPerResolutionHuman: humanCostPerTicket,
      costPerResolutionAI: aiCostPerTicket,
      humanMinutesSaved: Math.round(minutesSaved),
      totalCostSavings: Math.round(savings),
    };
  }

  public exportReportCsv(): string {
    const kpis = this.getScorecard();
    return `Metric,Value
Verified Autonomous Resolution Rate (VARR),${kpis.varr}%
Average CSAT,${kpis.csatAverage}%
SLA Attainment,${kpis.slaAttainmentPct}%
Total Interactions,${kpis.totalInteractions}
Autonomous Resolved,${kpis.autonomousResolved}
Copilot Assisted,${kpis.copilotAssisted}
Human Escalated,${kpis.humanEscalated}
Average Resolution Time,${kpis.avgResolutionTimeMins} mins
Human Minutes Saved,${kpis.humanMinutesSaved}
Total Operational Savings,$${kpis.totalCostSavings.toLocaleString()}
`;
  }
}

export const reportingService = new ReportingService();

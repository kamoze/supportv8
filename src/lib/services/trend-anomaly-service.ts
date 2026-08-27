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
  public getTrendSeries(): TrendDataPoint[] {
    return [
      { date: "Aug 20", totalVolume: 120, checkoutFailures: 14, ssoAuth: 8, billing: 25, mfaSms: 12, csat: 95.0, sentimentNegativePct: 12 },
      { date: "Aug 21", totalVolume: 135, checkoutFailures: 18, ssoAuth: 10, billing: 28, mfaSms: 15, csat: 94.5, sentimentNegativePct: 14 },
      { date: "Aug 22", totalVolume: 140, checkoutFailures: 16, ssoAuth: 12, billing: 30, mfaSms: 18, csat: 93.8, sentimentNegativePct: 16 },
      { date: "Aug 23", totalVolume: 180, checkoutFailures: 35, ssoAuth: 22, billing: 34, mfaSms: 45, csat: 91.2, sentimentNegativePct: 24 },
      { date: "Aug 24", totalVolume: 240, checkoutFailures: 68, ssoAuth: 30, billing: 40, mfaSms: 60, csat: 88.4, sentimentNegativePct: 32 },
      { date: "Aug 25", totalVolume: 290, checkoutFailures: 110, ssoAuth: 42, billing: 48, mfaSms: 72, csat: 84.1, sentimentNegativePct: 41 },
      { date: "Aug 26", totalVolume: 340, checkoutFailures: 187, ssoAuth: 64, billing: 52, mfaSms: 86, csat: 82.0, sentimentNegativePct: 48 },
    ];
  }

  public getAnomalies(): AnomalyAlert[] {
    return [
      {
        id: "anom_1",
        category: "Checkout Failures",
        changePct: 284,
        severity: "high",
        description: "Checkout failure volume is +284% over 7-day rolling baseline following release 4.18.2.",
        timestamp: "2026-08-26T04:30:00Z",
      },
      {
        id: "anom_2",
        category: "MFA Authentication",
        changePct: 217,
        severity: "medium",
        description: "MFA inquiries rose 217% due to FIDO2 hardware token migration inquiries.",
        timestamp: "2026-08-26T03:15:00Z",
      },
      {
        id: "anom_3",
        category: "Refund Re-open Rate",
        changePct: 180,
        severity: "medium",
        description: "AI-only refund conversations re-open 2.8x more frequently than human-handled refunds.",
        timestamp: "2026-08-26T02:00:00Z",
      },
    ];
  }
}

export const trendAnomalyService = new TrendAnomalyService();

import { NextResponse } from "next/server";
import { trendAnomalyService } from "@/lib/services/trend-anomaly-service";

export async function GET() {
  const series = trendAnomalyService.getTrendSeries();
  const anomalies = trendAnomalyService.getAnomalies();

  return NextResponse.json({
    success: true,
    data: {
      series,
      anomalies,
    },
  });
}

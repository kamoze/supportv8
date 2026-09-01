import { NextRequest, NextResponse } from "next/server";
import { trendAnomalyService } from "@/lib/services/trend-anomaly-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const series = trendAnomalyService.getTrendSeries(tenant);
  const anomalies = trendAnomalyService.getAnomalies(tenant);

  return NextResponse.json({
    success: true,
    data: {
      series,
      anomalies,
    },
  });
}

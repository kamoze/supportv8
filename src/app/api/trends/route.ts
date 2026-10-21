import { NextRequest, NextResponse } from "next/server";
import { trendAnomalyService } from "@/lib/services/trend-anomaly-service";
import {
  authorizeMvpRead,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeMvpRead(req);
    const series = trendAnomalyService.getTrendSeries(auth.tenantSlug);
    const anomalies = trendAnomalyService.getAnomalies(auth.tenantSlug);

    return NextResponse.json({
      success: true,
      data: {
        series,
        anomalies,
      },
    });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load trends" },
      { status: 500 }
    );
  }
}

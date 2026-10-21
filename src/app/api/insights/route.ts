import { NextRequest, NextResponse } from "next/server";
import { insightsService } from "@/lib/services/insights-service";
import {
  authorizeMvpRead,
  authorizeMvpManage,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeMvpRead(req);
    const insights = insightsService.getAll(auth.tenantSlug);
    return NextResponse.json({
      success: true,
      count: insights.length,
      data: insights,
    });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load insights" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeMvpManage(req);
    const body = await req.json();
    const { action, insightId, status } = body;

    if (action === "execute") {
      const result = await insightsService.executeInsightAction(insightId);
      return NextResponse.json(result);
    } else if (action === "update_status") {
      const insight = insightsService.updateStatus(insightId, status);
      return NextResponse.json({ success: true, data: insight });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Insight action failed" },
      { status: 400 }
    );
  }
}

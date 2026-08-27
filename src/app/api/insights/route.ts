import { NextRequest, NextResponse } from "next/server";
import { insightsService } from "@/lib/services/insights-service";

export async function GET() {
  const insights = insightsService.getAll();
  return NextResponse.json({
    success: true,
    count: insights.length,
    data: insights,
  });
}

export async function POST(req: NextRequest) {
  try {
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
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Insight action failed" },
      { status: 400 }
    );
  }
}

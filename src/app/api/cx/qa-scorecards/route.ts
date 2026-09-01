import { NextRequest, NextResponse } from "next/server";
import { qaSynthesizer } from "@/lib/services/qa-scorecard-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const metrics = qaSynthesizer.getQaMetrics(tenant);
  return NextResponse.json({
    success: true,
    data: metrics,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { conversationId, notes } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ success: false, error: "conversationId is required" }, { status: 400 });
    }

    const scorecard = qaSynthesizer.auditConversation(conversationId, notes);
    return NextResponse.json({
      success: true,
      message: `Conversation ${conversationId} audited. Overall QA Score: ${scorecard.overallScore}%`,
      data: scorecard,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "QA audit failed" },
      { status: 500 }
    );
  }
}

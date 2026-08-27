import { NextRequest, NextResponse } from "next/server";
import { slaEngine } from "@/lib/services/sla-engine-service";

export async function GET() {
  const overview = slaEngine.getSlaOverview();
  return NextResponse.json({
    success: true,
    data: overview,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { ticketId } = await req.json();
    if (!ticketId) {
      return NextResponse.json({ success: false, error: "ticketId is required" }, { status: 400 });
    }

    const result = slaEngine.escalateAtRiskTicket(ticketId);
    return NextResponse.json({
      success: true,
      message: result.message,
      data: result.ticket,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "SLA action failed" },
      { status: 500 }
    );
  }
}

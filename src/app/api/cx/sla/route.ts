import { NextRequest, NextResponse } from "next/server";
import { slaEngine } from "@/lib/services/sla-engine-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const overview = slaEngine.getSlaOverview(tenant);
  return NextResponse.json({
    success: true,
    data: overview,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketId, assignee, assigneeType, escalationReason, priority } = body;
    if (!ticketId) {
      return NextResponse.json({ success: false, error: "ticketId is required" }, { status: 400 });
    }

    const result = slaEngine.escalateAtRiskTicket({
      ticketId,
      assignee,
      assigneeType,
      escalationReason,
      priority,
    });

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

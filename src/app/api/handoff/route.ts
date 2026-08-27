import { NextRequest, NextResponse } from "next/server";
import { verticalHandoff, type HandoffPayload } from "@/lib/verticals/handoff";
import { db } from "@/lib/db/mock-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { targetVertical, customerRef, issueId, problemId, summary, requestedAction } = body;

    const payload: HandoffPayload = {
      sourceVertical: "supportv8",
      targetVertical: targetVertical || "orderv8",
      tenantId: db.tenant.tenantId,
      customerRef: customerRef || "C-1920",
      issueId,
      problemId,
      summary: summary || "Customer issue transferred from supportV8",
      requestedAction,
      authUserId: "usr_agent_01",
      timestamp: new Date().toISOString(),
    };

    const handoff = verticalHandoff.createHandoffToken(payload);

    return NextResponse.json({
      success: true,
      data: handoff,
      payload,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Handoff failed" },
      { status: 400 }
    );
  }
}

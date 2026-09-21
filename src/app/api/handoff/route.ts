import { NextRequest, NextResponse } from "next/server";
import { verticalHandoff, type HandoffPayload } from "@/lib/verticals/handoff";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { db } from "@/lib/db/mock-data";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Accept an incoming handoff token or payload
    if (body.action === "accept" || (body.token && !body.targetVertical)) {
      const tokenOrPayload = body.token || body.payload || body;
      const accepted = verticalHandoff.acceptHandoff(tokenOrPayload);
      return NextResponse.json({
        success: true,
        message: "Handoff accepted and bound apps linked to shared credit pool",
        data: accepted.payload,
        sharedCredits: accepted.sharedCredits,
        boundApps: accepted.boundApps,
      });
    }

    // 2. Create an outbound or cross-vertical handoff
    const {
      sourceVertical = "supportv8",
      targetVertical = "orderv8",
      customerRef = "C-1920",
      issueId,
      problemId,
      summary,
      requestedAction,
      accountId,
      boundApps,
      planId,
    } = body;

    const payload: HandoffPayload = {
      sourceVertical,
      targetVertical,
      tenantId: body.tenantId || db.tenant.tenantId,
      accountId,
      boundApps,
      planId,
      customerRef,
      issueId,
      problemId,
      summary: summary || `Customer issue transferred from ${sourceVertical}`,
      requestedAction,
      authUserId: body.authUserId || "usr_agent_01",
      timestamp: new Date().toISOString(),
    };

    const handoff = verticalHandoff.createHandoffToken(payload);

    return NextResponse.json({
      success: true,
      data: handoff,
      payload: handoff.payload,
      sharedCredits: handoff.sharedCredits,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Handoff failed" },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const token = searchParams.get("token");
    const payloadParam = searchParams.get("payload");
    const accountId = searchParams.get("accountId");

    if (token || payloadParam) {
      const accepted = verticalHandoff.acceptHandoff(payloadParam || token!);
      return NextResponse.json({
        success: true,
        data: accepted.payload,
        sharedCredits: accepted.sharedCredits,
        boundApps: accepted.boundApps,
      });
    }

    if (accountId) {
      return NextResponse.json({
        success: true,
        data: {
          accountId,
          boundApps: marketplaceService.getBoundApps(accountId),
          sharedCredits: marketplaceService.getCredits(undefined, { accountId }),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Missing token or accountId parameter" },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Handoff query failed" },
      { status: 400 }
    );
  }
}

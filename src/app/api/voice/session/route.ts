import { NextRequest, NextResponse } from "next/server";
import { voiceService } from "@/lib/voice/voice-service";
import { db } from "@/lib/db/mock-data";

export async function GET() {
  const phoneConfigs = voiceService.getPhoneConfigs(db.tenant.tenantId);
  const sessions = voiceService.getSessions(db.tenant.tenantId);

  return NextResponse.json({
    success: true,
    data: {
      phoneConfigs,
      sessions,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider = "vapi", callerNumber, callerName, verificationLevel, customerTier } = body;

    if (!callerNumber) {
      return NextResponse.json({ success: false, error: "callerNumber is required" }, { status: 400 });
    }

    const result = await voiceService.startSession({
      tenantId: db.tenant.tenantId,
      provider,
      callerNumber,
      callerName,
      verificationLevel,
      customerTier,
    });

    return NextResponse.json({
      success: true,
      message: `Voice session started on ${provider.toUpperCase()}`,
      data: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Voice session failed" },
      { status: 500 }
    );
  }
}

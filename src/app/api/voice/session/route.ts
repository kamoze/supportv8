import { NextRequest, NextResponse } from "next/server";
import { voiceService } from "@/lib/voice/voice-service";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";

function voiceError(error: unknown) {
  if (error instanceof RequestAuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json({ success: false, error: "Voice service request failed" }, { status: 500 });
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    const phoneConfigs = voiceService.getPhoneConfigs(tenant.tenantId);
    const sessions = voiceService.getSessions(tenant.tenantId);

    return NextResponse.json({
      success: true,
      data: {
        phoneConfigs,
        sessions,
      },
    });
  } catch (error) {
    return voiceError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    const body = await req.json();
    const { provider = "vapi", callerNumber, callerName, verificationLevel, customerTier } = body;

    if (!callerNumber) {
      return NextResponse.json({ success: false, error: "callerNumber is required" }, { status: 400 });
    }

    const result = await voiceService.startSession({
      tenantId: tenant.tenantId,
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
  } catch (error) {
    return voiceError(error);
  }
}

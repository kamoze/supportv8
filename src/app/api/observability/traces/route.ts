import { NextResponse } from "next/server";
import { ChatbotTelemetry } from "@/lib/chatbot/observability/telemetry";
import {
  authorizeMvpRead,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";

export async function GET(request: Request) {
  try {
    const auth = await authorizeMvpRead(request);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") || undefined;

    const traces = ChatbotTelemetry.getTraces({ tenantId: auth.tenantId, sessionId });
    const metrics = ChatbotTelemetry.getMetricsSummary();

    return NextResponse.json({
      success: true,
      metrics,
      traces: traces.slice(0, 50),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load traces" },
      { status: 500 }
    );
  }
}

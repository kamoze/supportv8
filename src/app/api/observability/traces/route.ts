import { NextResponse } from "next/server";
import { ChatbotTelemetry } from "@/lib/chatbot/observability/telemetry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId") || undefined;
  const sessionId = searchParams.get("sessionId") || undefined;

  const traces = ChatbotTelemetry.getTraces({ tenantId, sessionId });
  const metrics = ChatbotTelemetry.getMetricsSummary();

  return NextResponse.json({
    success: true,
    metrics,
    traces: traces.slice(0, 50),
    timestamp: new Date().toISOString(),
  });
}

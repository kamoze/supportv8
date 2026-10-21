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
    const correlationId = searchParams.get("correlationId") || undefined;

    const traces = ChatbotTelemetry.getTraces({
      tenantId: auth.tenantId,
      sessionId,
      correlationId,
    });
    const metrics = ChatbotTelemetry.getMetricsSummary(auth.tenantId);

    // Sanitize output traces to ensure zero raw interaction or credential leakage
    const safeTraces = traces.slice(0, 50).map((t) => ({
      traceId: t.traceId,
      spanId: t.spanId,
      sessionId: t.sessionId,
      tenantId: t.tenantId,
      correlationId: t.correlationId,
      operation: t.operation || "chat_completion",
      channel: t.channel,
      model: t.model,
      promptTokens: t.promptTokens,
      completionTokens: t.completionTokens,
      totalTokens: t.totalTokens,
      costUsd: t.costUsd,
      latencyMs: t.latencyMs,
      durationMs: t.durationMs ?? t.latencyMs,
      outcome: t.outcome ?? (t.errorCode ? "error" : "success"),
      errorCode: t.errorCode,
      guardrailTriggered: t.guardrailTriggered,
      toolsInvoked: t.toolsInvoked,
      timestamp: t.timestamp,
    }));

    return NextResponse.json({
      success: true,
      metrics,
      traces: safeTraces,
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

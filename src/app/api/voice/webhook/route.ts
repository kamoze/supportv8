import { NextRequest, NextResponse } from "next/server";
import { voiceService } from "@/lib/voice/voice-service";
import { verifyVoiceContextToken } from "@/lib/voice/context-token";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-voice-context-token") || "";
    const tokenPayload = verifyVoiceContextToken(authHeader);

    const body = await req.json();
    const { event, sessionId, toolName, input } = body;

    if (event === "tool_call" || toolName) {
      const activeSessionId = sessionId || tokenPayload?.sessionId;
      if (!activeSessionId) {
        return NextResponse.json({ success: false, error: "sessionId required for voice tool call" }, { status: 400 });
      }

      const result = await voiceService.executeVoiceTool({
        sessionId: activeSessionId,
        toolName,
        input: input || {},
      });

      return NextResponse.json({
        success: true,
        data: result.data,
        latencyMs: result.latencyMs,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Voice event '${event || "ping"}' handled.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Voice webhook error" },
      { status: 500 }
    );
  }
}

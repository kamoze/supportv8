import { NextResponse } from "next/server";
import { ChannelAdapters } from "@/lib/chatbot/experience/channel-adapters";
import { AgentRuntimeCore } from "@/lib/chatbot/agent-runtime/agent-runtime-core";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";

// Webhook verification endpoint (GET) for Meta WhatsApp Business
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "servicev8_whatsapp_token";

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// Inbound message webhook (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = ChannelAdapters.normalizeWhatsApp(body);

    if (!payload) {
      return NextResponse.json({ status: "ignored_non_message_event" });
    }

    const tenant = await resolveRequestTenant(request);
    payload.tenantId = tenant.tenantId;

    const result = await AgentRuntimeCore.processMessage(payload);
    const outboundFormatted = ChannelAdapters.formatOutbound("whatsapp", result.responseContent);

    return NextResponse.json({
      success: true,
      channel: "whatsapp",
      recipient: payload.senderPhone,
      replyContent: outboundFormatted,
      isEscalated: result.isEscalated,
    });
  } catch (err: unknown) {
    const status = err instanceof RequestAuthError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "WhatsApp processing error" },
      { status }
    );
  }
}

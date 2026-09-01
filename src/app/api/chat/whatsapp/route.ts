import { NextResponse } from "next/server";
import { ChannelAdapters } from "@/lib/chatbot/experience/channel-adapters";
import { AgentRuntimeCore } from "@/lib/chatbot/agent-runtime/agent-runtime-core";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  ChatIngressError,
  requireBoundedContentLength,
  requireBoundedRawBody,
  requireChatChannelEnabled,
  verifyMetaWebhookSignature,
  verifyWebhookToken,
} from "@/lib/chatbot/security/ingress-security";

function ingressError(error: unknown, fallback: string) {
  const status =
    error instanceof ChatIngressError || error instanceof RequestAuthError
      ? error.status
      : 500;
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status }
  );
}

// Webhook verification endpoint (GET) for Meta WhatsApp Business
export async function GET(request: Request) {
  try {
    requireChatChannelEnabled("whatsapp");
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!verifyToken) {
      throw new ChatIngressError("WhatsApp ingress is not configured", 503);
    }
    if (mode === "subscribe" && challenge && verifyWebhookToken(token, verifyToken)) {
      return new Response(challenge, { status: 200 });
    }
    throw new ChatIngressError("Verification failed", 403);
  } catch (error) {
    return ingressError(error, "WhatsApp verification error");
  }
}

// Inbound message webhook (POST)
export async function POST(request: Request) {
  try {
    requireChatChannelEnabled("whatsapp");
    requireBoundedContentLength(request.headers.get("content-length"));
    const rawBody = await request.text();
    requireBoundedRawBody(rawBody);
    if (
      !verifyMetaWebhookSignature(
        rawBody,
        request.headers.get("x-hub-signature-256"),
        process.env.WHATSAPP_APP_SECRET
      )
    ) {
      throw new ChatIngressError("Invalid webhook signature", 401);
    }

    let body: Parameters<typeof ChannelAdapters.normalizeWhatsApp>[0];
    try {
      body = JSON.parse(rawBody) as Parameters<typeof ChannelAdapters.normalizeWhatsApp>[0];
    } catch {
      throw new ChatIngressError("Invalid webhook payload", 400);
    }
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
    return ingressError(err, "WhatsApp processing error");
  }
}

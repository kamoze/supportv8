import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@/lib/db/chat-repository";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  ChatIngressError,
  requireChatOperatorRole,
} from "@/lib/chatbot/security/ingress-security";
import { randomUUID } from "node:crypto";
import { sendMessagingEmailReply } from "@/lib/messaging/email-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, sender = "customer", content, clientMessageId } = body;

    if (!sessionId || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Missing sessionId or content" }, { status: 400 });
    }
    if (sender !== "customer" && sender !== "agent") {
      return NextResponse.json({ error: "Invalid message sender" }, { status: 400 });
    }

    const tenant = await resolveRequestTenant(request, {
      requireAuthentication: sender === "agent",
    });
    if (sender === "agent") requireChatOperatorRole(tenant);
    const effectiveMessageId = typeof clientMessageId === "string" && /^msg_[a-zA-Z0-9_-]{8,120}$/.test(clientMessageId.trim())
      ? clientMessageId.trim()
      : `msg_${randomUUID().replace(/-/g, "")}`;
    const emailContext = sender === "agent" && chatRepository.getEmailDeliveryContext
      ? await chatRepository.getEmailDeliveryContext(tenant.tenantId, sessionId)
      : null;
    if (emailContext) {
      await sendMessagingEmailReply({ accountId: emailContext.accountId, tenantId: tenant.tenantId, conversationId: emailContext.messagingConversationId, content, idempotencyKey: `supportv8:${tenant.tenantId}:${effectiveMessageId}` });
    }
    const result = await chatRepository.sendMessage({
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      sessionId,
      sender,
      senderName: sender === "agent" ? tenant.displayName || "Support Operator" : undefined,
      senderId: sender === "agent" ? tenant.userId : undefined,
      content,
      clientMessageId: effectiveMessageId,
    });
    if (emailContext && sender === "agent") {
      await chatRepository.recordEmailJourney({ tenantId: tenant.tenantId, sessionId, eventId: effectiveMessageId, direction: "outbound", actor: tenant.displayName || "Support Operator", details: "Reply sent through the customer email thread" });
    }

    return NextResponse.json({
      success: true,
      ...result,
      nextCursor: result.session.nextCursor,
    });
  } catch (error) {
    if (error instanceof ChatIngressError || error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to post message";
    return NextResponse.json(
      { error: message },
      { status: message === "Chat session not found" ? 404 : 500 }
    );
  }
}

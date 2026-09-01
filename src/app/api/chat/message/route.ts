import { NextRequest, NextResponse } from "next/server";
import { chatRepository } from "@/lib/db/chat-repository";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import {
  ChatIngressError,
  requireChatOperatorRole,
} from "@/lib/chatbot/security/ingress-security";

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
    const result = await chatRepository.sendMessage({
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      sessionId,
      sender,
      senderName: sender === "agent" ? tenant.username || "Support Operator" : undefined,
      senderId: sender === "agent" ? tenant.userId : undefined,
      content,
      clientMessageId: typeof clientMessageId === "string" ? clientMessageId : undefined,
    });

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

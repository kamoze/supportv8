import { NextResponse } from "next/server";
import { ChannelAdapters } from "@/lib/chatbot/experience/channel-adapters";
import { AgentRuntimeCore } from "@/lib/chatbot/agent-runtime/agent-runtime-core";

// Inbound email processing webhook (e.g. from SendGrid, Postmark, AWS SES)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { from, to, subject, textBody, messageId } = body;

    if (!from || !textBody) {
      return NextResponse.json({ error: "from and textBody are required" }, { status: 400 });
    }

    const payload = ChannelAdapters.normalizeEmail({
      from,
      to: to || "support@servicev8.com",
      subject: subject || "Support Request",
      textBody,
      messageId,
    });

    const result = await AgentRuntimeCore.processMessage(payload);
    const outboundFormatted = ChannelAdapters.formatOutbound("email", result.responseContent, result.citations);

    return NextResponse.json({
      success: true,
      channel: "email",
      replyTo: payload.senderEmail,
      subject: `Re: ${subject || "Support Request"}`,
      body: outboundFormatted,
      isEscalated: result.isEscalated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Email processing error" }, { status: 500 });
  }
}

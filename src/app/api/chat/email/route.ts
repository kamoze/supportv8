import { NextResponse } from "next/server";
import {
  ChatIngressError,
  requireChatChannelEnabled,
} from "@/lib/chatbot/security/ingress-security";

// Inbound email processing webhook (e.g. from SendGrid, Postmark, AWS SES)
export async function POST(_request: Request) {
  try {
    requireChatChannelEnabled("email");
    // Inbound email providers do not share one signature scheme. Keep this
    // endpoint closed until the selected provider has a concrete verifier.
    throw new ChatIngressError("Verified email ingress is not configured", 503);
  } catch (err: unknown) {
    const status = err instanceof ChatIngressError ? err.status : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Email processing error" },
      { status }
    );
  }
}

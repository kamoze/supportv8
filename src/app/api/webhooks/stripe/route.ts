import { NextRequest, NextResponse } from "next/server";
import { stripeConnector } from "@/lib/connectors/stripe-connector";

export async function GET() {
  const status = stripeConnector.getStatus();
  return NextResponse.json({
    status: "active",
    service: "supportV8 Stripe Webhook Ingress Listener",
    endpoint: "/api/webhooks/stripe",
    mode: status.mode,
    configured: status.configured,
    eventsProcessedToday: status.eventsProcessedToday,
    supportedEvents: status.supportedEvents,
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get("stripe-signature");

    // Cryptographic validation of webhook payload
    const isValid = stripeConnector.verifyWebhookSignature(rawBody, signatureHeader);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid Stripe webhook signature" },
        { status: 400 }
      );
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON webhook payload" },
        { status: 400 }
      );
    }

    // Process event into SupportV8 ticket queue & correlation engine
    const result = await stripeConnector.processWebhookEvent(event);

    return NextResponse.json({
      received: true,
      result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        received: false,
        error: err instanceof Error ? err.message : "Failed to process Stripe webhook",
      },
      { status: 500 }
    );
  }
}

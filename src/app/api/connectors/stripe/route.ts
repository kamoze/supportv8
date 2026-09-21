import { NextRequest, NextResponse } from "next/server";
import { stripeConnector } from "@/lib/connectors/stripe-connector";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  const customerId = searchParams.get("id");

  const status = stripeConnector.getStatus();

  if (email || customerId) {
    const customer = await stripeConnector.lookupCustomer(email || customerId || "");
    return NextResponse.json({
      success: true,
      status,
      customer,
    });
  }

  return NextResponse.json({
    success: true,
    status,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "test_connection", payload = {} } = body;

    if (action === "test_connection") {
      const result = await stripeConnector.testConnection();
      return NextResponse.json({
        success: result.success,
        message: result.message,
        result,
        data: result,
      });
    }

    if (action === "process_refund") {
      const result = await stripeConnector.processRefund({
        chargeId: payload.chargeId,
        paymentIntentId: payload.paymentIntentId,
        orderId: payload.orderId,
        amount: parseFloat(payload.amount) || 49.0,
        reason: payload.reason,
        ticketId: payload.ticketId,
      });

      return NextResponse.json({
        success: result.success,
        message: result.message,
        result,
        data: result,
      });
    }

    if (action === "simulate_event") {
      const eventType = payload.type || "charge.failed";
      const sampleEvent = {
        id: `evt_sim_${Date.now()}`,
        type: eventType,
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: `ch_sim_${Date.now()}`,
            amount: Math.round((payload.amount || 79.0) * 100),
            currency: "usd",
            customer: payload.customerId || "cus_sim_88120",
            customer_name: payload.customerName || "Elena Rostova (VIP)",
            billing_details: {
              name: payload.customerName || "Elena Rostova (VIP)",
              email: payload.customerEmail || "elena@biohealth.org",
            },
            failure_message: payload.failureMessage || "Transaction declined: Insufficient funds or velocity check triggered.",
            failure_code: payload.failureCode || "card_declined",
            reason: payload.disputeReason || "fraudulent",
          },
        },
      };

      const result = await stripeConnector.processWebhookEvent(sampleEvent);
      return NextResponse.json({
        success: result.success,
        message: result.message,
        result,
        data: result,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unsupported action: ${action}` },
      { status: 400 }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Stripe connector request failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";
import { interactionGateway } from "@/lib/services/interaction-gateway";
import { issueService } from "@/lib/services/issue-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const tenantData = db.getTenantData(tenant);
  return NextResponse.json({
    success: true,
    count: tenantData.sources.length,
    data: tenantData.sources,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, sourceId, eventPayload } = body;

    if (action === "test_webhook") {
      // Simulate ingress through Interaction Gateway
      const normEvent = interactionGateway.normalize({
        tenantId: db.tenant.tenantId,
        source: eventPayload.source || "zendesk",
        sourceRef: eventPayload.sourceRef || `ZD-${Date.now().toString().slice(-6)}`,
        customerRef: eventPayload.customerRef || "C-9900",
        text: eventPayload.text || "Checkout page spinning indefinitely on submit",
        sender: "customer",
      });

      // Create derived issue
      const issue = issueService.createFromInteraction({
        source: normEvent.source,
        externalId: normEvent.source_reference,
        customerRef: normEvent.customer_reference,
        customerName: eventPayload.customerName || "Simulated Customer",
        customerTier: eventPayload.customerTier || "pro",
        text: normEvent.content.text,
      });

      return NextResponse.json({
        success: true,
        message: "Webhook event normalized and derived Issue created.",
        normalizedEvent: normEvent,
        createdIssue: issue,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Source action failed" },
      { status: 400 }
    );
  }
}

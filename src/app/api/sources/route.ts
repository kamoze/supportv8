import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { pgClient } from "@/lib/db/pg-client";
import { issueService } from "@/lib/services/issue-service";
import {
  authorizeMvpRead,
  authorizeMvpManage,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";
import type { NormalizedInteractionInput, SourceConnector, SourceType } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeMvpRead(req);
    const tenantId = auth.tenantId;

    const sources: SourceConnector[] = await pgClient.withTenantSession(
      tenantId,
      async (session) => {
        const rows = await session.query<any>(
          `SELECT id, provider, connector_key, base_url, status, last_event_at
           FROM supportv8.source_connections
           WHERE tenant_id = $1`,
          [tenantId]
        );

        return rows.map((row) => ({
          id: row.id,
          name: row.provider === "zendesk" ? "Zendesk Support" : row.connector_key,
          type: (row.provider || "zendesk") as SourceType,
          status:
            row.status === "connected"
              ? "connected"
              : row.status === "degraded"
              ? "degraded"
              : "disconnected",
          lastSync: row.last_event_at
            ? (row.last_event_at instanceof Date
                ? row.last_event_at.toISOString()
                : String(row.last_event_at))
            : new Date().toISOString(),
          eventCountToday: 0,
          capabilities: {
            read: ["tickets", "comments", "users"],
            realtime: ["webhooks"],
            write: ["internal_notes", "tags"],
          },
          credentialsConfigured: true,
          endpointUrl: row.base_url || "",
        }));
      }
    );

    return NextResponse.json({
      success: true,
      count: sources.length,
      data: sources,
    });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load sources" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeMvpManage(req);
    const body = await req.json();
    const { action, eventPayload } = body;

    if (action === "test_webhook") {
      const source = eventPayload?.source || "zendesk";
      const sourceRef = eventPayload?.sourceRef || `ZD-${Date.now().toString().slice(-6)}`;
      const customerRef = eventPayload?.customerRef || "C-9900";
      const text = eventPayload?.text || "Checkout page spinning indefinitely on submit";
      const customerName = eventPayload?.customerName || "Simulated Customer";
      const customerTier = eventPayload?.customerTier || "pro";

      const normalizedInput: NormalizedInteractionInput = {
        eventId: `evt_${crypto.randomUUID().slice(0, 12)}`,
        tenantId: auth.tenantId,
        accountId: auth.accountId || "acc_default",
        connectionId: "conn_webhook_sim",
        connectorKey: source,
        source: source as "zendesk",
        sourceReference: sourceRef,
        customerReference: customerRef,
        sourceUrl: `https://${auth.tenantSlug}.zendesk.com/agent/tickets/${sourceRef}`,
        text,
        sender: "customer",
        occurredAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        correlationId: `corr_${crypto.randomUUID().slice(0, 8)}`,
        raw: {
          customerName,
          customerTier,
        },
      };

      const issue = await issueService.createFromInteraction(auth.tenantId, normalizedInput);

      return NextResponse.json({
        success: true,
        message: "Webhook event normalized and derived Issue created.",
        normalizedEvent: normalizedInput,
        createdIssue: issue,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Source action failed" },
      { status: 400 }
    );
  }
}

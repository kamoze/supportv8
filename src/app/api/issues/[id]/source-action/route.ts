import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  authorizeMvpManage,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";
import { issueService } from "@/lib/services/issue-service";
import { pgSupportIntelligenceRepository } from "@/lib/db/support-intelligence-repository";
import { actionGatewayHttpClient } from "@/lib/runtime/action-gateway-http-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  let auth;
  try {
    auth = await authorizeMvpManage(request);
  } catch (err) {
    const res = requestAuthResponse(err);
    if (res) return res;
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await Promise.resolve(params);
  if (!id) {
    return NextResponse.json({ success: false, error: "Issue ID is required" }, { status: 400 });
  }

  // 1. Load the Issue strictly within the authenticated tenant
  const issue = await issueService.getById(id, auth.tenantId);
  if (!issue || issue.tenantId !== auth.tenantId) {
    return NextResponse.json({ success: false, error: "Issue not found" }, { status: 404 });
  }

  // 2. Require source === "zendesk"
  if (issue.source !== "zendesk") {
    return NextResponse.json(
      { success: false, error: "Write-back is only supported for Zendesk issues" },
      { status: 400 }
    );
  }

  // 3. Derive provider ticket ID from externalId
  const ticketId = issue.externalId.replace(/^ZD-/, "").trim();
  if (!ticketId) {
    return NextResponse.json(
      { success: false, error: "Issue does not have a valid provider ticket identifier" },
      { status: 400 }
    );
  }

  // 4. Parse request body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body?.action;
  if (action !== "update" && action !== "close") {
    return NextResponse.json(
      { success: false, error: "Invalid action: must be 'update' or 'close'" },
      { status: 400 }
    );
  }

  if (action === "close") {
    if (typeof body.resolutionSummary !== "string" || !body.resolutionSummary.trim()) {
      return NextResponse.json(
        { success: false, error: "resolutionSummary is required to close an issue" },
        { status: 400 }
      );
    }
  } else {
    const validStatuses = ["open", "pending", "solved"];
    const validPriorities = ["low", "normal", "high", "urgent"];
    if (body.status !== undefined && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status: must be one of ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }
    if (body.priority !== undefined && !validPriorities.includes(body.priority)) {
      return NextResponse.json(
        { success: false, error: `Invalid priority: must be one of ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }
    if (!body.status && !body.priority && !body.internalNote) {
      return NextResponse.json(
        { success: false, error: "update requires at least one of status, priority, or internalNote" },
        { status: 400 }
      );
    }
  }

  // 5. Enforce operating mode
  const policy = await pgSupportIntelligenceRepository.getTenantPolicy(auth.tenantId);
  const currentMode = policy?.mode || "observe";

  if (currentMode === "observe") {
    return NextResponse.json(
      { success: false, error: "Mutation rejected: tenant is in observe mode" },
      { status: 403 }
    );
  }

  let actor: { id: string; type: "human" | "ai_employee"; name: string };
  let policyDecision: { id: string; mode: "observe" | "copilot" | "autonomous"; decision: "allow" };

  if (currentMode === "copilot") {
    actor = {
      id: auth.userId || "operator_human",
      type: "human",
      name: auth.username || auth.displayName || "Operator",
    };
    policyDecision = {
      id: `pol_dec_${Date.now()}`,
      mode: "copilot",
      decision: "allow",
    };
  } else if (currentMode === "autonomous") {
    const isSystemAutonomous = request.headers.get("x-servicev8-autonomous-actor") === "true";
    if (!isSystemAutonomous) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Autonomous execution cannot be initiated directly by client browser without system workflow actor",
        },
        { status: 403 }
      );
    }
    actor = {
      id: "emp_support_lead",
      type: "ai_employee",
      name: "Support Intelligence Lead",
    };
    policyDecision = {
      id: `pol_dec_auto_${Date.now()}`,
      mode: "autonomous",
      decision: "allow",
    };
  } else {
    return NextResponse.json(
      { success: false, error: `Unsupported operating mode: ${currentMode}` },
      { status: 403 }
    );
  }

  // 6. Resolve connected source
  const connection = await pgSupportIntelligenceRepository.getSourceConnection(auth.tenantId, "zendesk");
  if (!connection || connection.status !== "connected") {
    return NextResponse.json(
      { success: false, error: "Tenant does not have an active connected Zendesk source" },
      { status: 409 }
    );
  }

  // 7. Deterministic idempotency key
  const canonicalPayload: Record<string, unknown> =
    action === "close"
      ? { resolutionSummary: body.resolutionSummary.trim(), ticketId }
      : {
          internalNote: body.internalNote || undefined,
          priority: body.priority || undefined,
          status: body.status || undefined,
          ticketId,
        };

  const sortedKeys = Object.keys(canonicalPayload).sort();
  const sortedPayload: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    if (canonicalPayload[k] !== undefined) {
      sortedPayload[k] = canonicalPayload[k];
    }
  }

  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(sortedPayload)).digest("hex");
  const idempotencyKey = `supportv8:${auth.tenantId}:${id}:${action}:${payloadHash}`;

  // Check client-supplied idempotency key conflict if present
  const clientSuppliedKey = request.headers.get("x-idempotency-key");
  if (clientSuppliedKey) {
    const existingForClientKey = await pgSupportIntelligenceRepository.getActionReceipt(
      auth.tenantId,
      clientSuppliedKey
    );
    if (existingForClientKey) {
      const existingStr = JSON.stringify(existingForClientKey.payload || {});
      const currentStr = JSON.stringify(sortedPayload);
      if (existingStr !== currentStr) {
        return NextResponse.json(
          { success: false, error: "Idempotency key reused with different payload" },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true, replayed: true, receipt: existingForClientKey });
    }
  }

  // Check deterministic idempotency key replay
  const existingReceipt = await pgSupportIntelligenceRepository.getActionReceipt(auth.tenantId, idempotencyKey);
  if (existingReceipt) {
    return NextResponse.json({ success: true, replayed: true, receipt: existingReceipt });
  }

  // 8. Submit mutation to Action Gateway
  const capability = action === "close" ? "support.ticket.close" : "support.ticket.update";
  const gatewayPayload =
    action === "close"
      ? { ticketId, resolutionSummary: body.resolutionSummary.trim() }
      : {
          ticketId,
          ...(body.status ? { status: body.status } : {}),
          ...(body.priority ? { priority: body.priority } : {}),
          ...(body.internalNote ? { internalNote: body.internalNote } : {}),
        };

  let gatewayResult;
  try {
    gatewayResult = await actionGatewayHttpClient.execute({
      accountId: connection.accountId,
      tenantId: auth.tenantId,
      capability,
      connectorKey: connection.connectorKey,
      idempotencyKey,
      actor,
      policyDecision,
      payload: gatewayPayload,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Action Gateway execution failed: ${err.message}` },
      { status: 502 }
    );
  }

  if (gatewayResult.status === "failed") {
    // Record failed receipt, but do NOT change local Issue state
    const failedReceipt = await pgSupportIntelligenceRepository.recordActionReceipt({
      tenantId: auth.tenantId,
      idempotencyKey,
      action,
      capability,
      issueId: id,
      actionExecutionId: gatewayResult.id,
      status: "failed",
      actor,
      payload: gatewayPayload,
      result: gatewayResult.result,
    });
    return NextResponse.json(
      {
        success: false,
        error: gatewayResult.error || "Action execution failed in provider",
        receipt: failedReceipt,
      },
      { status: 502 }
    );
  }

  // 9. On Gateway success: Record receipt and update local Issue state in PostgreSQL
  const receipt = await pgSupportIntelligenceRepository.recordActionReceipt({
    tenantId: auth.tenantId,
    idempotencyKey,
    action,
    capability,
    issueId: id,
    actionExecutionId: gatewayResult.id,
    status: gatewayResult.status || "completed",
    actor,
    payload: gatewayPayload,
    result: gatewayResult.result,
  });

  if (action === "close") {
    await issueService.update(
      id,
      {
        sourceStatus: "solved",
        status: "resolved",
      },
      auth.tenantId
    );
  } else if (action === "update") {
    const updates: any = {};
    if (body.status) updates.sourceStatus = body.status;
    if (body.priority) updates.priority = body.priority;
    if (Object.keys(updates).length > 0) {
      await issueService.update(id, updates, auth.tenantId);
    }
  }

  return NextResponse.json({
    success: true,
    replayed: false,
    receipt,
  });
}

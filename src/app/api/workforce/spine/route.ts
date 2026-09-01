import { NextRequest, NextResponse } from "next/server";
import { WorkforceSpine } from "@/lib/workforce-spine/orchestrator";
import { WorkforceGovernance } from "@/lib/workforce-spine/governance";
import { WarmVoiceTransferEngine } from "@/lib/workforce-spine/voice-transfer";
import { marketplaceService } from "@/lib/services/marketplace-service";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";

function workforceError(error: unknown) {
  if (error instanceof RequestAuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json({ success: false, error: "Workforce Spine request failed" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(request, { requireAuthentication: true });
    const isDemoTenant = tenant.tenantSlug === "acme" || tenant.tenantSlug === "meridian";
    const employees = isDemoTenant
      ? ["employee_sophia", "employee_alex", "employee_barnaby"].map((employeeId) => {
          const employee = WorkforceGovernance.getEmployee(employeeId);
          return {
            ...employee,
            quotaUtilizationPercent: parseFloat(((employee.tokensConsumed / employee.tokenMonthlyQuota) * 100).toFixed(1)),
          };
        })
      : [];

    return NextResponse.json({
      success: true,
      spine: "ServiceV8 Workforce Spine",
      architecture: {
        pillar1: "Identity & Governance (Personas, Quotas, Autonomy)",
        pillar2: "Temporal State & Execution Engine",
        pillar3: "Omnichannel Ingress & Warm Voice Transfer",
        pillar4: "Tool Execution & KnowledgeV8 Bi-Directional Audit Sync",
      },
      employees,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return workforceError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(request, { requireAuthentication: true });
    const body = await request.json();
    const { actionType, payload, employeeId } = body;
    const isDemoTenant = tenant.tenantSlug === "acme" || tenant.tenantSlug === "meridian";
    const hiredEmployee = marketplaceService
      .getWorkforceCatalog(tenant.tenantSlug)
      .some((employee) => employee.isHired && employee.id === employeeId);
    if (!isDemoTenant && !hiredEmployee) {
      return NextResponse.json(
        { success: false, error: "No AI employee is hired for this workspace." },
        { status: 409 },
      );
    }

    if (actionType === "warm_voice_transfer") {
      const packet = WarmVoiceTransferEngine.buildTransferPacket({
        callSid: payload.callSid || `call_${Date.now()}`,
        callerNumber: payload.callerNumber || "+18005550199",
        customerName: payload.customerName || "Elena Rostova",
        employeeId: employeeId || "human_support_queue",
        sentimentScore: payload.sentimentScore || 0.42,
        issueSummary: payload.issueSummary || "Customer billing dispute",
        suggestedAction: payload.suggestedAction || "Issue $150 credit voucher",
      });
      return NextResponse.json({ success: true, mode: "warm_voice_transfer", packet });
    }

    const actionResult = await WorkforceSpine.orchestrateAction({
      actionId: `act_spine_${Date.now()}`,
      tenantId: tenant.tenantId,
      employeeId: employeeId || "human_support_queue",
      stream: payload.stream || "customers",
      operation: payload.operation || "orderv8.refund",
      payload: payload.data || { amountUsd: 150.0 },
    });

    return NextResponse.json({ success: true, mode: "workforce_action_orchestrated", actionResult });
  } catch (error) {
    return workforceError(error);
  }
}

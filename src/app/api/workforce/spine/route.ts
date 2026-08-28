import { NextResponse } from "next/server";
import { WorkforceSpine } from "@/lib/workforce-spine/orchestrator";
import { WorkforceGovernance } from "@/lib/workforce-spine/governance";
import { WarmVoiceTransferEngine } from "@/lib/workforce-spine/voice-transfer";

export async function GET() {
  const sophia = WorkforceGovernance.getEmployee("employee_sophia");
  const alex = WorkforceGovernance.getEmployee("employee_alex");
  const barnaby = WorkforceGovernance.getEmployee("employee_barnaby");

  return NextResponse.json({
    success: true,
    spine: "ServiceV8 Workforce Spine",
    architecture: {
      pillar1: "Identity & Governance (Personas, Quotas, Autonomy)",
      pillar2: "Temporal State & Execution Engine",
      pillar3: "Omnichannel Ingress & Warm Voice Transfer",
      pillar4: "Tool Execution & KnowledgeV8 Bi-Directional Audit Sync",
    },
    employees: [
      {
        ...sophia,
        quotaUtilizationPercent: parseFloat(((sophia.tokensConsumed / sophia.tokenMonthlyQuota) * 100).toFixed(1)),
      },
      {
        ...alex,
        quotaUtilizationPercent: parseFloat(((alex.tokensConsumed / alex.tokenMonthlyQuota) * 100).toFixed(1)),
      },
      {
        ...barnaby,
        quotaUtilizationPercent: parseFloat(((barnaby.tokensConsumed / barnaby.tokenMonthlyQuota) * 100).toFixed(1)),
      },
    ],
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { actionType, payload, tenantId = "tenant_default", employeeId = "employee_sophia" } = body;

    if (actionType === "warm_voice_transfer") {
      const packet = WarmVoiceTransferEngine.buildTransferPacket({
        callSid: payload.callSid || `call_${Date.now()}`,
        callerNumber: payload.callerNumber || "+18005550199",
        customerName: payload.customerName || "Elena Rostova",
        employeeId,
        sentimentScore: payload.sentimentScore || 0.42,
        issueSummary: payload.issueSummary || "Customer billing dispute",
        suggestedAction: payload.suggestedAction || "Issue $150 credit voucher",
      });
      return NextResponse.json({ success: true, mode: "warm_voice_transfer", packet });
    }

    const actionResult = await WorkforceSpine.orchestrateAction({
      actionId: `act_spine_${Date.now()}`,
      tenantId,
      employeeId,
      stream: payload.stream || "customers",
      operation: payload.operation || "orderv8.refund",
      payload: payload.data || { amountUsd: 150.0 },
    });

    return NextResponse.json({ success: true, mode: "workforce_action_orchestrated", actionResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Workforce Spine error" }, { status: 500 });
  }
}

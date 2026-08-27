import { NextRequest, NextResponse } from "next/server";
import { SupportAgenticEngine } from "@/lib/runtime/support-engine";
import { globalActionGateway } from "@/lib/runtime/action-gateway-client";
import { db } from "@/lib/db/mock-data";
import { triageEngine } from "@/lib/services/triage-engine";
import { contextEngine } from "@/lib/services/context-engine";
import { defineTenantRef, evaluateAutonomy, parseAutonomyPolicy, type EngineContext } from "@servicev8/agentic-runtime";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode = "copilot",
      message = "We are unable to login via Okta SAML since 9am.",
      customer = { id: "C-1920", name: "Sarah Jenkins", tier: "enterprise" },
      externalTicketId = "ZD-884233",
    } = body;

    // 1. Triage & Context
    const triage = triageEngine.classify(message, customer.tier);
    const interactionId = `int_${Date.now().toString().slice(-6)}`;
    const contextSnapshot = contextEngine.assembleContext(interactionId, customer, message);

    // 2. Build Engine instance
    const engine = new SupportAgenticEngine({
      mode,
      externalTicketId,
      source: "zendesk",
      customer,
      message,
      sentiment: triage.sentiment,
      intent: triage.intent,
      category: triage.category,
      likelyProblemId: triage.category === "checkout_failure" ? "PRB-218" : triage.category === "auth_sso" ? "PRB-219" : undefined,
      confidence: triage.confidence,
    });

    const tenantRef = defineTenantRef({
      tenantId: db.tenant.tenantId,
      tenantDomain: "acme.servicev8.internal",
    });

    // 3. Engine run context with mock narration
    const engineCtx: EngineContext = {
      tenant: tenantRef,
      instanceId: "hire_support_ai_01",
      tuning: {},
      narrate: async (prompt: string) => {
        return `supportV8 ${mode.toUpperCase()} assessment for ${customer.name}: Identified category '${triage.category}' with ${(triage.confidence * 100).toFixed(0)}% confidence. Recommended ${triage.routingRecommendation.toUpperCase()}.`;
      },
    };

    const resolution = await engine.run(engineCtx);

    // 4. Autonomy Evaluation for each proposal
    const autonomyPolicy =
      parseAutonomyPolicy({ autoExecuteMaxRisk: db.policy.autonomyThreshold }, `tenant:${db.tenant.tenantId}`) ||
      { autoExecuteMaxRisk: "medium" as const, source: "default:fallback" };
    const registry = globalActionGateway.getRegistry();

    const evaluatedProposals = [];
    for (const proposal of resolution.proposals || []) {
      const op = registry.get(proposal.operationId);
      const decision = evaluateAutonomy({
        grants: ["ticket:write", "billing:refund", "account:admin", "comms:broadcast", "knowledge:write"],
        risk: op.risk,
        requiredScope: op.requiredScope,
        policy: autonomyPolicy,
        preApproved: [],
        proposal,
      });

      let dispatchResult = null;
      if (decision.outcome === "execute" && mode === "autonomous") {
        dispatchResult = await globalActionGateway.requestAction({
          tenantId: db.tenant.tenantId,
          actor: {
            id: "ai_employee_01",
            type: "ai_employee",
            name: "Support AI Employee",
          },
          operationId: proposal.operationId,
          input: proposal.input,
        });
      }

      evaluatedProposals.push({
        proposal,
        operationSummary: op.summary,
        risk: op.risk,
        decision,
        dispatched: !!dispatchResult,
        dispatchResult,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        mode,
        triage,
        contextSnapshot,
        resolution,
        evaluatedProposals,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Agent run failed" },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { policyEngine } from "@/lib/services/policy-engine";
import {
  authorizeMvpRead,
  authorizeMvpManage,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeMvpRead(req);
    const policy = await policyEngine.getPolicy(auth.tenantId);
    return NextResponse.json({
      success: true,
      data: policy,
    });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load policy" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeMvpManage(req);
    const body = await req.json();
    const { action, policyUpdates, sampleMessage, customerTier, rule, ruleId, ruleUpdates, preset } = body;

    if (action === "update") {
      const updated = await policyEngine.updatePolicy(
        auth.tenantId,
        policyUpdates || {},
        auth.userId || "operator"
      );
      return NextResponse.json({ success: true, message: "Policy settings updated", data: updated });
    } else if (action === "add_rule") {
      const newRule = policyEngine.addRule(auth.tenantId, rule);
      return NextResponse.json({ success: true, message: `Rule '${newRule.name}' created`, data: newRule });
    } else if (action === "update_rule") {
      const updatedRule = policyEngine.updateRule(auth.tenantId, ruleId, ruleUpdates);
      return NextResponse.json({ success: true, message: `Rule '${updatedRule.name}' updated`, data: updatedRule });
    } else if (action === "delete_rule") {
      const deleted = policyEngine.deleteRule(auth.tenantId, ruleId);
      return NextResponse.json({ success: true, message: "Rule deleted", data: { deleted } });
    } else if (action === "apply_preset") {
      const updatedPolicy = await policyEngine.applyPresetProfile(
        auth.tenantId,
        preset,
        auth.userId || "operator"
      );
      return NextResponse.json({ success: true, message: `Applied preset profile '${preset}'`, data: updatedPolicy });
    } else if (action === "simulate") {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { success: false, error: "Policy simulation is disabled in production" },
          { status: 403 }
        );
      }
      const currentPolicy = await policyEngine.getPolicy(auth.tenantId);
      const simulation = policyEngine.simulate(
        sampleMessage || "I demand an immediate refund for double charge on checkout!",
        customerTier || "pro",
        currentPolicy
      );
      return NextResponse.json({ success: true, data: simulation });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Policy operation failed" },
      { status: 400 }
    );
  }
}

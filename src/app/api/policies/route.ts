import { NextRequest, NextResponse } from "next/server";
import { policyEngine } from "@/lib/services/policy-engine";

export async function GET(req: NextRequest) {
  const searchParams = new URL(req.url).searchParams;
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || req.headers.get("x-tenant-id") || undefined;
  const policy = policyEngine.getPolicy(tenant);
  return NextResponse.json({
    success: true,
    data: policy,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, policyUpdates, sampleMessage, customerTier, rule, ruleId, ruleUpdates, preset } = body;

    if (action === "update") {
      const updated = policyEngine.updatePolicy(policyUpdates);
      return NextResponse.json({ success: true, message: "Policy settings updated", data: updated });
    } else if (action === "add_rule") {
      const newRule = policyEngine.addRule(rule);
      return NextResponse.json({ success: true, message: `Rule '${newRule.name}' created`, data: newRule });
    } else if (action === "update_rule") {
      const updatedRule = policyEngine.updateRule(ruleId, ruleUpdates);
      return NextResponse.json({ success: true, message: `Rule '${updatedRule.name}' updated`, data: updatedRule });
    } else if (action === "delete_rule") {
      const deleted = policyEngine.deleteRule(ruleId);
      return NextResponse.json({ success: true, message: "Rule deleted", data: { deleted } });
    } else if (action === "apply_preset") {
      const updatedPolicy = policyEngine.applyPresetProfile(preset);
      return NextResponse.json({ success: true, message: `Applied preset profile '${preset}'`, data: updatedPolicy });
    } else if (action === "simulate") {
      const simulation = policyEngine.simulate(
        sampleMessage || "I demand an immediate refund for double charge on checkout!",
        customerTier || "pro"
      );
      return NextResponse.json({ success: true, data: simulation });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Policy operation failed" },
      { status: 400 }
    );
  }
}

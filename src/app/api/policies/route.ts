import { NextRequest, NextResponse } from "next/server";
import { policyEngine } from "@/lib/services/policy-engine";

export async function GET() {
  const policy = policyEngine.getPolicy();
  return NextResponse.json({
    success: true,
    data: policy,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, policyUpdates, sampleMessage, customerTier } = body;

    if (action === "update") {
      const updated = policyEngine.updatePolicy(policyUpdates);
      return NextResponse.json({ success: true, data: updated });
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

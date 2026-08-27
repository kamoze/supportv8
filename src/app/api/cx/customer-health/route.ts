import { NextRequest, NextResponse } from "next/server";
import { customerHealth } from "@/lib/services/customer-health-service";

export async function GET() {
  const radar = customerHealth.getHealthRadar();
  return NextResponse.json({
    success: true,
    data: radar,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await req.json();
    if (!accountId) {
      return NextResponse.json({ success: false, error: "accountId is required" }, { status: 400 });
    }

    const result = customerHealth.triggerVipOutreach(accountId);
    return NextResponse.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Outreach action failed" },
      { status: 500 }
    );
  }
}

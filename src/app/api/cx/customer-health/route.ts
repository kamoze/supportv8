import { NextRequest, NextResponse } from "next/server";
import { customerHealth } from "@/lib/services/customer-health-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const radar = customerHealth.getHealthRadar(tenant);
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

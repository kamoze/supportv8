import { NextRequest, NextResponse } from "next/server";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import { marketplaceService } from "@/lib/services/marketplace-service";

function creditError(error: unknown) {
  if (error instanceof RequestAuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "Credit operation failed" },
    { status: 400 },
  );
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    const credits = marketplaceService.getCredits(tenant.tenantSlug);
    return NextResponse.json({
      success: true,
      data: {
        credits,
        currency: "USD",
        provider: "forgegw",
      },
    });
  } catch (error) {
    return creditError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    const body = await req.json();
    const { action, amount, reason } = body;

    if (action === "deduct") {
      const result = marketplaceService.deductCredits(amount || 0, reason || "API credit deduction", tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Deducted ${result.deducted} ForgeGW Credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "add" || action === "topup") {
      const result = marketplaceService.addCredits(amount || 0, reason || "API credit top-up", tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Added ${result.added} ForgeGW Credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "set") {
      const updated = marketplaceService.setCredits(amount || 0, tenant.tenantSlug);
      return NextResponse.json({
        success: true,
        message: `Set ForgeGW Credits balance to ${updated}`,
        data: { credits: updated },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid credit action. Use 'deduct', 'add', or 'set'" }, { status: 400 });
  } catch (error: unknown) {
    return creditError(error);
  }
}

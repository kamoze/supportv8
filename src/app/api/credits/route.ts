import { NextRequest, NextResponse } from "next/server";
import { marketplaceService } from "@/lib/services/marketplace-service";

export async function GET() {
  const credits = marketplaceService.getCredits();
  return NextResponse.json({
    success: true,
    data: {
      credits,
      currency: "USD",
      provider: "forgegw",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, amount, reason } = body;

    if (action === "deduct") {
      const result = marketplaceService.deductCredits(amount || 0, reason || "API credit deduction");
      return NextResponse.json({
        success: true,
        message: `Deducted ${result.deducted} ForgeGW Credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "add" || action === "topup") {
      const result = marketplaceService.addCredits(amount || 0, reason || "API credit top-up");
      return NextResponse.json({
        success: true,
        message: `Added ${result.added} ForgeGW Credits. Balance: ${result.remaining}`,
        data: result,
      });
    }

    if (action === "set") {
      const updated = marketplaceService.setCredits(amount || 0);
      return NextResponse.json({
        success: true,
        message: `Set ForgeGW Credits balance to ${updated}`,
        data: { credits: updated },
      });
    }

    return NextResponse.json({ success: false, error: "Invalid credit action. Use 'deduct', 'add', or 'set'" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Credit operation failed" },
      { status: 400 }
    );
  }
}

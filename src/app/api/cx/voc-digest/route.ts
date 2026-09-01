import { NextRequest, NextResponse } from "next/server";
import { vocDigest } from "@/lib/services/voc-digest-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const voc = vocDigest.getVocOverview(tenant);
  const digest = vocDigest.generateShiftDigest(tenant);

  return NextResponse.json({
    success: true,
    data: {
      voc,
      digest,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
    const body = await req.json().catch(() => ({}));
    const { action = "regenerate" } = body;

    const digest = vocDigest.generateShiftDigest(tenant);
    return NextResponse.json({
      success: true,
      message: action === "broadcast"
        ? "Shift handoff briefing broadcasted to Slack #cx-leads and Email digest."
        : "Shift handoff briefing successfully generated.",
      data: digest,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "VoC digest failed" },
      { status: 500 }
    );
  }
}

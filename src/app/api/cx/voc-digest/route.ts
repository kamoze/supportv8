import { NextRequest, NextResponse } from "next/server";
import { vocDigest } from "@/lib/services/voc-digest-service";

export async function GET() {
  const voc = vocDigest.getVocOverview();
  const digest = vocDigest.generateShiftDigest();

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
    const body = await req.json().catch(() => ({}));
    const { action = "regenerate" } = body;

    const digest = vocDigest.generateShiftDigest();
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

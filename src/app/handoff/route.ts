import { NextRequest, NextResponse } from "next/server";
import { verticalHandoff } from "@/lib/verticals/handoff";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const payload = url.searchParams.get("payload");

  if (!token && !payload) {
    return NextResponse.redirect(new URL("/?view=cockpit", request.url));
  }

  try {
    const accepted = verticalHandoff.acceptHandoff(payload || token!);
    const tenantSlug = accepted.payload.tenantId || "acme";
    const sourceVertical = accepted.payload.sourceVertical || "runtime";
    return NextResponse.redirect(
      new URL(
        `/?view=cockpit&handoff=${encodeURIComponent(sourceVertical)}&tenant=${encodeURIComponent(tenantSlug)}`,
        request.url
      )
    );
  } catch {
    return NextResponse.redirect(new URL("/?view=cockpit&error=handoff_invalid", request.url));
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tokenOrPayload = body.token || body.payload || body;
    const accepted = verticalHandoff.acceptHandoff(tokenOrPayload);
    return NextResponse.json({
      success: true,
      data: accepted.payload,
      sharedCredits: accepted.sharedCredits,
      boundApps: accepted.boundApps,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Handoff failed" },
      { status: 400 }
    );
  }
}

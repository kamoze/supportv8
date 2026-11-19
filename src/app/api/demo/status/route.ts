import { NextResponse } from "next/server";
import { SUPPORT_DEMO_TENANT_SLUGS, supportDemoEnabled } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/** Tells the browser whether this deployment runs the demo sandbox. Grants nothing. */
export async function GET() {
  const enabled = supportDemoEnabled();
  return NextResponse.json(
    { success: true, enabled, tenants: enabled ? [...SUPPORT_DEMO_TENANT_SLUGS] : [] },
    { headers: { "Cache-Control": "no-store" } },
  );
}

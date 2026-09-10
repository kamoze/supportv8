import { NextResponse } from "next/server";
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { portalRepository } from "@/lib/db/portal-repository";

export async function GET(request: Request) {
  try {
    const tenant = await resolveRequestTenant(request);
    const portal = await portalRepository.getPublished(tenant.tenantId, tenant.tenantSlug);
    return NextResponse.json(
      { success: true, ...portal },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "The support portal is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const tenantData = db.getTenantData(tenant);
  const overview = db.getOverviewMetrics(tenant);

  return NextResponse.json({
    success: true,
    data: overview,
    tenant: tenantData.tenant,
  });
}

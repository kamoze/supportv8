import { NextResponse } from "next/server";
import { db } from "@/lib/db/mock-data";

export async function GET() {
  const overview = db.getOverviewMetrics();
  return NextResponse.json({
    success: true,
    data: overview,
    tenant: db.tenant,
  });
}

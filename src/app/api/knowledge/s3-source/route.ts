import { NextRequest, NextResponse } from "next/server";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { resolveRequestTenant, tenantIdFromSlug } from "@/lib/auth/request-tenant";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tenantCtx = await resolveRequestTenant(req).catch(() => null);
  const { searchParams } = new URL(req.url);
  const tenantSlug = tenantCtx?.tenantSlug || searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const tenantId = tenantCtx?.tenantId || tenantIdFromSlug(tenantSlug);

  const sources = ragIngestion.getS3Sources(tenantId);
  return NextResponse.json({
    success: true,
    count: sources.length,
    data: sources,
  });
}

export async function POST(req: NextRequest) {
  try {
    const tenantCtx = await resolveRequestTenant(req).catch(() => null);
    const { searchParams } = new URL(req.url);
    const tenantSlug = tenantCtx?.tenantSlug || searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
    const tenantId = tenantCtx?.tenantId || tenantIdFromSlug(tenantSlug);

    const body = await req.json();
    const { action, bucketName, prefix, region, endpoint, targetCategory, groups, sourceId } = body;

    if (action === "sync") {
      if (!sourceId) {
        return NextResponse.json({ success: false, error: "sourceId is required for sync" }, { status: 400 });
      }
      const syncResult = await ragIngestion.syncS3Source(sourceId);
      return NextResponse.json({
        success: true,
        message: syncResult.message,
        syncedCount: syncResult.syncedCount,
      });
    }

    // Connect new S3 Source
    if (!bucketName) {
      return NextResponse.json({ success: false, error: "bucketName is required" }, { status: 400 });
    }

    const newSource = ragIngestion.connectS3Source({
      tenantId,
      bucketName,
      prefix,
      region,
      endpoint,
      targetCategory,
      groups,
    });

    return NextResponse.json({
      success: true,
      message: `S3 Bucket Source 's3://${bucketName}/${prefix || ""}' connected successfully!`,
      data: newSource,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "S3 Source operation failed" },
      { status: 500 }
    );
  }
}

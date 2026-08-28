import { NextRequest, NextResponse } from "next/server";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { db } from "@/lib/db/mock-data";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sources = ragIngestion.getS3Sources(db.tenant.tenantId);
  return NextResponse.json({
    success: true,
    count: sources.length,
    data: sources,
  });
}

export async function POST(req: NextRequest) {
  try {
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
      tenantId: db.tenant.tenantId,
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

import { NextRequest, NextResponse } from "next/server";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { resolveRequestTenant, tenantIdFromSlug } from "@/lib/auth/request-tenant";

export async function POST(req: NextRequest) {
  try {
    const tenantCtx = await resolveRequestTenant(req).catch(() => null);
    const { searchParams } = new URL(req.url);
    const tenantSlug = tenantCtx?.tenantSlug || searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "tenant_default";
    const tenantId = tenantCtx?.tenantId || tenantIdFromSlug(tenantSlug);

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { success: false, error: "A query string between 1 and 2,000 characters is required." },
        { status: 400 }
      );
    }

    const limit = typeof body.limit === "number" ? body.limit : 5;
    const minSimilarity = typeof body.minSimilarity === "number" ? body.minSimilarity : 0.35;

    const ragResponse = await ragIngestion.queryRag({
      tenantId,
      query,
      limit,
      minSimilarity,
    });

    return NextResponse.json({
      success: true,
      tenantId,
      data: ragResponse,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to execute semantic RAG query" },
      { status: 500 }
    );
  }
}

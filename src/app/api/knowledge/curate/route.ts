import { NextRequest, NextResponse } from "next/server";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { resolveRequestTenant, tenantIdFromSlug } from "@/lib/auth/request-tenant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { documentId, title, articleType = "runbook", category = "general", groups = ["support-tier1"], tags = [], summary = "", content = "" } = body;

    if (!documentId || !title) {
      return NextResponse.json(
        { success: false, error: "documentId and title are required for curation" },
        { status: 400 }
      );
    }

    const tenantCtx = await resolveRequestTenant(req).catch(() => null);
    const { searchParams } = new URL(req.url);
    const tenantSlug = tenantCtx?.tenantSlug || searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
    const tenantId = tenantCtx?.tenantId || tenantIdFromSlug(tenantSlug);

    const result = await ragIngestion.curateDocument(tenantId, documentId, {
      title,
      articleType,
      category,
      groups,
      tags,
      summary,
      body: content,
    });

    return NextResponse.json({
      success: true,
      message: `Document successfully curated and published to Knowledge Base as '${result.article.title}'!`,
      data: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Curation failed" },
      { status: 500 }
    );
  }
}

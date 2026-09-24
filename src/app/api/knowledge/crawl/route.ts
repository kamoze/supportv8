import { NextRequest, NextResponse } from "next/server";
import { webCrawler } from "@/lib/services/web-crawler-service";
import { resolveRequestTenant, tenantIdFromSlug } from "@/lib/auth/request-tenant";

export async function GET(req: NextRequest) {
  const tenantCtx = await resolveRequestTenant(req).catch(() => null);
  const { searchParams } = new URL(req.url);
  const tenantSlug = tenantCtx?.tenantSlug || searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const tenantId = tenantCtx?.tenantId || tenantIdFromSlug(tenantSlug);

  const sources = webCrawler.getWebSources(tenantId);
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
    const { url, title, category, crawlDepth, mockHtmlContent } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: "Website 'url' is required" }, { status: 400 });
    }

    const result = await webCrawler.crawlAndIngest({
      tenantId,
      url,
      title,
      category: category || "web_documentation",
      crawlDepth: crawlDepth || 1,
      mockHtmlContent,
    });

    return NextResponse.json({
      success: true,
      message: `Website '${url}' successfully crawled, saved to S3 (${result.s3SnapshotUrl}), and indexed into ${result.chunkCount} pgvector chunks!`,
      data: result,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Website crawl failed" },
      { status: 500 }
    );
  }
}

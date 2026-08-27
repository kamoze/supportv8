import { NextRequest, NextResponse } from "next/server";
import { webCrawler } from "@/lib/services/web-crawler-service";
import { db } from "@/lib/db/mock-data";

export async function GET() {
  const sources = webCrawler.getWebSources(db.tenant.tenantId);
  return NextResponse.json({
    success: true,
    count: sources.length,
    data: sources,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, title, category, crawlDepth, mockHtmlContent } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: "Website 'url' is required" }, { status: 400 });
    }

    const result = await webCrawler.crawlAndIngest({
      tenantId: db.tenant.tenantId,
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

import { NextRequest, NextResponse } from "next/server";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";

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

    const result = ragIngestion.curateDocument(documentId, {
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

import { NextRequest, NextResponse } from "next/server";
import { knowledgeService } from "@/lib/services/knowledge-service";
import { db } from "@/lib/db/mock-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const tenantData = db.getTenantData(tenant);

  const articles = knowledgeService.getArticles();
  const gaps = knowledgeService.getGaps();
  const proposals = knowledgeService.getProposals();
  const documents = tenantData.documents || [];
  const webSources = tenantData.webSources || [];

  return NextResponse.json({
    success: true,
    data: {
      articles: tenantData.isClean ? [] : articles,
      gaps: tenantData.isClean ? [] : gaps,
      proposals: tenantData.isClean ? [] : proposals,
      documents,
      webSources,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, proposalId } = body;

    if (action === "publish") {
      const result = await knowledgeService.publishProposal(proposalId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Knowledge action failed" },
      { status: 400 }
    );
  }
}

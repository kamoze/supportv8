import { NextRequest, NextResponse } from "next/server";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { authorizeMvpRead, authorizeMvpManage, requestAuthResponse } from "@/lib/auth/route-authorization";

export async function GET(req: NextRequest) {
  try {
    const { tenantId } = await authorizeMvpRead(req);

    const [durableDocs, durableArticles] = await Promise.all([
      ragIngestion.getDurableDocuments(tenantId),
      ragIngestion.getDurableArticles(tenantId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        articles: durableArticles,
        gaps: [],
        proposals: [],
        documents: durableDocs,
        webSources: [],
      },
    });
  } catch (err: unknown) {
    const denied = requestAuthResponse(err);
    if (denied) return denied;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load knowledge data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await authorizeMvpManage(req);
    const body = await req.json();
    const { action, ticket } = body;

    if (action === "publish") {
      // Legacy proposals have no tenant ownership or scoped publication grant.
      // An authenticated manager cannot supply that missing owner authority.
      return NextResponse.json({ success: false, error: "knowledge_publication_unavailable" }, { status: 503 });
    }

    if (action === "ingest_ticket") {
      if (!ticket || !ticket.externalId || !ticket.summary) {
        return NextResponse.json({ success: false, error: "ticket with externalId and summary is required" }, { status: 400 });
      }
      const result = await ragIngestion.ingestTicketToRag({
        tenantId,
        ticket,
      });
      return NextResponse.json({
        success: true,
        message: `Ticket ${ticket.externalId} indexed into pgvector knowledge base!`,
        data: result,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const denied = requestAuthResponse(err);
    if (denied) return denied;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Knowledge action failed" },
      { status: 400 }
    );
  }
}

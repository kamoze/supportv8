import { NextRequest, NextResponse } from "next/server";
import { knowledgeService } from "@/lib/services/knowledge-service";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";
import { db } from "@/lib/db/mock-data";
import { resolveRequestTenant, tenantIdFromSlug } from "@/lib/auth/request-tenant";
import type { KnowledgeDocument } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const tenantCtx = await resolveRequestTenant(req).catch(() => null);
    const { searchParams } = new URL(req.url);
    const tenantSlug = tenantCtx?.tenantSlug || searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
    const tenantId = tenantCtx?.tenantId || tenantIdFromSlug(tenantSlug);
    const tenantData = db.getTenantData(tenantSlug);

    const [durableDocs, durableArticles] = await Promise.all([
      ragIngestion.getDurableDocuments(tenantId),
      ragIngestion.getDurableArticles(tenantId),
    ]);

    let articles: any[] = durableArticles;
    let documents: KnowledgeDocument[] = durableDocs;
    let gaps: any[] = [];
    let proposals: any[] = [];
    let webSources: any[] = [];

    const hasDb = Boolean(process.env.DATABASE_URL);
    if (!hasDb && !tenantData.isClean && !tenantCtx?.runtimeLinked) {
      if (articles.length === 0) articles = knowledgeService.getArticles();
      gaps = knowledgeService.getGaps();
      proposals = knowledgeService.getProposals();
      if (documents.length === 0) documents = tenantData.documents || [];
      webSources = tenantData.webSources || [];
    }

    return NextResponse.json({
      success: true,
      data: {
        articles,
        gaps,
        proposals,
        documents,
        webSources,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load knowledge data" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, proposalId, ticket } = body;
    const tenantCtx = await resolveRequestTenant(req).catch(() => null);
    const { searchParams } = new URL(req.url);
    const tenantSlug = tenantCtx?.tenantSlug || searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
    const tenantId = tenantCtx?.tenantId || tenantIdFromSlug(tenantSlug);

    if (action === "publish") {
      const result = await knowledgeService.publishProposal(proposalId);
      return NextResponse.json(result);
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
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Knowledge action failed" },
      { status: 400 }
    );
  }
}

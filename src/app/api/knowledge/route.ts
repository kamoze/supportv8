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

    const [durableDocs, durableArticles, mockArticles, gaps, proposals] = await Promise.all([
      ragIngestion.getDurableDocuments(tenantId),
      ragIngestion.getDurableArticles(tenantId),
      Promise.resolve(tenantData.isClean ? [] : knowledgeService.getArticles()),
      Promise.resolve(tenantData.isClean ? [] : knowledgeService.getGaps()),
      Promise.resolve(tenantData.isClean ? [] : knowledgeService.getProposals()),
    ]);

    const articleMap = new Map<string, any>();
    for (const a of durableArticles) articleMap.set(a.id, a);
    for (const a of mockArticles) {
      if (!articleMap.has(a.id)) articleMap.set(a.id, a);
    }
    const articles = Array.from(articleMap.values());

    const mockDocs = tenantData.documents || [];
    const docMap = new Map<string, KnowledgeDocument>();
    for (const d of durableDocs) docMap.set(d.id, d);
    for (const d of mockDocs) {
      if (!docMap.has(d.id)) docMap.set(d.id, d);
    }
    const documents = Array.from(docMap.values());
    const webSources = tenantData.webSources || [];

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

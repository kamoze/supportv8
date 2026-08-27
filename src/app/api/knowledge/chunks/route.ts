import { NextRequest, NextResponse } from "next/server";
import { ragIngestion } from "@/lib/services/rag-ingestion-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { success: false, error: "documentId query parameter is required" },
        { status: 400 }
      );
    }

    const chunks = ragIngestion.getDocumentChunks(documentId);
    return NextResponse.json({
      success: true,
      count: chunks.length,
      data: chunks,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load chunks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "update_chunk") {
      const { chunkId, content, section, weight } = body;
      if (!chunkId || content === undefined) {
        return NextResponse.json({ success: false, error: "chunkId and content required" }, { status: 400 });
      }
      const updated = ragIngestion.updateChunk(chunkId, { content, section, weight });
      return NextResponse.json({
        success: true,
        message: `RAG chunk ${chunkId} re-vectorized with 1536-dim embedding!`,
        data: updated,
      });
    }

    if (action === "add_chunk") {
      const { documentId, content, section } = body;
      if (!documentId || !content) {
        return NextResponse.json({ success: false, error: "documentId and content required" }, { status: 400 });
      }
      const created = ragIngestion.addChunk(documentId, content, section);
      return NextResponse.json({
        success: true,
        message: `New RAG chunk added and vectorized for document ${documentId}!`,
        data: created,
      });
    }

    if (action === "delete_chunk") {
      const { chunkId } = body;
      if (!chunkId) {
        return NextResponse.json({ success: false, error: "chunkId required" }, { status: 400 });
      }
      const ok = ragIngestion.deleteChunk(chunkId);
      return NextResponse.json({
        success: ok,
        message: `Chunk ${chunkId} removed from vector index.`,
      });
    }

    if (action === "update_tags") {
      const { documentId, groups = [], tags = [] } = body;
      if (!documentId) {
        return NextResponse.json({ success: false, error: "documentId required" }, { status: 400 });
      }
      const updated = ragIngestion.updateDocumentTags(documentId, groups, tags);
      return NextResponse.json({
        success: true,
        message: `Document tags updated and propagated to curated concepts!`,
        data: updated,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Chunk operation failed" },
      { status: 500 }
    );
  }
}

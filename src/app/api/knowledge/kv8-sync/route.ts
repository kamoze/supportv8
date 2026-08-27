import { NextRequest, NextResponse } from "next/server";
import { knowledgev8Connector } from "@/lib/connectors/knowledgev8-connector";
import { db } from "@/lib/db/mock-data";

export async function GET() {
  const status = knowledgev8Connector.getStatus();
  return NextResponse.json({
    success: true,
    data: status,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = "sync", workspaceId, gapId } = body;

    if (action === "sync") {
      const result = await knowledgev8Connector.syncWorkspaceConcepts(workspaceId);
      return NextResponse.json({
        success: true,
        message: `Successfully synchronized ${result.syncedCount} curated concepts from KnowledgeV8 workspace '${workspaceId || "ws_enterprise_core"}'!`,
        data: result,
      });
    }

    if (action === "submit_gap") {
      const gap: import("@/lib/types").KnowledgeGap = db.gaps.find((g) => g.id === gapId) || {
        id: gapId || "GAP-CUSTOM",
        topic: "Hardware Security Keys",
        recurringIssueCount: 86,
        confidence: 0.92,
        sampleQueries: ["How do I configure YubiKey hardware keys?"],
        firstDetected: new Date().toISOString(),
        suggestedAction: "Author guide",
        status: "detected",
      };

      const result = await knowledgev8Connector.submitKnowledgeGapProposal(gap);
      return NextResponse.json({
        success: true,
        message: `Knowledge gap '${gap.topic}' submitted to KnowledgeV8 workspace '${result.targetWorkspace}' as Proposal ${result.proposalId}!`,
        data: result,
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

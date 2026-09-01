import { NextRequest, NextResponse } from "next/server";
import { issueService } from "@/lib/services/issue-service";
import type { SentimentClass, SourceType } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sentiment = searchParams.get("sentiment") as SentimentClass | undefined;
  const category = searchParams.get("category") || undefined;
  const source = searchParams.get("source") as SourceType | undefined;
  const problemId = searchParams.get("problemId") || undefined;
  const search = searchParams.get("search") || undefined;
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || req.headers.get("x-tenant-id") || undefined;

  const issues = issueService.getAll({ sentiment, category, source, problemId, search, tenant });
  return NextResponse.json({
    success: true,
    count: issues.length,
    data: issues,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json();
    const { action, issueId, id, updates, ...rest } = body;
    const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || req.headers.get("x-tenant-id") || body.tenant || body.tenantSlug || undefined;

    if (action === "update" || action === "resolve" || action === "change_status") {
      const targetId = issueId || id;
      const payload = updates || (action === "resolve" ? { status: "resolved" } : rest);
      const updated = issueService.updateIssue(targetId, payload, tenant);
      if (!updated) {
        return NextResponse.json({ success: false, error: `Issue ${targetId} not found` }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Issue ${targetId} updated successfully`,
        data: updated,
      });
    }

    const issue = issueService.createFromInteraction({ ...body, tenant });
    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to process issue" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json();
    const { id, issueId, ...updates } = body;
    const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || req.headers.get("x-tenant-id") || body.tenant || body.tenantSlug || undefined;
    const targetId = id || issueId;
    if (!targetId) {
      return NextResponse.json({ success: false, error: "Missing issue ID" }, { status: 400 });
    }
    const updated = issueService.updateIssue(targetId, updates, tenant);
    if (!updated) {
      return NextResponse.json({ success: false, error: `Issue ${targetId} not found` }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update issue" },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { issueService } from "@/lib/services/issue-service";
import { chatRepository } from "@/lib/db/chat-repository";
import { RequestAuthError, resolveRequestTenant } from "@/lib/auth/request-tenant";
import type { SentimentClass, SourceType } from "@/lib/types";

const hasDurableDatabase = () => Boolean(process.env.DATABASE_URL);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sentiment = searchParams.get("sentiment") as SentimentClass | undefined;
    const category = searchParams.get("category") || undefined;
    const source = searchParams.get("source") as SourceType | undefined;
    const problemId = searchParams.get("problemId") || undefined;
    const search = searchParams.get("search") || undefined;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });

    const [mockIssues, durableChatIssues] = await Promise.all([
      Promise.resolve(issueService.getAll({ sentiment, category, source, problemId, search, tenant: tenant.tenantSlug })),
      source && source !== "chat" || !hasDurableDatabase()
        ? Promise.resolve([])
        : chatRepository.listChatIssues(tenant.tenantId),
    ]);
    const filteredChatIssues = durableChatIssues.filter((issue) => {
      if (sentiment && issue.sentiment !== sentiment) return false;
      if (category && issue.category !== category) return false;
      if (problemId && issue.problemId !== problemId) return false;
      if (search) {
        const haystack = `${issue.externalId} ${issue.customerName} ${issue.summary}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
    const durableIds = new Set(filteredChatIssues.map((issue) => issue.id));
    const issues = [...filteredChatIssues, ...mockIssues.filter((issue) => !durableIds.has(issue.id))];
    return NextResponse.json({
      success: true,
      count: issues.length,
      data: issues,
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to load issues" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, issueId, id, updates, ...rest } = body;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });

    if (action === "update" || action === "resolve" || action === "change_status") {
      const targetId = issueId || id;
      const payload = updates || (action === "resolve" ? { status: "resolved" } : rest);
      const updated =
        (hasDurableDatabase()
          ? await chatRepository.updateChatIssue(tenant.tenantId, targetId, payload)
          : null) ||
        issueService.updateIssue(targetId, payload, tenant.tenantSlug);
      if (!updated) {
        return NextResponse.json({ success: false, error: `Issue ${targetId} not found` }, { status: 404 });
      }
      return NextResponse.json({
        success: true,
        message: `Issue ${targetId} updated successfully`,
        data: updated,
      });
    }

    const issue = issueService.createFromInteraction({ ...body, tenant: tenant.tenantSlug });
    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to process issue" },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, issueId, ...updates } = body;
    const tenant = await resolveRequestTenant(req, { requireAuthentication: true });
    const targetId = id || issueId;
    if (!targetId) {
      return NextResponse.json({ success: false, error: "Missing issue ID" }, { status: 400 });
    }
    const updated =
      (hasDurableDatabase()
        ? await chatRepository.updateChatIssue(tenant.tenantId, targetId, updates)
        : null) ||
      issueService.updateIssue(targetId, updates, tenant.tenantSlug);
    if (!updated) {
      return NextResponse.json({ success: false, error: `Issue ${targetId} not found` }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (err: unknown) {
    if (err instanceof RequestAuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to update issue" },
      { status: 400 }
    );
  }
}

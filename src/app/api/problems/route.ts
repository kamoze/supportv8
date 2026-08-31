import { NextRequest, NextResponse } from "next/server";
import { problemService } from "@/lib/services/problem-service";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || undefined;
  const problems = problemService.getAll(tenant);
  return NextResponse.json({
    success: true,
    count: problems.length,
    data: problems,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, problemId, issueId, issueIds, title, suspectedCause, status } = body;

    if (action === "correlate") {
      const problem = problemService.correlateIssues(issueIds, title, suspectedCause);
      return NextResponse.json({ success: true, data: problem });
    } else if (action === "link") {
      const problem = problemService.linkIssue(problemId, issueId);
      return NextResponse.json({ success: true, data: problem });
    } else if (action === "unlink") {
      const problem = problemService.unlinkIssue(problemId, issueId);
      return NextResponse.json({ success: true, data: problem });
    } else if (action === "update_status") {
      const problem = problemService.updateStatus(problemId, status);
      return NextResponse.json({ success: true, data: problem });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Problem operation failed" },
      { status: 400 }
    );
  }
}

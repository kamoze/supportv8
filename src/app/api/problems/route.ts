import { NextRequest, NextResponse } from "next/server";
import { problemService } from "@/lib/services/problem-service";
import {
  authorizeMvpRead,
  authorizeMvpManage,
  requestAuthResponse,
} from "@/lib/auth/route-authorization";

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeMvpRead(req);
    const problems = problemService.getAll(auth.tenantSlug);
    return NextResponse.json({
      success: true,
      count: problems.length,
      data: problems,
    });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to load problems" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeMvpManage(req);
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
    } else if (action === "update_status" || (problemId && status)) {
      const problem = problemService.updateStatus(problemId, status);
      return NextResponse.json({ success: true, data: problem });
    } else if (action === "simulate" || action === "seed") {
      const problems = problemService.seedDemoProblems(auth.tenantSlug);
      return NextResponse.json({ success: true, data: problems });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const authRes = requestAuthResponse(err);
    if (authRes) return authRes;
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Problem operation failed" },
      { status: 400 }
    );
  }
}

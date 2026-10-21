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
    const problems = await problemService.getAll(auth.tenantId);
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
      if (!Array.isArray(issueIds) || !title) {
        return NextResponse.json(
          { success: false, error: "Missing issueIds or title" },
          { status: 400 }
        );
      }
      const problem = await problemService.correlateIssues(
        auth.tenantId,
        issueIds,
        title,
        suspectedCause
      );
      return NextResponse.json({ success: true, data: problem });
    } else if (action === "link") {
      if (!problemId || !issueId) {
        return NextResponse.json(
          { success: false, error: "Missing problemId or issueId" },
          { status: 400 }
        );
      }
      const problem = await problemService.linkIssue(auth.tenantId, problemId, issueId);
      return NextResponse.json({ success: true, data: problem });
    } else if (action === "unlink") {
      if (!problemId || !issueId) {
        return NextResponse.json(
          { success: false, error: "Missing problemId or issueId" },
          { status: 400 }
        );
      }
      const problem = await problemService.unlinkIssue(auth.tenantId, problemId, issueId);
      return NextResponse.json({ success: true, data: problem });
    } else if (action === "update_status" || (problemId && status)) {
      const problem = await problemService.updateStatus(auth.tenantId, problemId, status);
      return NextResponse.json({ success: true, data: problem });
    } else if (action === "simulate" || action === "seed") {
      return NextResponse.json({ success: true, data: [] });
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

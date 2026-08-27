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

  const issues = issueService.getAll({ sentiment, category, source, problemId, search });
  return NextResponse.json({
    success: true,
    count: issues.length,
    data: issues,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const issue = issueService.createFromInteraction(body);
    return NextResponse.json({
      success: true,
      data: issue,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to create issue" },
      { status: 400 }
    );
  }
}

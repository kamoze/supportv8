import { NextRequest, NextResponse } from "next/server";
import { workforceManager } from "@/lib/workforce";

export async function GET() {
  const members = workforceManager.getAll();
  return NextResponse.json({
    success: true,
    count: members.length,
    data: members,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { action, memberId, task } = await req.json();

    if (action === "delegate") {
      const result = workforceManager.delegateTask(memberId, task);
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Workforce action failed" },
      { status: 400 }
    );
  }
}

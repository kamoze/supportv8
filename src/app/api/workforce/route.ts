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
    const { action, memberId, task, employeeId, issueDescription } = await req.json();

    if (action === "hire") {
      const result = workforceManager.hireEmployee(employeeId || memberId);
      return NextResponse.json({ success: result.success, message: result.message, data: result.member });
    }

    if (action === "assign_work") {
      const result = workforceManager.assignWork(memberId || employeeId, issueDescription || task);
      return NextResponse.json({ success: result.success, message: result.message, supervisor: result.supervisor });
    }

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

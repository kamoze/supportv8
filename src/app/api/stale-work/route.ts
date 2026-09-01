import { NextRequest, NextResponse } from "next/server";
import { staleWorkSweeper } from "@/lib/services/stale-work-sweeper";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get("tenant") || req.headers.get("x-tenant-slug") || "acme";
  const candidates = staleWorkSweeper.getCandidates(tenant);
  const dryRun = staleWorkSweeper.runDryRun(tenant);

  return NextResponse.json({
    success: true,
    data: {
      candidates,
      dryRun,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, candidateId } = body;

    if (action === "execute_single") {
      const result = await staleWorkSweeper.executeCandidateAction(candidateId);
      return NextResponse.json(result);
    } else if (action === "execute_all_safe") {
      const result = await staleWorkSweeper.executeAllSafeToClose();
      return NextResponse.json({
        success: true,
        message: `Successfully executed batch close on ${result.executedCount} safe candidates via Action Gateway.`,
        data: result,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Stale work execution failed" },
      { status: 400 }
    );
  }
}

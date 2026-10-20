import { NextResponse } from "next/server";
import { verifyWorkloadToken, OUTCOME_RECEIVER_POLICY } from "@/lib/tasksv8/auth";
import { parseWorkOutcomeEvent } from "@/lib/tasksv8/contracts";
import { getTasksv8Store } from "@/lib/tasksv8/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (process.env.SUPPORTV8_TASKSV8_ENABLED !== "true") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Workload Auth verification
  const authResult = await verifyWorkloadToken(
    request,
    process.env.TASKSV8_JWT_SECRET,
    OUTCOME_RECEIVER_POLICY
  );

  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  const { identity } = authResult;

  // Parse and validate CloudEvent payload
  let payloadJson: unknown;
  try {
    payloadJson = await request.json();
  } catch (_err) {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let cloudEvent;
  try {
    cloudEvent = parseWorkOutcomeEvent(payloadJson);
  } catch (err: any) {
    return NextResponse.json(
      { error: "invalid_contract", message: err?.message },
      { status: 400 }
    );
  }

  const store = getTasksv8Store();

  try {
    const receipt = await store.recordOutcome(
      { tenantId: identity.tenantId, accountId: identity.accountId },
      cloudEvent
    );

    return NextResponse.json(receipt, { status: 200 });
  } catch (err: any) {
    if (err?.code === "idempotency_conflict") {
      return NextResponse.json(
        { error: "idempotency_conflict", message: err.message },
        { status: 409 }
      );
    }
    if (err?.code === "link_not_found") {
      return NextResponse.json(
        { error: "link_not_found", message: err.message },
        { status: 404 }
      );
    }
    if (err?.code === "tenant_forbidden") {
      return NextResponse.json(
        { error: "tenant_forbidden", message: err.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: err?.message },
      { status: 500 }
    );
  }
}

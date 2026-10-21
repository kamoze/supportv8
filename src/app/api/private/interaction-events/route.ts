import { NextResponse } from "next/server";
import { authenticateInteractionIngress } from "@/lib/service-app/interaction-ingress-auth";
import { validateInteractionEnvelope } from "@/lib/connectors/interaction-envelope";
import { getInteractionRepository } from "@/lib/connectors/interaction-repository-registry";
import { enqueueSupportInteraction } from "@/lib/temporal/client";

/**
 * POST /api/private/interaction-events
 *
 * Ingestion endpoint for normalized support interaction events dispatched by Action Gateway.
 * Strict workload JWT authentication, envelope validation, tenant boundary verification,
 * durable PostgreSQL persistence with forced RLS before 202/200 acknowledgement,
 * and asynchronous issue derivation dispatch.
 */
export async function POST(request: Request) {
  // 1. Workload JWT Authentication
  const authResult = await authenticateInteractionIngress(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  // 2. Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  // 3. Envelope Validation
  const validationResult = validateInteractionEnvelope(body);
  if (!validationResult.valid) {
    return NextResponse.json(
      { error: validationResult.error },
      { status: validationResult.status }
    );
  }

  const { event } = validationResult;

  // 4. Enforce Token <-> Event Envelope Tenant and Account Equality
  if (
    authResult.actor.tenantId !== event.tenantId ||
    authResult.actor.accountId !== event.accountId
  ) {
    return NextResponse.json(
      { error: "Forbidden: tenant or account identifier mismatch between token and event payload" },
      { status: 403 }
    );
  }

  // 5. Durable PostgreSQL Persistence before acknowledgement (under forced RLS)
  const repo = getInteractionRepository();
  const { replayed, interactionId } = await repo.recordInteraction(event);

  // 6. Asynchronous Issue Derivation via Temporal workflow (best-effort dispatch)
  try {
    await enqueueSupportInteraction(event.eventId, event.tenantId);
  } catch (err) {
    console.warn(`[interaction-events] failed to dispatch temporal workflow for event ${event.eventId}:`, err);
  }

  // 7. Acknowledge with 200 (if replayed) or 202 (if new)
  if (replayed) {
    return NextResponse.json(
      {
        accepted: true,
        replayed: true,
        eventId: event.eventId,
        interactionId,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      accepted: true,
      replayed: false,
      eventId: event.eventId,
      interactionId,
    },
    { status: 202 }
  );
}

import type { GrowthLoopConfig } from "./config";

export type GrowthOutcomeType = "converted" | "lost";

export interface GrowthOutcomeInput {
  /** The attributed growth lead ID. If null or empty, outcome emission is soft-skipped. */
  leadId: string | null | undefined;
  /** Terminal conversion outcome: "converted" (revenue win) or "lost" (cancelled/dropped). */
  outcome: GrowthOutcomeType;
  /** Monetary value of conversion (optional for "lost"). */
  value?: number | undefined;
  /** Unique primary key ID of the underlying domain entity (e.g. orderId, bookingId, patientId). */
  entityId: string;
  /** Domain entity type tag (e.g. "order", "booking", "patient_appointment", "lease"). */
  entityType?: string | undefined;
  /** Custom extra metadata to record in GrowthV8. */
  metadata?: Record<string, unknown> | undefined;
}

export interface GrowthOutcomeResult {
  ok: boolean;
  skipped?: boolean | undefined;
  message?: string | undefined;
}

/**
 * Emits a conversion outcome to GrowthV8 for an attributed lead that has reached
 * a terminal status.
 *
 * Soft-skips (never throws) when:
 * 1. The entity has no `leadId` (organic traffic).
 * 2. GrowthV8 URL or outcome token is unconfigured.
 *
 * Fail-soft guarantee: network transport failures are returned as `{ ok: false, message }`
 * and will never roll back or crash the underlying domain transaction.
 */
export async function emitGrowthOutcome(
  input: GrowthOutcomeInput,
  config: GrowthLoopConfig,
  fetchImpl: typeof fetch = fetch
): Promise<GrowthOutcomeResult> {
  const { leadId, outcome, value, entityId, entityType = "entity", metadata = {} } = input;

  if (!leadId) {
    return { ok: false, skipped: true };
  }

  const { growthv8Url, outcomeToken } = config;
  if (!growthv8Url || !outcomeToken) {
    return { ok: false, skipped: true, message: "growthv8 loop not configured" };
  }

  const idempotencyKey = `${entityId}:${outcome}`;

  try {
    const res = await fetchImpl(`${growthv8Url}/v1/outcomes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${outcomeToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        lead_id: leadId,
        outcome,
        value: outcome === "converted" && typeof value === "number" ? value : undefined,
        metadata: {
          entityId,
          entityType,
          idempotencyKey,
          ...metadata,
        },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, message: `growthv8 ${res.status}: ${detail}` };
    }

    return { ok: true };
  } catch (err: any) {
    // Best-effort: a GrowthV8 outage must never fail the underlying domain action
    return { ok: false, message: err?.message || "growthv8 unreachable" };
  }
}

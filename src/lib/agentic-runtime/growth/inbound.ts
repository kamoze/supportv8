import type { GrowthLoopConfig } from "./config";

export interface InboundGrowthLeadPayload {
  leadId: string;
  workspace: string;
  intent: string;
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface InboundLeadValidationResult {
  ok: boolean;
  status: number;
  error?: string;
  payload?: InboundGrowthLeadPayload;
  customerDisplayName?: string;
}

/**
 * Validates an incoming growth lead request from GrowthV8.
 *
 * Verifies bearer token authentication and validates required fields
 * (`leadId`, `workspace`, `intent`).
 */
export function validateInboundGrowthLead(
  authHeader: string | null | undefined,
  body: Record<string, unknown>,
  config: GrowthLoopConfig
): InboundLeadValidationResult {
  const token = (authHeader || "").replace(/^Bearer\s+/i, "").trim();

  if (!config.inboundToken || token !== config.inboundToken) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const leadId = String(body.leadId ?? "").trim();
  const workspace = String(body.workspace ?? "").trim();
  const intent = String(body.intent ?? "").trim();

  if (!leadId || !workspace || !intent) {
    return { ok: false, status: 400, error: "leadId, workspace and intent are required" };
  }

  const name = body.name ? String(body.name).trim() : undefined;
  const email = body.email ? String(body.email).trim() : undefined;
  const phone = body.phone ? String(body.phone).trim() : undefined;
  const customerDisplayName = (name || email || phone || "Growth lead").slice(0, 200);

  return {
    ok: true,
    status: 200,
    payload: {
      leadId,
      workspace,
      intent,
      name,
      email,
      phone,
      metadata: typeof body.metadata === "object" && body.metadata !== null ? (body.metadata as Record<string, unknown>) : undefined,
    },
    customerDisplayName,
  };
}

/**
 * supportV8 Interaction Gateway
 * Ingress, event normalization, deduplication, and streaming correlation.
 */

import type { InteractionEvent, SourceType } from "../types";

export interface RawIngressPayload {
  tenantId?: string;
  source: SourceType;
  channel?: string;
  sourceRef: string;
  customerRef: string;
  text: string;
  sender?: "customer" | "agent" | "ai_employee" | "system";
  metadata?: Record<string, unknown>;
}

export class InteractionGateway {
  private dedupeCache: Set<string> = new Set();

  public normalize(raw: RawIngressPayload): InteractionEvent {
    const tenantId = raw.tenantId || "tenant_default";
    const correlationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sessionId = `sess_${raw.source}_${raw.customerRef}`;
    const interactionId = `int_${Date.now().toString().slice(-6)}`;
    const dedupeKey = `${tenantId}:${raw.source}:${raw.sourceRef}:${raw.text.trim()}`;

    if (this.dedupeCache.has(dedupeKey)) {
      // Event already seen (e.g. provider webhook retry)
      throw new Error(`Duplicate interaction event dropped: ${dedupeKey}`);
    }
    this.dedupeCache.add(dedupeKey);
    // Keep dedupe set bounded
    if (this.dedupeCache.size > 5000) {
      this.dedupeCache.clear();
    }

    const event: InteractionEvent = {
      event: "interaction.message.received",
      tenant_id: tenantId,
      interaction_id: interactionId,
      session_id: sessionId,
      channel: raw.channel || (raw.source === "twilio_voice" ? "voice" : "chat"),
      source: raw.source,
      source_reference: raw.sourceRef,
      customer_reference: raw.customerRef,
      timestamp: new Date().toISOString(),
      correlation_id: correlationId,
      content: {
        type: raw.source === "twilio_voice" ? "transcript" : "text",
        text: raw.text,
        sender: raw.sender || "customer",
        metadata: raw.metadata,
      },
    };

    return event;
  }
}

export const interactionGateway = new InteractionGateway();

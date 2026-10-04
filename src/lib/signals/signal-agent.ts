/**
 * SupportV8 Signal Agent Outbox
 *
 * Implements the Signals aspect of the Four-Part Service App Contract.
 * Emits CloudEvents 1.0 domain signals into the centralized Runtime Signals
 * intake, contributing support ticket interactions, customer escalations,
 * and resolution outcomes to the tenant's Operational Learning Graph (OLG).
 */

import { getAgenticRuntimeBaseUrl, getAgenticRuntimeToken } from "@/lib/chat/agenticos-chat-client";

export const SUPPORT_SIGNAL_TYPES = {
  TICKET_CREATED: "com.servicev8.business.support.ticket-created.v1",
  TICKET_ESCALATED: "com.servicev8.business.support.ticket-escalated.v1",
  TICKET_RESOLVED: "com.servicev8.business.support.ticket-resolved.v1",
  CSAT_RECORDED: "com.servicev8.business.support.csat-recorded.v1",
} as const;

export type SupportSignalType = typeof SUPPORT_SIGNAL_TYPES[keyof typeof SUPPORT_SIGNAL_TYPES];

export type SignalEmitOptions = {
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  maxRetries?: number;
  retryDelayMs?: number;
};

export type SignalEmitResult =
  | {
      ok: true;
      receiptId?: string;
      duplicate?: boolean;
      status?: string;
    }
  | {
      ok: false;
      error: string;
    };

export function getAgenticRuntimeCascadeUrls(
  env: Record<string, string | undefined> = process.env
): string[] {
  const candidates = [
    env.SERVICEV8_RUNTIME_CLUSTER_URL,
    env.SERVICEV8_RUNTIME_TAILNET_URL,
    env.SERVICEV8_RUNTIME_PUBLIC_URL ||
      env.SERVICEV8_RUNTIME_URL ||
      env.SUPPORT_RUNTIME_URL ||
      env.RUNTIME_URL,
    getAgenticRuntimeBaseUrl(env),
  ].filter((u): u is string => Boolean(u && u.trim().length > 0));

  if (candidates.length === 0) {
    candidates.push("http://servicev8-runtime.default.svc.cluster.local:3000");
    candidates.push("https://runtime.servicev8.com");
  }

  // Deduplicate candidates preserving declaration priority
  return Array.from(new Set(candidates.map((u) => u.replace(/\/+$/, ""))));
}

export function getSignalsSecret(env: Record<string, string | undefined> = process.env): string {
  return (
    env.RUNTIME_SIGNALS_SECRET ||
    env.RUNTIME_WEBHOOK_SECRET ||
    getAgenticRuntimeToken(env) ||
    ""
  );
}

export async function safeEmitSignal(
  params: {
    tenantId: string;
    accountId?: string;
    eventType: string;
    subject: string;
    data: Record<string, unknown>;
    id?: string;
    time?: string;
  },
  options: SignalEmitOptions = {}
): Promise<SignalEmitResult> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchImpl ?? fetch;
  const cascadeUrls = getAgenticRuntimeCascadeUrls(env);
  const secret = getSignalsSecret(env);

  const eventId =
    params.id ||
    `evt_supportv8_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const eventEnvelope = {
    specversion: "1.0",
    id: eventId,
    source: "urn:servicev8:app:supportv8",
    type: params.eventType,
    subject: params.subject,
    time: params.time || new Date().toISOString(),
    datacontenttype: "application/json",
    data: params.data,
  };

  let targetTenantId = params.tenantId;
  const accountId = params.accountId || params.tenantId;

  if (targetTenantId.startsWith("tenant_rt_") && accountId.startsWith("acct_")) {
    targetTenantId = `tenant_${accountId.replace("acct_", "")}`;
  }

  const startTime = Date.now();

  // Structured CloudEvent emission to stdout for k8s container log inspection
  console.log(
    JSON.stringify({
      timestamp: eventEnvelope.time,
      channel: "cloudevents",
      direction: "outbound",
      stage: "emitted",
      app: "supportv8",
      tenantId: targetTenantId,
      rawTenantId: params.tenantId !== targetTenantId ? params.tenantId : undefined,
      accountId,
      source: eventEnvelope.source,
      type: eventEnvelope.type,
      subject: eventEnvelope.subject,
      eventId: eventEnvelope.id,
      data: eventEnvelope.data,
    })
  );
  console.log(
    `[CLOUDEVENT:EMIT] app="supportv8" type="${params.eventType}" id="${eventId}" tenant="${targetTenantId}" subject="${params.subject}"`
  );

  let lastError = "No cascade URLs available";

  for (let i = 0; i < cascadeUrls.length; i++) {
    const baseUrl = cascadeUrls[i];
    const url = `${baseUrl}/api/signals/intake`;

    if (i > 0) {
      console.log(
        `[CLOUDEVENT:CASCADE_FAILOVER] app="supportv8" failing over to candidate ${i + 1}/${cascadeUrls.length}: ${baseUrl}`
      );
    }

    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-servicev8-signal-secret": secret,
          "x-servicev8-tenant-id": targetTenantId,
          "x-servicev8-account-id": accountId,
        },
        body: JSON.stringify(eventEnvelope),
      });

      if (response.status === 200 || response.status === 202) {
        let body: {
          ok?: boolean;
          receiptId?: string;
          duplicate?: boolean;
          status?: string;
        } = {};
        try {
          body = (await response.json()) as any;
        } catch {
          body = { ok: true, status: "accepted" };
        }
        const durationMs = Date.now() - startTime;
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            channel: "cloudevents",
            direction: "inbound_ack",
            stage: "acknowledged",
            app: "supportv8",
            tenantId: params.tenantId,
            accountId,
            source: eventEnvelope.source,
            type: eventEnvelope.type,
            subject: eventEnvelope.subject,
            eventId: eventEnvelope.id,
            status: body.status ?? "accepted",
            receiptId: body.receiptId,
            cascadeEndpoint: baseUrl,
            durationMs,
          })
        );
        console.log(
          `[CLOUDEVENT:ACK] app="supportv8" type="${params.eventType}" id="${eventId}" tenant="${params.tenantId}" subject="${params.subject}" status="${body.status ?? "accepted"}" receipt="${body.receiptId ?? "none"}" (${durationMs}ms)`
        );
        return {
          ok: true,
          receiptId: body.receiptId,
          duplicate: body.duplicate,
          status: body.status,
        };
      }

      const errText = await response.text().catch(() => "");
      lastError = `HTTP ${response.status}: ${errText}`;

      // If client error (4xx except 429), fail fast since payload is invalid
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            channel: "cloudevents",
            direction: "outbound_error",
            stage: "rejected",
            app: "supportv8",
            tenantId: params.tenantId,
            accountId,
            source: eventEnvelope.source,
            type: eventEnvelope.type,
            subject: eventEnvelope.subject,
            eventId: eventEnvelope.id,
            httpStatus: response.status,
            error: errText,
          })
        );
        console.warn(`[CLOUDEVENT:REJECTED] app="supportv8" intake rejected signal (${response.status}): ${errText}`);
        return { ok: false, error: lastError };
      }

      // If server error (5xx) or rate-limited (429), try next cascade candidate
      console.warn(
        `[CLOUDEVENT:WARNING] app="supportv8" intake failed at ${baseUrl} (${response.status}), trying next candidate...`
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `[CLOUDEVENT:WARNING] app="supportv8" network error reaching ${baseUrl}: ${lastError}, trying next candidate...`
      );
    }
  }

  console.warn(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      channel: "cloudevents",
      direction: "outbound_error",
      stage: "transport_error",
      app: "supportv8",
      tenantId: params.tenantId,
      accountId,
      source: eventEnvelope.source,
      type: eventEnvelope.type,
      subject: eventEnvelope.subject,
      eventId: eventEnvelope.id,
      error: lastError,
    })
  );
  console.warn("[CLOUDEVENT:ERROR] app=\"supportv8\" signal emission failed softly across all cascade URLs:", lastError);

  return { ok: false, error: lastError };
}

export async function emitSupportTicketCreatedSignal(
  params: {
    tenantId: string;
    accountId?: string;
    ticket: {
      id: string;
      ticketRef?: string;
      customerName: string;
      customerRef?: string;
      summary: string;
      priority: string;
      category?: string;
      status?: string;
    };
  },
  options?: SignalEmitOptions
): Promise<SignalEmitResult> {
  return safeEmitSignal(
    {
      tenantId: params.tenantId,
      accountId: params.accountId,
      eventType: SUPPORT_SIGNAL_TYPES.TICKET_CREATED,
      subject: `ticket:${params.ticket.id}`,
      data: {
        ticketId: params.ticket.id,
        ticketRef: params.ticket.ticketRef || params.ticket.id,
        customerName: params.ticket.customerName,
        customerRef: params.ticket.customerRef,
        summary: params.ticket.summary,
        priority: params.ticket.priority,
        category: params.ticket.category || "general_support",
        status: params.ticket.status || "open",
        createdAt: new Date().toISOString(),
      },
    },
    options
  );
}

export async function emitSupportTicketEscalatedSignal(
  params: {
    tenantId: string;
    accountId?: string;
    ticketId: string;
    ticketRef?: string;
    customerName?: string;
    reason?: string;
    severity?: "warning" | "critical";
  },
  options?: SignalEmitOptions
): Promise<SignalEmitResult> {
  return safeEmitSignal(
    {
      tenantId: params.tenantId,
      accountId: params.accountId,
      eventType: SUPPORT_SIGNAL_TYPES.TICKET_ESCALATED,
      subject: `ticket:${params.ticketId}`,
      data: {
        ticketId: params.ticketId,
        ticketRef: params.ticketRef || params.ticketId,
        customerName: params.customerName || "Customer",
        priority: "urgent",
        severity: params.severity || "critical",
        reason: params.reason || "Customer escalation reported",
        escalatedAt: new Date().toISOString(),
      },
    },
    options
  );
}

export async function emitSupportTicketResolvedSignal(
  params: {
    tenantId: string;
    accountId?: string;
    ticketId: string;
    ticketRef?: string;
    resolutionSummary?: string;
    resolvedAt?: string;
  },
  options?: SignalEmitOptions
): Promise<SignalEmitResult> {
  return safeEmitSignal(
    {
      tenantId: params.tenantId,
      accountId: params.accountId,
      eventType: SUPPORT_SIGNAL_TYPES.TICKET_RESOLVED,
      subject: `ticket:${params.ticketId}`,
      data: {
        ticketId: params.ticketId,
        ticketRef: params.ticketRef || params.ticketId,
        status: "resolved",
        resolutionSummary: params.resolutionSummary || "Ticket resolved by support operator",
        resolvedAt: params.resolvedAt || new Date().toISOString(),
      },
    },
    options
  );
}

export async function emitSupportCsatRecordedSignal(
  params: {
    tenantId: string;
    accountId?: string;
    ticketId: string;
    ticketRef?: string;
    score: number;
    feedback?: string;
  },
  options?: SignalEmitOptions
): Promise<SignalEmitResult> {
  return safeEmitSignal(
    {
      tenantId: params.tenantId,
      accountId: params.accountId,
      eventType: SUPPORT_SIGNAL_TYPES.CSAT_RECORDED,
      subject: `ticket:${params.ticketId}`,
      data: {
        ticketId: params.ticketId,
        ticketRef: params.ticketRef || params.ticketId,
        score: params.score,
        feedback: params.feedback || "",
        recordedAt: new Date().toISOString(),
      },
    },
    options
  );
}

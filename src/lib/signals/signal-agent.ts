/**
 * Legacy helper signatures remain source-compatible but cannot publish facts.
 * Native issue SQL capture and the shared operational worker own managed sends.
 */



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

/** Deprecated public helpers cannot attest native commit or source ownership.
 * Native SQL capture + shared operational worker are the only managed lane.
 * No credential, tenant rewrite, payload logging or network fallback is allowed.
 */
export function getAgenticRuntimeCascadeUrls(_env:Record<string,string|undefined>=process.env):string[]{return [];}
export function getSignalsSecret(_env:Record<string,string|undefined>=process.env):string{return '';}
export async function safeEmitSignal(_params:{tenantId:string;accountId?:string;eventType:string;subject:string;data:Record<string,unknown>;id?:string;time?:string},_options:SignalEmitOptions={}):Promise<SignalEmitResult>{
 return {ok:false,error:'signals_native_transaction_required'};
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

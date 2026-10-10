/**
 * Durable Support-Domain OLG Outbox
 * Implements EVT-01 to EVT-06:
 * - Transactional domain outbox bound to ticket/case commits
 * - Persisted lease fencing ensuring stale workers cannot ACK
 * - Strict OLG receipt validation
 * - Cross-tenant isolation (composite key: tenantId + eventId)
 * - Payload sanitization (redacts raw customer transcripts and PII)
 */

export interface DomainOutboxEvent {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateType: "ticket" | "case" | "escalation";
  aggregateId: string;
  payload: Record<string, unknown>;
  status: "pending" | "leased" | "delivered" | "quarantined";
  leaseWorkerId?: string;
  leaseExpiresAt?: number;
  receiptId?: string;
  retryCount: number;
  createdAt: string;
}

export interface DomainTransactionContext {
  stageEvent(event: Omit<DomainOutboxEvent, "status" | "retryCount" | "createdAt">): Promise<void>;
}

export interface DomainOutboxStore {
  withTransaction<T>(fn: (tx: DomainTransactionContext) => Promise<T>): Promise<T>;
  stage(event: Omit<DomainOutboxEvent, "status" | "retryCount" | "createdAt">): Promise<void>;
  getPendingEvents(tenantId: string): Promise<DomainOutboxEvent[]>;
  getEventById(eventId: string): Promise<DomainOutboxEvent | null>;
  claim(workerId: string, limit: number, leaseDurationMs: number): Promise<DomainOutboxEvent[]>;
  ack(
    eventId: string,
    workerId: string,
    receipt: { receiptId: string; deliveredAt: string },
    tenantId?: string
  ): Promise<{ success: boolean; error?: string }>;
}

export function validateOlgReceipt(receipt: unknown): boolean {
  if (!receipt || typeof receipt !== "object") return false;
  const r = receipt as Record<string, unknown>;
  if (typeof r.receiptId !== "string" || !r.receiptId) return false;
  return (
    /^rcpt_[a-z0-9_]{16,64}$/.test(r.receiptId) ||
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(r.receiptId)
  );
}

const REDACTED_FIELDS = new Set([
  "rawcustomertranscript",
  "chatmessages",
  "userpii",
  "rawtranscript",
  "transcript",
  "creditcard",
  "ssn",
  "password",
]);

export function sanitizeDomainEventPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (!REDACTED_FIELDS.has(lowerKey)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        sanitized[key] = sanitizeDomainEventPayload(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? sanitizeDomainEventPayload(item as Record<string, unknown>)
            : item
        );
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}

export function createInMemoryDomainOutboxStore(): DomainOutboxStore {
  // Composite key: `${tenantId}:${eventId}`
  const store = new Map<string, DomainOutboxEvent>();

  const stageInternal = (
    targetMap: Map<string, DomainOutboxEvent>,
    raw: Omit<DomainOutboxEvent, "status" | "retryCount" | "createdAt">
  ) => {
    const compositeKey = `${raw.tenantId}:${raw.id}`;
    const cleanPayload = sanitizeDomainEventPayload(raw.payload);
    const event: DomainOutboxEvent = {
      ...raw,
      payload: cleanPayload,
      status: "pending",
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    targetMap.set(compositeKey, event);
  };

  return {
    async withTransaction<T>(fn: (tx: DomainTransactionContext) => Promise<T>): Promise<T> {
      const stagedInTx = new Map<string, DomainOutboxEvent>();
      const txContext: DomainTransactionContext = {
        async stageEvent(event) {
          stageInternal(stagedInTx, event);
        },
      };

      // Execute transaction callback
      const result = await fn(txContext);

      // Commit only if fn succeeded without throwing
      for (const [key, ev] of stagedInTx.entries()) {
        store.set(key, ev);
      }

      return result;
    },

    async stage(event) {
      stageInternal(store, event);
    },

    async getPendingEvents(tenantId: string) {
      const results: DomainOutboxEvent[] = [];
      const now = Date.now();
      for (const ev of store.values()) {
        if (ev.tenantId === tenantId) {
          if (ev.status === "pending" || (ev.status === "leased" && (ev.leaseExpiresAt ?? 0) <= now)) {
            results.push(JSON.parse(JSON.stringify(ev)));
          }
        }
      }
      return results;
    },

    async getEventById(eventId: string) {
      for (const ev of store.values()) {
        if (ev.id === eventId) {
          return JSON.parse(JSON.stringify(ev));
        }
      }
      return null;
    },

    async claim(workerId: string, limit: number, leaseDurationMs: number) {
      const now = Date.now();
      const claimed: DomainOutboxEvent[] = [];

      for (const ev of store.values()) {
        if (claimed.length >= limit) break;
        const isEligible =
          ev.status === "pending" ||
          (ev.status === "leased" && (ev.leaseExpiresAt ?? 0) <= now);

        if (isEligible) {
          ev.status = "leased";
          ev.leaseWorkerId = workerId;
          ev.leaseExpiresAt = now + leaseDurationMs;
          ev.retryCount += 1;
          claimed.push(JSON.parse(JSON.stringify(ev)));
        }
      }

      return claimed;
    },

    async ack(
      eventId: string,
      workerId: string,
      receipt: { receiptId: string; deliveredAt: string },
      tenantId?: string
    ) {
      const now = Date.now();
      let found: DomainOutboxEvent | undefined;

      for (const ev of store.values()) {
        if (ev.id === eventId && (!tenantId || ev.tenantId === tenantId)) {
          if (ev.leaseWorkerId === workerId && ev.status === "leased") {
            found = ev;
            break;
          }
          if (!found) found = ev;
        }
      }

      if (!found) {
        return { success: false, error: "Event not found" };
      }

      // Lease fencing check FIRST: stale worker cannot touch or quarantine active lease!
      if (
        found.status !== "leased" ||
        found.leaseWorkerId !== workerId ||
        (found.leaseExpiresAt ?? 0) <= now
      ) {
        return {
          success: false,
          error: "Cannot ACK event: worker lease has expired or was claimed by another worker.",
        };
      }

      // Receipt validation only performed after establishing valid lease
      if (!validateOlgReceipt(receipt)) {
        found.status = "quarantined";
        return { success: false, error: "Invalid OLG receipt schema" };
      }

      found.status = "delivered";
      found.receiptId = receipt.receiptId;
      return { success: true };
    },
  };
}

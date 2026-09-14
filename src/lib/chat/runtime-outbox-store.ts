import { relayQuery } from "./relay-query";
import { Pool, type PoolClient, type PoolConfig } from "pg";

export interface RuntimeDeliveryEvent {
  eventId: string;
  threadId: string;
  sequence: string;
  eventType: string;
  scopeHash: string;
  leaseId: string;
}
export interface RuntimeDeliveryStore {
  claim(limit: number): Promise<RuntimeDeliveryEvent[]>;
  complete(eventId: string, leaseId: string): Promise<boolean>;
  fail(eventId: string, leaseId: string): Promise<boolean>;
  close(): Promise<void>;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EVENT_TYPES = new Set([
  "message.created", "message.updated", "message.deleted", "turn.created", "turn.updated", "turn.deleted",
  "recipient.created", "recipient.updated", "recipient.deleted", "recipient_link.created", "recipient_link.updated",
  "recipient_link.deleted", "assistant.waiting", "assistant.updated", "assistant.settled",
]);
function isUuid(value: unknown): value is string {
  return typeof value === "string" && value.length === 36 && UUID.test(value);
}
export function validateRuntimeDeliveryEvent(event: RuntimeDeliveryEvent): void {
  if (!event || !isUuid(event.eventId) || !isUuid(event.threadId) || !isUuid(event.leaseId)
    || typeof event.scopeHash !== "string" || event.scopeHash.length !== 64 || !/^[0-9a-f]{64}$/.test(event.scopeHash)
    || typeof event.sequence !== "string" || event.sequence.length > 19 || !/^[1-9][0-9]*$/.test(event.sequence)
    || event.sequence.includes("\n") || BigInt(event.sequence) > 9223372036854775807n
    || !EVENT_TYPES.has(event.eventType)) {
    throw new Error("Invalid Runtime delivery event");
  }
}
export function validateRuntimeBatchSize(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid Runtime relay batch size");
}
export function validateRuntimeDatabaseUrl(value: string): void {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) throw new Error();
    // pg lets connection-string parameters override the explicit pool settings.
    const reserved = ["statement_timeout", "query_timeout", "connect_timeout", "connectionTimeoutMillis", "application_name", "options"];
    if (reserved.some(key => url.searchParams.has(key))) throw new Error();
  } catch { throw new Error("Invalid Runtime database configuration"); }
}

export class PostgresRuntimeDeliveryStore implements RuntimeDeliveryStore {
  private readonly pool: Pool;
  private readonly clients = new Set<PoolClient>();

  constructor(connectionString: string, factory: (options: PoolConfig) => Pool = options => new Pool(options),
    log: (category: string) => void = category => console.warn(`[agenticos-chat-relay] ${category}`)) {
    validateRuntimeDatabaseUrl(connectionString);
    this.pool = factory({ connectionString, max: 1, connectionTimeoutMillis: 5_000,
      query_timeout: 6_000, application_name: "agenticos-chat-relay" });
    this.pool.on("connect", client => this.clients.add(client));
    this.pool.on("remove", client => this.clients.delete(client));
    this.pool.on("error", () => log("database_unavailable"));
  }
  async claim(limit: number): Promise<RuntimeDeliveryEvent[]> {
    validateRuntimeBatchSize(limit);
    let rows: Record<string, unknown>[];
    try { ({ rows } = await relayQuery(this.pool, "SELECT * FROM runtime_chat.claim_delivery($1)", [limit])); }
    catch { throw new Error("Runtime delivery claim failed"); }
    return rows.map(row => {
      const event = { eventId: row.event_id, threadId: row.thread_id, sequence: row.sequence,
        eventType: row.event_type, scopeHash: row.scope_hash, leaseId: row.lease_id } as RuntimeDeliveryEvent;
      validateRuntimeDeliveryEvent(event);
      return event;
    });
  }
  async complete(eventId: string, leaseId: string): Promise<boolean> {
    if (!isUuid(eventId) || !isUuid(leaseId)) throw new Error("Invalid Runtime delivery lease");
    try {
      const result = await relayQuery(this.pool, "SELECT runtime_chat.complete_delivery($1,$2) AS completed", [eventId, leaseId]);
      return result.rows[0]?.completed === true;
    } catch { throw new Error("Runtime delivery completion failed"); }
  }
  async fail(eventId: string, leaseId: string): Promise<boolean> {
    if (!isUuid(eventId) || !isUuid(leaseId)) throw new Error("Invalid Runtime delivery lease");
    try {
      const result = await relayQuery(this.pool, "SELECT runtime_chat.fail_delivery($1,$2) AS failed", [eventId, leaseId]);
      return result.rows[0]?.failed === true;
    } catch { throw new Error("Runtime delivery failure release failed"); }
  }
  async close(): Promise<void> { await this.pool.end(); }
  forceClose(): void {
    for (const client of this.clients) void client.end().catch(() => undefined);
  }
}

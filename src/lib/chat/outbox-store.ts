import { Pool, type QueryResultRow } from "pg";

export interface ClaimedChatOutboxEvent {
  eventId: string;
  tenantId: string;
  sessionId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface ClaimedRow extends QueryResultRow {
  event_id: string;
  tenant_id: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: Date | string;
}

export interface ChatOutboxStore {
  claim(workerId: string, limit: number): Promise<ClaimedChatOutboxEvent[]>;
  complete(eventId: string, workerId: string): Promise<void>;
  fail(eventId: string, workerId: string, error: string): Promise<void>;
  close(): Promise<void>;
}

export class PostgresChatOutboxStore implements ChatOutboxStore {
  private readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) throw new Error("DATABASE_URL is required for the chat relay");
    this.pool = new Pool({
      connectionString,
      max: Number(process.env.CHAT_RELAY_DB_POOL_MAX || 4),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "supportv8-chat-relay",
    });
  }

  async claim(workerId: string, limit: number): Promise<ClaimedChatOutboxEvent[]> {
    const result = await this.pool.query<ClaimedRow>(
      "SELECT * FROM supportv8.claim_chat_outbox($1, $2)",
      [workerId, Math.min(Math.max(limit, 1), 200)],
    );
    return result.rows.map((row) => ({
      eventId: row.event_id,
      tenantId: row.tenant_id,
      sessionId: row.aggregate_id,
      eventType: row.event_type,
      payload: row.payload || {},
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    }));
  }

  async complete(eventId: string, workerId: string): Promise<void> {
    await this.pool.query("SELECT supportv8.complete_chat_outbox($1, $2)", [eventId, workerId]);
  }

  async fail(eventId: string, workerId: string, error: string): Promise<void> {
    await this.pool.query("SELECT supportv8.fail_chat_outbox($1, $2, $3)", [
      eventId,
      workerId,
      error.slice(0, 1_000),
    ]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

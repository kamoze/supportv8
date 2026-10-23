/**
 * Support Intelligence PostgreSQL Repository
 *
 * Implements durable, tenant-safe data plane for SupportV8 intelligence events,
 * Action Gateway receipts, source connections, and tenant retention policies.
 * All queries execute under transaction-local PostgreSQL Row Level Security (RLS)
 * via client.withTenantSession(tenantId, callback).
 */
import { pgClient, PostgresClient } from "./pg-client";
import type {
  NormalizedInteractionInput,
  SourceConnectionRecord,
  SupportIntelligenceRepository,
  TenantPolicyRecord,
  ActionReceiptRecord,
} from "@/lib/types";

function mapRowToNormalizedInput(row: any): NormalizedInteractionInput {
  return {
    eventId: row.event_id,
    tenantId: row.tenant_id,
    accountId: row.account_id,
    connectionId: row.connection_id,
    connectorKey: row.connector_key,
    source: row.source,
    sourceReference: row.source_reference,
    customerReference: row.customer_reference,
    sourceUrl: row.source_url,
    text: row.text,
    sender: row.sender,
    occurredAt:
      row.occurred_at instanceof Date
        ? row.occurred_at.toISOString()
        : String(row.occurred_at),
    receivedAt:
      row.received_at instanceof Date
        ? row.received_at.toISOString()
        : String(row.received_at),
    correlationId: row.correlation_id,
    raw:
      typeof row.raw_payload === "string"
        ? JSON.parse(row.raw_payload)
        : (row.raw_payload ?? {}),
  };
}

function mapRowToSourceConnection(row: any): SourceConnectionRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    accountId: row.account_id,
    provider: row.provider,
    connectionId: row.connection_id,
    connectorKey: row.connector_key,
    externalAccountId: row.external_account_id,
    baseUrl: row.base_url,
    status: row.status,
    lastEventAt: row.last_event_at
      ? row.last_event_at instanceof Date
        ? row.last_event_at.toISOString()
        : String(row.last_event_at)
      : undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

function mapRowToTenantPolicy(row: any): TenantPolicyRecord {
  return {
    tenantId: row.tenant_id,
    rawContextRetentionHours: Number(row.raw_context_retention_hours),
    mode: row.mode,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

function mapRowToActionReceipt(row: any): ActionReceiptRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    idempotencyKey: row.idempotency_key,
    action: row.action,
    capability: row.capability ?? undefined,
    issueId: row.issue_id ?? undefined,
    actionExecutionId: row.action_execution_id ?? undefined,
    status: row.status,
    actor:
      typeof row.actor === "string"
        ? JSON.parse(row.actor)
        : (row.actor ?? undefined),
    payload:
      typeof row.payload === "string"
        ? JSON.parse(row.payload)
        : (row.payload ?? undefined),
    result:
      typeof row.result === "string"
        ? JSON.parse(row.result)
        : (row.result ?? undefined),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export class PgSupportIntelligenceRepository implements SupportIntelligenceRepository {
  private readonly client: PostgresClient;

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  /**
   * Records a normalized provider interaction idempotently within tenant RLS boundary.
   * If (tenant_id, source, event_id) already exists, returns { replayed: true, interactionId }.
   * If newly inserted, writes to supportv8.interaction_outbox in the same transaction.
   */
  async recordInteraction(
    input: NormalizedInteractionInput
  ): Promise<{ replayed: boolean; interactionId: string }> {
    const interactionId = "evt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const outboxId = "obx_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const eventKey = `evt:${input.tenantId}:${input.eventId}`;

    return this.client.withTenantSession(input.tenantId, async (session) => {
      // 0. Lookup tenant retention policy (defaulting to 72 hours)
      const policyRows = await session.query<{ raw_context_retention_hours: number }>(
        "SELECT raw_context_retention_hours FROM supportv8.tenant_policies WHERE tenant_id = $1",
        [input.tenantId]
      );
      const retentionHours = policyRows[0]?.raw_context_retention_hours ?? 72;
      const receivedTimestamp = input.receivedAt ? new Date(input.receivedAt).getTime() : Date.now();
      const expiresAt = new Date(receivedTimestamp + retentionHours * 3600 * 1000).toISOString();

      // 1. Insert into interaction_events with ON CONFLICT DO NOTHING
      const insertRows = await session.query<{ id: string }>(
        `INSERT INTO supportv8.interaction_events (
           id, tenant_id, account_id, connection_id, connector_key,
           source, event_id, source_reference, customer_reference,
           source_url, text, sender, occurred_at, received_at,
           correlation_id, raw_payload, expires_at, processing_state
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13, $14,
           $15, $16, $17, 'pending'
         )
         ON CONFLICT (tenant_id, source, event_id) DO NOTHING
         RETURNING id`,
        [
          interactionId,
          input.tenantId,
          input.accountId,
          input.connectionId,
          input.connectorKey || "zendesk",
          input.source,
          input.eventId,
          input.sourceReference,
          input.customerReference,
          input.sourceUrl,
          input.text,
          input.sender,
          input.occurredAt,
          input.receivedAt || new Date().toISOString(),
          input.correlationId,
          JSON.stringify(input.raw || {}),
          expiresAt,
        ]
      );

      // Conflict occurred: fetch existing id and return replayed: true
      if (!insertRows || insertRows.length === 0) {
        const existingRows = await session.query<{ id: string }>(
          `SELECT id FROM supportv8.interaction_events
           WHERE tenant_id = $1 AND source = $2 AND event_id = $3`,
          [input.tenantId, input.source, input.eventId]
        );
        const existingId = existingRows[0]?.id;
        if (!existingId) {
          throw new Error(
            `Unable to resolve existing interaction event for tenant=${input.tenantId} event=${input.eventId}`
          );
        }
        return { replayed: true, interactionId: existingId };
      }

      const committedId = insertRows[0].id;

      // 2. Insert outbox record in same atomic transaction
      await session.query(
        `INSERT INTO supportv8.interaction_outbox (
           id, tenant_id, event_key, payload, status, created_at
         ) VALUES (
           $1, $2, $3, $4, 'pending', NOW()
         )
         ON CONFLICT (tenant_id, event_key) DO NOTHING`,
        [
          outboxId,
          input.tenantId,
          eventKey,
          JSON.stringify({
            interactionId: committedId,
            eventId: input.eventId,
            source: input.source,
            sourceReference: input.sourceReference,
            customerReference: input.customerReference,
          }),
        ]
      );

      return { replayed: false, interactionId: committedId };
    });
  }

  /**
   * Claims due interactions (pending or failed with retry_at <= NOW()) across tenants
   * using the SECURITY DEFINER supportv8.claim_interaction_events function.
   */
  async claimInteractions(
    limit: number,
    workerId: string
  ): Promise<NormalizedInteractionInput[]> {
    return this.client.withSystemSession(async (session) => {
      const rows = await session.query<any>(
        "SELECT * FROM supportv8.claim_interaction_events($1, $2)",
        [workerId, limit]
      );
      return rows.map(mapRowToNormalizedInput);
    });
  }

  /**
   * Claims due interactions strictly within a specified tenant's RLS session.
   */
  async claimInteractionsForTenant(
    tenantId: string,
    limit: number,
    workerId: string
  ): Promise<NormalizedInteractionInput[]> {
    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<any>(
        `WITH due AS (
           SELECT id FROM supportv8.interaction_events
           WHERE tenant_id = $1
             AND (processing_state = 'pending' OR (processing_state = 'failed' AND retry_at <= NOW()))
           ORDER BY received_at ASC
           LIMIT $2
           FOR UPDATE SKIP LOCKED
         )
         UPDATE supportv8.interaction_events e
         SET processing_state = 'processing',
             locked_by = $3,
             locked_at = NOW(),
             updated_at = NOW()
         FROM due
         WHERE e.id = due.id
         RETURNING e.*`,
        [tenantId, limit, workerId]
      );
      return rows.map(mapRowToNormalizedInput);
    });
  }

  /**
   * Marks interaction completed and associates generated derived Issue ID.
   */
  async completeInteraction(
    tenantId: string,
    eventId: string,
    issueId: string
  ): Promise<void> {
    await this.client.withTenantSession(tenantId, async (session) => {
      await session.query(
        `UPDATE supportv8.interaction_events
         SET processing_state = 'completed',
             issue_id = $1,
             updated_at = NOW()
         WHERE tenant_id = $2 AND event_id = $3`,
        [issueId, tenantId, eventId]
      );
    });
  }

  /**
   * Marks interaction failed with error code and scheduled retry timestamp.
   */
  async failInteraction(
    tenantId: string,
    eventId: string,
    errorCode: string,
    retryAt: string
  ): Promise<void> {
    await this.client.withTenantSession(tenantId, async (session) => {
      await session.query(
        `UPDATE supportv8.interaction_events
         SET processing_state = 'failed',
             error_code = $1,
             retry_at = $2,
             retry_count = retry_count + 1,
             updated_at = NOW()
         WHERE tenant_id = $3 AND event_id = $4`,
        [errorCode, retryAt, tenantId, eventId]
      );
    });
  }

  /**
   * Retrieves source connection for tenant.
   */
  async getSourceConnection(
    tenantId: string,
    connectorKey = "zendesk"
  ): Promise<SourceConnectionRecord | null> {
    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT id, tenant_id, account_id, provider, connection_id, connector_key,
                external_account_id, base_url, status, last_event_at, created_at, updated_at
         FROM supportv8.source_connections
         WHERE tenant_id = $1 AND connector_key = $2`,
        [tenantId, connectorKey]
      );
      if (!rows || rows.length === 0) return null;
      return mapRowToSourceConnection(rows[0]);
    });
  }

  /**
   * Upserts source connection for tenant.
   */
  async upsertSourceConnection(
    record: Omit<SourceConnectionRecord, "createdAt" | "updatedAt">
  ): Promise<SourceConnectionRecord> {
    const id = record.id || ("src_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32));
    return this.client.withTenantSession(record.tenantId, async (session) => {
      const rows = await session.query<any>(
        `INSERT INTO supportv8.source_connections (
           id, tenant_id, account_id, provider, connection_id, connector_key,
           external_account_id, base_url, status, last_event_at, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
         )
         ON CONFLICT (tenant_id, connector_key) DO UPDATE SET
           account_id = EXCLUDED.account_id,
           connection_id = EXCLUDED.connection_id,
           external_account_id = EXCLUDED.external_account_id,
           base_url = EXCLUDED.base_url,
           status = EXCLUDED.status,
           last_event_at = COALESCE(EXCLUDED.last_event_at, supportv8.source_connections.last_event_at),
           updated_at = NOW()
         RETURNING *`,
        [
          id,
          record.tenantId,
          record.accountId,
          record.provider,
          record.connectionId,
          record.connectorKey,
          record.externalAccountId,
          record.baseUrl,
          record.status,
          record.lastEventAt || null,
        ]
      );
      return mapRowToSourceConnection(rows[0]);
    });
  }

  /**
   * Retrieves retention policy for tenant.
   */
  async getTenantPolicy(tenantId: string): Promise<TenantPolicyRecord | null> {
    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT tenant_id, raw_context_retention_hours, mode, updated_at
         FROM supportv8.tenant_policies
         WHERE tenant_id = $1`,
        [tenantId]
      );
      if (!rows || rows.length === 0) return null;
      return mapRowToTenantPolicy(rows[0]);
    });
  }

  /**
   * Sets retention policy for tenant.
   */
  async setTenantPolicy(policy: {
    tenantId: string;
    rawContextRetentionHours?: number;
    mode?: "observe" | "copilot" | "autonomous";
  }): Promise<TenantPolicyRecord> {
    const retention = policy.rawContextRetentionHours ?? 72;
    const mode = policy.mode ?? "observe";
    return this.client.withTenantSession(policy.tenantId, async (session) => {
      const rows = await session.query<any>(
        `INSERT INTO supportv8.tenant_policies (
           tenant_id, raw_context_retention_hours, mode, updated_at
         ) VALUES (
           $1, $2, $3, NOW()
         )
         ON CONFLICT (tenant_id) DO UPDATE SET
           raw_context_retention_hours = EXCLUDED.raw_context_retention_hours,
           mode = EXCLUDED.mode,
           updated_at = NOW()
         RETURNING *`,
        [policy.tenantId, retention, mode]
      );
      return mapRowToTenantPolicy(rows[0]);
    });
  }

  /**
   * Records an Action Gateway execution receipt idempotently.
   */
  async recordActionReceipt(receipt: {
    id?: string;
    tenantId: string;
    idempotencyKey: string;
    action: string;
    capability?: string;
    issueId?: string;
    actionExecutionId?: string;
    status: string;
    actor?: Record<string, unknown>;
    payload?: Record<string, unknown>;
    result?: Record<string, unknown>;
  }): Promise<ActionReceiptRecord> {
    const id = receipt.id || ("rcpt_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32));
    return this.client.withTenantSession(receipt.tenantId, async (session) => {
      const rows = await session.query<any>(
        `INSERT INTO supportv8.action_receipts (
           id, tenant_id, idempotency_key, action, capability, issue_id,
           action_execution_id, status, actor, payload, result, created_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
         )
         ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
         RETURNING *`,
        [
          id,
          receipt.tenantId,
          receipt.idempotencyKey,
          receipt.action,
          receipt.capability || null,
          receipt.issueId || null,
          receipt.actionExecutionId || null,
          receipt.status,
          receipt.actor ? JSON.stringify(receipt.actor) : null,
          receipt.payload ? JSON.stringify(receipt.payload) : null,
          receipt.result ? JSON.stringify(receipt.result) : null,
        ]
      );
      if (rows && rows.length > 0) {
        return mapRowToActionReceipt(rows[0]);
      }
      const existing = await session.query<any>(
        `SELECT * FROM supportv8.action_receipts
         WHERE tenant_id = $1 AND idempotency_key = $2`,
        [receipt.tenantId, receipt.idempotencyKey]
      );
      return mapRowToActionReceipt(existing[0]);
    });
  }

  /**
   * Retrieves an Action Gateway receipt by tenant and idempotency key.
   */
  async getActionReceipt(
    tenantId: string,
    idempotencyKey: string
  ): Promise<ActionReceiptRecord | null> {
    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.action_receipts
         WHERE tenant_id = $1 AND idempotency_key = $2`,
        [tenantId, idempotencyKey]
      );
      if (!rows || rows.length === 0) return null;
      return mapRowToActionReceipt(rows[0]);
    });
  }

  /**
   * Retrieves an Action Gateway receipt by tenant and execution ID.
   */
  async getActionReceiptByExecutionId(
    tenantId: string,
    actionExecutionId: string
  ): Promise<ActionReceiptRecord | null> {
    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.action_receipts
         WHERE tenant_id = $1 AND action_execution_id = $2`,
        [tenantId, actionExecutionId]
      );
      if (!rows || rows.length === 0) return null;
      return mapRowToActionReceipt(rows[0]);
    });
  }

  /**
   * Lists action receipts for a tenant, ordered by creation time descending.
   */
  async listActionReceipts(
    tenantId: string,
    limit = 50
  ): Promise<ActionReceiptRecord[]> {
    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.action_receipts
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [tenantId, limit]
      );
      if (!rows || rows.length === 0) return [];
      return rows.map(mapRowToActionReceipt);
    });
  }

  /**
   * Retrieves interaction by tenant and eventId.
   */
  async getInteraction(
    tenantId: string,
    eventId: string
  ): Promise<NormalizedInteractionInput | null> {
    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.interaction_events
         WHERE tenant_id = $1 AND event_id = $2`,
        [tenantId, eventId]
      );
      if (!rows || rows.length === 0) return null;
      return mapRowToNormalizedInput(rows[0]);
    });
  }
}

export const supportIntelligenceRepository = new PgSupportIntelligenceRepository();
export const pgSupportIntelligenceRepository = supportIntelligenceRepository;

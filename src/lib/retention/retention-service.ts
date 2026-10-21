/**
 * SupportV8 Retention Service
 *
 * Implements enforceable tenant retention policies:
 * - Redacts raw_payload to '{}'::jsonb and text to '[REDACTED_PURGED]' for expired interaction events.
 * - Preserves durable derived intelligence (Issues, Problems, classifications, source references,
 *   correlation IDs, confidence scores, and Action Gateway receipts).
 * - Enforces PostgreSQL forced Row Level Security by executing per-tenant purges inside tenant sessions.
 */

import { pgClient, PostgresClient } from "../db/pg-client";

export interface PurgeResult {
  purgedEventsCount: number;
  purgedTenants: string[];
}

export class RetentionService {
  private client: PostgresClient;

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  /**
   * Purges expired raw interaction payloads and transient message text across all tenants.
   * Redacts raw_payload to '{}'::jsonb and text to '[REDACTED_PURGED]'.
   * Never deletes derived Issues, Problems, action receipts, or outbox records.
   * Executes per-tenant purges inside each tenant's RLS session to satisfy forced RLS.
   */
  public async purgeExpiredRawContext(asOf: Date = new Date()): Promise<PurgeResult> {
    const tenants = await this.client.withSystemSession(async (session) => {
      const rows = await session.query<{ id: string }>(
        `SELECT id FROM supportv8.tenants ORDER BY id`
      );
      return rows.map((r) => r.id);
    });

    let totalPurged = 0;
    const purgedTenants: string[] = [];

    for (const tenantId of tenants) {
      const count = await this.purgeExpiredRawContextForTenant(tenantId, asOf);
      if (count > 0) {
        totalPurged += count;
        purgedTenants.push(tenantId);
      }
    }

    return {
      purgedEventsCount: totalPurged,
      purgedTenants,
    };
  }

  /**
   * Purges expired raw interactions for a specific tenant strictly within the tenant's RLS session.
   */
  public async purgeExpiredRawContextForTenant(
    tenantId: string,
    asOf: Date = new Date()
  ): Promise<number> {
    const asOfIso = asOf.toISOString();

    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<{ id: string }>(
        `UPDATE supportv8.interaction_events
         SET raw_payload = '{}'::jsonb,
             text = '[REDACTED_PURGED]',
             updated_at = NOW()
         WHERE tenant_id = $1
           AND expires_at <= $2
           AND (raw_payload <> '{}'::jsonb OR text <> '[REDACTED_PURGED]')
         RETURNING id`,
        [tenantId, asOfIso]
      );

      return rows.length;
    });
  }

  /**
   * Reads the configured raw context retention hours for a tenant.
   * Defaults to 72 hours if no explicit policy row exists.
   */
  public async getRetentionHours(tenantId: string): Promise<number> {
    return this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<{ raw_context_retention_hours: number }>(
        `SELECT raw_context_retention_hours FROM supportv8.tenant_policies WHERE tenant_id = $1`,
        [tenantId]
      );
      return rows[0]?.raw_context_retention_hours ?? 72;
    });
  }
}

export const retentionService = new RetentionService();

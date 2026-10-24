import { pgClient, PostgresClient } from "@/lib/db/pg-client";
import {
  supportIntelligenceRepository,
  PgSupportIntelligenceRepository,
} from "@/lib/db/support-intelligence-repository";
import { InteractionWorker } from "@/lib/temporal/interaction-workflow";
import type { SupportIntelligenceRepository } from "@/lib/types";

export interface OutboxRelayReport {
  claimed: number;
  processed: number;
  failed: number;
  errors?: string[];
}

export class InteractionOutboxRelay {
  private repository: SupportIntelligenceRepository;
  private client: PostgresClient;
  private worker: InteractionWorker;
  private workerId: string;

  constructor(
    repository: SupportIntelligenceRepository = supportIntelligenceRepository,
    client: PostgresClient = pgClient,
    workerId: string = `outbox-relay-${Date.now()}`
  ) {
    this.repository = repository;
    this.client = client;
    this.worker = new InteractionWorker(repository, client, workerId);
    this.workerId = workerId;
  }

  /**
   * Scans and processes any pending or retryable interaction events that were
   * persisted in the outbox or interaction_events table but not yet dispatched
   * or completed by Temporal. Guarantees complete ingress recovery.
   */
  async drainPendingInteractions(limit = 50): Promise<OutboxRelayReport> {
    const events = await this.repository.claimInteractions(limit, this.workerId);
    if (events.length === 0) {
      return { claimed: 0, processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const { issueId } = await this.worker.processEvent(event.eventId, event.tenantId);

        // Mark outbox entry as delivered in tenant session
        await this.client.withTenantSession(event.tenantId, async (session) => {
          await session.query(
            `UPDATE supportv8.interaction_outbox
             SET status = 'delivered',
                 processed_at = NOW()
             WHERE tenant_id = $1
               AND event_key = $2`,
            [event.tenantId, `evt:${event.tenantId}:${event.eventId}`]
          );
        });

        processed++;
      } catch (err: any) {
        failed++;
        errors.push(`Failed event ${event.eventId} (${event.tenantId}): ${err.message}`);
      }
    }

    return {
      claimed: events.length,
      processed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

export const interactionOutboxRelay = new InteractionOutboxRelay();

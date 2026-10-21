import { pgClient, PostgresClient } from "@/lib/db/pg-client";
import {
  supportIntelligenceRepository,
  PgSupportIntelligenceRepository,
} from "@/lib/db/support-intelligence-repository";
import type { SupportIntelligenceRepository } from "@/lib/types";

export interface InteractionActivityOptions {
  repository?: SupportIntelligenceRepository;
  client?: PostgresClient;
}

export class TerminalInteractionError extends Error {
  readonly errorCode: string;

  constructor(message: string, errorCode = "TERMINAL_INTERACTION_ERROR") {
    super(message);
    this.name = "TerminalInteractionError";
    this.errorCode = errorCode;
  }
}

/**
 * Derives a durable Issue record from a stored interaction event under tenant RLS.
 * Idempotently inserts or updates supportv8.issues on (tenant_id, source, external_id).
 * Associates the derived issueId with the interaction and marks it 'completed'.
 */
export async function deriveIssueFromInteractionActivity(
  eventId: string,
  tenantId: string,
  options?: InteractionActivityOptions
): Promise<{ issueId: string }> {
  const repo = options?.repository ?? supportIntelligenceRepository;
  const client = options?.client ?? pgClient;

  // 1. Fetch interaction event within tenant boundary
  const interaction = await repo.getInteraction(tenantId, eventId);
  if (!interaction) {
    const retryAt = new Date().toISOString();
    try {
      await repo.failInteraction(tenantId, eventId, "EVENT_NOT_FOUND", retryAt);
    } catch {}
    throw new TerminalInteractionError(
      `Interaction event '${eventId}' not found for tenant '${tenantId}'`,
      "EVENT_NOT_FOUND"
    );
  }

  // 2. Validate envelope integrity
  if (!interaction.sourceReference || !interaction.sourceUrl) {
    const retryAt = new Date().toISOString();
    try {
      await repo.failInteraction(tenantId, eventId, "INVALID_EVENT_DATA", retryAt);
    } catch {}
    throw new TerminalInteractionError(
      `Interaction event '${eventId}' missing required source reference or URL`,
      "INVALID_EVENT_DATA"
    );
  }

  const issueId = "iss_" + crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  const firstLine = interaction.text.split("\n")[0]?.trim() || "";
  const summary = firstLine.length > 0 ? firstLine.slice(0, 200) : `Zendesk ticket ${interaction.sourceReference}`;

  const customerName =
    (interaction.raw?.customerName as string) ||
    (interaction.raw?.requesterName as string) ||
    interaction.customerReference;

  // 3. Upsert durable issue under forced tenant RLS session
  const derivedIssueId = await client.withTenantSession(tenantId, async (session) => {
    const rows = await session.query<{ id: string }>(
      `INSERT INTO supportv8.issues (
         id, tenant_id, source, external_id, source_url, customer_ref,
         customer_name, summary, source_status, timeline, messages,
         created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, 'open', $9, $10,
         NOW(), NOW()
       )
       ON CONFLICT (tenant_id, source, external_id) DO UPDATE SET
         source_url = EXCLUDED.source_url,
         summary = CASE WHEN supportv8.issues.summary = '' THEN EXCLUDED.summary ELSE supportv8.issues.summary END,
         updated_at = NOW()
       RETURNING id`,
      [
        issueId,
        tenantId,
        interaction.source,
        interaction.sourceReference,
        interaction.sourceUrl,
        interaction.customerReference,
        customerName,
        summary,
        JSON.stringify([
          {
            type: "interaction_received",
            eventId: interaction.eventId,
            occurredAt: interaction.occurredAt,
            timestamp: new Date().toISOString(),
          },
        ]),
        JSON.stringify([
          {
            sender: interaction.sender,
            text: interaction.text,
            occurredAt: interaction.occurredAt,
          },
        ]),
      ]
    );

    return rows[0].id;
  });

  // 4. Mark interaction completed and link issueId
  await repo.completeInteraction(tenantId, eventId, derivedIssueId);

  return { issueId: derivedIssueId };
}

/**
 * Workflow implementation for processing an inbound support interaction.
 * Workflow ID format: support-interaction:${tenantId}:${eventId}
 */
export async function processSupportInteraction(
  eventId: string,
  tenantId: string,
  options?: InteractionActivityOptions
): Promise<{ issueId: string }> {
  return await deriveIssueFromInteractionActivity(eventId, tenantId, options);
}

/**
 * Worker helper for processing claimed interaction events in background loops or tests.
 */
export class InteractionWorker {
  private readonly repository: SupportIntelligenceRepository;
  private readonly client: PostgresClient;
  private readonly workerId: string;

  constructor(
    repository: SupportIntelligenceRepository = supportIntelligenceRepository,
    client: PostgresClient = pgClient,
    workerId: string = `worker-${crypto.randomUUID().slice(0, 8)}`
  ) {
    this.repository = repository;
    this.client = client;
    this.workerId = workerId;
  }

  async processEvent(eventId: string, tenantId: string): Promise<{ issueId: string }> {
    return deriveIssueFromInteractionActivity(eventId, tenantId, {
      repository: this.repository,
      client: this.client,
    });
  }

  async processNext(tenantId?: string): Promise<{ processed: number; issueId?: string }> {
    const events = tenantId
      ? await (this.repository.claimInteractionsForTenant
          ? this.repository.claimInteractionsForTenant(tenantId, 1, this.workerId)
          : this.repository.claimInteractions(1, this.workerId))
      : await this.repository.claimInteractions(1, this.workerId);

    if (events.length === 0) return { processed: 0 };
    const event = events[0];
    const res = await this.processEvent(event.eventId, event.tenantId);
    return { processed: 1, issueId: res.issueId };
  }
}

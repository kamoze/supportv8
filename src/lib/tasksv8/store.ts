import { randomUUID } from "node:crypto";
import { pgClient, type PostgresClient } from "@/lib/db/pg-client";
import {
  type CloudEventV1,
  type WorkIntakeV1,
  type WorkOutcomeV1,
  canonicalJson,
  sha256Hex,
} from "./contracts";

export interface Tasksv8Link {
  tenantId: string;
  accountId: string;
  ticketId: string;
  taskId?: string | null;
  taskUri?: string | null;
  sourceRevision: number;
  lastEventId: string;
  lastReceiptId?: string | null;
  outcomeState?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Tasksv8OutboxItem {
  tenantId: string;
  accountId: string;
  eventId: string;
  requestDigest: string;
  payload: CloudEventV1<WorkIntakeV1>;
  status: "pending" | "leased" | "delivered" | "failed";
  leaseToken?: string | null;
  leaseExpiresAt?: Date | string | null;
  attemptCount: number;
  receiptId?: string | null;
  createdAt: Date | string;
  sourceRecordId?: string;
}

export interface Tasksv8OutcomeReceipt {
  tenantId: string;
  eventId: string;
  payloadDigest: string;
  receiptId: string;
  payload: CloudEventV1<WorkOutcomeV1>;
  createdAt: Date | string;
}

export interface RecordOutcomeResult {
  receiptId: string;
  eventId: string;
  state: "recorded" | "duplicate";
}

export interface Tasksv8Store {
  recordEscalation(
    scope: { tenantId: string; accountId?: string },
    ticket: { id: string; summary?: string; priority?: string; sourceUrl?: string; [key: string]: unknown },
    intakeEvent?: CloudEventV1<WorkIntakeV1>
  ): Promise<{ link: Tasksv8Link; outboxItem: Tasksv8OutboxItem }>;

  claimOutbox(
    batchSize?: number,
    leaseMs?: number,
    tenantId?: string
  ): Promise<Tasksv8OutboxItem[]>;

  ackOutbox(
    scope: { tenantId: string; accountId?: string },
    eventId: string,
    receiptId: string,
    taskId?: string,
    taskUri?: string
  ): Promise<void>;

  recordOutcome(
    scope: { tenantId: string; accountId?: string },
    outcomeEvent: CloudEventV1<WorkOutcomeV1>
  ): Promise<RecordOutcomeResult>;

  getLink(
    scope: { tenantId: string },
    ticketId: string
  ): Promise<Tasksv8Link | null>;

  pending(tenantId: string): Promise<Tasksv8OutboxItem[]>;

  outcomeReceipt(
    tenantId: string,
    eventId: string
  ): Promise<Tasksv8OutcomeReceipt | null>;
}

export class MemoryTasksv8Store implements Tasksv8Store {
  private readonly links = new Map<string, Tasksv8Link>();
  private readonly outbox = new Map<string, Tasksv8OutboxItem>();
  private readonly receipts = new Map<string, Tasksv8OutcomeReceipt>();

  private linkKey(tenantId: string, ticketId: string): string {
    return `${tenantId}:${ticketId}`;
  }

  private outboxKey(tenantId: string, eventId: string): string {
    return `${tenantId}:${eventId}`;
  }

  private receiptKey(tenantId: string, eventId: string): string {
    return `${tenantId}:${eventId}`;
  }

  async recordEscalation(
    scope: { tenantId: string; accountId?: string },
    ticket: { id: string; summary?: string; priority?: string; sourceUrl?: string; [key: string]: unknown },
    customEvent?: CloudEventV1<WorkIntakeV1>
  ): Promise<{ link: Tasksv8Link; outboxItem: Tasksv8OutboxItem }> {
    const tenantId = scope.tenantId;
    const accountId = scope.accountId ?? `${tenantId}-account`;
    const lKey = this.linkKey(tenantId, ticket.id);
    const existing = this.links.get(lKey);
    const sourceRevision = existing ? existing.sourceRevision + 1 : 1;
    const nowIso = new Date().toISOString();

    const intakeEvent: CloudEventV1<WorkIntakeV1> = customEvent ?? {
      specversion: "1.0",
      id: `evt_intake_${randomUUID()}`,
      source: "urn:servicev8:supportv8",
      type: "servicev8.work-intake.v1",
      time: nowIso,
      datacontenttype: "application/json",
      data: {
        schema: "servicev8.work-intake.v1",
        operation: "upsert",
        source: {
          system: "supportv8",
          recordId: ticket.id,
          recordUri:
            ticket.sourceUrl ??
            `https://${tenantId}.support.servicev8.com/runtime?ticket=${ticket.id}`,
          revision: sourceRevision,
          occurredAt: nowIso,
        },
        work: {
          workKind: "support_escalation",
          title: ticket.summary ?? `Support Escalation ${ticket.id}`,
          problemStatement: ticket.summary ?? `Support ticket ${ticket.id} escalated`,
          desiredOutcome: "Investigate and resolve support escalation",
          acceptanceCriteria: ["Investigate root cause and apply remediation"],
          constraints: [],
          nonGoals: [],
          requiredDeliverables: ["Remediation evidence"],
          verificationMethod: "human_review",
          priority:
            ticket.priority === "urgent"
              ? "urgent"
              : ticket.priority === "high"
              ? "high"
              : "medium",
          severity: "major",
          customerImpact: ticket.summary,
          labels: ["support_escalation", "supportv8"],
        },
        relationships: [
          {
            kind: "triggered_by",
            targetSystem: "supportv8",
            targetId: ticket.id,
          },
        ],
        correlationId: ticket.id,
      },
    };

    const requestDigest = sha256Hex(canonicalJson(intakeEvent));

    const link: Tasksv8Link = {
      tenantId,
      accountId,
      ticketId: ticket.id,
      taskId: existing?.taskId ?? null,
      taskUri: existing?.taskUri ?? null,
      sourceRevision,
      lastEventId: intakeEvent.id,
      lastReceiptId: existing?.lastReceiptId ?? null,
      outcomeState: "escalated",
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    this.links.set(lKey, link);

    const outboxItem: Tasksv8OutboxItem = {
      tenantId,
      accountId,
      eventId: intakeEvent.id,
      requestDigest,
      payload: intakeEvent,
      status: "pending",
      leaseToken: null,
      leaseExpiresAt: null,
      attemptCount: 0,
      receiptId: null,
      createdAt: nowIso,
      sourceRecordId: ticket.id,
    };
    this.outbox.set(this.outboxKey(tenantId, intakeEvent.id), outboxItem);

    return { link, outboxItem };
  }

  async claimOutbox(
    batchSize = 10,
    leaseMs = 30000,
    tenantId?: string
  ): Promise<Tasksv8OutboxItem[]> {
    const now = new Date();
    const claimed: Tasksv8OutboxItem[] = [];

    for (const item of this.outbox.values()) {
      if (tenantId && item.tenantId !== tenantId) continue;
      const isPending = item.status === "pending";
      const isExpiredLease =
        item.status === "leased" &&
        item.leaseExpiresAt &&
        new Date(item.leaseExpiresAt) < now;

      if (isPending || isExpiredLease) {
        item.status = "leased";
        item.leaseToken = randomUUID();
        item.leaseExpiresAt = new Date(Date.now() + leaseMs).toISOString();
        item.attemptCount++;
        claimed.push({ ...item, sourceRecordId: item.payload.data.source.recordId });
        if (claimed.length >= batchSize) break;
      }
    }

    return claimed;
  }

  async ackOutbox(
    scope: { tenantId: string; accountId?: string },
    eventId: string,
    receiptId: string,
    taskId?: string,
    taskUri?: string
  ): Promise<void> {
    const oKey = this.outboxKey(scope.tenantId, eventId);
    const item = this.outbox.get(oKey);
    if (item) {
      item.status = "delivered";
      item.receiptId = receiptId;
      item.leaseToken = null;
      item.leaseExpiresAt = null;
    }

    // Find and update link
    for (const link of this.links.values()) {
      if (link.tenantId === scope.tenantId && link.lastEventId === eventId) {
        if (taskId) link.taskId = taskId;
        if (taskUri) link.taskUri = taskUri;
        link.lastReceiptId = receiptId;
        link.updatedAt = new Date().toISOString();
        break;
      }
    }
  }

  async recordOutcome(
    scope: { tenantId: string; accountId?: string },
    outcomeEvent: CloudEventV1<WorkOutcomeV1>
  ): Promise<RecordOutcomeResult> {
    // 1. Locate target ticket from sourceReferences
    const targetRef =
      outcomeEvent.data.sourceReferences.find((r) => r.system === "supportv8") ??
      outcomeEvent.data.sourceReferences[0];
    const ticketId = targetRef?.recordId ?? outcomeEvent.data.workId;

    // Check if link exists for any tenant
    let link: Tasksv8Link | undefined;
    for (const l of this.links.values()) {
      if (l.ticketId === ticketId) {
        link = l;
        break;
      }
    }

    if (!link) {
      const err = new Error(`Link not found for ticket ${ticketId}`);
      (err as any).code = "link_not_found";
      throw err;
    }

    if (link.tenantId !== scope.tenantId) {
      const err = new Error(`Foreign tenant denied for ticket ${ticketId}`);
      (err as any).code = "tenant_forbidden";
      throw err;
    }

    // 2. Check idempotency
    const payloadDigest = sha256Hex(canonicalJson(outcomeEvent));
    const rKey = this.receiptKey(scope.tenantId, outcomeEvent.id);
    const existing = this.receipts.get(rKey);

    if (existing) {
      if (existing.payloadDigest === payloadDigest) {
        return {
          receiptId: existing.receiptId,
          eventId: outcomeEvent.id,
          state: "duplicate",
        };
      }
      const err = new Error(
        `idempotency_conflict: Conflicting outcome payload digest for event ${outcomeEvent.id}`
      );
      (err as any).code = "idempotency_conflict";
      throw err;
    }

    // 3. Record outcome receipt
    const receiptId = randomUUID();
    const receipt: Tasksv8OutcomeReceipt = {
      tenantId: scope.tenantId,
      eventId: outcomeEvent.id,
      payloadDigest,
      receiptId,
      payload: outcomeEvent,
      createdAt: new Date().toISOString(),
    };
    this.receipts.set(rKey, receipt);

    // 4. Update link outcome state WITHOUT touching ticket status!
    const updatedLink: Tasksv8Link = {
      ...link,
      outcomeState: outcomeEvent.data.execution.state,
      lastReceiptId: receiptId,
      updatedAt: new Date().toISOString(),
    };
    this.links.set(this.linkKey(link.tenantId, link.ticketId), updatedLink);

    return {
      receiptId,
      eventId: outcomeEvent.id,
      state: "recorded",
    };
  }

  async getLink(
    scope: { tenantId: string },
    ticketId: string
  ): Promise<Tasksv8Link | null> {
    const link = this.links.get(this.linkKey(scope.tenantId, ticketId));
    return link ? { ...link } : null;
  }

  async pending(tenantId: string): Promise<Tasksv8OutboxItem[]> {
    const list: Tasksv8OutboxItem[] = [];
    for (const item of this.outbox.values()) {
      if (item.tenantId === tenantId && item.status === "pending") {
        list.push({ ...item, sourceRecordId: item.payload.data.source.recordId });
      }
    }
    return list;
  }

  async outcomeReceipt(
    tenantId: string,
    eventId: string
  ): Promise<Tasksv8OutcomeReceipt | null> {
    const r = this.receipts.get(this.receiptKey(tenantId, eventId));
    return r ? { ...r } : null;
  }
}

export class PostgresTasksv8Store implements Tasksv8Store {
  constructor(private readonly client: PostgresClient = pgClient) {}

  async recordEscalation(
    scope: { tenantId: string; accountId?: string },
    ticket: { id: string; summary?: string; priority?: string; sourceUrl?: string; [key: string]: unknown },
    customEvent?: CloudEventV1<WorkIntakeV1>
  ): Promise<{ link: Tasksv8Link; outboxItem: Tasksv8OutboxItem }> {
    const tenantId = scope.tenantId;
    const accountId = scope.accountId ?? `${tenantId}-account`;
    const nowIso = new Date().toISOString();

    return this.client.withTenantSession(tenantId, async (db) => {
      // Find current revision
      const existing = await db.query<any>(
        `SELECT source_revision, task_id, task_uri, last_receipt_id, created_at
         FROM supportv8.tasksv8_links
         WHERE tenant_id = $1 AND ticket_id = $2
         LIMIT 1`,
        [tenantId, ticket.id]
      );

      const sourceRevision = existing[0] ? existing[0].source_revision + 1 : 1;

      const intakeEvent: CloudEventV1<WorkIntakeV1> = customEvent ?? {
        specversion: "1.0",
        id: `evt_intake_${randomUUID()}`,
        source: "urn:servicev8:supportv8",
        type: "servicev8.work-intake.v1",
        time: nowIso,
        datacontenttype: "application/json",
        data: {
          schema: "servicev8.work-intake.v1",
          operation: "upsert",
          source: {
            system: "supportv8",
            recordId: ticket.id,
            recordUri:
              ticket.sourceUrl ??
              `https://${tenantId}.support.servicev8.com/runtime?ticket=${ticket.id}`,
            revision: sourceRevision,
            occurredAt: nowIso,
          },
          work: {
            workKind: "support_escalation",
            title: ticket.summary ?? `Support Escalation ${ticket.id}`,
            problemStatement: ticket.summary ?? `Support ticket ${ticket.id} escalated`,
            desiredOutcome: "Investigate and resolve support escalation",
            acceptanceCriteria: ["Investigate root cause and apply remediation"],
            constraints: [],
            nonGoals: [],
            requiredDeliverables: ["Remediation evidence"],
            verificationMethod: "human_review",
            priority:
              ticket.priority === "urgent"
                ? "urgent"
                : ticket.priority === "high"
                ? "high"
                : "medium",
            severity: "major",
            customerImpact: ticket.summary,
            labels: ["support_escalation", "supportv8"],
          },
          relationships: [
            {
              kind: "triggered_by",
              targetSystem: "supportv8",
              targetId: ticket.id,
            },
          ],
          correlationId: ticket.id,
        },
      };

      const requestDigest = sha256Hex(canonicalJson(intakeEvent));

      const linkRows = await db.query<any>(
        `INSERT INTO supportv8.tasksv8_links (
           tenant_id, account_id, ticket_id, source_revision, last_event_id, outcome_state, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'escalated', NOW())
         ON CONFLICT (tenant_id, ticket_id)
         DO UPDATE SET
           source_revision = $4,
           last_event_id = $5,
           outcome_state = 'escalated',
           updated_at = NOW()
         RETURNING *`,
        [tenantId, accountId, ticket.id, sourceRevision, intakeEvent.id]
      );

      const outboxRows = await db.query<any>(
        `INSERT INTO supportv8.tasksv8_outbox (
           tenant_id, account_id, event_id, request_digest, payload, status, attempt_count
         ) VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', 0)
         RETURNING *`,
        [tenantId, accountId, intakeEvent.id, requestDigest, JSON.stringify(intakeEvent)]
      );

      const link: Tasksv8Link = {
        tenantId: linkRows[0].tenant_id,
        accountId: linkRows[0].account_id,
        ticketId: linkRows[0].ticket_id,
        taskId: linkRows[0].task_id,
        taskUri: linkRows[0].task_uri,
        sourceRevision: linkRows[0].source_revision,
        lastEventId: linkRows[0].last_event_id,
        lastReceiptId: linkRows[0].last_receipt_id,
        outcomeState: linkRows[0].outcome_state,
        createdAt: linkRows[0].created_at,
        updatedAt: linkRows[0].updated_at,
      };

      const outboxItem: Tasksv8OutboxItem = {
        tenantId: outboxRows[0].tenant_id,
        accountId: outboxRows[0].account_id,
        eventId: outboxRows[0].event_id,
        requestDigest: outboxRows[0].request_digest,
        payload: outboxRows[0].payload,
        status: outboxRows[0].status,
        leaseToken: outboxRows[0].lease_token,
        leaseExpiresAt: outboxRows[0].lease_expires_at,
        attemptCount: outboxRows[0].attempt_count,
        receiptId: outboxRows[0].receipt_id,
        createdAt: outboxRows[0].created_at,
        sourceRecordId: ticket.id,
      };

      return { link, outboxItem };
    });
  }

  async claimOutbox(
    batchSize = 10,
    leaseMs = 30000,
    tenantId?: string
  ): Promise<Tasksv8OutboxItem[]> {
    if (!tenantId) {
      throw new Error("PostgresTasksv8Store requires tenantId to claim outbox items");
    }
    const leaseToken = randomUUID();

    return this.client.withTenantSession(tenantId, async (db) => {
      const rows = await db.query<any>(
        `UPDATE supportv8.tasksv8_outbox
         SET status = 'leased',
             lease_token = $1,
             lease_expires_at = NOW() + ($2 || ' milliseconds')::interval,
             attempt_count = attempt_count + 1
         WHERE (tenant_id, event_id) IN (
             SELECT tenant_id, event_id
             FROM supportv8.tasksv8_outbox
             WHERE tenant_id = $3 AND (status = 'pending' OR (status = 'leased' AND lease_expires_at < NOW()))
             ORDER BY created_at ASC
             LIMIT $4
             FOR UPDATE SKIP LOCKED
         )
         RETURNING *`,
        [leaseToken, leaseMs, tenantId, batchSize]
      );

      return rows.map((r) => ({
        tenantId: r.tenant_id,
        accountId: r.account_id,
        eventId: r.event_id,
        requestDigest: r.request_digest,
        payload: r.payload,
        status: r.status,
        leaseToken: r.lease_token,
        leaseExpiresAt: r.lease_expires_at,
        attemptCount: r.attempt_count,
        receiptId: r.receipt_id,
        createdAt: r.created_at,
        sourceRecordId: r.payload?.data?.source?.recordId,
      }));
    });
  }

  async ackOutbox(
    scope: { tenantId: string; accountId?: string },
    eventId: string,
    receiptId: string,
    taskId?: string,
    taskUri?: string
  ): Promise<void> {
    return this.client.withTenantSession(scope.tenantId, async (db) => {
      await db.query(
        `UPDATE supportv8.tasksv8_outbox
         SET status = 'delivered',
             receipt_id = $2,
             lease_token = NULL,
             lease_expires_at = NULL
         WHERE tenant_id = $1 AND event_id = $3`,
        [scope.tenantId, receiptId, eventId]
      );

      await db.query(
        `UPDATE supportv8.tasksv8_links
         SET task_id = COALESCE($3, task_id),
             task_uri = COALESCE($4, task_uri),
             last_receipt_id = $5,
             updated_at = NOW()
         WHERE tenant_id = $1 AND last_event_id = $2`,
        [scope.tenantId, eventId, taskId ?? null, taskUri ?? null, receiptId]
      );
    });
  }

  async recordOutcome(
    scope: { tenantId: string; accountId?: string },
    outcomeEvent: CloudEventV1<WorkOutcomeV1>
  ): Promise<RecordOutcomeResult> {
    const targetRef =
      outcomeEvent.data.sourceReferences.find((r) => r.system === "supportv8") ??
      outcomeEvent.data.sourceReferences[0];
    const ticketId = targetRef?.recordId ?? outcomeEvent.data.workId;

    return this.client.withTenantSession(scope.tenantId, async (db) => {
      const links = await db.query<any>(
        `SELECT tenant_id, ticket_id, outcome_state
         FROM supportv8.tasksv8_links
         WHERE tenant_id = $1 AND ticket_id = $2
         LIMIT 1`,
        [scope.tenantId, ticketId]
      );

      if (!links[0]) {
        // Check if ticket exists in any other tenant
        const anyLinks = await db
          .query<any>(
            `SET LOCAL row_security = off;
             SELECT tenant_id FROM supportv8.tasksv8_links WHERE ticket_id = $1 LIMIT 1;`,
            [ticketId]
          )
          .catch(() => []);
        if (anyLinks[0] && anyLinks[0].tenant_id !== scope.tenantId) {
          const err = new Error(`Foreign tenant denied for ticket ${ticketId}`);
          (err as any).code = "tenant_forbidden";
          throw err;
        }
        const err = new Error(`Link not found for ticket ${ticketId}`);
        (err as any).code = "link_not_found";
        throw err;
      }

      const payloadDigest = sha256Hex(canonicalJson(outcomeEvent));

      const existingReceipts = await db.query<any>(
        `SELECT receipt_id, payload_digest
         FROM supportv8.tasksv8_outcome_receipts
         WHERE tenant_id = $1 AND event_id = $2
         LIMIT 1`,
        [scope.tenantId, outcomeEvent.id]
      );

      if (existingReceipts[0]) {
        if (existingReceipts[0].payload_digest === payloadDigest) {
          return {
            receiptId: existingReceipts[0].receipt_id,
            eventId: outcomeEvent.id,
            state: "duplicate",
          };
        }
        const err = new Error(
          `idempotency_conflict: Conflicting outcome payload digest for event ${outcomeEvent.id}`
        );
        (err as any).code = "idempotency_conflict";
        throw err;
      }

      const receiptId = randomUUID();

      await db.query(
        `INSERT INTO supportv8.tasksv8_outcome_receipts (
           tenant_id, event_id, payload_digest, receipt_id, payload
         ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          scope.tenantId,
          outcomeEvent.id,
          payloadDigest,
          receiptId,
          JSON.stringify(outcomeEvent),
        ]
      );

      // CRITICAL: NEVER UPDATE supportv8.issues! Update tasksv8_links only.
      await db.query(
        `UPDATE supportv8.tasksv8_links
         SET outcome_state = $3,
             last_receipt_id = $4,
             updated_at = NOW()
         WHERE tenant_id = $1 AND ticket_id = $2`,
        [scope.tenantId, ticketId, outcomeEvent.data.execution.state, receiptId]
      );

      return {
        receiptId,
        eventId: outcomeEvent.id,
        state: "recorded",
      };
    });
  }

  async getLink(
    scope: { tenantId: string },
    ticketId: string
  ): Promise<Tasksv8Link | null> {
    return this.client.withTenantSession(scope.tenantId, async (db) => {
      const rows = await db.query<any>(
        `SELECT tenant_id, account_id, ticket_id, task_id, task_uri,
                source_revision, last_event_id, last_receipt_id, outcome_state,
                created_at, updated_at
         FROM supportv8.tasksv8_links
         WHERE tenant_id = $1 AND ticket_id = $2
         LIMIT 1`,
        [scope.tenantId, ticketId]
      );
      if (!rows[0]) return null;
      return {
        tenantId: rows[0].tenant_id,
        accountId: rows[0].account_id,
        ticketId: rows[0].ticket_id,
        taskId: rows[0].task_id,
        taskUri: rows[0].task_uri,
        sourceRevision: rows[0].source_revision,
        lastEventId: rows[0].last_event_id,
        lastReceiptId: rows[0].last_receipt_id,
        outcomeState: rows[0].outcome_state,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at,
      };
    });
  }

  async pending(tenantId: string): Promise<Tasksv8OutboxItem[]> {
    return this.client.withTenantSession(tenantId, async (db) => {
      const rows = await db.query<any>(
        `SELECT tenant_id, account_id, event_id, request_digest, payload,
                status, lease_token, lease_expires_at, attempt_count, receipt_id,
                created_at
         FROM supportv8.tasksv8_outbox
         WHERE tenant_id = $1 AND status = 'pending'
         ORDER BY created_at ASC`,
        [tenantId]
      );
      return rows.map((r) => ({
        tenantId: r.tenant_id,
        accountId: r.account_id,
        eventId: r.event_id,
        requestDigest: r.request_digest,
        payload: r.payload,
        status: r.status,
        leaseToken: r.lease_token,
        leaseExpiresAt: r.lease_expires_at,
        attemptCount: r.attempt_count,
        receiptId: r.receipt_id,
        createdAt: r.created_at,
        sourceRecordId: r.payload?.data?.source?.recordId,
      }));
    });
  }

  async outcomeReceipt(
    tenantId: string,
    eventId: string
  ): Promise<Tasksv8OutcomeReceipt | null> {
    return this.client.withTenantSession(tenantId, async (db) => {
      const rows = await db.query<any>(
        `SELECT tenant_id, event_id, payload_digest, receipt_id, payload, created_at
         FROM supportv8.tasksv8_outcome_receipts
         WHERE tenant_id = $1 AND event_id = $2
         LIMIT 1`,
        [tenantId, eventId]
      );
      if (!rows[0]) return null;
      return {
        tenantId: rows[0].tenant_id,
        eventId: rows[0].event_id,
        payloadDigest: rows[0].payload_digest,
        receiptId: rows[0].receipt_id,
        payload: rows[0].payload,
        createdAt: rows[0].created_at,
      };
    });
  }
}

let activeStore: Tasksv8Store | undefined;

export function getTasksv8Store(): Tasksv8Store {
  if (!activeStore) {
    if (process.env.DATABASE_URL || process.env.SUPPORTV8_DATABASE_URL) {
      activeStore = new PostgresTasksv8Store();
    } else {
      activeStore = new MemoryTasksv8Store();
    }
  }
  return activeStore;
}

export function setTasksv8Store(store: Tasksv8Store): void {
  activeStore = store;
}

export function resetTasksv8Store(): void {
  activeStore = undefined;
}

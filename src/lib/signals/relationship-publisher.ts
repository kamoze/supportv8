import { createHash } from "node:crypto";
import type { DomainOutboxStore, DomainTransactionContext } from "@/lib/platform/event-outbox";

export type EntityRef = {
  entityId: string;
  entityType: string;
  owningInstallationId: string;
};

export type RelationAssertion = {
  schemaVersion: "servicev8.olg.relation.v1";
  accountId: string;
  tenantId: string;
  assertionId: string;
  revision: number;
  source: EntityRef;
  target: EntityRef;
  predicate: "supportv8.ticket.about_order" | "supportv8.ticket.for_customer";
  definitionVersion: string;
  producerBindingId: string;
  evidenceRefs: string[];
  evidenceDigest: string;
  validFrom: string;
  validTo: string | null;
  recordedAt: string;
  supersedesAssertionId: string | null;
  epistemicClass: "source_reported";
};

export type SupportTicketRelationshipInput = {
  tenantId: string;
  accountId: string;
  installationId: string;
  connectionId: string;
  producerBindingId: string;
  ticketId: string;
  customerId?: string | null;
  orderId?: string | null;
  orderInstallationId?: string | null;
  orderConnectionId?: string | null;
  revision: number;
  occurredAt: string;
  evidenceRefs: string[];
  supersedesOrderAssertionId?: string | null;
  supersedesCustomerAssertionId?: string | null;
};

function canonicalEntityId(tenantId: string, installationId: string, connectionId: string, entityType: string, sourceObjectId: string): string {
  const hash = createHash("sha256")
    .update(`${tenantId}|${installationId}|${connectionId}|${entityType}|${sourceObjectId}`)
    .digest("hex")
    .slice(0, 24);
  return `ent_${entityType}_${hash}`;
}

function computeDigest(payload: unknown): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
}

export async function stageSupportTicketRelationships(
  tx: DomainTransactionContext,
  input: SupportTicketRelationshipInput
): Promise<RelationAssertion[]> {
  const staged: RelationAssertion[] = [];
  const ticketRef: EntityRef = {
    entityId: canonicalEntityId(
      input.tenantId,
      input.installationId,
      input.connectionId,
      "support_ticket",
      input.ticketId
    ),
    entityType: "support_ticket",
    owningInstallationId: input.installationId,
  };

  if (input.orderId) {
    const orderInst = input.orderInstallationId ?? input.installationId;
    const orderConn = input.orderConnectionId ?? input.connectionId;
    const orderRef: EntityRef = {
      entityId: canonicalEntityId(
        input.tenantId,
        orderInst,
        orderConn,
        "order",
        input.orderId
      ),
      entityType: "order",
      owningInstallationId: orderInst,
    };
    const assertionId = `rel_support_order_${createHash("sha256")
      .update(`${input.tenantId}|${input.ticketId}|${input.orderId}|${input.revision}`)
      .digest("hex")
      .slice(0, 20)}`;
    const assertion: RelationAssertion = {
      schemaVersion: "servicev8.olg.relation.v1",
      accountId: input.accountId,
      tenantId: input.tenantId,
      assertionId,
      revision: input.revision,
      source: ticketRef,
      target: orderRef,
      predicate: "supportv8.ticket.about_order",
      definitionVersion: "1.0.0",
      producerBindingId: input.producerBindingId,
      evidenceRefs: [...input.evidenceRefs],
      evidenceDigest: computeDigest({
        predicate: "supportv8.ticket.about_order",
        ticketId: input.ticketId,
        orderId: input.orderId,
        revision: input.revision,
        evidenceRefs: input.evidenceRefs,
      }),
      validFrom: input.occurredAt,
      validTo: null,
      recordedAt: input.occurredAt,
      supersedesAssertionId: input.supersedesOrderAssertionId ?? null,
      epistemicClass: "source_reported",
    };

    await tx.stageEvent({
      id: `outbox_${assertionId}`,
      tenantId: input.tenantId,
      eventType: "com.servicev8.olg.relation.asserted.v1",
      aggregateType: "ticket",
      aggregateId: input.ticketId,
      payload: {
        assertion,
        sourceKey: {
          tenantId: input.tenantId,
          accountId: input.accountId,
          owningInstallationId: input.installationId,
          connectionId: input.connectionId,
          entityType: "support_ticket",
          sourceObjectId: input.ticketId,
        },
        targetKey: {
          tenantId: input.tenantId,
          accountId: input.accountId,
          owningInstallationId: orderInst,
          connectionId: orderConn,
          entityType: "order",
          sourceObjectId: input.orderId,
        },
      },
    });
    staged.push(assertion);
  }

  if (input.customerId) {
    const customerRef: EntityRef = {
      entityId: canonicalEntityId(
        input.tenantId,
        input.installationId,
        input.connectionId,
        "customer",
        input.customerId
      ),
      entityType: "customer",
      owningInstallationId: input.installationId,
    };
    const assertionId = `rel_support_cust_${createHash("sha256")
      .update(`${input.tenantId}|${input.ticketId}|${input.customerId}|${input.revision}`)
      .digest("hex")
      .slice(0, 20)}`;
    const assertion: RelationAssertion = {
      schemaVersion: "servicev8.olg.relation.v1",
      accountId: input.accountId,
      tenantId: input.tenantId,
      assertionId,
      revision: input.revision,
      source: ticketRef,
      target: customerRef,
      predicate: "supportv8.ticket.for_customer",
      definitionVersion: "1.0.0",
      producerBindingId: input.producerBindingId,
      evidenceRefs: [...input.evidenceRefs],
      evidenceDigest: computeDigest({
        predicate: "supportv8.ticket.for_customer",
        ticketId: input.ticketId,
        customerId: input.customerId,
        revision: input.revision,
        evidenceRefs: input.evidenceRefs,
      }),
      validFrom: input.occurredAt,
      validTo: null,
      recordedAt: input.occurredAt,
      supersedesAssertionId: input.supersedesCustomerAssertionId ?? null,
      epistemicClass: "source_reported",
    };

    await tx.stageEvent({
      id: `outbox_${assertionId}`,
      tenantId: input.tenantId,
      eventType: "com.servicev8.olg.relation.asserted.v1",
      aggregateType: "ticket",
      aggregateId: input.ticketId,
      payload: {
        assertion,
        sourceKey: {
          tenantId: input.tenantId,
          accountId: input.accountId,
          owningInstallationId: input.installationId,
          connectionId: input.connectionId,
          entityType: "support_ticket",
          sourceObjectId: input.ticketId,
        },
        targetKey: {
          tenantId: input.tenantId,
          accountId: input.accountId,
          owningInstallationId: input.installationId,
          connectionId: input.connectionId,
          entityType: "customer",
          sourceObjectId: input.customerId,
        },
      },
    });
    staged.push(assertion);
  }

  return staged;
}

export type SupportRelationshipPublisherOptions = {
  outbox: DomainOutboxStore;
  workerId: string;
  leaseDurationMs?: number;
  batchSize?: number;
  runtimeUrl?: string;
  connectionToken?: string;
  fetchImpl?: typeof fetch;
};

export function createSupportRelationshipPublisher(options: SupportRelationshipPublisherOptions) {
  const leaseDurationMs = options.leaseDurationMs ?? 30_000;
  const batchSize = options.batchSize ?? 25;
  const fetchFn = options.fetchImpl ?? fetch;
  const runtimeUrl = (options.runtimeUrl ?? process.env.SERVICEV8_RUNTIME_URL ?? "http://localhost:3300").replace(
    /\/$/,
    ""
  );

  return {
    async flushPending(tenantId?: string): Promise<{ delivered: number; failed: number }> {
      const claimed = await options.outbox.claim(options.workerId, batchSize, leaseDurationMs);
      let delivered = 0;
      let failed = 0;

      for (const ev of claimed) {
        if (tenantId && ev.tenantId !== tenantId) continue;
        if (ev.eventType !== "com.servicev8.olg.relation.asserted.v1") continue;

        const assertion = ev.payload.assertion as RelationAssertion | undefined;
        if (!assertion) {
          failed += 1;
          continue;
        }

        try {
          const response = await fetchFn(`${runtimeUrl}/api/signals/intake`, {
            method: "POST",
            headers: {
              "content-type": "application/cloudevents+json",
              ...(options.connectionToken
                ? { authorization: `Bearer ${options.connectionToken}` }
                : {}),
              "x-servicev8-tenant-id": ev.tenantId,
            },
            body: JSON.stringify({
              specversion: "1.0",
              id: ev.id,
              source: "urn:servicev8:app:supportv8",
              type: ev.eventType,
              subject: `${assertion.source.entityType}:${assertion.source.entityId}`,
              time: assertion.recordedAt,
              datacontenttype: "application/json",
              data: ev.payload,
            }),
          });

          if (!response.ok) {
            failed += 1;
            continue;
          }

          const body = (await response.json()) as { receiptId?: string };
          if (!body.receiptId) {
            failed += 1;
            continue;
          }

          const acked = await options.outbox.ack(
            ev.id,
            options.workerId,
            { receiptId: body.receiptId, deliveredAt: new Date().toISOString() },
            ev.tenantId
          );
          if (acked.success) {
            delivered += 1;
          } else {
            failed += 1;
          }
        } catch {
          failed += 1;
        }
      }

      return { delivered, failed };
    },
  };
}

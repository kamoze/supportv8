import { describe, expect, it, vi } from "vitest";
import { createInMemoryDomainOutboxStore } from "@/lib/platform/event-outbox";
import {
  createSupportRelationshipPublisher,
  stageSupportTicketRelationships,
} from "./relationship-publisher";

describe("SupportV8 Durable Relationship Publisher (Task 3)", () => {
  it("stages ticket-to-order and ticket-to-customer assertions in the transactional outbox and survives crash before publish", async () => {
    const outbox = createInMemoryDomainOutboxStore();

    await outbox.withTransaction(async (tx) => {
      await stageSupportTicketRelationships(tx, {
        tenantId: "tenant_acme_01",
        accountId: "acct_acme_01",
        installationId: "inst_support_01",
        connectionId: "conn_support_us",
        producerBindingId: "bind_support_01_us",
        ticketId: "tkt_701",
        customerId: "cust_301",
        orderId: "ord_901",
        orderInstallationId: "inst_order_01",
        orderConnectionId: "conn_order_us",
        revision: 1,
        occurredAt: "2026-10-13T10:00:00.000Z",
        evidenceRefs: ["urn:servicev8:receipt:rcpt_tkt_701"],
      });
    });

    const pending = await outbox.getPendingEvents("tenant_acme_01");
    expect(pending).toHaveLength(2);
    const predicates = pending.map((e) => (e.payload.assertion as any).predicate).sort();
    expect(predicates).toEqual([
      "supportv8.ticket.about_order",
      "supportv8.ticket.for_customer",
    ]);

    // Simulate first worker crash during network publish (503 from Runtime)
    const failingFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Service Unavailable" }), { status: 503 })
    );
    const crashingPublisher = createSupportRelationshipPublisher({
      outbox,
      workerId: "worker_crash_1",
      leaseDurationMs: 10,
      fetchImpl: failingFetch as unknown as typeof fetch,
      runtimeUrl: "https://runtime.servicev8.test",
    });

    const firstAttempt = await crashingPublisher.flushPending("tenant_acme_01");
    expect(firstAttempt.delivered).toBe(0);
    expect(firstAttempt.failed).toBe(2);

    // Wait for short lease to expire and recover on second worker
    await new Promise((r) => setTimeout(r, 20));

    const deliveredAssertions: unknown[] = [];
    const healthyFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      deliveredAssertions.push(body);
      return new Response(
        JSON.stringify({
          ok: true,
          receiptId: "rcpt_olg_rel_000000000001",
          assertionId: body.data?.assertion?.assertionId,
          replay: false,
        }),
        { status: 202 }
      );
    });

    const recoveryPublisher = createSupportRelationshipPublisher({
      outbox,
      workerId: "worker_recovery_2",
      leaseDurationMs: 5000,
      fetchImpl: healthyFetch as unknown as typeof fetch,
      runtimeUrl: "https://runtime.servicev8.test",
    });

    const secondAttempt = await recoveryPublisher.flushPending("tenant_acme_01");
    expect(secondAttempt.delivered).toBe(2);
    expect(deliveredAssertions).toHaveLength(2);

    const remaining = await outbox.getPendingEvents("tenant_acme_01");
    expect(remaining).toHaveLength(0);
  });
});

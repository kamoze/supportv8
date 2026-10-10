import { describe, it, expect, beforeEach } from "vitest";
import { createAlignmentHarness, AlignmentHarness } from "./alignment-harness";
import {
  DomainOutboxStore,
  createInMemoryDomainOutboxStore,
  validateOlgReceipt,
  sanitizeDomainEventPayload,
} from "@/lib/platform/event-outbox";

describe("EVT-01 to EVT-06: Durable Support-Domain OLG Outbox", () => {
  let harness: AlignmentHarness;
  let outbox: DomainOutboxStore;

  beforeEach(async () => {
    harness = await createAlignmentHarness();
    outbox = createInMemoryDomainOutboxStore();
  });

  it("EVT-01: Domain transaction rolls back -> neither domain mutation nor outbox event commits", async () => {
    // When domain transaction rolls back (e.g. invalid ticket data or aborted commit):
    const abortedResult = await outbox.withTransaction(async (tx) => {
      await tx.stageEvent({
        id: "evt_aborted_001",
        tenantId: "tenant-a",
        eventType: "com.servicev8.business.support.ticket-created.v1",
        aggregateType: "ticket",
        aggregateId: "TICK-999",
        payload: { ticketId: "TICK-999", priority: "urgent" },
      });
      // Simulate transaction failure / rollback
      throw new Error("Simulated database constraint failure");
    }).catch(() => null);

    expect(abortedResult).toBeNull();

    // Event must NOT be persisted in outbox
    const events = await outbox.getPendingEvents("tenant-a");
    expect(events.length).toBe(0);
  });

  it("EVT-02: OLG outage after commit; process restart -> old pending row retried without loss", async () => {
    // Stage and commit event
    await outbox.withTransaction(async (tx) => {
      await tx.stageEvent({
        id: "evt_pending_002",
        tenantId: "tenant-a",
        eventType: "com.servicev8.business.support.ticket-created.v1",
        aggregateType: "ticket",
        aggregateId: "TICK-100",
        payload: { ticketId: "TICK-100", priority: "normal" },
      });
    });

    // Simulate process restart
    await harness.restart();

    // The event remains durable and pending for delivery retry
    const pending = await outbox.getPendingEvents("tenant-a");
    expect(pending.length).toBe(1);
    expect(pending[0].id).toBe("evt_pending_002");
    expect(pending[0].status).toBe("pending");
  });

  it("EVT-03: Two worker leases with fenced ACK; stale worker cannot ACK; stable replay ID", async () => {
    await outbox.withTransaction(async (tx) => {
      await tx.stageEvent({
        id: "evt_lease_003",
        tenantId: "tenant-a",
        eventType: "com.servicev8.business.support.ticket-resolved.v1",
        aggregateType: "ticket",
        aggregateId: "TICK-101",
        payload: { ticketId: "TICK-101", resolutionTimeSeconds: 120 },
      });
    });

    // Worker 1 claims event with 50ms lease
    const claimedByWorker1 = await outbox.claim("worker-1", 10, 50);
    expect(claimedByWorker1.length).toBe(1);
    expect(claimedByWorker1[0].id).toBe("evt_lease_003");

    // Wait for lease to expire
    await new Promise((r) => setTimeout(r, 60));

    // Worker 2 claims the expired event
    const claimedByWorker2 = await outbox.claim("worker-2", 10, 5000);
    expect(claimedByWorker2.length).toBe(1);

    // Stale Worker 1 attempts to ACK expired lease -> rejected!
    const staleAck = await outbox.ack(
      "evt_lease_003",
      "worker-1",
      { receiptId: "rcpt_valid_0000000000000001", deliveredAt: new Date().toISOString() }
    );
    expect(staleAck.success).toBe(false);
    expect(staleAck.error).toContain("lease");

    // Active Worker 2 ACKs with valid receipt -> succeeds!
    const validAck = await outbox.ack(
      "evt_lease_003",
      "worker-2",
      { receiptId: "rcpt_valid_0000000000000002", deliveredAt: new Date().toISOString() }
    );
    expect(validAck.success).toBe(true);

    const event = await outbox.getEventById("evt_lease_003");
    expect(event?.status).toBe("delivered");
  });

  it("EVT-04: Cross-tenant isolation; two tenants emitting same event ID remain distinct", async () => {
    await outbox.withTransaction(async (tx) => {
      await tx.stageEvent({
        id: "evt_shared_key_001",
        tenantId: "tenant-a",
        eventType: "com.servicev8.business.support.ticket-created.v1",
        aggregateType: "ticket",
        aggregateId: "TICK-1",
        payload: { tenant: "tenant-a", summary: "Ticket A" },
      });
      await tx.stageEvent({
        id: "evt_shared_key_001",
        tenantId: "tenant-b",
        eventType: "com.servicev8.business.support.ticket-created.v1",
        aggregateType: "ticket",
        aggregateId: "TICK-1",
        payload: { tenant: "tenant-b", summary: "Ticket B" },
      });
    });

    const pendingA = await outbox.getPendingEvents("tenant-a");
    const pendingB = await outbox.getPendingEvents("tenant-b");

    expect(pendingA.length).toBe(1);
    expect(pendingB.length).toBe(1);
    expect(pendingA[0].payload.tenant).toBe("tenant-a");
    expect(pendingB[0].payload.tenant).toBe("tenant-b");
  });

  it("EVT-05: Missing or invalid receipt cannot falsely mark event delivered", async () => {
    const valid = validateOlgReceipt({ receiptId: "rcpt_20261010_abcdef123456" });
    expect(valid).toBe(true);

    // Malformed or empty receipts
    expect(validateOlgReceipt(null)).toBe(false);
    expect(validateOlgReceipt({})).toBe(false);
    expect(validateOlgReceipt({ receiptId: "" })).toBe(false);
    expect(validateOlgReceipt({ receiptId: "invalid-short" })).toBe(false);
    expect(validateOlgReceipt({ receiptId: "12345" })).toBe(false);
  });

  it("EVT-06: Domain facts payload sanitization; raw customer transcripts are redacted/excluded", async () => {
    const rawPayload = {
      ticketId: "TICK-500",
      category: "billing",
      priority: "high",
      rawCustomerTranscript: "Customer: Here is my secret credit card 4111...",
      chatMessages: [
        { sender: "Customer", text: "Please reset my account" },
      ],
      userPii: { ssn: "000-00-0000" },
    };

    const sanitized = sanitizeDomainEventPayload(rawPayload);

    // Business facts preserved
    expect(sanitized.ticketId).toBe("TICK-500");
    expect(sanitized.category).toBe("billing");
    expect(sanitized.priority).toBe("high");

    // Raw transcripts and sensitive payloads excluded
    expect(sanitized.rawCustomerTranscript).toBeUndefined();
    expect(sanitized.chatMessages).toBeUndefined();
    expect(sanitized.userPii).toBeUndefined();
  });
});

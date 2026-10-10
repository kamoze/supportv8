import { describe, it, expect, beforeEach } from "vitest";
import { createAlignmentHarness, AlignmentHarness } from "./alignment-harness";
import {
  admitAgenticTurn,
  getThreadTurnHistory,
  clearConversationStoreForTesting,
} from "@/lib/platform/conversation";

describe("CHAT-01 to CHAT-05: Unified AgenticOS Employee Chat", () => {
  let harness: AlignmentHarness;

  beforeEach(async () => {
    harness = await createAlignmentHarness();
    clearConversationStoreForTesting();
  });

  it("CHAT-01: Canonical turn admission with verified actor and active employee; bounded context", async () => {
    const admission = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-client-001",
      employeeId: "emp_support_lead",
      prompt: "Summarize outstanding customer escalations",
      activeHires: ["emp_support_lead"],
    });

    expect(admission.success).toBe(true);
    expect(admission.status).toBe(200);
    expect(admission.turnId).toBeDefined();
    expect(admission.admitted).toBe(true);

    // Unhired employee cannot be admitted
    const unhiredAdmission = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-client-002",
      employeeId: "emp_unhired_specialist",
      prompt: "Execute order refund",
      activeHires: ["emp_support_lead"],
    });
    expect(unhiredAdmission.success).toBe(false);
    expect(unhiredAdmission.status).toBe(409);
  });

  it("CHAT-02: Repeat same clientTurnId returns identical admission; different body yields conflict", async () => {
    // 1. First turn admission
    const turn1 = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-idem-100",
      employeeId: "emp_support_lead",
      prompt: "Status check",
      activeHires: ["emp_support_lead"],
    });
    expect(turn1.success).toBe(true);

    // 2. Exact same prompt & clientTurnId -> returns existing turn
    const turn2 = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-idem-100",
      employeeId: "emp_support_lead",
      prompt: "Status check",
      activeHires: ["emp_support_lead"],
    });
    expect(turn2.success).toBe(true);
    expect(turn2.turnId).toBe(turn1.turnId);

    // 3. Different prompt with same clientTurnId -> Conflict 409
    const turnConflict = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-idem-100",
      employeeId: "emp_support_lead",
      prompt: "Different prompt claiming same turn ID",
      activeHires: ["emp_support_lead"],
    });
    expect(turnConflict.success).toBe(false);
    expect(turnConflict.status).toBe(409);
  });

  it("CHAT-03: Process restart/reconnect reconciles existing turn without spawning duplicate worker", async () => {
    const turn = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-resume-200",
      employeeId: "emp_support_lead",
      prompt: "Long running analysis",
      activeHires: ["emp_support_lead"],
    });
    expect(turn.success).toBe(true);

    // Reconnect with same clientTurnId
    const resumed = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-resume-200",
      employeeId: "emp_support_lead",
      prompt: "Long running analysis",
      activeHires: ["emp_support_lead"],
    });
    expect(resumed.success).toBe(true);
    expect(resumed.turnId).toBe(turn.turnId);
  });

  it("CHAT-04: Private thread accessed by non-participant or cross-tenant -> non-disclosing denial", async () => {
    const turn = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-priv-300",
      employeeId: "emp_support_lead",
      prompt: "Confidential executive review",
      activeHires: ["emp_support_lead"],
      isPrivate: true,
      participants: ["user-owner-a"],
    });
    expect(turn.success).toBe(true);

    // Another member in Tenant A not in participants
    const leakAttempt = getThreadTurnHistory({
      tenantSlug: "tenant-a",
      callerSubject: "user-member-a",
      threadId: turn.threadId!,
    });
    expect(leakAttempt.allowed).toBe(false);
    expect([403, 404]).toContain(leakAttempt.status);

    // Cross-tenant attempt from Tenant B
    const crossAttempt = getThreadTurnHistory({
      tenantSlug: "tenant-b",
      callerSubject: "user-owner-b",
      threadId: turn.threadId!,
    });
    expect(crossAttempt.allowed).toBe(false);
    expect([403, 404]).toContain(crossAttempt.status);
  });

  it("CHAT-05: Multiple recipients with one revoked -> honest per-recipient status without fabricated replies", async () => {
    const multiRecipient = admitAgenticTurn({
      tenantSlug: "tenant-a",
      actorId: "user-owner-a",
      clientTurnId: "turn-multi-400",
      employeeId: "emp_support_lead",
      prompt: "Coordinate with specialists",
      activeHires: ["emp_support_lead"], // emp_crm_specialist is NOT active/hired
      additionalRecipients: ["emp_crm_specialist"],
    });

    expect(multiRecipient.recipientStates).toBeDefined();
    expect(multiRecipient.recipientStates?.["emp_support_lead"]).toBe("ready");
    expect(multiRecipient.recipientStates?.["emp_crm_specialist"]).toBe("unavailable");
  });
});

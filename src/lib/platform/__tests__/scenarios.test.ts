import { describe, it, expect, beforeEach } from "vitest";
import { createAlignmentHarness, AlignmentHarness } from "./alignment-harness";
import {
  saveScenarioConfig,
  getScenarioConfig,
  listScenarioConfigs,
  startScenarioRun,
  stopScenarioRunOnRevocation,
  clearScenarioStoreForTesting,
} from "@/lib/platform/scenarios";

describe("SCN-01 to SCN-03: Acquired Support Scenarios & Execution Lifecycle", () => {
  let harness: AlignmentHarness;

  beforeEach(async () => {
    harness = await createAlignmentHarness();
    clearScenarioStoreForTesting();
  });

  it("SCN-01: Save two named configs for one acquired scenario; search by keyword/tag/name and survive restart", async () => {
    // 1. Save config A
    const configA = saveScenarioConfig({
      tenantSlug: "tenant-a",
      scenarioId: "sc_support_triage",
      name: "Standard Triage Config",
      participants: [
        { employeeId: "emp_support_lead", role: "lead", requiredCapabilities: ["ticket.read", "ticket.update"] },
      ],
      parameters: { thresholdMinutes: 15, autoAssign: true },
      tags: ["triage", "standard"],
    });

    // 2. Save config B for the same scenario
    const configB = saveScenarioConfig({
      tenantSlug: "tenant-a",
      scenarioId: "sc_support_triage",
      name: "VIP Escalation Config",
      participants: [
        { employeeId: "emp_support_lead", role: "lead", requiredCapabilities: ["ticket.read", "ticket.update"] },
      ],
      parameters: { thresholdMinutes: 5, autoAssign: false, notifyChannel: "pager" },
      tags: ["vip", "escalation"],
    });

    expect(configA.id).not.toBe(configB.id);
    expect(configA.revision).toBe(1);
    expect(configB.revision).toBe(1);

    // 3. Search by tag and keyword
    const vipResults = listScenarioConfigs("tenant-a", { keyword: "VIP" });
    expect(vipResults.length).toBe(1);
    expect(vipResults[0].id).toBe(configB.id);

    const triageResults = listScenarioConfigs("tenant-a", { tag: "triage" });
    expect(triageResults.length).toBe(1);
    expect(triageResults[0].id).toBe(configA.id);

    // 4. Simulate process restart
    await harness.restart();

    // Verify configs survive restart
    const persistedA = getScenarioConfig("tenant-a", configA.id);
    expect(persistedA).toBeDefined();
    expect(persistedA?.name).toBe("Standard Triage Config");
  });

  it("SCN-02: Active run pins revision 1; editing to revision 2 does not mutate running execution", async () => {
    const config = saveScenarioConfig({
      tenantSlug: "tenant-a",
      scenarioId: "sc_support_escalation",
      name: "Tier 2 Escalation",
      participants: [
        { employeeId: "emp_support_lead", role: "lead", requiredCapabilities: ["ticket.read"] },
      ],
      parameters: { priority: "P1" },
    });

    // Launch run under revision 1
    const run1 = startScenarioRun({
      tenantSlug: "tenant-a",
      configId: config.id,
      activeHires: ["emp_support_lead"],
      idempotencyKey: "run-idem-001",
    });

    expect(run1.success).toBe(true);
    expect(run1.run?.pinnedRevision).toBe(1);
    expect(run1.run?.status).toBe("running");

    // Update config to revision 2 while run1 is still running
    const updatedConfig = saveScenarioConfig({
      id: config.id,
      tenantSlug: "tenant-a",
      scenarioId: "sc_support_escalation",
      name: "Tier 2 Escalation (v2)",
      participants: [
        { employeeId: "emp_support_lead", role: "lead", requiredCapabilities: ["ticket.read"] },
      ],
      parameters: { priority: "P0" },
    });
    expect(updatedConfig.revision).toBe(2);

    // The active run1 must still be pinned to revision 1!
    expect(run1.run?.pinnedRevision).toBe(1);

    // Next run selects revision 2
    const run2 = startScenarioRun({
      tenantSlug: "tenant-a",
      configId: config.id,
      activeHires: ["emp_support_lead"],
      idempotencyKey: "run-idem-002",
    });
    expect(run2.success).toBe(true);
    expect(run2.run?.pinnedRevision).toBe(2);
  });

  it("SCN-03: Foreign config denied; missing/revoked participant blocks run or stops execution", async () => {
    // Config owned by Tenant A
    const configA = saveScenarioConfig({
      tenantSlug: "tenant-a",
      scenarioId: "sc_support_triage",
      name: "Tenant A Private Config",
      participants: [
        { employeeId: "emp_support_lead", role: "lead", requiredCapabilities: ["ticket.read"] },
      ],
      parameters: {},
    });

    // Tenant B tries to access or run Tenant A's config -> 403 denied
    const crossAccess = getScenarioConfig("tenant-b", configA.id);
    expect(crossAccess).toBeNull();

    const crossRun = startScenarioRun({
      tenantSlug: "tenant-b",
      configId: configA.id,
      activeHires: ["emp_support_lead"],
    });
    expect(crossRun.success).toBe(false);
    expect(crossRun.status).toBe(403);

    // Tenant A tries to run with missing participant (emp_support_lead not hired)
    const missingParticipantRun = startScenarioRun({
      tenantSlug: "tenant-a",
      configId: configA.id,
      activeHires: [], // empty hires
    });
    expect(missingParticipantRun.success).toBe(false);
    expect(missingParticipantRun.status).toBe(409);

    // Active run stops if participant is revoked
    const validRun = startScenarioRun({
      tenantSlug: "tenant-a",
      configId: configA.id,
      activeHires: ["emp_support_lead"],
      idempotencyKey: "run-stop-test",
    });
    expect(validRun.success).toBe(true);

    const stoppedRun = stopScenarioRunOnRevocation(validRun.run!.runId, "emp_support_lead");
    expect(stoppedRun?.status).toBe("stopped");
    expect(stoppedRun?.failureReason).toContain("revoked");
  });
});

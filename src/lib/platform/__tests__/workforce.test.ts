import { describe, it, expect, beforeEach } from "vitest";
import { createAlignmentHarness, AlignmentHarness } from "./alignment-harness";
import { marketplaceService } from "@/lib/services/marketplace-service";

describe("WF-01 to WF-05: Workforce Authority & Canonical Lifecycle", () => {
  let harness: AlignmentHarness;

  beforeEach(async () => {
    harness = await createAlignmentHarness();
  });

  it("WF-01: Fresh tenant has no seeded workforce; Runtime employees are not in app roster", async () => {
    // A fresh standalone or runtime tenant must start with 0 hired employees
    const res = await harness.request("workforce", { actor: "ownerA" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(0);
    expect(res.body.data).toEqual([]);

    // Runtime employees (Arthur, Vivian, Sophia) access permitted records via runtime API,
    // but they are never seeded or injected into the app's internal workforce roster
    const catalog = marketplaceService.getWorkforceCatalog("tenant-a");
    const hired = catalog.filter((w) => w.isHired);
    expect(hired.length).toBe(0);

    const runtimeNames = ["Arthur", "Vivian", "Sophia"];
    for (const name of runtimeNames) {
      const found = hired.find((h) => h.name.includes(name));
      expect(found).toBeUndefined();
    }
  });

  it("WF-02: Revoked entitlement denies workforce actions and execution", async () => {
    // Revoke entitlement at the owner
    await harness.owners.change("tenantA.entitlement", "revoked");

    // Attempting an action on an unhired or revoked employee must fail
    const res = await harness.request("workforce", {
      actor: "ownerA",
      body: {
        action: "assign_work",
        employeeId: "emp_support_lead",
        task: "Resolve critical ticket #1024",
      },
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it("WF-03: Two hires with distinct immutable IDs remain distinct without name collision", async () => {
    // If two specialists are registered with the same display role or name,
    // they must retain distinct immutable IDs and separate configurations
    const catalog = marketplaceService.getWorkforceCatalog("tenant-a");
    const ids = catalog.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("WF-04: Local unverified request cannot grant a hire, assignment, or credits", async () => {
    // A caller attempting to locally hire an agent directly without canonical owner authorization
    // must be rejected or disallowed from granting authority
    const hireRes = await harness.request("workforce", {
      actor: "ownerA",
      body: {
        action: "hire",
        employeeId: "emp_support_lead",
      },
    });

    // In aligned mode, local arbitrary hire without owner grant must be blocked
    expect(hireRes.status).toBe(403);
    expect(hireRes.body.success).toBe(false);

    // Attempting local credit addition must also be blocked
    const creditRes = await harness.request("credits", {
      actor: "ownerA",
      body: {
        action: "add",
        amount: 5000,
        reason: "Local synthetic topup",
      },
    });
    expect(creditRes.status).toBe(403);
    expect(creditRes.body.success).toBe(false);
  });

  it("WF-05: Process restart preserves owner truth without in-memory mutations", async () => {
    // Ensure that restart resets or reconciles back to canonical owner state
    await harness.restart();
    const state = await harness.state();
    expect(state.hires).toBe(0);
  });
});

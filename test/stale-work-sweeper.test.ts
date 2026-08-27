import { describe, it, expect } from "vitest";
import { staleWorkSweeper } from "@/lib/services/stale-work-sweeper";

describe("supportV8 Stale Work Sweeper", () => {
  it("computes accurate dry-run candidates and categorization", () => {
    const dryRun = staleWorkSweeper.runDryRun();
    expect(dryRun.totalScanned).toBe(1420);
    expect(dryRun.candidatesFound).toBeGreaterThanOrEqual(1);
    expect(dryRun.safeToCloseCount).toBeGreaterThanOrEqual(1);
  });

  it("executes single candidate closure via Action Gateway", async () => {
    const res = await staleWorkSweeper.executeCandidateAction("SW-01");
    expect(res.success).toBe(true);
    expect(res.auditId).toBeDefined();
  });
});

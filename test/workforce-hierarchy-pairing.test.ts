import { describe, it, expect } from "vitest";
import { workforceManager } from "../src/lib/workforce";

describe("AI Workforce Hierarchy & Intern Pairing Specification (OrderV8 Architecture)", () => {
  it("should enforce hiring requirement before work can be assigned", () => {
    // Sophia is in available catalog (not yet hired)
    const assignUnhired = workforceManager.assignWork("emp_voice_specialist", "Handle live caller dispute");
    expect(assignUnhired.success).toBe(false);
    expect(assignUnhired.message).toContain("must be HIRED first before being assigned work");

    // Hire Sophia into the active workforce
    const hireResult = workforceManager.hireEmployee("emp_voice_specialist");
    expect(hireResult.success).toBe(true);
    expect(hireResult.member?.hired).toBe(true);

    // Now work can be assigned successfully
    const assignHired = workforceManager.assignWork("emp_voice_specialist", "Handle live caller dispute");
    expect(assignHired.success).toBe(true);
    expect(assignHired.message).toContain("assigned to hired AI Employee");
  });

  it("should block direct work assignment to specialized interns", () => {
    // Intern Chip is paired to Alex
    const internChip = workforceManager.getById("intern_tagger");
    expect(internChip).toBeDefined();
    expect(internChip?.level).toBe("ai_intern");
    expect(internChip?.canReceiveDirectWork).toBe(false);
    expect(internChip?.supervisorId).toBe("emp_support_lead");

    // Direct assignment to Chip must fail per OrderV8 architecture
    const directAssign = workforceManager.assignWork("intern_tagger", "Triage customer ticket #9912");
    expect(directAssign.success).toBe(false);
    expect(directAssign.message).toContain("Interns are paired sub-agents and cannot be assigned work directly");
    expect(directAssign.message).toContain("Alex — Support Intelligence Lead");
  });

  it("should return paired interns for supervising AI Employee", () => {
    const alexInterns = workforceManager.getPairedInterns("emp_support_lead");
    expect(alexInterns.length).toBeGreaterThanOrEqual(2);
    const internIds = alexInterns.map((i) => i.id);
    expect(internIds).toContain("intern_tagger");
    expect(internIds).toContain("intern_stale_sweeper");
  });

  it("should allow supervisor delegation to paired interns for micro-tasks", () => {
    const delegateRes = workforceManager.delegateTask("intern_tagger", "Extract intent tags for ticket #8841");
    expect(delegateRes.delegated).toBe(true);
    expect(delegateRes.message).toContain("Task delegated successfully");
  });
});

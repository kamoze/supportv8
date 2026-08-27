import { describe, it, expect } from "vitest";
import { problemService } from "@/lib/services/problem-service";
import { businessImpactEngine } from "@/lib/services/business-impact-engine";
import { db } from "@/lib/db/mock-data";

describe("supportV8 Problem Correlation & Business Impact", () => {
  it("calculates accurate revenue exposure and impact levels", () => {
    const issues = db.issues.filter((i) => i.problemId === "PRB-218");
    const impact = businessImpactEngine.calculate(issues);

    expect(impact.impact).toBe("critical");
    expect(impact.estimatedRevenueExposure).toBeGreaterThanOrEqual(15000);
    expect(impact.affectedEnterpriseCount).toBeGreaterThanOrEqual(1);
  });

  it("links and unlinks issues non-destructively without modifying source system", () => {
    const problem = problemService.getById("PRB-219");
    expect(problem).toBeDefined();

    const initialCount = problem!.linkedIssueIds.length;
    // Link an issue
    problemService.linkIssue("PRB-219", "ISS-1004");
    expect(problem!.linkedIssueIds).toContain("ISS-1004");
    expect(problem!.linkedIssueIds.length).toBe(initialCount + 1);

    // Unlink the issue
    problemService.unlinkIssue("PRB-219", "ISS-1004");
    expect(problem!.linkedIssueIds).not.toContain("ISS-1004");
    expect(problem!.linkedIssueIds.length).toBe(initialCount);
  });
});

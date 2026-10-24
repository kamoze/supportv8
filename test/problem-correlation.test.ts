import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { problemService } from "@/lib/services/problem-service";
import { businessImpactEngine } from "@/lib/services/business-impact-engine";
import { PostgresClient } from "@/lib/db/pg-client";
import { MockPostgresClient } from "./fixtures/mock-db-client";

describe("supportV8 Problem Correlation & Business Impact", () => {
  let mockClient: MockPostgresClient;

  beforeEach(() => {
    mockClient = new MockPostgresClient();
    PostgresClient.setTestClient(mockClient);

    // Seed test problem and issues
    mockClient.problems.push({
      id: "PRB-219",
      tenant_id: "tenant_acme",
      title: "SSO Authentication Timeout",
      summary: "Intermittent SAML failures",
      suspected_cause: "Auth pod load",
      status: "active",
      confidence: 0.9,
      impact: "high",
      affected_customer_count: 2,
      affected_enterprise_count: 1,
      estimated_revenue_exposure: 15000,
      linked_issue_ids: ["ISS-1002", "ISS-1003"],
      created_at: new Date(),
      updated_at: new Date(),
    });

    mockClient.issues.push(
      {
        id: "ISS-1002",
        tenant_id: "tenant_acme",
        source: "zendesk",
        external_id: "ZD-1002",
        customer_tier: "enterprise",
        priority: "urgent",
        sentiment: "frustrated",
        problem_id: "PRB-219",
      },
      {
        id: "ISS-1003",
        tenant_id: "tenant_acme",
        source: "zendesk",
        external_id: "ZD-1003",
        customer_tier: "standard",
        priority: "normal",
        sentiment: "neutral",
        problem_id: "PRB-219",
      },
      {
        id: "ISS-1004",
        tenant_id: "tenant_acme",
        source: "zendesk",
        external_id: "ZD-1004",
        customer_tier: "pro",
        priority: "normal",
        sentiment: "neutral",
      }
    );
  });

  afterEach(() => {
    PostgresClient.setTestClient(null);
  });

  it("calculates accurate revenue exposure and impact levels", () => {
    const issues = [
      { id: "ISS-1", customerTier: "enterprise", priority: "urgent" },
      { id: "ISS-2", customerTier: "enterprise", priority: "high" },
    ] as any[];
    const impact = businessImpactEngine.calculate(issues);

    expect(impact.impact).toBe("critical");
    expect(impact.estimatedRevenueExposure).toBeGreaterThanOrEqual(15000);
    expect(impact.affectedEnterpriseCount).toBeGreaterThanOrEqual(1);
  });

  it("links and unlinks issues non-destructively without modifying source system", async () => {
    const problem = await problemService.getById("PRB-219", "tenant_acme");
    expect(problem).toBeDefined();

    const initialCount = problem!.linkedIssueIds.length;
    // Link an issue
    await problemService.linkIssue("tenant_acme", "PRB-219", "ISS-1004");
    const updated = await problemService.getById("PRB-219", "tenant_acme");
    expect(updated!.linkedIssueIds).toContain("ISS-1004");
    expect(updated!.linkedIssueIds.length).toBe(initialCount + 1);

    // Unlink the issue
    await problemService.unlinkIssue("tenant_acme", "PRB-219", "ISS-1004");
    const unlinked = await problemService.getById("PRB-219", "tenant_acme");
    expect(unlinked!.linkedIssueIds).not.toContain("ISS-1004");
    expect(unlinked!.linkedIssueIds.length).toBe(initialCount);
  });
});

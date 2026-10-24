import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  buildSupportIntelligenceContext,
  SupportIntelligenceContext,
} from "../src/lib/chat/support-intelligence-context";
import { issueService } from "../src/lib/services/issue-service";
import { problemService } from "../src/lib/services/problem-service";
import { trendAnomalyService } from "../src/lib/services/trend-anomaly-service";
import { POST } from "../src/app/api/chat/route";
import { resolveRequestTenant } from "../src/lib/auth/request-tenant";

vi.mock("../src/lib/auth/request-tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/request-tenant")>();
  return {
    ...actual,
    resolveRequestTenant: vi.fn(),
  };
});

describe("Durable Support Intelligence Chat Context", () => {
  const TENANT_A = "tenant_alpha";
  const TENANT_B = "tenant_beta";

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("buildSupportIntelligenceContext", () => {
    it("returns a truthful empty-state for a clean tenant with zero mock data", async () => {
      vi.spyOn(issueService, "getAll").mockResolvedValue([]);
      vi.spyOn(problemService, "getAll").mockResolvedValue([]);
      vi.spyOn(trendAnomalyService, "getTrends").mockResolvedValue([]);

      const context = await buildSupportIntelligenceContext(TENANT_A, "What issues do I have?");

      expect(context.hasIntelligence).toBe(false);
      expect(context.issuesCount).toBe(0);
      expect(context.problemsCount).toBe(0);
      expect(context.trendsCount).toBe(0);
      expect(context.issues).toEqual([]);
      expect(context.problems).toEqual([]);
      expect(context.trends).toEqual([]);
      expect(context.citations).toEqual([]);

      const parsedPrompt = JSON.parse(context.prompt);
      expect(parsedPrompt.workspace.tenantId).toBe(TENANT_A);
      expect(parsedPrompt.issues).toEqual([]);
      expect(parsedPrompt.problems).toEqual([]);
      expect(parsedPrompt.trends).toEqual([]);
    });

    it("bounds retrieved records to at most 20 Issues, 10 Problems, and 10 Trends", async () => {
      // Generate 25 issues, 15 problems, 15 trends
      const mockIssues = Array.from({ length: 25 }, (_, i) => ({
        id: `iss_${i + 1}`,
        tenantId: TENANT_A,
        summary: `Issue number ${i + 1}`,
        status: "open" as const,
        priority: "high" as const,
        category: "billing",
        confidence: 0.95,
        source: "zendesk" as const,
        externalId: `zd-${1000 + i}`,
        sourceUrl: `https://example.zendesk.com/agent/tickets/${1000 + i}`,
        customerName: `Customer ${i + 1}`, // PII to be excluded
        customerRef: `cust_${i + 1}`, // PII to be excluded
        raw: { secretNote: "Confidential customer details" }, // Raw to be excluded
        messages: [{ content: "Sensitive message content" }], // Raw to be excluded
        timeline: [{ details: "Raw event payload" }],
        createdAt: "2026-10-21T12:00:00Z",
        updatedAt: "2026-10-21T12:00:00Z",
      }));

      const mockProblems = Array.from({ length: 15 }, (_, i) => ({
        id: `prob_${i + 1}`,
        tenantId: TENANT_A,
        title: `Problem ${i + 1}`,
        status: "investigating" as const,
        severity: "critical" as const,
        affectedCustomerCount: 10 + i,
        estimatedRevenueExposure: 5000 * (i + 1),
        issueIds: [`iss_${i + 1}`],
        createdAt: "2026-10-21T12:00:00Z",
        updatedAt: "2026-10-21T12:00:00Z",
      }));

      const mockTrends = Array.from({ length: 15 }, (_, i) => ({
        windowStart: "2026-10-14T00:00:00Z",
        windowEnd: "2026-10-21T00:00:00Z",
        tenantId: TENANT_A,
        category: `Category ${i + 1}`,
        baselineCount: 10,
        currentCount: 20 + i,
        changePct: 100 + i,
        confidence: 0.9,
      }));

      vi.spyOn(issueService, "getAll").mockResolvedValue(mockIssues as any);
      vi.spyOn(problemService, "getAll").mockResolvedValue(mockProblems as any);
      vi.spyOn(trendAnomalyService, "getTrends").mockResolvedValue(mockTrends as any);

      const context = await buildSupportIntelligenceContext(TENANT_A, "billing");

      expect(context.hasIntelligence).toBe(true);
      expect(context.issuesCount).toBe(20);
      expect(context.problemsCount).toBe(10);
      expect(context.trendsCount).toBe(10);
      expect(context.issues.length).toBe(20);
      expect(context.problems.length).toBe(10);
      expect(context.trends.length).toBe(10);

      // Verify citations are produced and point to bounded records
      expect(context.citations.length).toBeGreaterThan(0);
      expect(context.citations.length).toBeLessThanOrEqual(10); // 5 issues + 3 problems + 2 trends
      expect(context.citations.some((c) => c.type === "issue")).toBe(true);
      expect(context.citations.some((c) => c.type === "problem")).toBe(true);
      expect(context.citations.some((c) => c.type === "trend")).toBe(true);

      // Verify citations have required metadata
      for (const citation of context.citations) {
        expect(citation.id).toBeDefined();
        expect(citation.title).toBeDefined();
        if (citation.type === "issue") {
          expect(citation.sourceUrl).toBeDefined();
        }
      }
    });

    it("excludes raw interaction payloads and customer PII from context", async () => {
      const sensitiveIssue = {
        id: "iss_pii_check",
        tenantId: TENANT_A,
        summary: "Checkout failed with credit card token",
        status: "open" as const,
        priority: "urgent" as const,
        category: "payments",
        confidence: 0.99,
        source: "zendesk" as const,
        externalId: "zd-9999",
        sourceUrl: "https://example.zendesk.com/agent/tickets/9999",
        customerName: "Alice Secret",
        customerRef: "alice@confidential.org",
        raw: { ssn: "000-11-2222", creditCard: "4111-2222-3333-4444" },
        messages: [{ content: "My social security number is 000-11-2222" }],
        timeline: [{ details: "Payment payload with full CVV" }],
        createdAt: "2026-10-21T12:00:00Z",
        updatedAt: "2026-10-21T12:00:00Z",
      };

      vi.spyOn(issueService, "getAll").mockResolvedValue([sensitiveIssue] as any);
      vi.spyOn(problemService, "getAll").mockResolvedValue([]);
      vi.spyOn(trendAnomalyService, "getTrends").mockResolvedValue([]);

      const context = await buildSupportIntelligenceContext(TENANT_A, "payments");

      // Verify the issue in context has no PII
      const bounded = context.issues[0] as any;
      expect(bounded.id).toBe("iss_pii_check");
      expect(bounded.summary).toBe("Checkout failed with credit card token");
      expect(bounded.customerName).toBeUndefined();
      expect(bounded.customerRef).toBeUndefined();
      expect(bounded.raw).toBeUndefined();
      expect(bounded.messages).toBeUndefined();
      expect(bounded.timeline).toBeUndefined();

      // Verify prompt string contains no PII
      expect(context.prompt).not.toContain("Alice Secret");
      expect(context.prompt).not.toContain("alice@confidential.org");
      expect(context.prompt).not.toContain("000-11-2222");
      expect(context.prompt).not.toContain("4111-2222-3333-4444");
    });

    it("enforces tenant isolation: Tenant A cannot retrieve Tenant B summaries or citations", async () => {
      const tenantAIssue = {
        id: "iss_tenant_a_1",
        tenantId: TENANT_A,
        summary: "Alpha secret project ticket",
        status: "open" as const,
        priority: "urgent" as const,
        category: "alpha_internal",
        sourceUrl: "https://alpha.zendesk.com/tickets/1",
        createdAt: "2026-10-21T12:00:00Z",
        updatedAt: "2026-10-21T12:00:00Z",
      };

      const getAllSpy = vi.spyOn(issueService, "getAll").mockImplementation(async (options: any) => {
        if (options?.tenant === TENANT_A) {
          return [tenantAIssue] as any;
        }
        // Tenant B has no records
        return [];
      });

      // Tenant B queries specifically searching for Tenant A's issue summary or ID
      const tenantBContext = await buildSupportIntelligenceContext(
        TENANT_B,
        "iss_tenant_a_1 Alpha secret project"
      );

      expect(getAllSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tenant: TENANT_B })
      );
      expect(tenantBContext.issuesCount).toBe(0);
      expect(tenantBContext.citations).toEqual([]);
      expect(tenantBContext.prompt).not.toContain("Alpha secret project ticket");
      expect(tenantBContext.prompt).not.toContain("iss_tenant_a_1");
    });
  });

  describe("POST /api/chat route integration", () => {
    beforeEach(() => {
      vi.mocked(resolveRequestTenant).mockResolvedValue({
        tenantId: "tenant_acme",
        tenantSlug: "acme",
        authenticated: true,
        userId: "operator_1",
        username: "operator@acme.com",
        displayName: "Operator One",
        roles: ["support_operator"],
      });
    });

    it("returns truthful empty-state response when tenant has no durable intelligence and runtime is unset", async () => {
      vi.spyOn(issueService, "getAll").mockResolvedValue([]);
      vi.spyOn(problemService, "getAll").mockResolvedValue([]);
      vi.spyOn(trendAnomalyService, "getTrends").mockResolvedValue([]);

      const request = new NextRequest("http://localhost:3005/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "What is currently broken?",
          employeeId: "emp_support_lead",
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.answer).toContain("No support intelligence or active issues were found");
      expect(json.data.citations).toEqual([]);
      expect(json.data.runtime).toBe("durable_intelligence");
      expect(json.data.suggestedActions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "Connect Source" }),
          expect.objectContaining({ label: "View Tickets & Issues" }),
        ])
      );
    });

    it("ignores forged client headers (?tenant=meridian or x-tenant-slug) and maintains tenant scope", async () => {
      const getIssuesSpy = vi.spyOn(issueService, "getAll").mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3005/api/chat?tenant=meridian",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-tenant-slug": "meridian",
            "x-tenant-id": "meridian",
          },
          body: JSON.stringify({
            query: "Show me all issues",
            employeeId: "emp_support_lead",
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Verify issueService was called with the authenticated tenantId (tenant_acme), NOT meridian
      expect(getIssuesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ tenant: "tenant_acme" })
      );
    });

    it("operates in strictly read-only mode and does not mutate issues or trigger actions", async () => {
      const updateSpy = vi.spyOn(issueService, "update");
      const correlateSpy = vi.spyOn(problemService, "correlateIssues");

      const request = new NextRequest("http://localhost:3005/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query: "Close ticket #1234 and mark it resolved",
          employeeId: "emp_support_lead",
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Zero mutations
      expect(updateSpy).not.toHaveBeenCalled();
      expect(correlateSpy).not.toHaveBeenCalled();
    });
  });
});

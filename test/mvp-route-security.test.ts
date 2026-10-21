import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/keycloak", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/keycloak")>();
  return {
    ...actual,
    verifySupportAccessToken: vi.fn(),
  };
});

import { verifySupportAccessToken } from "@/lib/auth/keycloak";
import { GET as getProblems, POST as postProblems } from "@/app/api/problems/route";
import { GET as getPolicies, POST as postPolicies } from "@/app/api/policies/route";
import { GET as getSources, POST as postSources } from "@/app/api/sources/route";
import { GET as getTrends } from "@/app/api/trends/route";
import { GET as getInsights, POST as postInsights } from "@/app/api/insights/route";
import { GET as getOverview } from "@/app/api/overview/route";
import { GET as getTraces } from "@/app/api/observability/traces/route";

import { problemService } from "@/lib/services/problem-service";
import { policyEngine } from "@/lib/services/policy-engine";
import { interactionGateway } from "@/lib/services/interaction-gateway";
import { issueService } from "@/lib/services/issue-service";
import { insightsService } from "@/lib/services/insights-service";
import { trendAnomalyService } from "@/lib/services/trend-anomaly-service";

describe("MVP route security contracts", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe("Step 1: Unauthenticated route matrix in production mode", () => {
    it("rejects unauthenticated GET /api/problems with 401", async () => {
      const req = new NextRequest("https://acme.support.servicev8.com/api/problems", {
        headers: { host: "acme.support.servicev8.com" },
      });
      const res = await getProblems(req);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/problems with 401 and performs no mutations", async () => {
      const correlateSpy = vi.spyOn(problemService, "correlateIssues");
      const linkSpy = vi.spyOn(problemService, "linkIssue");
      const unlinkSpy = vi.spyOn(problemService, "unlinkIssue");
      const updateStatusSpy = vi.spyOn(problemService, "updateStatus");
      const seedSpy = vi.spyOn(problemService, "seedDemoProblems");

      const req = new NextRequest("https://acme.support.servicev8.com/api/problems", {
        method: "POST",
        headers: { host: "acme.support.servicev8.com" },
        body: JSON.stringify({
          action: "link",
          problemId: "PRB-001",
          issueId: "ISS-001",
        }),
      });

      const res = await postProblems(req);
      expect(res.status).toBe(401);
      expect(correlateSpy).not.toHaveBeenCalled();
      expect(linkSpy).not.toHaveBeenCalled();
      expect(unlinkSpy).not.toHaveBeenCalled();
      expect(updateStatusSpy).not.toHaveBeenCalled();
      expect(seedSpy).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated GET /api/policies with 401", async () => {
      const req = new NextRequest("https://acme.support.servicev8.com/api/policies", {
        headers: { host: "acme.support.servicev8.com" },
      });
      const res = await getPolicies(req);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/policies with 401 and performs no mutations", async () => {
      const updatePolicySpy = vi.spyOn(policyEngine, "updatePolicy");
      const addRuleSpy = vi.spyOn(policyEngine, "addRule");
      const updateRuleSpy = vi.spyOn(policyEngine, "updateRule");
      const deleteRuleSpy = vi.spyOn(policyEngine, "deleteRule");
      const applyPresetSpy = vi.spyOn(policyEngine, "applyPresetProfile");
      const simulateSpy = vi.spyOn(policyEngine, "simulate");

      const req = new NextRequest("https://acme.support.servicev8.com/api/policies", {
        method: "POST",
        headers: { host: "acme.support.servicev8.com" },
        body: JSON.stringify({
          action: "update",
          policyUpdates: { operatingMode: "autonomous" },
        }),
      });

      const res = await postPolicies(req);
      expect(res.status).toBe(401);
      expect(updatePolicySpy).not.toHaveBeenCalled();
      expect(addRuleSpy).not.toHaveBeenCalled();
      expect(updateRuleSpy).not.toHaveBeenCalled();
      expect(deleteRuleSpy).not.toHaveBeenCalled();
      expect(applyPresetSpy).not.toHaveBeenCalled();
      expect(simulateSpy).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated GET /api/sources with 401", async () => {
      const req = new NextRequest("https://acme.support.servicev8.com/api/sources", {
        headers: { host: "acme.support.servicev8.com" },
      });
      const res = await getSources(req);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/sources with 401 and performs no mutations", async () => {
      const normalizeSpy = vi.spyOn(interactionGateway, "normalize");
      const createIssueSpy = vi.spyOn(issueService, "createFromInteraction");

      const req = new NextRequest("https://acme.support.servicev8.com/api/sources", {
        method: "POST",
        headers: { host: "acme.support.servicev8.com" },
        body: JSON.stringify({
          action: "test_webhook",
          eventPayload: { text: "Unauthenticated injection" },
        }),
      });

      const res = await postSources(req);
      expect(res.status).toBe(401);
      expect(normalizeSpy).not.toHaveBeenCalled();
      expect(createIssueSpy).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated GET /api/trends with 401", async () => {
      const req = new NextRequest("https://acme.support.servicev8.com/api/trends", {
        headers: { host: "acme.support.servicev8.com" },
      });
      const res = await getTrends(req);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated GET /api/insights with 401", async () => {
      const req = new NextRequest("https://acme.support.servicev8.com/api/insights", {
        headers: { host: "acme.support.servicev8.com" },
      });
      const res = await getInsights(req);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated POST /api/insights with 401 and performs no mutations", async () => {
      const executeSpy = vi.spyOn(insightsService, "executeInsightAction");
      const updateStatusSpy = vi.spyOn(insightsService, "updateStatus");

      const req = new NextRequest("https://acme.support.servicev8.com/api/insights", {
        method: "POST",
        headers: { host: "acme.support.servicev8.com" },
        body: JSON.stringify({
          action: "execute",
          insightId: "INS-001",
        }),
      });

      const res = await postInsights(req);
      expect(res.status).toBe(401);
      expect(executeSpy).not.toHaveBeenCalled();
      expect(updateStatusSpy).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated GET /api/overview with 401", async () => {
      const req = new NextRequest("https://acme.support.servicev8.com/api/overview", {
        headers: { host: "acme.support.servicev8.com" },
      });
      const res = await getOverview(req);
      expect(res.status).toBe(401);
    });

    it("rejects unauthenticated GET /api/observability/traces with 401", async () => {
      const req = new NextRequest("https://acme.support.servicev8.com/api/observability/traces", {
        headers: { host: "acme.support.servicev8.com" },
      });
      const res = await getTraces(req);
      expect(res.status).toBe(401);
    });
  });

  describe("Step 2: Forged-tenant tests with authenticated tenant_acme identity", () => {
    const acmeClaims = {
      sub: "usr_acme_operator",
      preferred_username: "operator@acme.com",
      tenant_id: "tenant_acme",
      azp: "supportv8-acme",
      realm_access: { roles: ["support_cx_lead", "support_operator"] },
    };

    it("executes GET /api/problems strictly in authenticated tenant_acme scope despite forged params", async () => {
      vi.mocked(verifySupportAccessToken).mockResolvedValue(acmeClaims);
      const getAllSpy = vi.spyOn(problemService, "getAll");

      const req = new NextRequest("https://acme.support.servicev8.com/api/problems?tenant=meridian", {
        headers: {
          host: "acme.support.servicev8.com",
          authorization: "Bearer valid-acme-token",
          "x-tenant-slug": "meridian",
          "x-tenant-id": "tenant_meridian",
        },
      });

      await getProblems(req);

      expect(getAllSpy).toHaveBeenCalledWith(expect.stringMatching(/acme/));
      expect(getAllSpy).not.toHaveBeenCalledWith("meridian");
      expect(getAllSpy).not.toHaveBeenCalledWith("tenant_meridian");
    });

    it("executes POST /api/problems strictly in authenticated tenant_acme scope despite forged params", async () => {
      vi.mocked(verifySupportAccessToken).mockResolvedValue(acmeClaims);
      const seedSpy = vi.spyOn(problemService, "seedDemoProblems");

      const req = new NextRequest("https://acme.support.servicev8.com/api/problems?tenant=meridian", {
        method: "POST",
        headers: {
          host: "acme.support.servicev8.com",
          authorization: "Bearer valid-acme-token",
          "x-tenant-slug": "meridian",
          "x-tenant-id": "tenant_meridian",
        },
        body: JSON.stringify({ action: "simulate" }),
      });

      await postProblems(req);

      expect(seedSpy).toHaveBeenCalledWith(expect.stringMatching(/acme/));
      expect(seedSpy).not.toHaveBeenCalledWith("meridian");
      expect(seedSpy).not.toHaveBeenCalledWith("tenant_meridian");
    });

    it("executes GET /api/trends strictly in authenticated tenant_acme scope despite forged params", async () => {
      vi.mocked(verifySupportAccessToken).mockResolvedValue(acmeClaims);
      const trendsSpy = vi.spyOn(trendAnomalyService, "getTrendSeries");

      const req = new NextRequest("https://acme.support.servicev8.com/api/trends?tenant=meridian", {
        headers: {
          host: "acme.support.servicev8.com",
          authorization: "Bearer valid-acme-token",
          "x-tenant-slug": "meridian",
          "x-tenant-id": "tenant_meridian",
        },
      });

      await getTrends(req);

      expect(trendsSpy).toHaveBeenCalledWith(expect.stringMatching(/acme/));
      expect(trendsSpy).not.toHaveBeenCalledWith("meridian");
    });
  });
});

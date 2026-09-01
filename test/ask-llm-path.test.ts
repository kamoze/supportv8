import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/chat/route";
import { marketplaceService } from "../src/lib/services/marketplace-service";

describe("Ask managed LLM path", () => {
  beforeEach(() => {
    vi.stubEnv("FORGE_GATEWAY_URL", "http://forge.test");
    vi.stubEnv("FORGE_GATEWAY_MODEL_TOKEN", "model-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("exposes exactly one hired employee in each demo workspace", () => {
    for (const tenant of ["acme", "meridian"]) {
      const hired = marketplaceService
        .getWorkforceCatalog(tenant)
        .filter((employee) => employee.isHired);
      expect(hired.map((employee) => employee.id)).toEqual(["emp_support_lead"]);
      expect(marketplaceService.getPlans(tenant).some((plan) => plan.isCurrent)).toBe(false);
      expect(marketplaceService.getCredits(tenant)).toBe(150);
    }
  });

  it("calls the metered Forge completion with an Acme-only context", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        instanceId: "hi_supportv8_demo_acme",
        tenantId: "tenant_acme",
        vertical: "supportv8",
        role: "support-intelligence-lead",
        displayName: "Alex",
        name: "Alex",
        status: "active",
        subscription: "demo",
        budget: {
          monthlyAllowance: 50_000,
          creditBalance: 0,
          usedThisPeriod: 0,
          remaining: 50_000,
          exhausted: false,
        },
        grants: [],
        outcomeKey: "answers_grounded",
        createdAt: new Date().toISOString(),
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: { content: "Acme has tenant-scoped active issues." },
        usage: { creditsUsed: 3 },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(new NextRequest("http://localhost:3005/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "acme",
      },
      body: JSON.stringify({
        query: "Summarize the active issues",
        employeeId: "emp_support_lead",
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.runtime).toBe("forge_gateway");
    expect(payload.data.answer).toContain("Acme");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const completionUrl = fetchMock.mock.calls[1]?.[0] as URL;
    const completionInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const completionBody = JSON.parse(String(completionInit.body));
    expect(completionUrl.pathname).toBe("/v1/model/complete");
    expect(completionBody.tenantId).toBe("tenant_acme");
    expect(completionBody.instanceId).toBe("hi_supportv8_demo_acme");
    expect(completionBody.request.messages[0].content).toContain('"name":"Acme Corp"');
    expect(completionBody.request.messages[0].content).not.toContain("Meridian Logistics");
  });

  it("rejects any non-hired demo employee before a model call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(new NextRequest("http://localhost:3005/api/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tenant-id": "meridian",
      },
      body: JSON.stringify({ query: "What is happening?", employeeId: "emp_incident_analyst" }),
    }));

    expect(response.status).toBe(409);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

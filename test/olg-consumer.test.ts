import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchOlgContextForTenant,
  fetchOlgSituationsForTenant,
  findSituationsForTicket,
  type OlgSituation,
} from "@/lib/signals/olg-consumer";

describe("supportv8 olg-consumer", () => {
  const originalEnv = process.env;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...originalEnv,
      SERVICEV8_RUNTIME_URL: "https://runtime.test.servicev8.com",
      RUNTIME_SIGNALS_SECRET: "test-query-secret-support-777",
    };
  });

  const mockOlgResponse = {
    ok: true,
    data: {
      tenantId: "tenant_sup_123",
      nodes: [],
      edges: [],
      situations: [
        {
          id: "sit_sup_1",
          tenantId: "tenant_sup_123",
          category: "customer_escalation",
          entityRefs: ["ticket:iss_101", "customer:cust_ada"],
          title: "Customer Escalation Alert",
          summary: "Customer Ada reports repeated service disruption",
          severity: "critical",
          state: "open",
        },
        {
          id: "sit_sup_2",
          tenantId: "tenant_sup_123",
          category: "delivery_sla_risk",
          entityRefs: ["order:ord_999", "order:ORD-999"],
          title: "Delivery SLA Breach Risk",
          summary: "Order ORD-999 delayed 45 minutes",
          severity: "warning",
          state: "open",
        },
      ],
      timeline: [],
      stats: {
        totalSignals: 42,
        facetCounts: { context: 20, outcomes: 15, evidence: 7 },
        verifiedReceiptRatio: 0.9,
        activeSituations: 2,
      },
    },
  };

  it("fetches OLG context for tenant and passes authentication headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockOlgResponse,
    });

    const result = await fetchOlgContextForTenant("tenant_sup_123", {
      fetchImpl: mockFetch,
    });

    expect(result.ok).toBe(true);
    expect(result.situations.length).toBe(2);
    expect(result.totalSignals).toBe(42);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url.toString()).toContain("https://runtime.test.servicev8.com/api/signals/query");
    expect(init.headers["x-servicev8-signal-secret"]).toBe("test-query-secret-support-777");
    expect(init.headers["x-servicev8-tenant-id"]).toBe("tenant_sup_123");
  });

  it("finds situations matching ticket by id, customerRef, or referenced order", () => {
    const situations: OlgSituation[] = mockOlgResponse.data.situations as OlgSituation[];

    const matchedByTicket = findSituationsForTicket(situations, {
      ticketId: "iss_101",
      customerRef: "cust_ada",
    });
    expect(matchedByTicket.length).toBe(1);
    expect(matchedByTicket[0].id).toBe("sit_sup_1");

    const matchedByOrderRef = findSituationsForTicket(situations, {
      ticketId: "iss_different",
      summary: "Customer asking about order ORD-999 tracking",
    });
    expect(matchedByOrderRef.length).toBe(1);
    expect(matchedByOrderRef[0].id).toBe("sit_sup_2");

    const matchedNone = findSituationsForTicket(situations, {
      ticketId: "iss_none",
      customerRef: "cust_unknown",
    });
    expect(matchedNone.length).toBe(0);
  });

  it("fails soft when Runtime is unreachable", async () => {
    mockFetch.mockRejectedValue(new Error("Connection refused"));

    const result = await fetchOlgContextForTenant("tenant_sup_123", {
      fetchImpl: mockFetch,
    });

    expect(result.ok).toBe(false);
    expect(result.situations).toEqual([]);

    const active = await fetchOlgSituationsForTenant("tenant_sup_123", {
      fetchImpl: mockFetch,
    });
    expect(active).toEqual([]);
  });
});

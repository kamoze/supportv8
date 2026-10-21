import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  ActionGatewayHttpClient,
} from "../src/lib/runtime/action-gateway-http-client";
import { POST } from "../src/app/api/issues/[id]/source-action/route";
import { issueService } from "../src/lib/services/issue-service";
import { pgSupportIntelligenceRepository } from "../src/lib/db/support-intelligence-repository";
import { resolveRequestTenant } from "../src/lib/auth/request-tenant";

vi.mock("../src/lib/auth/request-tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/request-tenant")>();
  return {
    ...actual,
    resolveRequestTenant: vi.fn(),
  };
});

describe("Action Gateway HTTP Client & Governed Write-back", () => {
  const TENANT_ID = "tenant_acme";

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe("ActionGatewayHttpClient", () => {
    it("enforces 5-second request timeout on network hangs", async () => {
      const client = new ActionGatewayHttpClient({
        baseUrl: "http://gateway.test",
        token: "workload-token",
      });

      const fetchMock = vi.fn().mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              const err = new Error("The operation was aborted");
              err.name = "TimeoutError";
              reject(err);
            });
          }
        });
      });
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        client.execute({
          accountId: "acc_1",
          tenantId: TENANT_ID,
          capability: "support.ticket.update",
          connectorKey: "zendesk",
          idempotencyKey: "idem_timeout",
          actor: { id: "user_1", type: "human", name: "User" },
          policyDecision: { id: "pol_1", mode: "copilot", decision: "allow" },
          payload: { ticketId: "123", status: "solved" },
        })
      ).rejects.toThrow(/timed out/i);
    });

    it("rejects non-2xx responses and does not fall back to local simulation", async () => {
      const client = new ActionGatewayHttpClient({
        baseUrl: "http://gateway.test",
      });

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Zendesk API Rate Limit Exceeded" }), {
          status: 429,
          statusText: "Too Many Requests",
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        client.execute({
          accountId: "acc_1",
          tenantId: TENANT_ID,
          capability: "support.ticket.update",
          connectorKey: "zendesk",
          idempotencyKey: "idem_rate_limit",
          actor: { id: "user_1", type: "human", name: "User" },
          policyDecision: { id: "pol_1", mode: "copilot", decision: "allow" },
          payload: { ticketId: "123" },
        })
      ).rejects.toThrow(/HTTP 429.*Zendesk API Rate Limit/i);
    });

    it("rejects malformed responses missing execution ID", async () => {
      const client = new ActionGatewayHttpClient({
        baseUrl: "http://gateway.test",
      });

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "completed" }), {
          status: 200,
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        client.execute({
          accountId: "acc_1",
          tenantId: TENANT_ID,
          capability: "support.ticket.update",
          connectorKey: "zendesk",
          idempotencyKey: "idem_missing_id",
          actor: { id: "user_1", type: "human", name: "User" },
          policyDecision: { id: "pol_1", mode: "copilot", decision: "allow" },
          payload: { ticketId: "123" },
        })
      ).rejects.toThrow(/missing execution ID/i);
    });

    it("rejects response when gateway echoes a mismatched tenant", async () => {
      const client = new ActionGatewayHttpClient({
        baseUrl: "http://gateway.test",
      });

      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "ag_exec_foreign",
            tenantId: "tenant_foreign",
            status: "completed",
          }),
          { status: 200 }
        )
      );
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        client.execute({
          accountId: "acc_1",
          tenantId: TENANT_ID,
          capability: "support.ticket.update",
          connectorKey: "zendesk",
          idempotencyKey: "idem_foreign_mismatch",
          actor: { id: "user_1", type: "human", name: "User" },
          policyDecision: { id: "pol_1", mode: "copilot", decision: "allow" },
          payload: { ticketId: "123" },
        })
      ).rejects.toThrow(/tenant mismatch/i);
    });
  });

  describe("POST /api/issues/[id]/source-action Route", () => {
    beforeEach(() => {
      vi.mocked(resolveRequestTenant).mockResolvedValue({
        tenantId: TENANT_ID,
        tenantSlug: "acme",
        authenticated: true,
        userId: "operator_1",
        username: "operator@acme.com",
        displayName: "Alice Operator",
        roles: ["support_operator"],
      });
    });

    it("guarantees zero direct fetch calls to Zendesk (only Action Gateway is contacted)", async () => {
      const fetchMock = vi.fn().mockImplementation((url: string) => {
        if (url.includes("zendesk.com")) {
          throw new Error("Direct Zendesk call detected! Boundary violation.");
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "ag_exec_9901",
              status: "completed",
              result: { ticketId: "1001", status: "solved" },
            }),
            { status: 200 }
          )
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      vi.spyOn(issueService, "getById").mockResolvedValue({
        id: "iss_1001",
        tenantId: TENANT_ID,
        source: "zendesk",
        externalId: "ZD-1001",
        summary: "Checkout failed",
        status: "open",
        priority: "high",
        category: "billing",
      } as any);

      vi.spyOn(pgSupportIntelligenceRepository, "getTenantPolicy").mockResolvedValue({
        tenantId: TENANT_ID,
        rawContextRetentionHours: 72,
        mode: "copilot",
        updatedAt: new Date().toISOString(),
      });

      vi.spyOn(pgSupportIntelligenceRepository, "getSourceConnection").mockResolvedValue({
        id: "src_conn_1",
        tenantId: TENANT_ID,
        accountId: "acc_acme",
        provider: "zendesk",
        connectionId: "conn_zd_01",
        connectorKey: "zendesk",
        externalAccountId: "zd_acme",
        baseUrl: "https://acme.zendesk.com",
        status: "connected",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      vi.spyOn(pgSupportIntelligenceRepository, "getActionReceipt").mockResolvedValue(null);
      vi.spyOn(pgSupportIntelligenceRepository, "recordActionReceipt").mockImplementation(async (r: any) => ({
        ...r,
        id: "rcpt_1",
        createdAt: new Date().toISOString(),
      }));
      const updateIssueSpy = vi.spyOn(issueService, "update").mockResolvedValue({} as any);

      const request = new NextRequest("http://localhost:3005/api/issues/iss_1001/source-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "update",
          status: "solved",
          internalNote: "Fixed via governed write-back",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "iss_1001" }) });
      expect(response.status).toBe(200);

      // Verify fetch was only called to Action Gateway, zero calls to zendesk.com
      expect(fetchMock).toHaveBeenCalled();
      for (const call of fetchMock.mock.calls) {
        expect(call[0]).not.toContain("zendesk.com");
        expect(call[0]).toContain("/v1/actions/execute");
      }
      expect(updateIssueSpy).toHaveBeenCalledWith(
        "iss_1001",
        expect.objectContaining({ sourceStatus: "solved" }),
        TENANT_ID
      );
    });

    it("rejects mutation when tenant is in observe mode", async () => {
      vi.spyOn(issueService, "getById").mockResolvedValue({
        id: "iss_1001",
        tenantId: TENANT_ID,
        source: "zendesk",
        externalId: "ZD-1001",
      } as any);

      vi.spyOn(pgSupportIntelligenceRepository, "getTenantPolicy").mockResolvedValue({
        tenantId: TENANT_ID,
        rawContextRetentionHours: 72,
        mode: "observe",
        updatedAt: new Date().toISOString(),
      });

      const request = new NextRequest("http://localhost:3005/api/issues/iss_1001/source-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close", resolutionSummary: "Resolved by agent" }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "iss_1001" }) });
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toContain("observe mode");
    });

    it("returns 404 for a foreign or missing Issue ID", async () => {
      vi.spyOn(issueService, "getById").mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3005/api/issues/iss_foreign/source-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close", resolutionSummary: "Resolved" }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "iss_foreign" }) });
      expect(response.status).toBe(404);
    });

    it("returns 400 if Issue source is not zendesk", async () => {
      vi.spyOn(issueService, "getById").mockResolvedValue({
        id: "iss_intercom_1",
        tenantId: TENANT_ID,
        source: "intercom" as any,
        externalId: "int_99",
      } as any);

      const request = new NextRequest("http://localhost:3005/api/issues/iss_intercom_1/source-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close", resolutionSummary: "Resolved" }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "iss_intercom_1" }) });
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain("Zendesk");
    });

    it("rejects idempotency key reuse with changed payload (409)", async () => {
      vi.spyOn(issueService, "getById").mockResolvedValue({
        id: "iss_1001",
        tenantId: TENANT_ID,
        source: "zendesk",
        externalId: "ZD-1001",
      } as any);

      vi.spyOn(pgSupportIntelligenceRepository, "getTenantPolicy").mockResolvedValue({
        tenantId: TENANT_ID,
        rawContextRetentionHours: 72,
        mode: "copilot",
        updatedAt: new Date().toISOString(),
      });

      vi.spyOn(pgSupportIntelligenceRepository, "getSourceConnection").mockResolvedValue({
        id: "src_conn_1",
        tenantId: TENANT_ID,
        accountId: "acc_acme",
        provider: "zendesk",
        connectionId: "conn_zd_01",
        connectorKey: "zendesk",
        externalAccountId: "zd_acme",
        baseUrl: "https://acme.zendesk.com",
        status: "connected",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Existing receipt with different payload
      vi.spyOn(pgSupportIntelligenceRepository, "getActionReceipt").mockResolvedValue({
        id: "rcpt_existing",
        tenantId: TENANT_ID,
        idempotencyKey: "idem_reused_key",
        action: "update",
        status: "completed",
        payload: { ticketId: "1001", status: "open", priority: "low" },
        createdAt: new Date().toISOString(),
      } as any);

      const request = new NextRequest("http://localhost:3005/api/issues/iss_1001/source-action", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "idem_reused_key",
        },
        body: JSON.stringify({
          action: "update",
          status: "solved", // Changed payload!
          priority: "urgent",
        }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "iss_1001" }) });
      expect(response.status).toBe(409);
      const json = await response.json();
      expect(json.error).toContain("different payload");
    });

    it("does NOT mutate local issue state when Action Gateway execution fails", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "ag_exec_failed",
            status: "failed",
            error: "Zendesk upstream timeout: ticket could not be locked",
          }),
          { status: 200 }
        )
      );
      vi.stubGlobal("fetch", fetchMock);

      vi.spyOn(issueService, "getById").mockResolvedValue({
        id: "iss_1001",
        tenantId: TENANT_ID,
        source: "zendesk",
        externalId: "ZD-1001",
        status: "open",
      } as any);

      vi.spyOn(pgSupportIntelligenceRepository, "getTenantPolicy").mockResolvedValue({
        tenantId: TENANT_ID,
        rawContextRetentionHours: 72,
        mode: "copilot",
        updatedAt: new Date().toISOString(),
      });

      vi.spyOn(pgSupportIntelligenceRepository, "getSourceConnection").mockResolvedValue({
        id: "src_conn_1",
        tenantId: TENANT_ID,
        accountId: "acc_acme",
        provider: "zendesk",
        connectionId: "conn_zd_01",
        connectorKey: "zendesk",
        externalAccountId: "zd_acme",
        baseUrl: "https://acme.zendesk.com",
        status: "connected",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      vi.spyOn(pgSupportIntelligenceRepository, "getActionReceipt").mockResolvedValue(null);
      const recordReceiptSpy = vi.spyOn(pgSupportIntelligenceRepository, "recordActionReceipt").mockResolvedValue({} as any);
      const updateIssueSpy = vi.spyOn(issueService, "update");

      const request = new NextRequest("http://localhost:3005/api/issues/iss_1001/source-action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "close", resolutionSummary: "Issue resolved" }),
      });

      const response = await POST(request, { params: Promise.resolve({ id: "iss_1001" }) });
      expect(response.status).toBe(502);

      // Verify failed receipt was logged
      expect(recordReceiptSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" })
      );

      // Verify local issue state was NEVER mutated
      expect(updateIssueSpy).not.toHaveBeenCalled();
    });
  });
});

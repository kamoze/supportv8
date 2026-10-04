import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  emitSupportTicketCreatedSignal,
  emitSupportTicketEscalatedSignal,
  emitSupportTicketResolvedSignal,
  emitSupportCsatRecordedSignal,
  SUPPORT_SIGNAL_TYPES,
  safeEmitSignal,
  getAgenticRuntimeCascadeUrls,
} from "@/lib/signals/signal-agent";

describe("supportv8 signal-agent", () => {
  const originalEnv = process.env;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...originalEnv,
      SERVICEV8_RUNTIME_URL: "https://runtime.test.servicev8.com",
      RUNTIME_SIGNALS_SECRET: "test-secret-sig-support-1",
    };
  });

  it("emits support.ticket-created signal with proper CloudEvents envelope", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 202,
      json: async () => ({ ok: true, receiptId: "rcpt_sup_1", status: "accepted" }),
    });

    const result = await emitSupportTicketCreatedSignal(
      {
        tenantId: "tenant_sup_100",
        accountId: "acc_sup_100",
        ticket: {
          id: "iss_100",
          ticketRef: "SV8-RUNTIME-100",
          customerName: "Alice Wonderland",
          summary: "Cannot access patient portal",
          priority: "urgent",
          category: "portal_access",
        },
      },
      { fetchImpl: mockFetch }
    );

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url.toString()).toBe("https://runtime.test.servicev8.com/api/signals/intake");
    expect(init.method).toBe("POST");
    expect(init.headers["x-servicev8-signal-secret"]).toBe("test-secret-sig-support-1");
    expect(init.headers["x-servicev8-tenant-id"]).toBe("tenant_sup_100");
    expect(init.headers["x-servicev8-account-id"]).toBe("acc_sup_100");

    const body = JSON.parse(init.body);
    expect(body.specversion).toBe("1.0");
    expect(body.source).toBe("urn:servicev8:app:supportv8");
    expect(body.type).toBe(SUPPORT_SIGNAL_TYPES.TICKET_CREATED);
    expect(body.subject).toBe("ticket:iss_100");
    expect(body.data.ticketId).toBe("iss_100");
    expect(body.data.priority).toBe("urgent");
  });

  it("emits support.ticket-escalated signal with claim evidence", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 202,
      json: async () => ({ ok: true, receiptId: "rcpt_sup_2", status: "accepted" }),
    });

    const result = await emitSupportTicketEscalatedSignal(
      {
        tenantId: "tenant_sup_100",
        ticketId: "iss_100",
        customerName: "Alice Wonderland",
        reason: "Customer reports missing medication",
      },
      { fetchImpl: mockFetch }
    );

    expect(result.ok).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe(SUPPORT_SIGNAL_TYPES.TICKET_ESCALATED);
    expect(body.subject).toBe("ticket:iss_100");
    expect(body.data.reason).toBe("Customer reports missing medication");
  });

  it("emits support.ticket-resolved signal with verified receipt", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ ok: true, receiptId: "rcpt_sup_3", status: "duplicate" }),
    });

    const result = await emitSupportTicketResolvedSignal(
      {
        tenantId: "tenant_sup_100",
        ticketId: "iss_100",
        resolutionSummary: "Password reset instructions sent",
      },
      { fetchImpl: mockFetch }
    );

    expect(result.ok).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe(SUPPORT_SIGNAL_TYPES.TICKET_RESOLVED);
    expect(body.subject).toBe("ticket:iss_100");
    expect(body.data.status).toBe("resolved");
  });

  it("emits support.csat-recorded signal with customer satisfaction receipt", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 202,
      json: async () => ({ ok: true, receiptId: "rcpt_sup_4", status: "accepted" }),
    });

    const result = await emitSupportCsatRecordedSignal(
      {
        tenantId: "tenant_sup_100",
        ticketId: "iss_100",
        score: 5,
        feedback: "Resolved within 5 minutes!",
      },
      { fetchImpl: mockFetch }
    );

    expect(result.ok).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.type).toBe(SUPPORT_SIGNAL_TYPES.CSAT_RECORDED);
    expect(body.data.score).toBe(5);
  });

  it("fails safely and does not throw on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("Network connection refused"));

    const result = await safeEmitSignal(
      {
        tenantId: "tenant_sup_100",
        eventType: SUPPORT_SIGNAL_TYPES.TICKET_CREATED,
        subject: "ticket:iss_err",
        data: { error: true },
      },
      { fetchImpl: mockFetch }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Network connection refused");
    }
  });

  it("resolves multi-ingress cascade URLs in prioritized order", () => {
    const urls = getAgenticRuntimeCascadeUrls({
      SERVICEV8_RUNTIME_CLUSTER_URL: "http://servicev8-runtime.default.svc.cluster.local:3000",
      SERVICEV8_RUNTIME_TAILNET_URL: "http://runtime-intake:3000",
      SERVICEV8_RUNTIME_PUBLIC_URL: "https://runtime.servicev8.com",
    });

    expect(urls).toEqual([
      "http://servicev8-runtime.default.svc.cluster.local:3000",
      "http://runtime-intake:3000",
      "https://runtime.servicev8.com",
    ]);
  });

  it("fails over automatically across cascade ingress endpoints", async () => {
    // First candidate (cluster local) fails with network error
    mockFetch.mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.96.0.42:3000"));
    // Second candidate (tailnet or public) succeeds
    mockFetch.mockResolvedValueOnce({
      status: 202,
      json: async () => ({ ok: true, receiptId: "rcpt_cascade_success", status: "accepted" }),
    });

    const result = await safeEmitSignal(
      {
        tenantId: "tenant_sup_cascade",
        eventType: SUPPORT_SIGNAL_TYPES.TICKET_CREATED,
        subject: "ticket:iss_cascade",
        data: { priority: "normal" },
      },
      {
        fetchImpl: mockFetch,
        env: {
          SERVICEV8_RUNTIME_CLUSTER_URL: "http://cluster.local:3000",
          SERVICEV8_RUNTIME_PUBLIC_URL: "https://public.servicev8.com",
        },
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.receiptId).toBe("rcpt_cascade_success");
    }
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe("http://cluster.local:3000/api/signals/intake");
    expect(mockFetch.mock.calls[1][0]).toBe("https://public.servicev8.com/api/signals/intake");
  });

  it("canonicalizes external runtime tenant ID to canonical registry tenant ID", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 202,
      json: async () => ({ ok: true, receiptId: "rcpt_canonical_1", status: "accepted" }),
    });

    const result = await emitSupportTicketCreatedSignal(
      {
        tenantId: "tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559",
        accountId: "acct_5c88ae327c3a",
        ticket: {
          id: "iss_a733b7508a5a4348bbc48545481416f4",
          ticketRef: "SV8-MANUAL-A733B7508A5A",
          customerName: "Amara Okafor",
          summary: "Purchase asthma kit 100pcs for pharmacy",
          priority: "normal",
        },
      },
      { fetchImpl: mockFetch }
    );

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers["x-servicev8-tenant-id"]).toBe("tenant_5c88ae327c3a");
    expect(init.headers["x-servicev8-account-id"]).toBe("acct_5c88ae327c3a");
  });
});


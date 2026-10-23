import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ChatbotTelemetry } from "../src/lib/chatbot/observability/telemetry";
import { GET } from "../src/app/api/observability/traces/route";
import { resolveRequestTenant } from "../src/lib/auth/request-tenant";

vi.mock("../src/lib/auth/request-tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/request-tenant")>();
  return {
    ...actual,
    resolveRequestTenant: vi.fn(),
  };
});

describe("Observability & Telemetry Tenant Isolation", () => {
  const mockedResolveRequestTenant = vi.mocked(resolveRequestTenant);

  const TENANT_A = "tenant_alpha";
  const TENANT_B = "tenant_beta";

  beforeEach(() => {
    ChatbotTelemetry.clear();
    vi.clearAllMocks();
  });

  it("proves unauthenticated request to /api/observability/traces returns 401", async () => {
    mockedResolveRequestTenant.mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized: authentication required"), { status: 401 })
    );

    const request = new NextRequest("http://localhost:3000/api/observability/traces");
    const response = await GET(request);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain("Unauthorized");
  });

  it("proves an authenticated identity without support role returns 403", async () => {
    mockedResolveRequestTenant.mockResolvedValueOnce({
      tenantId: TENANT_A,
      accountId: TENANT_A,
      tenantSlug: TENANT_A,
      authenticated: true,
      roles: ["client_user"],
      userId: "usr_client_01",
    });

    const request = new NextRequest("http://localhost:3000/api/observability/traces");
    const response = await GET(request);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it("proves Tenant A queries never return Tenant B correlation IDs or traces", async () => {
    // 1. Record structured trace for Tenant A
    ChatbotTelemetry.recordTrace({
      traceId: "tr_alpha_01",
      spanId: "span_alpha_01",
      sessionId: "sess_alpha_101",
      tenantId: TENANT_A,
      correlationId: "corr_alpha_secret_99",
      operation: "support.rag_query",
      channel: "web_chat",
      model: "gpt-4o",
      promptTokens: 250,
      completionTokens: 100,
      totalTokens: 350,
      costUsd: 0.007,
      latencyMs: 140,
      guardrailTriggered: false,
      toolsInvoked: ["knowledge.query"],
      timestamp: new Date().toISOString(),
    });

    // 2. Record structured trace for Tenant B
    ChatbotTelemetry.recordTrace({
      traceId: "tr_beta_01",
      spanId: "span_beta_01",
      sessionId: "sess_beta_202",
      tenantId: TENANT_B,
      correlationId: "corr_beta_secret_88",
      operation: "support.ticket_update",
      channel: "web_chat",
      model: "gpt-4o",
      promptTokens: 800,
      completionTokens: 200,
      totalTokens: 1000,
      costUsd: 0.02,
      latencyMs: 310,
      guardrailTriggered: true,
      toolsInvoked: ["zendesk.ticket.update"],
      timestamp: new Date().toISOString(),
    });

    // 3. Authenticate as Tenant A
    mockedResolveRequestTenant.mockResolvedValueOnce({
      tenantId: TENANT_A,
      accountId: TENANT_A,
      tenantSlug: TENANT_A,
      authenticated: true,
      roles: ["support_observer"],
      userId: "usr_observer_a",
    });

    const reqA = new NextRequest("http://localhost:3000/api/observability/traces");
    const resA = await GET(reqA);

    expect(resA.status).toBe(200);
    const dataA = await resA.json();

    expect(dataA.success).toBe(true);
    expect(dataA.traces).toHaveLength(1);
    expect(dataA.traces[0].traceId).toBe("tr_alpha_01");
    expect(dataA.traces[0].correlationId).toBe("corr_alpha_secret_99");
    expect(dataA.traces[0].tenantId).toBe(TENANT_A);

    // Assert zero leakage of Tenant B correlation ID or trace ID
    const containsBetaTrace = dataA.traces.some(
      (t: any) =>
        t.traceId === "tr_beta_01" ||
        t.correlationId === "corr_beta_secret_88" ||
        t.tenantId === TENANT_B
    );
    expect(containsBetaTrace).toBe(false);

    // Assert Tenant A metrics reflect only Tenant A
    expect(dataA.metrics.totalTraces).toBe(1);
    expect(dataA.metrics.totalTokens).toBe(350);
    expect(dataA.metrics.totalCostUsd).toBe(0.007);
    expect(dataA.metrics.guardrailTriggerRate).toBe(0);
  });

  it("proves telemetry sanitization strips PII, credentials, prompt bodies, and tokens", async () => {
    ChatbotTelemetry.recordTrace({
      traceId: "tr_sensitive_01",
      spanId: "span_sensitive_01",
      sessionId: "sess_sanitized",
      tenantId: TENANT_A,
      correlationId: "corr_user_john.doe@example.com_phone_+1-555-019-2834",
      operation: "Bearer sk-proj-1234567890abcdef",
      channel: "web_chat",
      model: "gpt-4o",
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      costUsd: 0.003,
      latencyMs: 95,
      guardrailTriggered: false,
      toolsInvoked: ["auth.login?token=secret123"],
      timestamp: new Date().toISOString(),
    });

    mockedResolveRequestTenant.mockResolvedValueOnce({
      tenantId: TENANT_A,
      accountId: TENANT_A,
      tenantSlug: TENANT_A,
      authenticated: true,
      roles: ["support_operator"],
      userId: "usr_op_a",
    });

    const req = new NextRequest("http://localhost:3000/api/observability/traces");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    const trace = data.traces[0];

    // Must not expose email
    expect(trace.correlationId).not.toContain("john.doe@example.com");
    expect(trace.correlationId).toContain("[REDACTED]");

    // Must not expose phone number
    expect(trace.correlationId).not.toContain("555-019-2834");

    // Must not expose bearer token
    expect(trace.operation).not.toContain("Bearer sk-proj-");
    expect(trace.operation).toContain("[REDACTED]");

    // Must not expose tool token argument
    expect(trace.toolsInvoked[0]).not.toContain("secret123");
    expect(trace.toolsInvoked[0]).toContain("[REDACTED]");
  });

  it("proves getTraces without tenantId returns empty array", () => {
    ChatbotTelemetry.recordTrace({
      traceId: "tr_test_unfiltered",
      spanId: "span_test_unfiltered",
      sessionId: "sess_unfiltered",
      tenantId: TENANT_A,
      channel: "web_chat",
      model: "gpt-4o",
      promptTokens: 10,
      completionTokens: 10,
      totalTokens: 20,
      costUsd: 0.001,
      latencyMs: 50,
      guardrailTriggered: false,
      toolsInvoked: [],
      timestamp: new Date().toISOString(),
    });

    // Calling getTraces without tenantId must strictly return []
    const unfiltered = ChatbotTelemetry.getTraces();
    expect(unfiltered).toEqual([]);

    const tenantATraces = ChatbotTelemetry.getTraces({ tenantId: TENANT_A });
    expect(tenantATraces).toHaveLength(1);
    expect(tenantATraces[0].traceId).toBe("tr_test_unfiltered");
  });
});

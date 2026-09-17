import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/chat/route";

describe("SupportV8 Chat Route with Central AgenticOS Runtime", () => {
  beforeEach(() => {
    vi.stubEnv("SERVICEV8_RUNTIME_URL", "http://agentic-runtime.internal");
    vi.stubEnv("SERVICEV8_RUNTIME_TOKEN", "test-runtime-token");
    vi.stubEnv("FORGE_GATEWAY_URL", "http://forge.test");
    vi.stubEnv("FORGE_GATEWAY_MODEL_TOKEN", "model-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("routes ask to central AgenticOS runtime when SUPPORTV8_CENTRAL_CHAT_ENABLED is true", async () => {
    vi.stubEnv("SUPPORTV8_CENTRAL_CHAT_ENABLED", "true");

    const fetchMock = vi.fn()
      // 1. Dispatch turn to /api/agenticos/turns
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            admitted: true,
            turnId: "turn_central_123",
            threadId: "thread_central_456",
            state: "running",
            lastRecipientId: "emp_support_lead",
            streamUrl: "http://agentic-runtime.internal/api/agenticos/turns/stream",
          }),
          { status: 201 }
        )
      )
      // 2. Poll changes
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            turns: [{ id: "turn_central_123", state: "completed" }],
            messages: [
              {
                id: "msg_user_1",
                role: "user",
                content: "Summarize issues",
              },
              {
                id: "msg_assistant_1",
                role: "assistant",
                content: "Central AgenticOS summary: All systems healthy in Acme workspace.",
              },
            ],
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new NextRequest("http://localhost:3005/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": "acme",
        },
        body: JSON.stringify({
          query: "Summarize issues",
          employeeId: "emp_support_lead",
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.runtime).toBe("agenticos_central");
    expect(payload.data.answer).toBe("Central AgenticOS summary: All systems healthy in Acme workspace.");
    expect(payload.data.citations).toBeDefined();

    // Verify calls went to agentic runtime
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const dispatchCall = fetchMock.mock.calls[0];
    const dispatchUrl = dispatchCall[0] as URL;
    const dispatchInit = dispatchCall[1] as RequestInit;
    expect(dispatchUrl.pathname).toBe("/api/agenticos/turns");
    expect(dispatchInit.headers).toMatchObject({
      Authorization: "Bearer test-runtime-token",
      "x-servicev8-tenant-domain": "acme",
    });

    const dispatchBody = JSON.parse(String(dispatchInit.body));
    expect(dispatchBody.slug).toBe("acme");
    expect(dispatchBody.domainContext.sourceApp).toBe("supportv8");
    expect(dispatchBody.domainContext.tenantSlug).toBe("acme");
  });

  it("fails softly and falls back to local ForgeGateway when central dispatch fails", async () => {
    vi.stubEnv("SUPPORTV8_CENTRAL_CHAT_ENABLED", "true");

    const fetchMock = vi.fn()
      // 1. Central dispatch fails with 500
      .mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }))
      // 2. Fallback to ForgeGateway getHire
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
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
          }),
          { status: 200 }
        )
      )
      // 3. Fallback to ForgeGateway complete
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: { content: "Fallback response from local forge gateway." },
            usage: { creditsUsed: 1 },
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new NextRequest("http://localhost:3005/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": "acme",
        },
        body: JSON.stringify({
          query: "Help with issues",
          employeeId: "emp_support_lead",
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.runtime).toBe("forge_gateway");
    expect(payload.data.answer).toBe("Fallback response from local forge gateway.");
  });

  it("uses local ForgeGateway directly when central chat flag is not enabled", async () => {
    vi.stubEnv("SUPPORTV8_CENTRAL_CHAT_ENABLED", "false");

    const fetchMock = vi.fn()
      // 1. ForgeGateway getHire
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            instanceId: "hi_supportv8_demo_acme",
            tenantId: "tenant_acme",
            vertical: "supportv8",
            status: "active",
            budget: { exhausted: false, remaining: 50000 },
          }),
          { status: 200 }
        )
      )
      // 2. ForgeGateway complete
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: { content: "Direct forge gateway response." },
            usage: { creditsUsed: 1 },
          }),
          { status: 200 }
        )
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new NextRequest("http://localhost:3005/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-tenant-id": "acme",
        },
        body: JSON.stringify({
          query: "Testing disabled flag",
          employeeId: "emp_support_lead",
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.runtime).toBe("forge_gateway");
    expect(payload.data.answer).toBe("Direct forge gateway response.");

    // Ensure agenticos turns was NOT called
    for (const call of fetchMock.mock.calls) {
      const url = call[0] as URL;
      expect(url.pathname).not.toBe("/api/agenticos/turns");
    }
  });
});

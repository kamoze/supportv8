import { describe, expect, it, vi } from "vitest";
import {
  dispatchAgenticTurn,
  executeAgenticChatAsk,
  getAgenticRuntimeBaseUrl,
  getAgenticRuntimeToken,
  isCentralAgenticChatEnabled,
  pollAgenticTurnCompletion,
} from "@/lib/chat/agenticos-chat-client";

describe("agenticos-chat-client for SupportV8", () => {
  it("enables central chat when SUPPORTV8_CENTRAL_CHAT_ENABLED or SERVICEV8_CENTRAL_CHAT_ENABLED is set", () => {
    expect(isCentralAgenticChatEnabled({})).toBe(false);
    expect(isCentralAgenticChatEnabled({ SUPPORTV8_CENTRAL_CHAT_ENABLED: "true" })).toBe(true);
    expect(isCentralAgenticChatEnabled({ SERVICEV8_CENTRAL_CHAT_ENABLED: "true" })).toBe(true);
  });

  it("resolves the base runtime URL with fallback", () => {
    expect(getAgenticRuntimeBaseUrl({})).toBe("https://runtime.servicev8.com");
    expect(
      getAgenticRuntimeBaseUrl({ SERVICEV8_RUNTIME_URL: "https://custom-runtime.example.com/" })
    ).toBe("https://custom-runtime.example.com");
    expect(
      getAgenticRuntimeBaseUrl({ SUPPORT_RUNTIME_URL: "http://servicev8-runtime.default.svc.cluster.local:3000/" })
    ).toBe("http://servicev8-runtime.default.svc.cluster.local:3000");
  });

  it("resolves the runtime token with fallback", () => {
    expect(getAgenticRuntimeToken({})).toBe("");
    expect(
      getAgenticRuntimeToken({ SUPPORTV8_SERVICE_APP_RUNTIME_SECRET: "support_app_secret_123" })
    ).toBe("support_app_secret_123");
    expect(
      getAgenticRuntimeToken({ SERVICEV8_RUNTIME_TOKEN: "servicev8_token_abc" })
    ).toBe("servicev8_token_abc");
  });

  it("dispatches turn to central runtime with proper domain context and headers", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        admitted: true,
        turnId: "turn_sup_123",
        threadId: "thr_sup_456",
        state: "pending",
        lastRecipientId: "emp_support_lead",
        streamUrl: "/api/workspace/acme/chat/stream?threadId=thr_sup_456",
      }),
    });

    const admission = await dispatchAgenticTurn(
      {
        tenantSlug: "acme",
        tenantId: "tenant_acme_123",
        prompt: "Help with order return",
        stream: "customers",
        recipientId: "emp_support_lead",
        metadata: { issueId: "iss_99" },
      },
      {
        env: {
          SERVICEV8_RUNTIME_URL: "https://runtime.servicev8.com",
          SUPPORTV8_SERVICE_APP_RUNTIME_SECRET: "token_123",
        },
        fetchImpl: mockFetch as unknown as typeof fetch,
      }
    );

    expect(admission).toEqual({
      admitted: true,
      turnId: "turn_sup_123",
      threadId: "thr_sup_456",
      state: "pending",
      lastRecipientId: "emp_support_lead",
      streamUrl: "/api/workspace/acme/chat/stream?threadId=thr_sup_456",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(calledUrl.toString()).toBe("https://runtime.servicev8.com/api/agenticos/turns");
    expect(calledInit.headers["Authorization"]).toBe("Bearer token_123");
    expect(calledInit.headers["x-servicev8-tenant-domain"]).toBe("acme");

    const body = JSON.parse(calledInit.body);
    expect(body.slug).toBe("acme");
    expect(body.prompt).toBe("Help with order return");
    expect(body.recipientId).toBe("emp_support_lead");
    expect(body.domainContext).toEqual({
      sourceApp: "supportv8",
      tenantId: "tenant_acme_123",
      tenantSlug: "acme",
      stream: "customers",
      entityType: "support_session",
      entityId: "acme",
      metadata: { issueId: "iss_99" },
    });
  });

  it("handles dispatch failures gracefully returning null", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    const admission = await dispatchAgenticTurn(
      {
        tenantSlug: "acme",
        tenantId: "tenant_acme_123",
        prompt: "Test query",
      },
      {
        env: { SERVICEV8_RUNTIME_URL: "https://runtime.servicev8.com" },
        fetchImpl: mockFetch as unknown as typeof fetch,
      }
    );

    expect(admission).toBeNull();
  });

  it("polls for turn completion and returns the final assistant reply", async () => {
    const mockFetch = vi
      .fn()
      // First poll: pending
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          turns: [{ id: "turn_sup_123", state: "running" }],
          messages: [{ id: "m1", role: "user", content: "Help with order return" }],
        }),
      })
      // Second poll: completed
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          turns: [{ id: "turn_sup_123", state: "completed" }],
          messages: [
            { id: "m1", role: "user", content: "Help with order return" },
            { id: "m2", role: "assistant", content: "I have reviewed your return request." },
          ],
        }),
      });

    const result = await pollAgenticTurnCompletion(
      {
        tenantSlug: "acme",
        threadId: "thr_sup_456",
        turnId: "turn_sup_123",
        timeoutMs: 3000,
        initialIntervalMs: 10,
      },
      {
        env: { SERVICEV8_RUNTIME_URL: "https://runtime.servicev8.com" },
        fetchImpl: mockFetch as unknown as typeof fetch,
      }
    );

    expect(result).toEqual({
      turnId: "turn_sup_123",
      threadId: "thr_sup_456",
      state: "completed",
      replyContent: "I have reviewed your return request.",
      messages: [
        { id: "m1", role: "user", content: "Help with order return" },
        { id: "m2", role: "assistant", content: "I have reviewed your return request." },
      ],
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles turn failure in polling", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        turns: [{ id: "turn_sup_123", state: "failed", error: "Temporal workflow timeout" }],
        messages: [],
      }),
    });

    const result = await pollAgenticTurnCompletion(
      {
        tenantSlug: "acme",
        threadId: "thr_sup_456",
        turnId: "turn_sup_123",
        timeoutMs: 1000,
        initialIntervalMs: 10,
      },
      {
        env: { SERVICEV8_RUNTIME_URL: "https://runtime.servicev8.com" },
        fetchImpl: mockFetch as unknown as typeof fetch,
      }
    );

    expect(result).toEqual({
      turnId: "turn_sup_123",
      threadId: "thr_sup_456",
      state: "failed",
      error: "Temporal workflow timeout",
      messages: [],
    });
  });

  it("executes full ask flow seamlessly", async () => {
    const mockFetch = vi
      .fn()
      // Turn admission
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admitted: true,
          turnId: "turn_ask_789",
          threadId: "thr_ask_001",
          state: "pending",
          lastRecipientId: "emp_support_lead",
          streamUrl: "/api/workspace/acme/chat/stream",
        }),
      })
      // Turn polling
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          turns: [{ id: "turn_ask_789", state: "completed" }],
          messages: [
            { id: "m1", role: "assistant", content: "Active issue count: 4. No high severity alarms." },
          ],
        }),
      });

    const res = await executeAgenticChatAsk(
      {
        tenantSlug: "acme",
        tenantId: "tenant_acme",
        employeeId: "emp_support_lead",
        employeeRole: "Support Lead",
        query: "What is the status?",
        contextPrompt: "TENANT_CONTEXT:\n{}",
        timeoutMs: 2000,
      },
      {
        env: { SERVICEV8_RUNTIME_URL: "https://runtime.servicev8.com" },
        fetchImpl: mockFetch as unknown as typeof fetch,
      }
    );

    expect(res).toEqual({
      answer: "Active issue count: 4. No high severity alarms.",
      turnId: "turn_ask_789",
      threadId: "thr_ask_001",
    });
  });
});

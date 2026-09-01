import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/auth/request-tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/request-tenant")>();
  return { ...actual, resolveRequestTenant: vi.fn() };
});

vi.mock("../src/lib/db/chat-repository", () => ({
  chatRepository: { getSessionPage: vi.fn() },
}));

import { resolveRequestTenant } from "../src/lib/auth/request-tenant";
import { chatRepository } from "../src/lib/db/chat-repository";
import { POST } from "../src/app/api/chat/draft/route";

const session = {
  id: "chat_acme_1",
  tenantDomain: "acme",
  stream: "customers",
  customerName: "Sarah Chen",
  customerEmail: "sarah@example.invalid",
  intakeData: {},
  assignedType: "human",
  assignedId: "operator_1",
  assignedName: "David",
  status: "active",
  priority: "normal",
  createdAt: "2026-09-01T10:00:00.000Z",
  updatedAt: "2026-09-01T10:01:00.000Z",
  messages: [
    {
      id: "msg_1",
      sender: "customer",
      senderName: "Sarah Chen",
      content: "My invoice still shows the duplicate charge.",
      timestamp: "2026-09-01T10:01:00.000Z",
    },
  ],
} as const;

function request(body: Record<string, unknown>) {
  return new NextRequest("https://acme.support.servicev8.com/api/chat/draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("tenant-scoped live chat draft generation", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FORGE_GATEWAY_URL", "http://forge.test");
    vi.stubEnv("FORGE_GATEWAY_MODEL_TOKEN", "model-token");
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      userId: "operator_1",
      displayName: "David",
      roles: ["support_operator"],
    });
    vi.mocked(chatRepository.getSessionPage).mockResolvedValue({
      session: session as never,
      nextCursor: undefined,
      hasEarlierMessages: false,
      hasMoreMessages: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the server-loaded tenant transcript for a metered Forge draft", async () => {
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
          usedThisPeriod: 10,
          remaining: 49_990,
          exhausted: false,
        },
        grants: [],
        outcomeKey: "drafts_created",
        createdAt: "2026-09-01T00:00:00.000Z",
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        response: { content: "Hi Sarah, I can see the duplicate charge is still showing. I’m reviewing the invoice and will confirm the next step here." },
        usage: { creditsUsed: 4 },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({
      sessionId: "chat_acme_1",
      channel: "chat",
      tone: "empathetic",
      transcript: "MERIDIAN SECRET — browser content must be ignored",
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.source).toBe("llm");
    expect(payload.data.creditsUsed).toBe(4);
    expect(chatRepository.getSessionPage).toHaveBeenCalledWith("tenant_acme", "chat_acme_1", { limit: 30 });
    const completionBody = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(completionBody.instanceId).toBe("hi_supportv8_demo_acme");
    expect(completionBody.request.messages[0].content).toContain("duplicate charge");
    expect(completionBody.request.messages[0].content).not.toContain("MERIDIAN SECRET");
  });

  it("returns a safe standard draft without completing when allowance is zero", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
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
        usedThisPeriod: 50_000,
        remaining: 0,
        exhausted: true,
      },
      grants: [],
      outcomeKey: "drafts_created",
      createdAt: "2026-09-01T00:00:00.000Z",
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ sessionId: "chat_acme_1", channel: "chat", tone: "concise" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.source).toBe("fallback");
    expect(payload.data.reason).toBe("allowance_exhausted");
    expect(payload.data.draft).toContain("Hi Sarah");
    expect(payload.data.draft).not.toMatch(/verified|approved|resolved/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a standard draft when the LLM service is not configured", async () => {
    vi.stubEnv("FORGE_GATEWAY_URL", "");
    vi.stubEnv("FORGE_GATEWAY_MODEL_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ sessionId: "chat_acme_1", channel: "email", tone: "technical" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ source: "fallback", reason: "runtime_unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not hide an invalid or cross-tenant session behind a fallback", async () => {
    vi.mocked(chatRepository.getSessionPage).mockResolvedValue(null);
    const response = await POST(request({ sessionId: "chat_meridian_1", channel: "chat", tone: "empathetic" }));
    expect(response.status).toBe(404);
  });

  it("rejects an observer before reading the transcript", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      userId: "observer_1",
      roles: ["support_observer"],
    });
    const response = await POST(request({ sessionId: "chat_acme_1", channel: "chat", tone: "empathetic" }));
    expect(response.status).toBe(403);
    expect(chatRepository.getSessionPage).not.toHaveBeenCalled();
  });
});

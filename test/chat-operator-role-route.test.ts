import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/auth/request-tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/request-tenant")>();
  return { ...actual, resolveRequestTenant: vi.fn() };
});

vi.mock("../src/lib/db/chat-repository", () => ({
  chatRepository: {
    sendMessage: vi.fn(),
    getSession: vi.fn(),
    listSessions: vi.fn(),
  },
}));

import { resolveRequestTenant } from "../src/lib/auth/request-tenant";
import { chatRepository } from "../src/lib/db/chat-repository";
import { POST } from "../src/app/api/chat/message/route";
import { GET as getSessions } from "../src/app/api/chat/session/route";
import { GET as getIssues } from "../src/app/api/issues/route";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("operator chat route authorization", () => {
  it("rejects an authenticated observer before writing a message", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      userId: "observer_1",
      username: "observer@acme.com",
      roles: ["support_observer"],
    });

    const response = await POST(
      new NextRequest("https://acme.support.servicev8.com/api/chat/message", {
        method: "POST",
        body: JSON.stringify({ sessionId: "chat_1", sender: "agent", content: "Injected reply" }),
      })
    );

    expect(response.status).toBe(403);
    expect(chatRepository.sendMessage).not.toHaveBeenCalled();
  });

  it("allows an authenticated SupportV8 operator", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      userId: "operator_1",
      username: "operator@acme.com",
      roles: ["support_operator"],
    });
    vi.mocked(chatRepository.sendMessage).mockResolvedValue({
      session: { id: "chat_1" } as never,
    });

    const response = await POST(
      new NextRequest("https://acme.support.servicev8.com/api/chat/message", {
        method: "POST",
        body: JSON.stringify({ sessionId: "chat_1", sender: "agent", content: "Verified reply" }),
      })
    );

    expect(response.status).toBe(200);
    expect(chatRepository.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant_acme", senderId: "operator_1" })
    );
  });

  it("rejects an observer before listing tenant chat sessions", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      userId: "observer_1",
      username: "observer@acme.com",
      roles: ["support_observer"],
    });

    const response = await getSessions(
      new NextRequest("https://acme.support.servicev8.com/api/chat/session")
    );

    expect(response.status).toBe(403);
    expect(chatRepository.listSessions).not.toHaveBeenCalled();
  });

  it("rejects an observer before loading the operator issue queue", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      userId: "observer_1",
      username: "observer@acme.com",
      roles: ["support_observer"],
    });

    const response = await getIssues(
      new NextRequest("https://acme.support.servicev8.com/api/issues")
    );

    expect(response.status).toBe(403);
  });
});

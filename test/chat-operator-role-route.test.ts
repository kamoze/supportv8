import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("../src/lib/auth/request-tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/request-tenant")>();
  return { ...actual, resolveRequestTenant: vi.fn() };
});

vi.mock("../src/lib/db/chat-repository", () => ({
  chatRepository: {
    startSession: vi.fn(),
    sendMessage: vi.fn(),
    getSession: vi.fn(),
    getSessionPage: vi.fn(),
    listSessions: vi.fn(),
  },
}));

import { resolveRequestTenant } from "../src/lib/auth/request-tenant";
import { chatRepository } from "../src/lib/db/chat-repository";
import { POST } from "../src/app/api/chat/message/route";
import { GET as getSessions, POST as startSession } from "../src/app/api/chat/session/route";
import { GET as getIssues } from "../src/app/api/issues/route";
import { POST as mutateIssue, PATCH as patchIssue } from "../src/app/api/issues/route";
import { POST as mutateMarketplace } from "../src/app/api/marketplace/route";
import { POST as mutateWorkforce } from "../src/app/api/workforce/route";
import { issueService } from "../src/lib/services/issue-service";
import { marketplaceService } from "../src/lib/services/marketplace-service";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("operator chat route authorization", () => {
  it("rejects a customer chat whose requested tenant differs from the hosted workspace", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_default",
      tenantSlug: "default",
      authenticated: false,
      roles: [],
    });

    const response = await startSession(
      new NextRequest("https://support.servicev8.com/api/chat/session", {
        method: "POST",
        body: JSON.stringify({
          tenantSlug: "acme",
          stream: "customers",
          customerName: "Tenant Boundary Probe",
          customerEmail: "probe@example.invalid",
          intakeData: {},
        }),
      }),
    );

    expect(response.status).toBe(403);
    expect(chatRepository.startSession).not.toHaveBeenCalled();
  });

  it("looks up a restored customer session only inside the hosted tenant", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_meridian",
      tenantSlug: "meridian",
      authenticated: false,
      roles: [],
    });
    vi.mocked(chatRepository.getSessionPage).mockResolvedValue(null);

    const response = await getSessions(
      new NextRequest("https://meridian.support.servicev8.com/api/chat/session?sessionId=chat_acme_1"),
    );

    expect(response.status).toBe(404);
    expect(chatRepository.getSessionPage).toHaveBeenCalledWith(
      "tenant_meridian",
      "chat_acme_1",
      expect.objectContaining({ limit: 100 }),
    );
  });

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
      displayName: "David",
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
      expect.objectContaining({
        tenantId: "tenant_acme",
        senderId: "operator_1",
        senderName: "David",
      })
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

  it.each([
    ["issue creation", mutateIssue, { summary: "must not persist" }],
    ["issue update", patchIssue, { id: "iss_acme_001", status: "resolved" }],
    ["marketplace change", mutateMarketplace, { action: "add_credits", amount: 999 }],
    ["workforce change", mutateWorkforce, { action: "hire", employeeId: "emp_incident_analyst" }],
  ])("rejects demo operator %s before shared state changes", async (_label, handler, body) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      userId: "demo_acme",
      username: "service-account-supportv8-demo-acme",
      roles: ["support_demo_operator"],
    });
    const createIssue = vi.spyOn(issueService, "createFromInteraction");
    const updateIssue = vi.spyOn(issueService, "updateIssue");
    const addCredits = vi.spyOn(marketplaceService, "addCredits");
    const hire = vi.spyOn(marketplaceService, "hireWorkforceAgent");

    const response = await handler(new NextRequest("https://acme.support.servicev8.com/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }));

    expect(response.status).toBe(403);
    expect(createIssue).not.toHaveBeenCalled();
    expect(updateIssue).not.toHaveBeenCalled();
    expect(addCredits).not.toHaveBeenCalled();
    expect(hire).not.toHaveBeenCalled();
    createIssue.mockRestore();
    updateIssue.mockRestore();
    addCredits.mockRestore();
    hire.mockRestore();
  });
});

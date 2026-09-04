import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/request-tenant", async (original) => ({
  ...await original<typeof import("@/lib/auth/request-tenant")>(),
  resolveRequestTenant: vi.fn(),
}));
vi.mock("@/lib/db/portal-repository", async (original) => ({
  ...await original<typeof import("@/lib/db/portal-repository")>(),
  portalRepository: {
    getDraft: vi.fn(),
    getPublished: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
    getPublishedAction: vi.fn(),
    recordActionEvent: vi.fn(async () => undefined),
  },
}));
vi.mock("@/lib/portal/rate-limit", async (original) => ({
  ...await original<typeof import("@/lib/portal/rate-limit")>(),
  portalRateLimiter: { enforce: vi.fn(async () => undefined) },
}));
vi.mock("@/lib/portal/public-query", async (original) => ({
  ...await original<typeof import("@/lib/portal/public-query")>(),
  runPublicKnowledgeQuery: vi.fn(async () => ({ query: "safe", citations: [] })),
}));

import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { portalRepository } from "@/lib/db/portal-repository";
import * as admin from "@/app/api/portal/admin/route";
import { POST as runAction } from "@/app/api/portal/actions/[slug]/route";

const adminRequest = (method = "GET", origin = "https://alpha.support.servicev8.com") => new Request(
  "http://0.0.0.0:3005/api/portal/admin",
  {
    method,
    headers: { host: "alpha.support.servicev8.com", origin, "content-type": "application/json" },
    ...(method === "GET" ? {} : { body: JSON.stringify({ action: "publish", expectedRevision: 1 }) }),
  },
);

beforeEach(() => {
  vi.mocked(resolveRequestTenant).mockResolvedValue({
    authenticated: true,
    tenantId: "tenant_alpha",
    tenantSlug: "alpha",
    userId: "operator-1",
    roles: ["support_operator"],
  });
});

afterEach(() => vi.clearAllMocks());

describe("portal management authorization", () => {
  it("rejects ordinary operators before reading a draft", async () => {
    expect((await admin.GET(adminRequest())).status).toBe(403);
    expect(portalRepository.getDraft).not.toHaveBeenCalled();
  });

  it("rejects a cross-workspace mutation before authentication", async () => {
    expect((await admin.POST(adminRequest("POST", "https://attacker.test"))).status).toBe(403);
    expect(resolveRequestTenant).not.toHaveBeenCalled();
    expect(portalRepository.publish).not.toHaveBeenCalled();
  });
});

describe("public portal action tenant binding", () => {
  it("ignores client tenant data and resolves the action in the hosted tenant", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      authenticated: false,
      tenantId: "tenant_alpha",
      tenantSlug: "alpha",
      roles: [],
    });
    vi.mocked(portalRepository.getPublishedAction).mockResolvedValue({
      id: "action_help",
      slug: "troubleshooting",
      label: "Troubleshooting",
      description: "Find verified help.",
      prompt: "Find published troubleshooting help.",
      mode: "answer",
      icon: "tools",
      categories: [],
      enabled: true,
    });

    const response = await runAction(
      new Request("https://alpha.support.servicev8.com/api/portal/actions/troubleshooting", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.4" },
        body: JSON.stringify({ tenantId: "tenant_beta", prompt: "read another tenant" }),
      }),
      { params: Promise.resolve({ slug: "troubleshooting" }) },
    );

    expect(response.status).toBe(200);
    expect(portalRepository.getPublishedAction).toHaveBeenCalledWith(
      "tenant_alpha",
      "alpha",
      "troubleshooting",
    );
  });

  it("never exposes a server-owned chat prompt to the browser", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      authenticated: false,
      tenantId: "tenant_alpha",
      tenantSlug: "alpha",
      roles: [],
    });
    vi.mocked(portalRepository.getPublishedAction).mockResolvedValue({
      id: "action_chat",
      slug: "billing-chat",
      label: "Billing help",
      description: "Start a billing conversation.",
      prompt: "INTERNAL ROUTING INSTRUCTION",
      mode: "chat",
      icon: "message",
      categories: ["billing"],
      enabled: true,
    });

    const response = await runAction(
      new Request("https://alpha.support.servicev8.com/api/portal/actions/billing-chat", {
        method: "POST",
        headers: { "x-real-ip": "203.0.113.4" },
      }),
      { params: Promise.resolve({ slug: "billing-chat" }) },
    );
    const body = await response.json();

    expect(body).toMatchObject({ success: true, mode: "chat", label: "Billing help" });
    expect(JSON.stringify(body)).not.toContain("INTERNAL ROUTING INSTRUCTION");
  });
});

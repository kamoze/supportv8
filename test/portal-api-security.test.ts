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
    getAnalytics: vi.fn(),
    recordActionEvent: vi.fn(async () => undefined),
  },
}));
vi.mock("@/lib/storage/s3-client", () => ({
  s3Storage: { uploadPortalAsset: vi.fn() },
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
import { POST as uploadMedia } from "@/app/api/portal/admin/media/route";
import { POST as runAction } from "@/app/api/portal/actions/[slug]/route";
import { s3Storage } from "@/lib/storage/s3-client";
import { emptyPortalConfig } from "@/lib/portal/config";

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

  it("returns tenant-scoped analytics to workspace managers", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      authenticated: true,
      tenantId: "tenant_alpha",
      tenantSlug: "alpha",
      userId: "manager-1",
      roles: ["support_superadmin"],
    });
    vi.mocked(portalRepository.getDraft).mockResolvedValue({
      config: emptyPortalConfig("alpha"),
      draftRevision: 1,
      publishedRevision: null,
      publishedAt: null,
      hasStoredDraft: true,
    });
    vi.mocked(portalRepository.getAnalytics).mockResolvedValue({
      windowDays: 30,
      summary: { totalRequests: 4, successfulRequests: 3, noResultRequests: 1, unavailableRequests: 0, rateLimitedRequests: 0, averageDurationMs: 90 },
      actions: [],
    });

    const response = await admin.GET(adminRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.analytics.summary.totalRequests).toBe(4);
    expect(portalRepository.getAnalytics).toHaveBeenCalledWith("tenant_alpha");
  });

  it("uploads validated media only for a manager in the resolved tenant", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      authenticated: true,
      tenantId: "tenant_alpha",
      tenantSlug: "alpha",
      userId: "manager-1",
      roles: ["support_cx_lead"],
    });
    vi.mocked(s3Storage.uploadPortalAsset).mockResolvedValue({
      key: "supportv8/portal/tenant_alpha/logo/asset.png",
      publicUrl: "https://cdn.servicev8.com/supportv8/portal/tenant_alpha/logo/asset.png",
      sizeBytes: 8,
    });
    const form = new FormData();
    form.set("kind", "logo");
    form.set("file", new File([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ], "logo.png", { type: "image/png" }));
    const request = new Request("http://0.0.0.0:3005/api/portal/admin/media", {
      method: "POST",
      headers: { host: "alpha.support.servicev8.com", origin: "https://alpha.support.servicev8.com" },
      body: form,
    });

    const response = await uploadMedia(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://cdn.servicev8.com/supportv8/portal/tenant_alpha/logo/asset.png");
    expect(s3Storage.uploadPortalAsset).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_alpha",
      kind: "logo",
      contentType: "image/png",
    }));
  });

  it("rejects portal media uploads from ordinary operators", async () => {
    const request = new Request("https://alpha.support.servicev8.com/api/portal/admin/media", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=blocked" },
      body: "--blocked--",
    });
    expect((await uploadMedia(request)).status).toBe(403);
    expect(s3Storage.uploadPortalAsset).not.toHaveBeenCalled();
  });

  it("rejects external and cross-tenant branding URLs before saving", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      authenticated: true,
      tenantId: "tenant_alpha",
      tenantSlug: "alpha",
      userId: "manager-1",
      roles: ["support_superadmin"],
    });
    const config = emptyPortalConfig("alpha");
    const request = new Request("https://alpha.support.servicev8.com/api/portal/admin", {
      method: "PUT",
      headers: {
        host: "alpha.support.servicev8.com",
        origin: "https://alpha.support.servicev8.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        expectedRevision: 0,
        config: {
          ...config,
          branding: {
            ...config.branding,
            logoUrl: "https://cdn.servicev8.com/supportv8/portal/tenant_meridian/logo/logo.png",
          },
        },
      }),
    });

    const response = await admin.PUT(request);
    expect(response.status).toBe(400);
    expect(portalRepository.saveDraft).not.toHaveBeenCalled();
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

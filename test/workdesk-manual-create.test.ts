import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
vi.mock("@/lib/auth/request-tenant", async original => ({ ...await original<typeof import("@/lib/auth/request-tenant")>(), resolveRequestTenant: vi.fn() }));
vi.mock("@/lib/db/chat-repository", () => ({ chatRepository: { startSession: vi.fn(), listChatIssues: vi.fn() } }));
import { resolveRequestTenant } from "@/lib/auth/request-tenant";
import { chatRepository } from "@/lib/db/chat-repository";
import { POST } from "@/app/api/issues/route";

const request = (overrides = {}) => new NextRequest("https://alpha.support.servicev8.com/api/issues", { method: "POST", body: JSON.stringify({
  action: "create_manual", customerName: "Casey", customerEmail: "casey@example.com", summary: "Damaged delivery",
  stream: "customers", priority: "high", channel: "email", tenantId: "tenant_other", ...overrides,
}) });
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("DATABASE_URL", "postgresql://test");
  vi.mocked(resolveRequestTenant).mockResolvedValue({ tenantId: "tenant_alpha", tenantSlug: "alpha", authenticated: true,
    userId: "operator1", displayName: "Jordan", roles: ["support_operator"] });
  vi.mocked(chatRepository.startSession).mockResolvedValue({ id: "session1" } as never);
  vi.mocked(chatRepository.listChatIssues).mockResolvedValue([{ id: "issue1", tenantId: "tenant_alpha" }] as never);
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe("manual Workdesk ticket creation", () => {
  it("persists the ticket and retrieves the saved issue using the signed tenant", async () => {
    const result = await POST(request());
    expect(result.status).toBe(201);
    expect((await result.json()).data.id).toBe("issue1");
    expect(chatRepository.startSession).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant_alpha",
      channel: "email", customerName: "Casey", manual: { operatorName: "Jordan", priority: "high" } }));
    expect(chatRepository.listChatIssues).toHaveBeenCalledWith("tenant_alpha", "session1");
  });
  it.each([{ summary: "" }, { customerName: "" }, { priority: "fake" }, { customerEmail: "bad" }, { stream: "invalid" }])("rejects invalid fields before saving: %j", async fields => {
    expect((await POST(request(fields))).status).toBe(400);
    expect(chatRepository.startSession).not.toHaveBeenCalled();
  });
  it("fails closed if durable storage is absent", async () => {
    vi.stubEnv("DATABASE_URL", ""); expect((await POST(request())).status).toBe(503);
    expect(chatRepository.startSession).not.toHaveBeenCalled();
  });
  it.each(["support_observer", "support_demo_operator"])("rejects %s", async role => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({ tenantId: "tenant_alpha", tenantSlug: "alpha", authenticated: true, roles: [role] });
    expect((await POST(request())).status).toBe(403);
    expect(chatRepository.startSession).not.toHaveBeenCalled();
  });
});

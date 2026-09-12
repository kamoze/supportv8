import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/chat-repository", () => ({ chatRepository: { validateAndBindEmailChannel: vi.fn(), getSession: vi.fn(), startSession: vi.fn(), sendMessage: vi.fn(), recordEmailJourney: vi.fn() } }));
vi.mock("@/lib/messaging/tenant-account", () => ({ verifySupportEmailTenantAccount: vi.fn() }));
import { chatRepository } from "@/lib/db/chat-repository";
import { verifySupportEmailTenantAccount } from "@/lib/messaging/tenant-account";
import { POST } from "../src/app/api/private/email-events/route";

afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

const event = { eventId: "email-in-1", providerMessageId: "email-in-1", accountId: "account-1", tenantId: "tenant_acme", connectionId: "connection-1", connectorKey: "email.resend.support", channel: "email", conversationId: "11111111-1111-4111-8111-111111111111", messageId: "message-1", sender: "Customer <customer@example.com>", recipient: "support@mail.acme.example", subject: "Cannot sign in", content: "Authentication fails.", receivedAt: "2026-09-12T18:00:00Z", hasAttachments: false };

function request(body = event, token = "private-token", tenantId = event.tenantId) {
  return new Request("https://support.servicev8.internal/api/private/email-events", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-servicev8-tenant-id": tenantId, "x-servicev8-account-id": event.accountId, "x-servicev8-event-id": event.eventId }, body: JSON.stringify(body) });
}

describe("private SupportV8 email intake", () => {
  it("creates one human-queue ticket with durable Messaging context", async () => {
    vi.stubEnv("SUPPORTV8_EMAIL_EVENTS_TOKEN", "private-token");
    vi.mocked(chatRepository.getSession).mockResolvedValue(null);
    vi.mocked(chatRepository.startSession).mockResolvedValue({ id: "email-session" } as never);
    const response = await POST(request());
    expect(response.status).toBe(202);
    const { sessionId } = await response.json();
    expect(chatRepository.startSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
    expect(chatRepository.recordEmailJourney).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
    expect(verifySupportEmailTenantAccount).toHaveBeenCalledWith({ tenantId: "tenant_acme", accountId: "account-1" });
    expect(chatRepository.validateAndBindEmailChannel).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant_acme", accountId: "account-1", connectionId: "connection-1", eventId: "email-in-1" }));
    expect(chatRepository.startSession).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant_acme", tenantSlug: "acme", channel: "email", customerEmail: "customer@example.com", forceHumanQueue: true, initialMessageId: expect.stringMatching(/^msg_email_/), intakeData: expect.objectContaining({ messagingConversationId: event.conversationId }) }));
    expect(chatRepository.startSession).toHaveBeenCalledWith(expect.not.objectContaining({ intakeData: expect.objectContaining({ accountId: "account-1" }) }));
    expect(chatRepository.recordEmailJourney).toHaveBeenCalledWith(expect.objectContaining({ eventId: "email-in-1", direction: "inbound" }));
  });

  it("appends a retry-safe message to an existing email ticket", async () => {
    vi.stubEnv("SUPPORTV8_EMAIL_EVENTS_TOKEN", "private-token");
    vi.mocked(chatRepository.getSession).mockResolvedValue({ id: "email-session" } as never);
    vi.mocked(chatRepository.sendMessage).mockResolvedValue({ session: { id: "email-session" } } as never);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(chatRepository.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant_acme", sessionId: expect.stringMatching(/^email_/), sender: "customer", clientMessageId: expect.stringMatching(/^msg_email_/) }));
    expect(chatRepository.startSession).not.toHaveBeenCalled();
  });

  it("rejects missing auth and tenant envelope substitution before persistence", async () => {
    vi.stubEnv("SUPPORTV8_EMAIL_EVENTS_TOKEN", "private-token");
    expect((await POST(request(event, "wrong"))).status).toBe(401);
    expect((await POST(request(event, "private-token", "tenant_other"))).status).toBe(403);
    expect(chatRepository.startSession).not.toHaveBeenCalled();
  });
});

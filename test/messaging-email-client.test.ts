import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMessagingEmailReply } from "../src/lib/messaging/email-client";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("MessagingV8 email client", () => {
  it("sends only conversation id and content with the exact tenant workload envelope", async () => {
    vi.stubEnv("MESSAGING_SERVICE_URL", "https://messaging.servicev8.internal");
    vi.stubEnv("SERVICEV8_OIDC_ISSUER", "https://keycloak.servicev8.com/realms/servicev8");
    vi.stubEnv("SUPPORTV8_EMAIL_CLIENT_ID", "supportv8-messaging-email");
    vi.stubEnv("SUPPORTV8_EMAIL_CLIENT_SECRET", "email-secret");
    vi.stubEnv("SUPPORTV8_MESSAGING_INSTALLATION_ID", "installation-1");
    vi.stubEnv("SUPPORTV8_MESSAGING_GRANT_REF", "grant-1");
    const fetcher = vi.fn().mockImplementation(async (target: string | URL) => String(target).includes("/protocol/openid-connect/token")
      ? Response.json({ access_token: "short-lived-workload-token" })
      : Response.json({ id: "message-1", executionId: "execution-1", status: "queued" }, { status: 202 }));
    const result = await sendMessagingEmailReply({ accountId: "account-1", tenantId: "tenant_acme", conversationId: "11111111-1111-4111-8111-111111111111", content: "Please try again.", idempotencyKey: "support-reply-1", fetcher });
    expect(result).toMatchObject({ executionId: "execution-1", status: "queued" });
    expect(fetcher).toHaveBeenNthCalledWith(2, "https://messaging.servicev8.internal/v1/conversations/11111111-1111-4111-8111-111111111111/reply", expect.objectContaining({
      method: "POST", headers: expect.objectContaining({ authorization: "Bearer short-lived-workload-token", "x-servicev8-account-id": "account-1", "x-servicev8-tenant-id": "tenant_acme", "idempotency-key": "support-reply-1" }), body: JSON.stringify({ content: "Please try again." }),
    }));
  });

  it("fails closed when the private service binding is incomplete", async () => {
    await expect(sendMessagingEmailReply({ accountId: "a", tenantId: "tenant_a", conversationId: "11111111-1111-4111-8111-111111111111", content: "x", idempotencyKey: "k" })).rejects.toThrow("Messaging email service is not configured");
  });
});

import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_INGRESS_MAX_BODY_BYTES,
  requireBoundedContentLength,
  requireBoundedRawBody,
  requireChatChannelEnabled,
  requireChatOperatorRole,
  selectServerOwnedSessionId,
  verifyMetaWebhookSignature,
  verifyWebhookToken,
} from "../src/lib/chatbot/security/ingress-security";
import { GET as verifyWhatsApp, POST as postWhatsApp } from "../src/app/api/chat/whatsapp/route";
import { POST as postEmail } from "../src/app/api/chat/email/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("chat ingress hardening", () => {
  it("verifies Meta signatures against the exact raw request body", () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const secret = "test-meta-app-secret";
    const signature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    expect(verifyMetaWebhookSignature(rawBody, signature, secret)).toBe(true);
    expect(verifyMetaWebhookSignature(`${rawBody} `, signature, secret)).toBe(false);
    expect(verifyMetaWebhookSignature(rawBody, "sha256=not-hex", secret)).toBe(false);
    expect(verifyMetaWebhookSignature(rawBody, signature, undefined)).toBe(false);
  });

  it("compares verification tokens without accepting missing values", () => {
    expect(verifyWebhookToken("known-token", "known-token")).toBe(true);
    expect(verifyWebhookToken("wrong-token", "known-token")).toBe(false);
    expect(verifyWebhookToken(null, "known-token")).toBe(false);
    expect(verifyWebhookToken("known-token", undefined)).toBe(false);
  });

  it("fails closed when channel feature flags are absent", () => {
    expect(() => requireChatChannelEnabled("whatsapp")).toThrow("not enabled");
    expect(() => requireChatChannelEnabled("email")).toThrow("not enabled");
  });

  it("rejects oversized raw webhook payloads", () => {
    expect(() => requireBoundedRawBody("a".repeat(CHAT_INGRESS_MAX_BODY_BYTES))).not.toThrow();
    expect(() => requireBoundedRawBody("a".repeat(CHAT_INGRESS_MAX_BODY_BYTES + 1))).toThrow(
      "too large"
    );
  });

  it("rejects oversized or malformed declared body lengths before reading", () => {
    expect(() => requireBoundedContentLength(null)).not.toThrow();
    expect(() => requireBoundedContentLength(String(CHAT_INGRESS_MAX_BODY_BYTES))).not.toThrow();
    expect(() =>
      requireBoundedContentLength(String(CHAT_INGRESS_MAX_BODY_BYTES + 1))
    ).toThrow("too large");
    expect(() => requireBoundedContentLength("not-a-number")).toThrow("Invalid Content-Length");
  });

  it("requires an explicit SupportV8 operator role in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const base = {
      tenantId: "tenant_acme",
      tenantSlug: "acme",
      authenticated: true,
      userId: "user_1",
      username: "operator@acme.com",
    };

    expect(() => requireChatOperatorRole({ ...base, roles: ["support_operator"] })).not.toThrow();
    expect(() => requireChatOperatorRole({ ...base, roles: ["support_cx_lead"] })).not.toThrow();
    expect(() => requireChatOperatorRole({ ...base, roles: ["support_observer"] })).toThrow(
      "Operator role is required"
    );
    expect(() =>
      requireChatOperatorRole({ ...base, authenticated: false, roles: ["support_operator"] })
    ).toThrow("Operator role is required");
  });

  it("preserves only an existing server-owned stream session ID", async () => {
    const exists = vi.fn(async (sessionId: string) => sessionId === "sess_existing");

    await expect(selectServerOwnedSessionId("sess_existing", exists)).resolves.toBe("sess_existing");
    const generated = await selectServerOwnedSessionId("sess_attacker_selected", exists);
    expect(generated).toMatch(/^sess_[a-f0-9]{32}$/);
    expect(generated).not.toBe("sess_attacker_selected");

    exists.mockClear();
    const malformed = await selectServerOwnedSessionId("../../other-tenant", exists);
    expect(malformed).toMatch(/^sess_[a-f0-9]{32}$/);
    expect(exists).not.toHaveBeenCalled();
  });

  it("keeps disabled and unconfigured channel routes closed", async () => {
    const disabledWhatsApp = await postWhatsApp(
      new Request("https://acme.support.servicev8.com/api/chat/whatsapp", {
        method: "POST",
        body: "{}",
      })
    );
    expect(disabledWhatsApp.status).toBe(404);

    const disabledEmail = await postEmail(
      new Request("https://acme.support.servicev8.com/api/chat/email", {
        method: "POST",
        body: "{}",
      })
    );
    expect(disabledEmail.status).toBe(404);

    vi.stubEnv("SUPPORTV8_EMAIL_INGRESS_ENABLED", "true");
    const unconfiguredEmail = await postEmail(
      new Request("https://acme.support.servicev8.com/api/chat/email", {
        method: "POST",
        body: "{}",
      })
    );
    expect(unconfiguredEmail.status).toBe(503);
  });

  it("rejects unsigned WhatsApp POSTs before parsing or persistence", async () => {
    vi.stubEnv("SUPPORTV8_WHATSAPP_INGRESS_ENABLED", "true");
    vi.stubEnv("WHATSAPP_APP_SECRET", "configured-secret");
    const response = await postWhatsApp(
      new Request("https://acme.support.servicev8.com/api/chat/whatsapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      })
    );
    expect(response.status).toBe(401);
  });

  it("requires a configured WhatsApp verification token", async () => {
    vi.stubEnv("SUPPORTV8_WHATSAPP_INGRESS_ENABLED", "true");
    const response = await verifyWhatsApp(
      new Request(
        "https://acme.support.servicev8.com/api/chat/whatsapp?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=123"
      )
    );
    expect(response.status).toBe(503);
  });

  it("accepts only the configured WhatsApp subscription verification token", async () => {
    vi.stubEnv("SUPPORTV8_WHATSAPP_INGRESS_ENABLED", "true");
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "known-verification-token");

    const accepted = await verifyWhatsApp(
      new Request(
        "https://acme.support.servicev8.com/api/chat/whatsapp?hub.mode=subscribe&hub.verify_token=known-verification-token&hub.challenge=challenge-123"
      )
    );
    expect(accepted.status).toBe(200);
    await expect(accepted.text()).resolves.toBe("challenge-123");

    const rejected = await verifyWhatsApp(
      new Request(
        "https://acme.support.servicev8.com/api/chat/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123"
      )
    );
    expect(rejected.status).toBe(403);
  });

  it("rejects malformed signed WhatsApp JSON before tenant resolution", async () => {
    vi.stubEnv("SUPPORTV8_WHATSAPP_INGRESS_ENABLED", "true");
    vi.stubEnv("WHATSAPP_APP_SECRET", "configured-secret");
    const rawBody = "not-json";
    const signature = `sha256=${createHmac("sha256", "configured-secret")
      .update(rawBody)
      .digest("hex")}`;

    const response = await postWhatsApp(
      new Request("https://acme.support.servicev8.com/api/chat/whatsapp", {
        method: "POST",
        headers: { "x-hub-signature-256": signature },
        body: rawBody,
      })
    );
    expect(response.status).toBe(400);
  });

  it("rejects oversized WhatsApp bodies before signature verification", async () => {
    vi.stubEnv("SUPPORTV8_WHATSAPP_INGRESS_ENABLED", "true");
    const response = await postWhatsApp(
      new Request("https://acme.support.servicev8.com/api/chat/whatsapp", {
        method: "POST",
        body: "a".repeat(CHAT_INGRESS_MAX_BODY_BYTES + 1),
      })
    );
    expect(response.status).toBe(413);
  });
});

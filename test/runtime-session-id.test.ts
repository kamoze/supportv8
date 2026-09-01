import { describe, expect, it } from "vitest";
import { durableRuntimeSessionId } from "../src/lib/chatbot/agent-runtime/conversation-manager";

describe("durable runtime session IDs", () => {
  it("namespaces external provider IDs by tenant", () => {
    const first = durableRuntimeSessionId({
      channel: "whatsapp",
      tenantId: "tenant_acme",
      sessionId: "wa_14165550100",
    });
    const second = durableRuntimeSessionId({
      channel: "whatsapp",
      tenantId: "tenant_globex",
      sessionId: "wa_14165550100",
    });

    expect(first).toMatch(/^chat_[a-f0-9]{48}$/);
    expect(second).toMatch(/^chat_[a-f0-9]{48}$/);
    expect(first).not.toBe(second);
  });

  it("keeps web session IDs stable", () => {
    expect(
      durableRuntimeSessionId({
        channel: "web_chat",
        tenantId: "tenant_acme",
        sessionId: "sess_browser_generated",
      })
    ).toBe("sess_browser_generated");
  });
});

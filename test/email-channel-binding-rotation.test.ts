import { describe, expect, it, vi } from "vitest";
import { ChatRepository } from "@/lib/db/chat-repository";

describe("Support email channel binding rotation", () => {
  it("rotates an existing binding with compare-and-swap and writes an audit record", async () => {
    const calls: Array<{ text: string; params: unknown[] }> = [];
    const db = { query: vi.fn(async (text: string, params: unknown[] = []) => {
      calls.push({ text, params });
      if (text.includes("FROM supportv8.tenants")) return [{ id: "tenant_acme", servicev8_account_id: "account-1" }];
      if (text.includes("FROM supportv8.email_channel_binding_history")) return [];
      if (text.includes("FROM supportv8.email_channel_bindings")) return [{ servicev8_account_id: "account-1", connection_id: "old-connection", connector_key: "email.resend.support", recipient: "old@mail.acme.example", status: "active" }];
      if (text.includes("UPDATE supportv8.email_channel_bindings")) return [{ tenant_id: "tenant_acme" }];
      return [];
    }) };
    const client = { withTenantSession: async (_tenantId: string, callback: (session: typeof db) => unknown) => callback(db) };
    const repository = new ChatRepository(client as any);

    await repository.validateAndBindEmailChannel({ tenantId: "tenant_acme", accountId: "account-1", connectionId: "new-connection", connectorKey: "email.resend.support", recipient: "Support@Mail.Acme.Example", eventId: "email-rotation-1" });

    const update = calls.find((call) => call.text.includes("UPDATE supportv8.email_channel_bindings"));
    expect(update?.text).toContain("connection_id = $6");
    expect(update?.params).toEqual(["tenant_acme", "new-connection", "email.resend.support", "support@mail.acme.example", "account-1", "old-connection", "email.resend.support", "old@mail.acme.example"]);
    const audit = calls.find((call) => call.text.includes("INSERT INTO supportv8.email_channel_binding_history"));
    expect(audit?.params[2]).toBe("rotated");
  });

  it("does not let a replayed old provider event rotate the current binding back", async () => {
    const queries: string[] = [];
    const db = { query: vi.fn(async (text: string) => {
      queries.push(text);
      if (text.includes("FROM supportv8.tenants")) return [{ id: "tenant_acme", servicev8_account_id: "account-1" }];
      if (text.includes("FROM supportv8.email_channel_binding_history")) return [{ source_event_id: "old-event" }];
      return [];
    }) };
    const client = { withTenantSession: async (_tenantId: string, callback: (session: typeof db) => unknown) => callback(db) };
    const repository = new ChatRepository(client as any);

    await repository.validateAndBindEmailChannel({ tenantId: "tenant_acme", accountId: "account-1", connectionId: "old-connection", connectorKey: "email.resend.support", recipient: "old@mail.acme.example", eventId: "old-event" });

    expect(queries.some((query) => query.includes("UPDATE supportv8.email_channel_bindings"))).toBe(false);
    expect(queries.some((query) => query.includes("FROM supportv8.email_channel_bindings"))).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { ChatRepository } from "@/lib/db/chat-repository";

const ALLOWED_DB_CHANNELS = ["web", "email", "whatsapp", "voice"] as const;

describe("ChatRepository channel constraint compliance", () => {
  it.each([
    { inputChannel: "manual_entry" as const, expectedDbChannel: "web" },
    { inputChannel: "manual" as const, expectedDbChannel: "web" },
    { inputChannel: "web_chat" as const, expectedDbChannel: "web" },
    { inputChannel: "chat" as const, expectedDbChannel: "web" },
    { inputChannel: "web" as const, expectedDbChannel: "web" },
    { inputChannel: "email" as const, expectedDbChannel: "email" },
    { inputChannel: "field_dispatch" as const, expectedDbChannel: "voice" },
    { inputChannel: "voice" as const, expectedDbChannel: "voice" },
    { inputChannel: "whatsapp" as const, expectedDbChannel: "whatsapp" },
    { inputChannel: undefined, expectedDbChannel: "web" },
  ])(
    "persists channel '$expectedDbChannel' for input channel '$inputChannel' satisfying chat_sessions_channel_check",
    async ({ inputChannel, expectedDbChannel }) => {
      const recordedQueries: Array<{ sql: string; values: any[] }> = [];
      const mockDb = {
        query: vi.fn().mockImplementation((sql: string, values?: any[]) => {
          recordedQueries.push({ sql, values: values || [] });
          if (sql.includes("SELECT id FROM supportv8.tenants")) {
            return Promise.resolve([{ id: "tenant_alpha" }]);
          }
          if (sql.includes("FROM supportv8.chat_sessions") && sql.includes("WHERE id = $1")) {
            return Promise.resolve([
              {
                id: "sess_test",
                tenant_id: "tenant_alpha",
                stream: "customers",
                channel: expectedDbChannel,
                customer_name: "Sofia Morales",
                customer_email: "sofia@solariadynamics.es",
                customer_ref: "cust_test",
                intake_data: {},
                status: "open",
                priority: "normal",
                assigned_group_id: "group_customers",
                assigned_operator_id: null,
                issue_id: "iss_test",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                closed_at: null,
                last_message_at: new Date().toISOString(),
                message_count: 1,
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      };

      const mockClient = {
        withTenantSession: vi.fn().mockImplementation((_tenantId: string, fn: (db: any) => Promise<any>) => fn(mockDb)),
      };

      const repo = new ChatRepository(mockClient as any);
      await repo.startSession({
        tenantId: "tenant_alpha",
        tenantSlug: "alpha",
        stream: "customers",
        customerName: "Sofia Morales",
        customerEmail: "sofia@solariadynamics.es",
        intakeData: { details: "Problem statement" },
        channel: inputChannel as any,
        manual: { operatorName: "Jordan Operator", priority: "normal" },
      });

      const sessionInsert = recordedQueries.find((q) => q.sql.includes("INSERT INTO supportv8.chat_sessions"));
      expect(sessionInsert).toBeDefined();

      // In INSERT INTO supportv8.chat_sessions (...):
      // ($1 id, $2 tenant_id, $3 stream, $4 channel, ...)
      const insertedChannel = sessionInsert!.values[3];
      expect(insertedChannel).toBe(expectedDbChannel);
      expect(ALLOWED_DB_CHANNELS).toContain(insertedChannel);
    }
  );
});

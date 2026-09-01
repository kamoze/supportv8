import { describe, expect, it } from "vitest";
import { ChatRepository } from "@/lib/db/chat-repository";
import type { DatabaseSession, PostgresClient } from "@/lib/db/pg-client";

describe("durable chat ticket lifecycle", () => {
  it("writes status, journey, messages, and assignment in the tenant transaction", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const row = {
      id: "issue-chat-1",
      tenant_id: "tenant_alpha",
      external_id: "SV8-CHAT-1001",
      source_url: "https://alpha.support.servicev8.com/chat/session-1",
      customer_ref: "cust_1",
      customer_name: "Casey",
      customer_tier: "standard",
      summary: "Need help",
      category: "general_support",
      product: "SupportV8",
      version: "1",
      source_status: "resolved",
      priority: "high",
      sentiment: "neutral",
      sentiment_score: 0,
      sentiment_trajectory: "stable",
      confidence: 0.9,
      business_impact: "medium",
      resolution_risk_score: 0.1,
      tags: [],
      recommended_action: null,
      timeline: [{
        id: "tl_resolved",
        timestamp: "10:05 AM",
        actor: "Jordan",
        actorType: "human_operator",
        action: "Status transitioned to RESOLVED",
      }],
      messages: [{
        id: "msg_reply",
        timestamp: "10:04 AM",
        sender: "operator",
        senderName: "Jordan",
        content: "This is resolved.",
        channel: "chat",
      }],
      assigned_to: "Jordan",
      assigned_agent: "Jordan",
      created_at: "2026-09-01T14:00:00.000Z",
      updated_at: "2026-09-01T14:05:00.000Z",
      intake_data: { __supportv8: { assignedName: "Jordan" } },
    };
    const session: DatabaseSession = {
      tenantId: "tenant_alpha",
      query: async <T>(sql: string, params: unknown[] = []) => {
        queries.push({ sql, params });
        if (sql.includes("UPDATE supportv8.issues")) return [{ id: row.id }] as T[];
        if (sql.includes("FROM supportv8.issues i")) return [row] as T[];
        return [] as T[];
      },
    };
    const client = {
      withTenantSession: async (_tenantId: string, callback: (db: DatabaseSession) => Promise<unknown>) => callback(session),
    } as PostgresClient;
    const repository = new ChatRepository(client);

    const updated = await repository.updateChatIssue("tenant_alpha", row.id, {
      status: "resolved",
      priority: "high",
      timeline: row.timeline as never,
      messages: row.messages as never,
      assignedTo: "Jordan",
      assignedAgent: "Jordan",
    });

    const issueUpdate = queries.find((query) => query.sql.includes("UPDATE supportv8.issues"));
    expect(issueUpdate?.sql).toContain("timeline = COALESCE");
    expect(issueUpdate?.sql).toContain("messages = COALESCE");
    expect(issueUpdate?.params).toContain(JSON.stringify(row.timeline));
    expect(issueUpdate?.params).toContain(JSON.stringify(row.messages));
    expect(updated).toMatchObject({
      id: row.id,
      status: "resolved",
      assignedTo: "Jordan",
      timeline: [{ action: "Status transitioned to RESOLVED" }],
      messages: [{ content: "This is resolved." }],
    });
    expect(queries.some((query) => query.sql.includes("UPDATE supportv8.chat_sessions"))).toBe(true);
    expect(queries.some((query) => query.sql.includes("UPDATE supportv8.workdesk_items"))).toBe(true);
  });
});

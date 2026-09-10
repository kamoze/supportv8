import { afterAll, describe, expect, it } from "vitest";
import { ChatRepository } from "@/lib/db/chat-repository";
import { PostgresClient } from "@/lib/db/pg-client";

const enabled = process.env.SUPPORTV8_RUN_DATABASE_INTEGRATION === "true";
const tenantId = `tenant_integration_${Date.now()}`;
const tenantSlug = tenantId.slice("tenant_".length).replace(/_/g, "-");
const client = new PostgresClient();
const repository = new ChatRepository(client);

describe.runIf(enabled)("PostgreSQL durable chat-to-workdesk integration", () => {
  afterAll(async () => {
    await client
      .withTenantSession(tenantId, (db) =>
        db.query("DELETE FROM supportv8.tenants WHERE id = $1", [tenantId])
      )
      .catch(() => undefined);
    await client.close();
  });

  it("commits a session, transcript, workdesk issue, and enforces cross-tenant reads", async () => {
    const session = await repository.startSession({
      tenantId,
      tenantSlug,
      stream: "customers",
      customerName: "Persistence Probe",
      customerEmail: "probe@example.com",
      intakeData: { details: "Verify durable transcript", urgency: "Normal" },
    });

    expect(session.messages).toHaveLength(2);
    const updated = await repository.sendMessage({
      tenantId,
      tenantSlug,
      sessionId: session.id,
      sender: "customer",
      content: "Please connect me to a human operator",
    });
    expect(updated.session.status).toBe("escalated");
    expect(updated.session.messages).toHaveLength(4);

    const issues = await repository.listChatIssues(tenantId);
    expect(issues).toHaveLength(1);
    expect(issues[0].sourceUrl).toContain(session.id);
    expect(issues[0].priority).toBe("urgent");

    const crossTenant = await repository.getSession("tenant_integration_other", session.id);
    expect(crossTenant).toBeNull();
  });

  it("persists a manual ticket across connections with a truthful journey and no invented customer message", async () => {
    const session = await repository.startSession({ tenantId, tenantSlug, stream: "customers",
      customerName: "Manual Test Customer", customerEmail: "manual@example.test", channel: "email",
      intakeData: { details: "Operator recorded a delivery problem", origin: "operator_workdesk" },
      manual: { operatorName: "Jordan", priority: "low" },
    });
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0]).toMatchObject({ sender: "agent", senderName: "Jordan" });
    const otherConnection = new PostgresClient();
    try {
      const repo = new ChatRepository(otherConnection);
      const [issue] = await repo.listChatIssues(tenantId, session.id);
      expect(issue).toMatchObject({ customerName: "Manual Test Customer", priority: "low",
        timeline: [{ actor: "Jordan", action: "Ticket created on behalf of customer" }] });
      expect(await repo.listChatIssues("tenant_integration_other", session.id)).toEqual([]);
      expect(await repo.updateChatIssue("tenant_integration_other", issue.id, { status: "resolved" })).toBeNull();
      expect(await repo.updateChatIssue(tenantId, issue.id, { status: "resolved" })).toMatchObject({ status: "resolved" });
      expect(await repo.getSession(tenantId, session.id)).toMatchObject({ status: "resolved" });
      expect(await repo.updateChatIssue(tenantId, issue.id, { status: "closed" })).toMatchObject({ status: "closed" });
    } finally { await otherConnection.close(); }
  });
});

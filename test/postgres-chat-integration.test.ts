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
});

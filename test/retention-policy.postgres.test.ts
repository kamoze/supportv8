import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { PostgresClient } from "../src/lib/db/pg-client";
import { PgSupportIntelligenceRepository } from "../src/lib/db/support-intelligence-repository";
import { RetentionService } from "../src/lib/retention/retention-service";
import { contextEngine } from "../src/lib/services/context-engine";
import { problemService } from "../src/lib/services/problem-service";

const enabled = process.env.SUPPORTV8_REAL_POSTGRES === "1";

describe.skipIf(!enabled)("Enforceable Context Retention & Separation PostgreSQL Integration", () => {
  const adminBaseUrl =
    process.env.SUPPORTV8_TEST_DATABASE_URL ||
    process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.USER || "postgres"}@127.0.0.1:5432/postgres`;

  const dbName = `support_retention_test_${Math.floor(Math.random() * 1000000)}`;
  const appRole = `support_ret_app_${Math.floor(Math.random() * 1000000)}`;
  const appPassword = "test_retention_pwd";

  let adminPool: Pool;
  let appPool: Pool;
  let client: PostgresClient;
  let repository: PgSupportIntelligenceRepository;
  let retentionService: RetentionService;

  const TENANT_24H = "tenant_policy_24h";
  const TENANT_168H = "tenant_policy_168h";

  beforeAll(async () => {
    // 1. Connect as admin to create test database
    adminPool = new Pool({ connectionString: adminBaseUrl });
    await adminPool.query(`CREATE DATABASE ${dbName}`);

    // 2. Connect to test database as admin to run migrations and setup roles
    const parsed = new URL(adminBaseUrl);
    parsed.pathname = `/${dbName}`;
    const dbAdminUrl = parsed.toString();
    const dbAdminPool = new Pool({ connectionString: dbAdminUrl });

    try {
      // Create non-superuser application role without BYPASSRLS
      await dbAdminPool.query(
        `CREATE ROLE ${appRole} WITH LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOBYPASSRLS`
      );

      // Read and execute migration 011_mvp_intelligence.sql and 012_retention_maintenance.sql
      const migrationPath = resolve(__dirname, "../migrations/011_mvp_intelligence.sql");
      const migrationSql = await readFile(migrationPath, "utf8");
      await dbAdminPool.query(migrationSql);

      const migration012Path = resolve(__dirname, "../migrations/012_retention_maintenance.sql");
      const migration012Sql = await readFile(migration012Path, "utf8");
      await dbAdminPool.query(migration012Sql);

      // Seed tenants for foreign key references
      await dbAdminPool.query(
        `INSERT INTO supportv8.tenants (id, domain, name, operating_mode)
         VALUES
           ('${TENANT_24H}', 'retention-24.example.com', 'Tenant 24h Policy', 'observe'),
           ('${TENANT_168H}', 'retention-168.example.com', 'Tenant 168h Policy', 'observe')
         ON CONFLICT (id) DO NOTHING`
      );

      // Grant schema and table access to the non-superuser application role
      await dbAdminPool.query(
        `GRANT USAGE ON SCHEMA supportv8 TO ${appRole};
         GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supportv8 TO ${appRole};
         GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA supportv8 TO ${appRole};
         GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA supportv8 TO ${appRole};`
      );
    } finally {
      await dbAdminPool.end();
    }

    // 3. Connect as application user to guarantee strict non-superuser RLS enforcement
    parsed.username = appRole;
    parsed.password = appPassword;
    const appConnectionUrl = parsed.toString();

    appPool = new Pool({ connectionString: appConnectionUrl });
    client = new PostgresClient(undefined, appPool);
    PostgresClient.setTestClient(client);
    repository = new PgSupportIntelligenceRepository(client);
    retentionService = new RetentionService(client);
  });

  afterAll(async () => {
    PostgresClient.setTestClient(null);
    if (appPool) await appPool.end();
    if (adminPool) {
      try {
        await adminPool.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      } catch {
        // Ignore drop errors
      }
      await adminPool.end();
    }
  });

  it("proves two tenant policies produce distinct interaction event expiries (24h vs 168h)", async () => {
    // 1. Configure distinct retention policies: 24h for Tenant A, 168h for Tenant B
    await repository.setTenantPolicy({
      tenantId: TENANT_24H,
      rawContextRetentionHours: 24,
      mode: "observe",
    });

    await repository.setTenantPolicy({
      tenantId: TENANT_168H,
      rawContextRetentionHours: 168,
      mode: "copilot",
    });

    // 2. Ingest interaction for Tenant A (24h)
    const resA = await repository.recordInteraction({
      eventId: "evt_retention_24h_01",
      tenantId: TENANT_24H,
      accountId: TENANT_24H,
      connectionId: "conn_zd_01",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "ZD-TICKET-24H",
      customerReference: "CUST-24",
      sourceUrl: "https://retention-24.zendesk.com/agent/tickets/24",
      text: "Customer issue with 24h retention",
      sender: "customer",
      occurredAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      correlationId: "corr_24h_01",
      raw: { headers: { userAgent: "curl" }, detail: "24h secret debug payload" },
    });
    expect(resA.replayed).toBe(false);

    // 3. Ingest interaction for Tenant B (168h)
    const resB = await repository.recordInteraction({
      eventId: "evt_retention_168h_01",
      tenantId: TENANT_168H,
      accountId: TENANT_168H,
      connectionId: "conn_zd_02",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "ZD-TICKET-168H",
      customerReference: "CUST-168",
      sourceUrl: "https://retention-168.zendesk.com/agent/tickets/168",
      text: "Customer issue with 168h retention",
      sender: "customer",
      occurredAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      correlationId: "corr_168h_01",
      raw: { headers: { userAgent: "curl" }, detail: "168h secret debug payload" },
    });
    expect(resB.replayed).toBe(false);

    // 4. Query both events within their respective tenant sessions to verify computed expiry duration
    const eventA = await client.withTenantSession(TENANT_24H, async (session) => {
      const rows = await session.query<{
        received_at: string;
        expires_at: string;
        diff_hours: number;
      }>(
        `SELECT received_at, expires_at,
                ROUND(EXTRACT(EPOCH FROM (expires_at - received_at)) / 3600) AS diff_hours
         FROM supportv8.interaction_events
         WHERE tenant_id = $1 AND event_id = $2`,
        [TENANT_24H, "evt_retention_24h_01"]
      );
      return rows[0];
    });

    const eventB = await client.withTenantSession(TENANT_168H, async (session) => {
      const rows = await session.query<{
        received_at: string;
        expires_at: string;
        diff_hours: number;
      }>(
        `SELECT received_at, expires_at,
                ROUND(EXTRACT(EPOCH FROM (expires_at - received_at)) / 3600) AS diff_hours
         FROM supportv8.interaction_events
         WHERE tenant_id = $1 AND event_id = $2`,
        [TENANT_168H, "evt_retention_168h_01"]
      );
      return rows[0];
    });

    expect(Number(eventA.diff_hours)).toBe(24);
    expect(Number(eventB.diff_hours)).toBe(168);
  });

  it("proves purge removes raw_payload and text while preserving durable Issues, Problems, and action receipts", async () => {
    const expiredEventId = "evt_expired_candidate_01";
    const activeEventId = "evt_active_unexpired_01";
    const issueId = "iss_durable_retained_01";
    const idempotencyKey = `idemp_audit_test_${Date.now()}`;

    // 1. Record an interaction that we will backdate as expired
    await repository.recordInteraction({
      eventId: expiredEventId,
      tenantId: TENANT_24H,
      accountId: TENANT_24H,
      connectionId: "conn_zd_01",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "ZD-TICKET-PURGE",
      customerReference: "CUST-PURGE-99",
      sourceUrl: "https://retention-24.zendesk.com/agent/tickets/99",
      text: "Sensitive customer PII and private raw message body",
      sender: "customer",
      occurredAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      receivedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
      correlationId: "corr_purge_01",
      raw: { authBearer: "eyJhbGciOi...", creditCardLast4: "4242", fullTranscript: "Secret" },
    });

    // 2. Also record an active unexpired event
    await repository.recordInteraction({
      eventId: activeEventId,
      tenantId: TENANT_24H,
      accountId: TENANT_24H,
      connectionId: "conn_zd_01",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "ZD-TICKET-ACTIVE",
      customerReference: "CUST-ACTIVE-01",
      sourceUrl: "https://retention-24.zendesk.com/agent/tickets/101",
      text: "Active unexpired message text",
      sender: "customer",
      occurredAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      correlationId: "corr_active_01",
      raw: { activeKey: "keep-me" },
    });

    // 3. Backdate the first event's expires_at to 2 hours ago
    await client.withTenantSession(TENANT_24H, async (session) => {
      await session.query(
        `UPDATE supportv8.interaction_events
         SET expires_at = NOW() - INTERVAL '2 hours'
         WHERE tenant_id = $1 AND event_id = $2`,
        [TENANT_24H, expiredEventId]
      );
    });

    // 4. Create durable derived Issue in supportv8.issues
    await client.withTenantSession(TENANT_24H, async (session) => {
      await session.query(
        `INSERT INTO supportv8.issues (
           id, tenant_id, source, external_id, summary,
           customer_name, customer_ref, priority, category, sentiment,
           source_status, source_url, tags, confidence, business_impact
         ) VALUES (
           $1, $2, 'zendesk', 'ZD-TICKET-PURGE',
           'High-level derived summary that must survive raw purge',
           'Alice Smith', 'CUST-PURGE-99', 'urgent', 'billing', 'frustrated',
           'open', 'https://retention-24.zendesk.com/agent/tickets/99',
           ARRAY['billing', 'retained'], 0.98, 'high'
         )`,
        [issueId, TENANT_24H]
      );
    });

    // 5. Complete interaction linking to the durable issue
    await repository.completeInteraction(TENANT_24H, expiredEventId, issueId);

    // 6. Correlate issue into a durable Problem
    const problem = await problemService.correlateIssues(
      TENANT_24H,
      [issueId],
      "Payment Gateway Intermittent Timeouts",
      "Upstream card processor timeout"
    );
    expect(problem.id).toBeDefined();

    // 7. Record an Action Gateway execution receipt
    await repository.recordActionReceipt({
      id: `rcpt_${Date.now()}`,
      tenantId: TENANT_24H,
      idempotencyKey,
      action: "ticket.update_priority",
      capability: "support.ticket.update",
      issueId,
      actionExecutionId: "ag_exec_retention_audit_001",
      status: "completed",
      actor: { id: "op_01", type: "system" },
      payload: { priority: "urgent" },
      result: { updated: true },
    });

    // 8. Run purge across all expired interactions
    const purgeResult = await retentionService.purgeExpiredRawContext();
    expect(purgeResult.purgedEventsCount).toBeGreaterThanOrEqual(1);
    expect(purgeResult.purgedTenants).toContain(TENANT_24H);

    // 9. Verify interaction event was redacted
    const purgedEvent = await client.withTenantSession(TENANT_24H, async (session) => {
      const rows = await session.query<{
        raw_payload: Record<string, unknown>;
        text: string;
        processing_state: string;
        issue_id: string;
        source_reference: string;
        customer_reference: string;
      }>(
        `SELECT raw_payload, text, processing_state, issue_id, source_reference, customer_reference
         FROM supportv8.interaction_events
         WHERE tenant_id = $1 AND event_id = $2`,
        [TENANT_24H, expiredEventId]
      );
      return rows[0];
    });

    expect(purgedEvent).toBeDefined();
    expect(purgedEvent.raw_payload).toEqual({});
    expect(purgedEvent.text).toBe("[REDACTED_PURGED]");
    expect(purgedEvent.processing_state).toBe("completed");
    expect(purgedEvent.issue_id).toBe(issueId);
    expect(purgedEvent.source_reference).toBe("ZD-TICKET-PURGE");
    expect(purgedEvent.customer_reference).toBe("CUST-PURGE-99");

    // 10. Verify unexpired event was NOT redacted
    const activeEvent = await client.withTenantSession(TENANT_24H, async (session) => {
      const rows = await session.query<{
        raw_payload: Record<string, unknown>;
        text: string;
      }>(
        `SELECT raw_payload, text
         FROM supportv8.interaction_events
         WHERE tenant_id = $1 AND event_id = $2`,
        [TENANT_24H, activeEventId]
      );
      return rows[0];
    });
    expect(activeEvent.text).toBe("Active unexpired message text");
    expect(activeEvent.raw_payload).toEqual({ activeKey: "keep-me" });

    // 11. Verify durable derived Issue is completely intact
    const retainedIssue = await client.withTenantSession(TENANT_24H, async (session) => {
      const rows = await session.query<{
        id: string;
        summary: string;
        confidence: number;
        category: string;
        problem_id: string;
      }>(
        `SELECT id, summary, confidence, category, problem_id
         FROM supportv8.issues
         WHERE tenant_id = $1 AND id = $2`,
        [TENANT_24H, issueId]
      );
      return rows[0];
    });
    expect(retainedIssue).toBeDefined();
    expect(retainedIssue.summary).toBe("High-level derived summary that must survive raw purge");
    expect(Number(retainedIssue.confidence)).toBe(0.98);
    expect(retainedIssue.category).toBe("billing");
    expect(retainedIssue.problem_id).toBe(problem.id);

    // 12. Verify durable Problem is intact
    const retainedProblem = await client.withTenantSession(TENANT_24H, async (session) => {
      const rows = await session.query<{ id: string; title: string }>(
        `SELECT id, title FROM supportv8.problems WHERE tenant_id = $1 AND id = $2`,
        [TENANT_24H, problem.id]
      );
      return rows[0];
    });
    expect(retainedProblem).toBeDefined();
    expect(retainedProblem.title).toBe("Payment Gateway Intermittent Timeouts");

    // 13. Verify action receipt is intact
    const receipt = await repository.getActionReceipt(TENANT_24H, idempotencyKey);
    expect(receipt).toBeDefined();
    expect(receipt?.actionExecutionId).toBe("ag_exec_retention_audit_001");
    expect(receipt?.issueId).toBe(issueId);
  });

  it("proves contextEngine remaining TTL computation and eviction", () => {
    contextEngine.clear();

    const interactionId = "int_ttl_test_01";
    // Assemble with 24 hours retention
    const context = contextEngine.assembleContext(
      interactionId,
      { id: "CUST-TTL-01", name: "TTL Tester" },
      "Testing TTL expiry",
      { retentionHours: 24 }
    );

    expect(context.ttlSeconds).toBe(24 * 3600);

    const ttl = contextEngine.getRemainingTtl(interactionId);
    expect(ttl).toBeGreaterThan(23 * 3600);
    expect(ttl).toBeLessThanOrEqual(24 * 3600);

    // Test non-existent interaction
    expect(contextEngine.getRemainingTtl("int_non_existent")).toBe(0);
  });
});

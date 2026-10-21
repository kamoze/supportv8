import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresClient } from "@/lib/db/pg-client";
import { PgSupportIntelligenceRepository } from "@/lib/db/support-intelligence-repository";
import type { NormalizedInteractionInput } from "@/lib/types";

describe("SupportIntelligenceRepository genuine PostgreSQL RLS boundary", () => {
  const adminBaseUrl =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.USER || "postgres"}@127.0.0.1:5432/postgres`;

  const dbName = `support_int_test_${Math.floor(Math.random() * 1000000)}`;
  const appRole = `support_int_app_${Math.floor(Math.random() * 1000000)}`;
  const appPassword = "test_password_secure";

  let adminPool: Pool;
  let appPool: Pool;
  let client: PostgresClient;
  let repository: PgSupportIntelligenceRepository;

  const tenantAlpha = "tenant_alpha";
  const tenantBeta = "tenant_beta";

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

      // Read and execute migration 011_mvp_intelligence.sql
      const migrationPath = resolve(__dirname, "../migrations/011_mvp_intelligence.sql");
      const migrationSql = await readFile(migrationPath, "utf8");
      await dbAdminPool.query(migrationSql);

      // Seed tenants for foreign key references
      await dbAdminPool.query(
        `INSERT INTO supportv8.tenants (id, domain, name, operating_mode)
         VALUES
           ('${tenantAlpha}', 'alpha.example.com', 'Tenant Alpha', 'autonomous'),
           ('${tenantBeta}', 'beta.example.com', 'Tenant Beta', 'autonomous')
         ON CONFLICT (id) DO NOTHING`
      );

      // Grant schema and table access to the non-superuser application role
      await dbAdminPool.query(
        `GRANT USAGE ON SCHEMA supportv8 TO ${appRole};
         GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supportv8 TO ${appRole};
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
    repository = new PgSupportIntelligenceRepository(client);
  });

  afterAll(async () => {
    try {
      await appPool?.end();
    } catch {}

    try {
      // Terminate connections to test DB and drop it
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
      );
      await adminPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await adminPool.query(`DROP ROLE IF EXISTS ${appRole}`);
    } catch {}

    try {
      await adminPool?.end();
    } catch {}
  });

  it("exact tenant session boundary: withTenantSession sets transaction-local app.current_tenant_id", async () => {
    const activeTenant = await client.withTenantSession(tenantAlpha, async (session) => {
      const rows = await session.query<{ current_tenant: string }>(
        "SELECT current_setting('app.current_tenant_id', true) AS current_tenant"
      );
      return rows[0]?.current_tenant;
    });

    expect(activeTenant).toBe(tenantAlpha);
  });

  it("idempotent (tenant_id, source, event_id) insertion returns replayed: true with the same interactionId", async () => {
    const input: NormalizedInteractionInput = {
      eventId: "evt-zd-1001",
      tenantId: tenantAlpha,
      accountId: "acct-alpha",
      connectionId: "conn-alpha-1",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "TICKET-1001",
      customerReference: "CUST-500",
      sourceUrl: "https://alpha.zendesk.com/tickets/1001",
      text: "Unable to complete checkout with credit card error 402",
      sender: "customer",
      occurredAt: "2026-10-21T12:00:00.000Z",
      receivedAt: "2026-10-21T12:00:01.000Z",
      correlationId: "corr-1001",
      raw: { priority: "urgent", channel: "web" },
    };

    // First delivery: should insert new interaction and return replayed: false
    const firstResult = await repository.recordInteraction(input);
    expect(firstResult.replayed).toBe(false);
    expect(firstResult.interactionId).toBeDefined();

    // Verify outbox entry was created
    const outboxRows = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<{ id: string; event_key: string; status: string }>(
        "SELECT id, event_key, status FROM supportv8.interaction_outbox WHERE tenant_id = $1 AND event_key = $2",
        [tenantAlpha, `evt:${tenantAlpha}:${input.eventId}`]
      )
    );
    expect(outboxRows.length).toBe(1);
    expect(outboxRows[0].status).toBe("pending");

    // Second delivery (duplicate / replay): should return replayed: true and SAME interactionId
    const secondResult = await repository.recordInteraction({
      ...input,
      text: "Modified text trying to tamper replay",
    });
    expect(secondResult.replayed).toBe(true);
    expect(secondResult.interactionId).toBe(firstResult.interactionId);

    // Verify outbox still has exactly one record
    const finalOutbox = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<{ count: string }>(
        "SELECT count(*) FROM supportv8.interaction_outbox WHERE tenant_id = $1 AND event_key = $2",
        [tenantAlpha, `evt:${tenantAlpha}:${input.eventId}`]
      )
    );
    expect(Number(finalOutbox[0].count)).toBe(1);
  });

  it("isolation: Tenant A cannot read or mutate Tenant B interaction events, receipts, or outbox", async () => {
    // 1. Tenant Alpha records interaction and action receipt
    const alphaInput: NormalizedInteractionInput = {
      eventId: "evt-zd-alpha-secret",
      tenantId: tenantAlpha,
      accountId: "acct-alpha",
      connectionId: "conn-alpha-1",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "TICKET-SECRET-A",
      customerReference: "CUST-SECRET-A",
      sourceUrl: "https://alpha.zendesk.com/tickets/999",
      text: "Confidential customer data for Alpha",
      sender: "customer",
      occurredAt: "2026-10-21T12:10:00.000Z",
      receivedAt: "2026-10-21T12:10:01.000Z",
      correlationId: "corr-alpha-secret",
      raw: { secret: "alpha-confidential" },
    };
    const alphaRecord = await repository.recordInteraction(alphaInput);
    expect(alphaRecord.replayed).toBe(false);

    await repository.recordActionReceipt({
      tenantId: tenantAlpha,
      idempotencyKey: "idem-alpha-receipt-1",
      action: "update_ticket",
      status: "success",
      payload: { note: "internal secret" },
    });

    // 2. Tenant Beta attempts to read Tenant Alpha's interaction via repository
    const betaRead = await repository.getInteraction(tenantBeta, alphaInput.eventId);
    expect(betaRead).toBeNull();

    // 3. Direct RLS test: Tenant Beta session querying interaction_events sees 0 of Alpha's rows
    const betaEvents = await client.withTenantSession(tenantBeta, async (session) =>
      session.query<{ id: string }>(
        "SELECT id FROM supportv8.interaction_events WHERE source_reference = $1",
        ["TICKET-SECRET-A"]
      )
    );
    expect(betaEvents.length).toBe(0);

    // 4. Direct RLS test: Tenant Beta querying outbox sees 0 of Alpha's outbox rows
    const betaOutbox = await client.withTenantSession(tenantBeta, async (session) =>
      session.query<{ id: string }>(
        "SELECT id FROM supportv8.interaction_outbox WHERE event_key = $1",
        [`evt:${tenantAlpha}:${alphaInput.eventId}`]
      )
    );
    expect(betaOutbox.length).toBe(0);

    // 5. Direct RLS test: Tenant Beta querying action_receipts sees 0 of Alpha's receipts
    const betaReceipt = await repository.getActionReceipt(tenantBeta, "idem-alpha-receipt-1");
    expect(betaReceipt).toBeNull();

    // 6. Direct RLS test: Tenant Beta cannot mutate or complete Tenant Alpha's event
    await repository.completeInteraction(tenantBeta, alphaInput.eventId, "issue-fake");

    const alphaEventAfter = await repository.getInteraction(tenantAlpha, alphaInput.eventId);
    expect(alphaEventAfter).not.toBeNull();
    // Processing state remains pending because Beta's update matched 0 rows under RLS
    const rawAlphaState = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<{ processing_state: string; issue_id: string | null }>(
        "SELECT processing_state, issue_id FROM supportv8.interaction_events WHERE tenant_id = $1 AND event_id = $2",
        [tenantAlpha, alphaInput.eventId]
      )
    );
    expect(rawAlphaState[0].processing_state).toBe("pending");
    expect(rawAlphaState[0].issue_id).toBeNull();
  });

  it("transaction rollback on processing failure: error inside withTenantSession rolls back", async () => {
    const failingEventId = "evt-zd-rollback-test";

    await expect(
      client.withTenantSession(tenantAlpha, async (session) => {
        await session.query(
          `INSERT INTO supportv8.interaction_events (
             id, tenant_id, account_id, connection_id, connector_key,
             source, event_id, source_reference, customer_reference,
             source_url, text, sender, occurred_at, received_at,
             correlation_id, raw_payload, expires_at, processing_state
           ) VALUES (
             'evt_temp_rollback', $1, 'acct-alpha', 'conn-1', 'zendesk',
             'zendesk', $2, 'REF-FAIL', 'CUST-FAIL',
             'https://example.com', 'Failing test', 'customer', NOW(), NOW(),
             'corr-fail', '{}'::jsonb, NOW() + interval '72 hours', 'pending'
           )`,
          [tenantAlpha, failingEventId]
        );

        // Simulate unexpected failure before commit
        throw new Error("Simulated transient processing explosion");
      })
    ).rejects.toThrow("Simulated transient processing explosion");

    // Verify row was rolled back and does NOT exist
    const found = await repository.getInteraction(tenantAlpha, failingEventId);
    expect(found).toBeNull();
  });

  it("dual-instance restart proof: fresh repository instance against the same database reads committed records", async () => {
    const restartEventId = "evt-zd-restart-test";
    const input: NormalizedInteractionInput = {
      eventId: restartEventId,
      tenantId: tenantAlpha,
      accountId: "acct-alpha",
      connectionId: "conn-alpha-1",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "TICKET-RESTART-42",
      customerReference: "CUST-RESTART-42",
      sourceUrl: "https://alpha.zendesk.com/tickets/42",
      text: "Persisted across instance restarts",
      sender: "customer",
      occurredAt: "2026-10-21T12:20:00.000Z",
      receivedAt: "2026-10-21T12:20:01.000Z",
      correlationId: "corr-restart-42",
      raw: { persistent: true },
    };

    // Instance 1 records the interaction
    const recordResult = await repository.recordInteraction(input);
    expect(recordResult.replayed).toBe(false);

    // Simulate service restart: instantiate fresh client and repository against same database
    const freshClient = new PostgresClient(undefined, appPool);
    const restartedRepository = new PgSupportIntelligenceRepository(freshClient);

    // Instance 2 reads the record
    const retrieved = await restartedRepository.getInteraction(tenantAlpha, restartEventId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.eventId).toBe(restartEventId);
    expect(retrieved?.text).toBe("Persisted across instance restarts");
    expect(retrieved?.sourceReference).toBe("TICKET-RESTART-42");
  });

  it("lifecycle: claims due interactions, completes with issueId, and handles failure retries", async () => {
    const claimEventId = "evt-zd-claim-test";
    const input: NormalizedInteractionInput = {
      eventId: claimEventId,
      tenantId: tenantAlpha,
      accountId: "acct-alpha",
      connectionId: "conn-alpha-1",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "TICKET-CLAIM-99",
      customerReference: "CUST-99",
      sourceUrl: "https://alpha.zendesk.com/tickets/99",
      text: "Claiming lifecycle test",
      sender: "customer",
      occurredAt: "2026-10-21T12:30:00.000Z",
      receivedAt: "2026-10-21T12:30:01.000Z",
      correlationId: "corr-claim-99",
      raw: {},
    };

    await repository.recordInteraction(input);

    // 1. Claim interaction for tenant
    const claimed = await repository.claimInteractions(10, "worker-test-1", tenantAlpha);
    const ourClaim = claimed.find((c) => c.eventId === claimEventId);
    expect(ourClaim).toBeDefined();

    // Verify status updated to processing
    const processingRow = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<{ processing_state: string; locked_by: string }>(
        "SELECT processing_state, locked_by FROM supportv8.interaction_events WHERE tenant_id = $1 AND event_id = $2",
        [tenantAlpha, claimEventId]
      )
    );
    expect(processingRow[0].processing_state).toBe("processing");
    expect(processingRow[0].locked_by).toBe("worker-test-1");

    // 2. Fail interaction with retry
    const retryTime = new Date(Date.now() + 60000).toISOString();
    await repository.failInteraction(tenantAlpha, claimEventId, "RATE_LIMIT_EXCEEDED", retryTime);

    const failedRow = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<{ processing_state: string; error_code: string; retry_count: number }>(
        "SELECT processing_state, error_code, retry_count FROM supportv8.interaction_events WHERE tenant_id = $1 AND event_id = $2",
        [tenantAlpha, claimEventId]
      )
    );
    expect(failedRow[0].processing_state).toBe("failed");
    expect(failedRow[0].error_code).toBe("RATE_LIMIT_EXCEEDED");
    expect(failedRow[0].retry_count).toBe(1);

    // 3. Complete interaction with generated issueId
    await repository.completeInteraction(tenantAlpha, claimEventId, "iss_generated_123");

    const completedRow = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<{ processing_state: string; issue_id: string }>(
        "SELECT processing_state, issue_id FROM supportv8.interaction_events WHERE tenant_id = $1 AND event_id = $2",
        [tenantAlpha, claimEventId]
      )
    );
    expect(completedRow[0].processing_state).toBe("completed");
    expect(completedRow[0].issue_id).toBe("iss_generated_123");
  });

  it("source connections and tenant policies persist within exact tenant boundaries", async () => {
    // 1. Upsert Source Connection for Tenant Alpha
    const connection = await repository.upsertSourceConnection({
      id: "src-zd-alpha",
      tenantId: tenantAlpha,
      accountId: "acct-alpha",
      provider: "zendesk",
      connectionId: "conn-gw-999",
      connectorKey: "zendesk",
      externalAccountId: "zd-subdomain-alpha",
      baseUrl: "https://alpha.zendesk.com",
      status: "connected",
    });
    expect(connection.status).toBe("connected");
    expect(connection.connectorKey).toBe("zendesk");

    const retrievedConn = await repository.getSourceConnection(tenantAlpha, "zendesk");
    expect(retrievedConn?.externalAccountId).toBe("zd-subdomain-alpha");

    // Tenant Beta cannot see Tenant Alpha's connection
    const betaConn = await repository.getSourceConnection(tenantBeta, "zendesk");
    expect(betaConn).toBeNull();

    // 2. Set and retrieve Tenant Policy
    await repository.setTenantPolicy({
      tenantId: tenantAlpha,
      rawContextRetentionHours: 48,
      mode: "copilot",
    });

    const alphaPolicy = await repository.getTenantPolicy(tenantAlpha);
    expect(alphaPolicy?.rawContextRetentionHours).toBe(48);
    expect(alphaPolicy?.mode).toBe("copilot");

    // Tenant Beta sees no policy initially
    const betaPolicy = await repository.getTenantPolicy(tenantBeta);
    expect(betaPolicy).toBeNull();
  });

  it("action receipts are keyed by (tenant_id, idempotency_key) and idempotent", async () => {
    const receipt1 = await repository.recordActionReceipt({
      tenantId: tenantAlpha,
      idempotencyKey: "idem-action-42",
      action: "close_ticket",
      issueId: "iss_42",
      actionExecutionId: "exec_gw_12345",
      status: "dispatched",
      actor: { role: "autonomous_agent" },
      payload: { resolution: "fixed by bot" },
    });
    expect(receipt1.status).toBe("dispatched");
    expect(receipt1.actionExecutionId).toBe("exec_gw_12345");

    // Second recording with identical idempotencyKey returns existing receipt
    const receipt2 = await repository.recordActionReceipt({
      tenantId: tenantAlpha,
      idempotencyKey: "idem-action-42",
      action: "close_ticket",
      status: "different_status_attempt",
    });
    expect(receipt2.id).toBe(receipt1.id);
    expect(receipt2.status).toBe("dispatched"); // Preserved original status
  });
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateKeyPair, SignJWT, type GenerateKeyPairResult } from "jose";
import { PostgresClient } from "@/lib/db/pg-client";
import { PgSupportIntelligenceRepository } from "@/lib/db/support-intelligence-repository";
import { POST } from "@/app/api/private/interaction-events/route";
import { setInteractionRepositoryForTesting } from "@/lib/connectors/interaction-repository-registry";
import { setInteractionIngressAuthKeyForTesting } from "@/lib/service-app/interaction-ingress-auth";
import { InteractionWorker } from "@/lib/temporal/interaction-workflow";

const enabled = process.env.SUPPORTV8_REAL_POSTGRES === "1";

describe.skipIf(!enabled)("POST /api/private/interaction-events PostgreSQL RLS & Lifecycle Integration", () => {
  const adminBaseUrl =
    process.env.SUPPORTV8_TEST_DATABASE_URL ||
    process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    `postgresql://${process.env.USER || "postgres"}@127.0.0.1:5432/postgres`;

  const dbName = `support_ingress_test_${Math.floor(Math.random() * 1000000)}`;
  const appRole = `support_ingress_app_${Math.floor(Math.random() * 1000000)}`;
  const appPassword = "test_ingress_password_secure";

  let adminPool: Pool;
  let appPool: Pool;
  let client: PostgresClient;
  let repository: PgSupportIntelligenceRepository;
  let keyPair: GenerateKeyPairResult;

  const tenantAlpha = "tenant_ingress_alpha";
  const tenantBeta = "tenant_ingress_beta";
  const accountAlpha = "acc_ingress_alpha";
  const accountBeta = "acc_ingress_beta";

  beforeAll(async () => {
    // 1. Generate RSA keypair for workload tokens
    keyPair = await generateKeyPair("RS256");
    setInteractionIngressAuthKeyForTesting(keyPair.publicKey);

    // 2. Connect as admin to create test database
    adminPool = new Pool({ connectionString: adminBaseUrl });
    await adminPool.query(`CREATE DATABASE ${dbName}`);

    // 3. Connect to test database as admin to run migrations and setup roles
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
         GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA supportv8 TO ${appRole};
         GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA supportv8 TO ${appRole};`
      );
    } finally {
      await dbAdminPool.end();
    }

    // 4. Connect as application user to guarantee strict non-superuser RLS enforcement
    parsed.username = appRole;
    parsed.password = appPassword;
    const appConnectionUrl = parsed.toString();

    appPool = new Pool({ connectionString: appConnectionUrl });
    client = new PostgresClient(undefined, appPool);
    repository = new PgSupportIntelligenceRepository(client);

    // Wire route to use our test repository
    setInteractionRepositoryForTesting(repository);
  });

  afterAll(async () => {
    setInteractionRepositoryForTesting(null);
    setInteractionIngressAuthKeyForTesting(null);

    try {
      await appPool?.end();
    } catch {}

    try {
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

  async function createToken(tenantId: string, accountId: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return await new SignJWT({
      sub: "action-gateway-sub",
      azp: "action-gateway-support",
      account_id: accountId,
      tenant_id: tenantId,
      scope: "supportv8:interactions:ingest",
      jti: `jti_${crypto.randomUUID().replace(/-/g, "")}`,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://auth.servicev8.com/realms/servicev8")
      .setAudience("supportv8")
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(keyPair.privateKey);
  }

  it("POST /api/private/interaction-events writes to database under forced RLS and acknowledges with 202", async () => {
    const eventId = "evt_pg_ingress_001";
    const token = await createToken(tenantAlpha, accountAlpha);

    const envelope = {
      eventId,
      accountId: accountAlpha,
      tenantId: tenantAlpha,
      connectionId: "conn_zk_alpha",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "ticket-1001",
      customerReference: "cust-9001",
      sourceUrl: "https://alpha.zendesk.com/tickets/1001",
      text: "Issue: cannot generate compliance PDF for Q3.",
      sender: "customer",
      occurredAt: new Date(Date.now() - 10000).toISOString(),
      raw: { priority: "urgent", customerName: "Alpha Corp" },
    };

    const request = new Request("https://supportv8.internal/api/private/interaction-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        "x-servicev8-account-id": accountAlpha,
        "x-servicev8-tenant-id": tenantAlpha,
      },
      body: JSON.stringify(envelope),
    });

    const response = await POST(request);
    expect(response.status).toBe(202);

    const body = await response.json();
    expect(body.accepted).toBe(true);
    expect(body.replayed).toBe(false);
    expect(body.eventId).toBe(eventId);
    expect(body.interactionId).toBeDefined();

    // Verify row was written to interaction_events under tenantAlpha RLS session
    const events = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<any>(
        `SELECT id, tenant_id, source, event_id, source_reference, text, processing_state
         FROM supportv8.interaction_events
         WHERE tenant_id = $1 AND event_id = $2`,
        [tenantAlpha, eventId]
      )
    );

    expect(events.length).toBe(1);
    expect(events[0].id).toBe(body.interactionId);
    expect(events[0].source).toBe("zendesk");
    expect(events[0].source_reference).toBe("ticket-1001");
    expect(events[0].processing_state).toBe("pending");

    // Verify outbox row committed in the same transaction
    const outbox = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<any>(
        `SELECT event_key, status FROM supportv8.interaction_outbox
         WHERE tenant_id = $1 AND event_key = $2`,
        [tenantAlpha, `evt:${tenantAlpha}:${eventId}`]
      )
    );

    expect(outbox.length).toBe(1);
    expect(outbox[0].status).toBe("pending");
  });

  it("redelivery of duplicate event returns 200 with replayed: true and no duplicate row", async () => {
    const eventId = "evt_pg_ingress_001"; // same eventId as above
    const token = await createToken(tenantAlpha, accountAlpha);

    const envelope = {
      eventId,
      accountId: accountAlpha,
      tenantId: tenantAlpha,
      connectionId: "conn_zk_alpha",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "ticket-1001",
      customerReference: "cust-9001",
      sourceUrl: "https://alpha.zendesk.com/tickets/1001",
      text: "Issue: cannot generate compliance PDF for Q3.",
      sender: "customer",
      occurredAt: new Date(Date.now() - 10000).toISOString(),
      raw: { priority: "urgent" },
    };

    const request = new Request("https://supportv8.internal/api/private/interaction-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        "x-servicev8-account-id": accountAlpha,
        "x-servicev8-tenant-id": tenantAlpha,
      },
      body: JSON.stringify(envelope),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.accepted).toBe(true);
    expect(body.replayed).toBe(true);
    expect(body.eventId).toBe(eventId);

    // Verify still exactly one row exists in database
    const events = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<any>(
        `SELECT COUNT(*)::int as count FROM supportv8.interaction_events
         WHERE tenant_id = $1 AND event_id = $2`,
        [tenantAlpha, eventId]
      )
    );
    expect(events[0].count).toBe(1);
  });

  it("token for tenant B carrying tenant A envelope returns 403 and creates no row", async () => {
    const eventId = "evt_pg_cross_tenant_probe";
    // Token minted for Tenant Beta
    const tokenBeta = await createToken(tenantBeta, accountBeta);

    // Envelope specifying Tenant Alpha
    const envelope = {
      eventId,
      accountId: accountAlpha,
      tenantId: tenantAlpha,
      connectionId: "conn_zk_alpha",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "ticket-unauthorized",
      customerReference: "cust-unauthorized",
      sourceUrl: "https://alpha.zendesk.com/tickets/9999",
      text: "Unauthorized payload cross-tenant injection test.",
      sender: "customer",
      occurredAt: new Date(Date.now() - 5000).toISOString(),
      raw: {},
    };

    const request = new Request("https://supportv8.internal/api/private/interaction-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${tokenBeta}`,
        // Headers must match token claims or token auth will reject first
        "x-servicev8-account-id": accountBeta,
        "x-servicev8-tenant-id": tenantBeta,
      },
      body: JSON.stringify(envelope),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain("mismatch");

    // Assert that NO row was inserted into tenantAlpha or tenantBeta
    const rowsAlpha = await client.withTenantSession(tenantAlpha, async (session) =>
      session.query<any>(
        `SELECT COUNT(*)::int as count FROM supportv8.interaction_events WHERE event_id = $1`,
        [eventId]
      )
    );
    expect(rowsAlpha[0].count).toBe(0);

    const rowsBeta = await client.withTenantSession(tenantBeta, async (session) =>
      session.query<any>(
        `SELECT COUNT(*)::int as count FROM supportv8.interaction_events WHERE event_id = $1`,
        [eventId]
      )
    );
    expect(rowsBeta[0].count).toBe(0);
  });

  it("Step 5 restart, replay, and tenant isolation: processes once, redelivers, asserts 1 interaction and 1 Issue", async () => {
    const eventId = "evt_step5_e2e_001";
    const token = await createToken(tenantAlpha, accountAlpha);

    const envelope = {
      eventId,
      accountId: accountAlpha,
      tenantId: tenantAlpha,
      connectionId: "conn_zk_alpha",
      connectorKey: "zendesk",
      source: "zendesk",
      sourceReference: "ticket-step5-555",
      customerReference: "cust-step5",
      sourceUrl: "https://alpha.zendesk.com/tickets/555",
      text: "Database failover trigger failure.\nUrgent attention required on DB replica.",
      sender: "customer",
      occurredAt: new Date(Date.now() - 10000).toISOString(),
      raw: { customerName: "Step5 Enterprise" },
    };

    // 1. Ingest via POST route
    const request1 = new Request("https://supportv8.internal/api/private/interaction-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        "x-servicev8-account-id": accountAlpha,
        "x-servicev8-tenant-id": tenantAlpha,
      },
      body: JSON.stringify(envelope),
    });

    const res1 = await POST(request1);
    expect(res1.status).toBe(202);
    const body1 = await res1.json();
    expect(body1.replayed).toBe(false);

    // 2. Construct fresh repository and worker against the same database (restart proof)
    const freshClient = new PostgresClient(undefined, appPool);
    const freshRepo = new PgSupportIntelligenceRepository(freshClient);
    const worker = new InteractionWorker(freshRepo, freshClient, "worker-step5-1");

    // Process the event once
    const processResult = await worker.processEvent(eventId, tenantAlpha);
    expect(processResult.issueId).toBeDefined();

    // Verify interaction completed and Issue created
    const eventRecord = await freshRepo.getInteraction(tenantAlpha, eventId);
    expect(eventRecord).toBeDefined();

    const issues = await freshClient.withTenantSession(tenantAlpha, async (session) =>
      session.query<any>(
        `SELECT id, tenant_id, source, external_id, summary, customer_ref, customer_name
         FROM supportv8.issues
         WHERE tenant_id = $1 AND external_id = $2`,
        [tenantAlpha, "ticket-step5-555"]
      )
    );
    expect(issues.length).toBe(1);
    expect(issues[0].id).toBe(processResult.issueId);
    expect(issues[0].source).toBe("zendesk");
    expect(issues[0].external_id).toBe("ticket-step5-555");
    expect(issues[0].summary).toBe("Database failover trigger failure.");
    expect(issues[0].customer_name).toBe("Step5 Enterprise");

    // 3. Redeliver the event via POST route
    const request2 = new Request("https://supportv8.internal/api/private/interaction-events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${token}`,
        "x-servicev8-account-id": accountAlpha,
        "x-servicev8-tenant-id": tenantAlpha,
      },
      body: JSON.stringify(envelope),
    });

    const res2 = await POST(request2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.replayed).toBe(true);

    // Process again via worker
    await worker.processEvent(eventId, tenantAlpha);

    // 4. Assert exactly one interaction row and one Issue row
    const finalEventCount = await freshClient.withTenantSession(tenantAlpha, async (session) =>
      session.query<any>(
        `SELECT COUNT(*)::int as count FROM supportv8.interaction_events
         WHERE tenant_id = $1 AND event_id = $2`,
        [tenantAlpha, eventId]
      )
    );
    expect(finalEventCount[0].count).toBe(1);

    const finalIssueCount = await freshClient.withTenantSession(tenantAlpha, async (session) =>
      session.query<any>(
        `SELECT COUNT(*)::int as count FROM supportv8.issues
         WHERE tenant_id = $1 AND external_id = $2`,
        [tenantAlpha, "ticket-step5-555"]
      )
    );
    expect(finalIssueCount[0].count).toBe(1);

    // 5. Tenant isolation check: Tenant Beta cannot see Tenant Alpha's issues or interactions
    const betaIssueCount = await freshClient.withTenantSession(tenantBeta, async (session) =>
      session.query<any>(
        `SELECT COUNT(*)::int as count FROM supportv8.issues WHERE external_id = $1`,
        ["ticket-step5-555"]
      )
    );
    expect(betaIssueCount[0].count).toBe(0);

    const betaEventCount = await freshClient.withTenantSession(tenantBeta, async (session) =>
      session.query<any>(
        `SELECT COUNT(*)::int as count FROM supportv8.interaction_events WHERE event_id = $1`,
        [eventId]
      )
    );
    expect(betaEventCount[0].count).toBe(0);
  });
});

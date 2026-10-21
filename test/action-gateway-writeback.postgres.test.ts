import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { PostgresClient } from "../src/lib/db/pg-client";
import { PgSupportIntelligenceRepository } from "../src/lib/db/support-intelligence-repository";
import { issueService } from "../src/lib/services/issue-service";
import { POST } from "../src/app/api/issues/[id]/source-action/route";
import { resolveRequestTenant } from "../src/lib/auth/request-tenant";

vi.mock("../src/lib/auth/request-tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/auth/request-tenant")>();
  return {
    ...actual,
    resolveRequestTenant: vi.fn(),
  };
});

describe("Action Gateway Write-back PostgreSQL RLS Integration", () => {
  const adminBaseUrl =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.USER || "postgres"}@127.0.0.1:5432/postgres`;

  const dbName = `support_wb_test_${Math.floor(Math.random() * 1000000)}`;
  const appRole = `support_wb_app_${Math.floor(Math.random() * 1000000)}`;
  const appPassword = "test_password_secure";

  let adminPool: Pool;
  let appPool: Pool;
  let client: PostgresClient;
  let repository: PgSupportIntelligenceRepository;

  const TENANT_A = "tenant_writeback_a";
  const TENANT_B = "tenant_writeback_b";

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
           ('${TENANT_A}', 'writeback-a.example.com', 'Tenant Writeback A', 'copilot'),
           ('${TENANT_B}', 'writeback-b.example.com', 'Tenant Writeback B', 'copilot')
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

    // Set up Tenant A connected Zendesk source and copilot policy
    await repository.upsertSourceConnection({
      id: "src_conn_wb_a",
      tenantId: TENANT_A,
      accountId: "acc_writeback_a",
      provider: "zendesk",
      connectionId: "conn_wb_a_1",
      connectorKey: "zendesk",
      externalAccountId: "zd_subdomain_a",
      baseUrl: "https://alpha-support.zendesk.com",
      status: "connected",
    });

    await repository.setTenantPolicy({
      tenantId: TENANT_A,
      rawContextRetentionHours: 72,
      mode: "copilot",
    });

    // Seed an initial durable issue for Tenant A
    await client.withTenantSession(TENANT_A, async (session) => {
      await session.query(
        `INSERT INTO supportv8.issues (
           id, tenant_id, source, external_id, source_url, customer_ref,
           customer_name, customer_tier, summary, category, product, version,
           sentiment, sentiment_score, sentiment_trajectory, priority, confidence,
           business_impact, resolution_risk_score, source_status, tags,
           timeline, messages, created_at, updated_at
         ) VALUES (
           'iss_wb_001', $1, 'zendesk', 'ZD-98765', 'https://alpha.zendesk.com/tickets/98765',
           'cust_999', 'Enterprise Client', 'enterprise', 'Database replication lag on prod',
           'infrastructure', 'Platform', 'v2', 'urgent', -0.8, 'worsening',
           'urgent', 0.95, 25000, 0.7, 'open', ARRAY['db', 'replication'],
           '[]'::jsonb, '[]'::jsonb, NOW(), NOW()
         )`,
        [TENANT_A]
      );
    });
  });

  afterAll(async () => {
    PostgresClient.setTestClient(null);

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

  it("executes governed write-back, persists durable action_receipts under forced RLS, and updates local issue", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: TENANT_A,
      tenantSlug: "writeback_a",
      authenticated: true,
      userId: "operator_alex",
      username: "alex@alpha.com",
      displayName: "Alex Operator",
      roles: ["support_operator"],
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "ag_exec_live_12345",
          status: "completed",
          result: { ticketId: "98765", status: "solved" },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest(
      "http://localhost:3005/api/issues/iss_wb_001/source-action",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "close",
          resolutionSummary: "Failover complete and replica synchronized.",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "iss_wb_001" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.replayed).toBe(false);
    expect(json.receipt.actionExecutionId).toBe("ag_exec_live_12345");
    expect(json.receipt.status).toBe("completed");

    // 1. Directly verify PostgreSQL action_receipts table under forced RLS
    await client.withTenantSession(TENANT_A, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.action_receipts WHERE tenant_id = $1 AND issue_id = 'iss_wb_001'`,
        [TENANT_A]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].action_execution_id).toBe("ag_exec_live_12345");
      expect(rows[0].action).toBe("close");
      expect(rows[0].capability).toBe("support.ticket.close");
      expect(rows[0].status).toBe("completed");
    });

    // 2. Directly verify PostgreSQL issues table was updated
    await client.withTenantSession(TENANT_A, async (session) => {
      const issueRows = await session.query<any>(
        `SELECT source_status FROM supportv8.issues WHERE tenant_id = $1 AND id = 'iss_wb_001'`,
        [TENANT_A]
      );
      expect(issueRows.length).toBe(1);
      expect(issueRows[0].source_status).toBe("solved");
    });
  });

  it("replays duplicate request idempotently without duplicate Action Gateway execution", async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: TENANT_A,
      tenantSlug: "writeback_a",
      authenticated: true,
      userId: "operator_alex",
      roles: ["support_operator"],
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Send identical request again
    const request = new NextRequest(
      "http://localhost:3005/api/issues/iss_wb_001/source-action",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "close",
          resolutionSummary: "Failover complete and replica synchronized.",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "iss_wb_001" }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.replayed).toBe(true);
    expect(json.receipt.actionExecutionId).toBe("ag_exec_live_12345");

    // Action Gateway fetch was NOT called because idempotency key resolved existing receipt
    expect(fetchMock).not.toHaveBeenCalled();

    // Still exactly 1 row in action_receipts table
    await client.withTenantSession(TENANT_A, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.action_receipts WHERE tenant_id = $1 AND issue_id = 'iss_wb_001'`,
        [TENANT_A]
      );
      expect(rows.length).toBe(1);
    });
  });

  it("strictly isolates action receipts across tenants under forced RLS", async () => {
    // Tenant B session cannot read Tenant A's action receipts
    await client.withTenantSession(TENANT_B, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.action_receipts`
      );
      expect(rows.length).toBe(0);
    });

    // Tenant B cannot invoke write-back on Tenant A's issue
    vi.mocked(resolveRequestTenant).mockResolvedValue({
      tenantId: TENANT_B,
      tenantSlug: "writeback_b",
      authenticated: true,
      userId: "operator_bob",
      roles: ["support_operator"],
    });

    const request = new NextRequest(
      "http://localhost:3005/api/issues/iss_wb_001/source-action",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "close",
          resolutionSummary: "Malicious cross-tenant attempt",
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "iss_wb_001" }),
    });

    expect(response.status).toBe(404);
  });

  it("proves dual-instance restart: fresh repository against same DB reads committed receipts", async () => {
    const freshClient = new PostgresClient(undefined, appPool);
    const freshRepo = new PgSupportIntelligenceRepository(freshClient);

    const receipts = await freshRepo.listActionReceipts(TENANT_A);
    expect(receipts.length).toBe(1);
    expect(receipts[0].actionExecutionId).toBe("ag_exec_live_12345");
    expect(receipts[0].action).toBe("close");

    const issue = await issueService.getById("iss_wb_001", TENANT_A);
    expect(issue).not.toBeNull();
    expect(issue?.sourceStatus).toBe("solved");
    expect(issue?.status).toBe("solved");
  });
});

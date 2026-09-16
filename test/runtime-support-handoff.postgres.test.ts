import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresClient } from "@/lib/db/pg-client";
import { PostgresRuntimeHandoffReplayStore } from "@/lib/service-app/runtime-handoff-replay";
import type { RuntimeSupportHandoffClaims } from "@/lib/service-app/runtime-handoff-claims";
const enabled = process.env.SUPPORTV8_REAL_POSTGRES === "1",
  localFixture =
    "postgres://postgres@127.0.0.1:52996/support_runtime_handoff_test",
  ciFixture =
    "postgresql://postgres:support-workspace-test@127.0.0.1:5432/postgres";
function owned(value: string) {
  if (value !== localFixture && value !== ciFixture)
    throw new Error(
      "Runtime handoff PostgreSQL proof requires an exact owned fixture URL",
    );
  const url = new URL(value);
  if (
    url.search ||
    url.hash ||
    url.hostname !== "127.0.0.1" ||
    url.username !== "postgres"
  )
    throw new Error(
      "Runtime handoff PostgreSQL proof requires an exact owned fixture URL",
    );
  return {
    url,
    database: url.pathname.slice(1),
    port: Number(url.port),
    isLocal: value === localFixture,
  };
}
function recognizedServerHost(
  fixture: ReturnType<typeof owned>,
  host: string,
  ci = process.env.CI === "true",
) {
  const loopback = host === "127.0.0.1" || host === "::1";
  const privateNetwork =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host);
  return loopback || (!fixture.isLocal && ci && privateNetwork);
}
describe("Runtime handoff PostgreSQL fixture safety gate", () => {
  it.each([
    `${localFixture}?x=1`,
    "postgres://postgres@127.0.0.1:52996/postgres",
    "postgres://other@127.0.0.1:52996/support_runtime_handoff_test",
  ])("rejects %s", (url) =>
    expect(() => owned(url)).toThrow("exact owned fixture URL"),
  );
  it("accepts a private sidecar address only for the exact CI fixture in CI", () => {
    expect(recognizedServerHost(owned(ciFixture), "172.18.0.2", true)).toBe(
      true,
    );
    expect(recognizedServerHost(owned(ciFixture), "172.18.0.2", false)).toBe(
      false,
    );
    expect(recognizedServerHost(owned(localFixture), "172.18.0.2", true)).toBe(
      false,
    );
  });
});
describe.skipIf(!enabled)("Runtime handoff durable replay boundary", () => {
  let admin: Pool,
    app1: Pool,
    app2: Pool,
    client1: PostgresClient,
    client2: PostgresClient;
  const readerRole = "support_runtime_handoff_fixture_v1";
  let schemaCreated = false;
  let readerRoleCreated = false;
  let productionRoleCreated = false;
  const workspace = `tenant_rt_${"a".repeat(48)}`,
    other = `tenant_rt_${"b".repeat(48)}`;
  const claim = (jti: string): RuntimeSupportHandoffClaims => ({
    version: "servicev8.support-handoff.v1",
    iss: "runtime",
    aud: "supportv8-service-app",
    sub: "synthetic-member",
    accountId: "synthetic-account",
    tenantId: "synthetic-registry",
    verticalId: "runtime",
    installationId: "synthetic-install",
    externalWorkspaceId: workspace,
    tenantDomain: "synthetic-support",
    role: "support:read",
    destination:
      "https://synthetic-support.support.servicev8.com/auth/runtime/handoff",
    iat: 1_800_000_000,
    exp: 1_900_000_000,
    jti,
  });
  beforeAll(async () => {
    const fixture = owned(
        process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL ?? "",
      ),
      identityUrl = fixture.url.toString();
    admin = new Pool({ connectionString: identityUrl });
    const identity = await admin.query<{
      db: string;
      host: string;
      port: number;
    }>(
      "select current_database() db,host(inet_server_addr()) host,inet_server_port() port",
    );
    expect(identity.rows[0]).toMatchObject({
      db: fixture.database,
      port: fixture.port,
    });
    expect(recognizedServerHost(fixture, identity.rows[0]?.host ?? "")).toBe(
      true,
    );
    const count = await admin.query<{ count: string }>(
      "select count(*)::text count from pg_tables where schemaname not in ('pg_catalog','information_schema')",
    );
    if (fixture.isLocal) expect(count.rows[0]?.count).toBe("0");
    const roleConflicts = await admin.query<{ rolname: string }>(
      "SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[])",
      [[readerRole, "supportv8_app"]],
    );
    if (roleConflicts.rows.length) {
      throw new Error(
        `Runtime handoff proof refuses pre-existing roles: ${roleConflicts.rows.map((row) => row.rolname).join(",")}`,
      );
    }
    try {
      await admin.query(
        `CREATE ROLE ${readerRole} LOGIN PASSWORD 'synthetic-only'`,
      );
      readerRoleCreated = true;
      await admin.query("CREATE ROLE supportv8_app");
      productionRoleCreated = true;
      await admin.query(
        "CREATE SCHEMA supportv8; CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain varchar(128) UNIQUE NOT NULL,name varchar(255) NOT NULL,operating_mode varchar(32) NOT NULL DEFAULT 'autonomous',servicev8_account_id varchar(128),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())",
      );
      schemaCreated = true;
      await admin.query(
        await readFile(
          new URL(
            "../migrations/005_runtime_support_workspaces.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await admin.query(
        await readFile(
          new URL(
            "../migrations/007_runtime_support_handoff_uses.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await admin.query(
        "INSERT INTO supportv8.tenants(id,domain,name,servicev8_account_id) VALUES($1,'synthetic-support','Synthetic','synthetic-account'),($2,'other-support','Other','other-account')",
        [workspace, other],
      );
      await admin.query(
        "INSERT INTO supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state) VALUES('synthetic-install','synthetic-operation','synthetic-account','synthetic-registry','runtime','synthetic-support','synthetic-member',$1,'synthetic-support','workspace_created')",
        [workspace],
      );
      await admin.query(
        `GRANT USAGE ON SCHEMA supportv8 TO ${readerRole}; GRANT SELECT,INSERT,DELETE ON supportv8.runtime_support_handoff_uses TO ${readerRole}`,
      );
      const appUrl = new URL(identityUrl);
      appUrl.username = readerRole;
      appUrl.password = "synthetic-only";
      app1 = new Pool({ connectionString: appUrl.toString(), max: 1 });
      app2 = new Pool({ connectionString: appUrl.toString(), max: 1 });
      client1 = new PostgresClient(undefined, app1);
      client2 = new PostgresClient(undefined, app2);
    } catch (error) {
      await cleanup();
      throw error;
    }
  }, 30_000);
  async function cleanup() {
    await app1?.end().catch(() => undefined);
    await app2?.end().catch(() => undefined);
    if (admin) {
      if (schemaCreated)
        await admin
          .query("DROP SCHEMA supportv8 CASCADE")
          .catch(() => undefined);
      if (readerRoleCreated)
        await admin.query(`DROP ROLE ${readerRole}`).catch(() => undefined);
      if (productionRoleCreated)
        await admin.query("DROP ROLE supportv8_app").catch(() => undefined);
    }
    schemaCreated = false;
    readerRoleCreated = false;
    productionRoleCreated = false;
  }
  afterAll(async () => {
    await cleanup();
    await admin?.end();
  });
  it("grants the production app role only the required replay-table operations", async () => {
    const privileges = await admin.query<{
      select: boolean;
      insert: boolean;
      delete: boolean;
      update: boolean;
    }>(
      `SELECT has_table_privilege('supportv8_app','supportv8.runtime_support_handoff_uses','SELECT') AS select,
        has_table_privilege('supportv8_app','supportv8.runtime_support_handoff_uses','INSERT') AS insert,
        has_table_privilege('supportv8_app','supportv8.runtime_support_handoff_uses','DELETE') AS delete,
        has_table_privilege('supportv8_app','supportv8.runtime_support_handoff_uses','UPDATE') AS update`,
    );
    expect(privileges.rows[0]).toEqual({
      select: true,
      insert: true,
      delete: true,
      update: false,
    });
  });
  it("allows exactly one concurrent consumer across independent clients", async () => {
    const c = claim("00000000-0000-4000-8000-000000000001"),
      results = await Promise.all([
        new PostgresRuntimeHandoffReplayStore(client1).consume(c),
        new PostgresRuntimeHandoffReplayStore(client2).consume(c),
      ]);
    expect(results.sort()).toEqual([false, true]);
  });
  it("enforces account, registry tenant and native workspace RLS together", async () => {
    const visible = await client1.withWorkspaceProvisioningSession(
      {
        tenantId: workspace,
        accountId: "synthetic-account",
        registryTenantId: "synthetic-registry",
      },
      (db) =>
        db.query("SELECT jti_hash FROM supportv8.runtime_support_handoff_uses"),
    );
    expect(visible).toHaveLength(1);
    for (const scope of [
      {
        tenantId: workspace,
        accountId: "other-account",
        registryTenantId: "synthetic-registry",
      },
      {
        tenantId: workspace,
        accountId: "synthetic-account",
        registryTenantId: "other-registry",
      },
      {
        tenantId: other,
        accountId: "synthetic-account",
        registryTenantId: "synthetic-registry",
      },
    ])
      expect(
        await client1.withWorkspaceProvisioningSession(scope, (db) =>
          db.query(
            "SELECT jti_hash FROM supportv8.runtime_support_handoff_uses",
          ),
        ),
      ).toEqual([]);
  });
});

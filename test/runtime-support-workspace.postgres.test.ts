import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresClient } from "@/lib/db/pg-client";
import {
  RuntimeSupportWorkspaceStore,
  WorkspaceReservationConflictError,
} from "@/lib/service-app/workspace-reservation";
import { PostgresTenantReservationBackend } from "@/lib/auth/tenant-signup-registry";
import { ChatRepository } from "@/lib/db/chat-repository";

const enabled = process.env.SUPPORTV8_REAL_POSTGRES === "1";
describe.skipIf(!enabled)(
  "runtime Support workspace genuine PostgreSQL boundary",
  () => {
    let dir: string | undefined,
      port: number,
      admin: Pool,
      app: Pool,
      store: RuntimeSupportWorkspaceStore;
    let adminUrl: string;
    let schemaCreated = false,
      supportAppCreated = false,
      supportReaderCreated = false;
    const sharedFixtures = new Set([
      "postgres://postgres@127.0.0.1:52996/support_runtime_handoff_test",
      "postgresql://postgres:support-workspace-test@127.0.0.1:5432/postgres",
    ]);
    const ciFixture =
      "postgresql://postgres:support-workspace-test@127.0.0.1:5432/postgres";
    const base = (suffix: string, overrides = {}) => ({
      accountId: "acct-shared",
      registryTenantId: `reg-${suffix}`,
      installationId: `install-${suffix}`,
      operationId: `op-${suffix}`,
      tenantDomain: `${suffix}.support.test`,
      subject: `subject-${suffix}`,
      verticalId: "runtime" as const,
      ...overrides,
    });
    beforeAll(async () => {
      adminUrl = process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL ?? "";
      if (!adminUrl) {
        dir = await mkdtemp(join(tmpdir(), "supportv8-pg-"));
        port = 25000 + Math.floor(Math.random() * 10000);
        expect(
          spawnSync("initdb", ["-D", dir, "-A", "trust", "-U", "postgres"], {
            stdio: "ignore",
          }).status,
        ).toBe(0);
        expect(
          spawnSync(
            "pg_ctl",
            ["-D", dir, "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"],
            { stdio: "ignore" },
          ).status,
        ).toBe(0);
        adminUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
      } else {
        if (!sharedFixtures.has(adminUrl))
          throw new Error(
            "Support workspace PostgreSQL proof requires an exact owned fixture URL",
          );
        port = Number(new URL(adminUrl).port || 5432);
      }
      admin = new Pool({ connectionString: adminUrl });
      const parsedAdmin = new URL(adminUrl),
        database = parsedAdmin.pathname.slice(1);
      const identity = await admin.query<{
        db: string;
        host: string;
        port: number;
      }>(
        "select current_database() db,host(inet_server_addr()) host,inet_server_port() port",
      );
      expect(identity.rows[0]?.db).toBe(database);
      expect(identity.rows[0]?.port).toBe(port);
      const serverHost = identity.rows[0]?.host ?? "";
      const loopback = serverHost === "127.0.0.1" || serverHost === "::1";
      const privateNetwork =
        loopback ||
        /^10\./.test(serverHost) ||
        /^192\.168\./.test(serverHost) ||
        /^172\.(?:1[6-9]|2\d|3[01])\./.test(serverHost);
      expect(adminUrl === ciFixture ? privateNetwork : loopback).toBe(true);
      expect(
        (
          await admin.query(
            "SELECT 1 FROM pg_namespace WHERE nspname='supportv8'",
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await admin.query(
            "SELECT 1 FROM pg_roles WHERE rolname IN ('support_app','support_reader')",
          )
        ).rowCount,
      ).toBe(0);
      if (sharedFixtures.has(adminUrl))
        expect(
          Number(
            (
              await admin.query(
                "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')",
              )
            ).rows[0].count,
          ),
        ).toBe(0);
      await admin.query(
        "CREATE ROLE support_app LOGIN PASSWORD 'support-workspace-test'",
      );
      supportAppCreated = true;
      await admin.query(
        "CREATE ROLE support_reader LOGIN PASSWORD 'support-workspace-test'",
      );
      supportReaderCreated = true;
      await admin.query(
        `GRANT CREATE ON DATABASE "${database}" TO support_app`,
      );
      await admin.query(
        "SET ROLE support_app; CREATE SCHEMA supportv8 AUTHORIZATION support_app; RESET ROLE",
      );
      schemaCreated = true;
      await admin.query(
        "SET ROLE support_app; CREATE FUNCTION supportv8.current_tenant_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('app.current_tenant_id',true) $$; CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain varchar(128) UNIQUE NOT NULL,name varchar(255) NOT NULL,operating_mode varchar(32) NOT NULL DEFAULT 'autonomous',servicev8_account_id varchar(128),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()); CREATE UNIQUE INDEX uq_supportv8_tenants_servicev8_account ON supportv8.tenants(servicev8_account_id) WHERE servicev8_account_id IS NOT NULL; RESET ROLE",
      );
      const emailMigration = await readFile(
        new URL(
          "../migrations/004_email_channel_bindings.sql",
          import.meta.url,
        ),
        "utf8",
      );
      const migration = await readFile(
        new URL(
          "../migrations/005_runtime_support_workspaces.sql",
          import.meta.url,
        ),
        "utf8",
      );
      await admin.query("SET ROLE support_app");
      await admin.query(emailMigration);
      await admin.query(migration);
      await admin.query("RESET ROLE");
      // Lifecycle functions need the migration administrator as owner, as in
      // deployment; the fixture app receives only the runtime permissions.
      for (const name of [
        "008_managed_support_registration_jobs.sql",
        "009_managed_support_permanent_lifecycle.sql",
      ]) {
        await admin.query(
          await readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
        );
      }
      await admin.query(
        "GRANT SELECT,INSERT ON supportv8.managed_support_registration_jobs TO support_app; GRANT EXECUTE ON FUNCTION supportv8.claim_managed_support_registration_jobs(varchar,integer),supportv8.finish_managed_support_registration_job(varchar,varchar,varchar,uuid,varchar,timestamptz),supportv8.observe_managed_support_lifecycle(varchar,varchar) TO support_app",
      );
      await admin.query(
        "GRANT USAGE ON SCHEMA supportv8 TO support_reader; GRANT SELECT,UPDATE,DELETE ON supportv8.runtime_support_workspaces TO support_reader",
      );
      const parsed = new URL(adminUrl);
      parsed.username = "support_app";
      parsed.password = "support-workspace-test";
      app = new Pool({ connectionString: parsed.toString(), max: 8 });
      store = new RuntimeSupportWorkspaceStore(
        new PostgresClient(undefined, app),
      );
    }, 30000);
    afterAll(async () => {
      await app?.end();
      if (admin) {
        const database = new URL(adminUrl).pathname.slice(1);
        if (schemaCreated) await admin.query("DROP SCHEMA supportv8 CASCADE");
        if (supportReaderCreated) await admin.query("DROP ROLE support_reader");
        if (supportAppCreated) {
          await admin.query(
            `REVOKE CREATE ON DATABASE "${database}" FROM support_app`,
          );
          await admin.query("DROP ROLE support_app");
        }
        await admin.end();
      }
      if (dir) {
        spawnSync("pg_ctl", ["-D", dir, "-m", "fast", "-w", "stop"]);
        await rm(dir, { recursive: true, force: true });
      }
    });

    it("is stable across retry, restart, and concurrency while allowing two Registry tenants in one account", async () => {
      const input = base("one"),
        [a, b] = await Promise.all([
          store.acquire(input),
          store.acquire(input),
        ]);
      expect(a).toEqual(b);
      const parsed = new URL(adminUrl);
      parsed.username = "support_app";
      parsed.password = "support-workspace-test";
      const restartedPool = new Pool({ connectionString: parsed.toString() });
      expect(
        await new RuntimeSupportWorkspaceStore(
          new PostgresClient(undefined, restartedPool),
        ).acquire(input),
      ).toEqual(a);
      await restartedPool.end();
      expect((await store.acquire(base("two"))).workspaceId).not.toBe(
        a.workspaceId,
      );
      expect(
        (
          await admin.query(
            "SELECT indexname FROM pg_indexes WHERE schemaname='supportv8' AND indexname='uq_supportv8_tenants_servicev8_account'",
          )
        ).rowCount,
      ).toBe(0);
    });
    it("rejects changed scope, operation reuse, native/domain collision, rollback retry, and tombstone resurrection", async () => {
      const input = base("conflict");
      const made = await store.acquire(input);
      for (const changed of [
        { ...input, accountId: "changed-account" },
        { ...input, registryTenantId: "changed-registry" },
        { ...input, installationId: "changed-installation" },
        { ...input, operationId: "changed-operation" },
        { ...input, tenantDomain: "changed.support.test" },
        { ...input, subject: "changed-subject" },
        { ...input, companyDisplayName: "Changed Company" },
      ])
        await expect(store.acquire(changed)).rejects.toBeInstanceOf(
          WorkspaceReservationConflictError,
        );
      await expect(
        store.acquire(
          base("other-install", { operationId: input.operationId }),
        ),
      ).rejects.toBeInstanceOf(WorkspaceReservationConflictError);
      await admin.query(
        "SET ROLE support_app; INSERT INTO supportv8.tenants VALUES('tenant_collision','collision.support.test','collision','autonomous','another-account'); RESET ROLE",
      );
      await expect(store.acquire(base("collision"))).rejects.toBeInstanceOf(
        WorkspaceReservationConflictError,
      );
      expect(
        (
          await admin.query(
            "SELECT 1 FROM supportv8.runtime_support_workspaces WHERE installation_id='install-collision'",
          )
        ).rowCount,
      ).toBe(0);
      await app.query(
        "DELETE FROM supportv8.tenants WHERE id='tenant_collision'",
      );
      expect(await store.acquire(base("collision"))).toMatchObject({
        status: "workspace_created",
        domain: "collision.support.test",
      });
      const nativeInput = base("native-collision"),
        nativeDigest = createHash("sha256")
          .update(
            `${nativeInput.accountId}\0${nativeInput.registryTenantId}\0${nativeInput.installationId}`,
          )
          .digest("hex"),
        nativeId = `tenant_rt_${nativeDigest.slice(0, 48)}`;
      await app.query(
        "INSERT INTO supportv8.tenants VALUES($1,'unrelated.support.test','collision','autonomous','another-account')",
        [nativeId],
      );
      await expect(store.acquire(nativeInput)).rejects.toBeInstanceOf(
        WorkspaceReservationConflictError,
      );
      expect(
        (
          await admin.query(
            "SELECT 1 FROM supportv8.runtime_support_workspaces WHERE installation_id=$1",
            [nativeInput.installationId],
          )
        ).rowCount,
      ).toBe(0);
      const c = await app.connect();
      try {
        await c.query("BEGIN");
        await c.query(
          "SELECT set_config('app.current_tenant_id',$1,true),set_config('app.current_account_id',$2,true),set_config('app.current_registry_tenant_id',$3,true)",
          [made.workspaceId, input.accountId, input.registryTenantId],
        );
        await c.query(
          "UPDATE supportv8.runtime_support_workspaces SET state='tombstoned',deleted_at=now() WHERE installation_id=$1",
          [input.installationId],
        );
        await c.query("COMMIT");
      } finally {
        c.release();
      }
      await expect(store.acquire(input)).rejects.toBeInstanceOf(
        WorkspaceReservationConflictError,
      );
      const tombstoneClient = await app.connect();
      try {
        await tombstoneClient.query("BEGIN");
        await tombstoneClient.query(
          "SELECT set_config('app.current_tenant_id',$1,true),set_config('app.current_account_id',$2,true),set_config('app.current_registry_tenant_id',$3,true)",
          [made.workspaceId, input.accountId, input.registryTenantId],
        );
        await expect(
          tombstoneClient.query(
            "UPDATE supportv8.runtime_support_workspaces SET state='workspace_created',deleted_at=NULL WHERE installation_id=$1",
            [input.installationId],
          ),
        ).rejects.toThrow(/invalid runtime support workspace state transition/);
        await tombstoneClient.query("ROLLBACK");
      } finally {
        tombstoneClient.release();
      }
    });
    it("enforces restricted-role RLS and immutable identity guards", async () => {
      const input = base("rls"),
        made = await store.acquire(input);
      const parsed = new URL(adminUrl);
      parsed.username = "support_reader";
      parsed.password = "support-workspace-test";
      const reader = new Pool({ connectionString: parsed.toString() });
      const scoped = async (
        account: string | undefined,
        registry: string | undefined,
        sql: string,
        tenantId = made.workspaceId,
      ) => {
        const c = await reader.connect();
        try {
          await c.query("BEGIN");
          if (tenantId)
            await c.query(
              "SELECT set_config('app.current_tenant_id',$1,true)",
              [tenantId],
            );
          if (account)
            await c.query(
              "SELECT set_config('app.current_account_id',$1,true)",
              [account],
            );
          if (registry)
            await c.query(
              "SELECT set_config('app.current_registry_tenant_id',$1,true)",
              [registry],
            );
          const r = await c.query(sql);
          await c.query("ROLLBACK");
          return r;
        } catch (error) {
          await c.query("ROLLBACK").catch(() => undefined);
          throw error;
        } finally {
          c.release();
        }
      };
      expect(
        (
          await scoped(
            input.accountId,
            input.registryTenantId,
            "SELECT * FROM supportv8.runtime_support_workspaces",
          )
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await scoped(
            "wrong",
            input.registryTenantId,
            "SELECT * FROM supportv8.runtime_support_workspaces",
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await scoped(
            input.accountId,
            "wrong",
            "SELECT * FROM supportv8.runtime_support_workspaces",
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await scoped(
            input.accountId,
            input.registryTenantId,
            "SELECT * FROM supportv8.runtime_support_workspaces",
            "tenant_wrong_native",
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await scoped(
            undefined,
            undefined,
            "SELECT * FROM supportv8.runtime_support_workspaces",
            "",
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await scoped(
            "wrong",
            input.registryTenantId,
            "UPDATE supportv8.runtime_support_workspaces SET updated_at=now()",
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await scoped(
            input.accountId,
            "wrong",
            "UPDATE supportv8.runtime_support_workspaces SET updated_at=now()",
          )
        ).rowCount,
      ).toBe(0);
      await expect(
        scoped(
          input.accountId,
          input.registryTenantId,
          "UPDATE supportv8.runtime_support_workspaces SET account_id='changed'",
        ),
      ).rejects.toThrow(/immutable/);
      await expect(
        scoped(
          input.accountId,
          input.registryTenantId,
          "UPDATE supportv8.runtime_support_workspaces SET state='reserved'",
        ),
      ).rejects.toThrow(/invalid runtime support workspace state transition/);
      await expect(
        scoped(
          input.accountId,
          input.registryTenantId,
          "DELETE FROM supportv8.runtime_support_workspaces",
        ),
      ).rejects.toThrow(/must be tombstoned/);
      await expect(
        app.query(
          "UPDATE supportv8.tenants SET domain='drift.support.test' WHERE id=$1",
          [made.workspaceId],
        ),
      ).rejects.toThrow(/foreign key constraint/);
      await expect(
        app.query(
          "UPDATE supportv8.tenants SET servicev8_account_id='drift-account' WHERE id=$1",
          [made.workspaceId],
        ),
      ).rejects.toThrow(/foreign key constraint/);
      await expect(
        app.query("DELETE FROM supportv8.tenants WHERE id=$1", [
          made.workspaceId,
        ]),
      ).rejects.toThrow(/foreign key constraint/);
      expect(await store.acquire(input)).toEqual(made);
      await reader.end();
    });
    it("keeps real native signup and account binding compatible after account uniqueness removal", async () => {
      const client = new PostgresClient(undefined, app),
        signup = new PostgresTenantReservationBackend(client),
        repository = new ChatRepository(client);
      const tenantId = "tenant_native_compat",
        accountId = "acct-shared";
      await store.acquire(base("native-compat-runtime"));
      expect(
        await signup.reserve({
          tenantId,
          tenantSlug: "native-compat.support.test",
          name: "Native compatibility",
          operatingMode: "copilot",
        }),
      ).toBe(true);
      await repository.validateAndBindEmailChannel({
        tenantId,
        accountId,
        connectionId: "connection-native",
        connectorKey: "email.resend.support",
        recipient: "Native@Support.Test",
        eventId: "event-native",
      });
      const tenant = await app.query(
        "SELECT servicev8_account_id FROM supportv8.tenants WHERE id=$1",
        [tenantId],
      );
      const binding = await client.withTenantSession(tenantId, (db) =>
        db.query<{ servicev8_account_id: string; recipient: string }>(
          "SELECT servicev8_account_id,recipient FROM supportv8.email_channel_bindings WHERE tenant_id=$1",
          [tenantId],
        ),
      );
      expect(tenant.rows).toEqual([{ servicev8_account_id: accountId }]);
      expect(binding).toEqual([
        { servicev8_account_id: accountId, recipient: "native@support.test" },
      ]);
      expect(
        Number(
          (
            await app.query(
              "SELECT count(*) FROM supportv8.tenants WHERE servicev8_account_id=$1",
              [accountId],
            )
          ).rows[0].count,
        ),
      ).toBeGreaterThan(1);
      await signup.release(tenantId);
    });
  },
);

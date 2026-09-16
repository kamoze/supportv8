import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresClient } from "@/lib/db/pg-client";
import { RuntimeSupportWorkspaceStore } from "@/lib/service-app/workspace-reservation";
import { ManagedSupportAuthority } from "@/lib/service-app/managed-support-authority";
import { ManagedSupportRegistrationStore } from "@/lib/service-app/managed-support-registration-store";

const url = process.env.SUPPORT_MANAGED_PERMANENT_TEST_DATABASE_URL ?? "";
describe.skipIf(!url)(
  "managed Support registration genuine PostgreSQL lifecycle",
  () => {
    let admin: Pool, app: Pool;
    let rolesCreated = false,
      schemaCreated = false;
    beforeAll(async () => {
      const parsed = new URL(url);
      if (
        parsed.hostname !== "127.0.0.1" ||
        parsed.port !== "53097" ||
        parsed.pathname !== "/support_managed_permanent_test"
      )
        throw new Error("exact owned lifecycle fixture required");
      admin = new Pool({ connectionString: url });
      const identity = (
        await admin.query(
          "select current_database() db,host(inet_server_addr()) host,inet_server_port() port",
        )
      ).rows[0];
      expect(identity).toMatchObject({
        db: "support_managed_permanent_test",
        host: "127.0.0.1",
        port: 53097,
      });
      expect(
        Number(
          (
            await admin.query(
              "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')",
            )
          ).rows[0].count,
        ),
      ).toBe(0);
      expect(
        Number(
          (
            await admin.query(
              "select count(*) from pg_roles where rolname in ('supportv8_app','support_managed_permanent_public')",
            )
          ).rows[0].count,
        ),
      ).toBe(0);
      await admin.query(
        "create role supportv8_app login; create role support_managed_permanent_public login",
      );
      rolesCreated = true;
      await admin.query(
        "create schema supportv8; create table supportv8.tenants(id varchar(64) primary key,domain varchar(128) unique not null,name varchar(255) not null,operating_mode varchar(32) not null default 'autonomous',servicev8_account_id varchar(128),created_at timestamptz default now(),updated_at timestamptz default now())",
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
        "grant usage on schema supportv8 to supportv8_app,support_managed_permanent_public; grant select,insert,update on supportv8.runtime_support_workspaces,supportv8.tenants to supportv8_app",
      );
      await admin.query(
        "insert into supportv8.tenants(id,domain,name,servicev8_account_id) values('tenant_backfill','backfill.test','Backfill','account-a'); insert into supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state) values('install-backfill','acq-backfill','account-a','registry-a','runtime','backfill.test','owner','tenant_backfill','backfill.test','workspace_created')",
      );
      await admin.query(
        await readFile(
          new URL(
            "../migrations/008_managed_support_registration_jobs.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await admin.query(
        await readFile(
          new URL(
            "../migrations/009_managed_support_permanent_lifecycle.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const appUrl = new URL(url);
      appUrl.username = "supportv8_app";
      app = new Pool({ connectionString: appUrl.toString(), max: 8 });
    }, 30000);
    afterAll(async () => {
      await app?.end();
      if (admin) {
        if (schemaCreated) await admin.query("drop schema supportv8 cascade");
        if (rolesCreated)
          await admin.query(
            "drop role support_managed_permanent_public; drop role supportv8_app",
          );
        await admin.end();
      }
    });
    it("backfills, atomically enqueues/replays, and denies public execution", async () => {
      expect(
        (
          await admin.query(
            "select state from supportv8.managed_support_registration_jobs where installation_id='install-backfill'",
          )
        ).rows[0].state,
      ).toBe("pending");
      const outsider = new URL(url);
      outsider.username = "support_managed_permanent_public";
      const publicPool = new Pool({ connectionString: outsider.toString() });
      await expect(
        publicPool.query(
          "select * from supportv8.claim_managed_support_registration_jobs('outsider',1)",
        ),
      ).rejects.toThrow(/permission denied/);
      await publicPool.end();
      const role = (
        await app.query(
          "select rolsuper,rolbypassrls from pg_roles where rolname=current_user",
        )
      ).rows[0];
      expect(role).toEqual({ rolsuper: false, rolbypassrls: false });
      await admin.query(
        "revoke insert on supportv8.managed_support_registration_jobs from supportv8_app",
      );
      const store = new RuntimeSupportWorkspaceStore(
        new PostgresClient(undefined, app),
      );
      const input = {
        accountId: "account-rollback",
        registryTenantId: "registry-rollback",
        installationId: "install-rollback",
        operationId: "acq-rollback",
        tenantDomain: "rollback.test",
        subject: "owner",
        verticalId: "runtime" as const,
      };
      await expect(store.acquire(input)).rejects.toThrow();
      expect(
        Number(
          (
            await admin.query(
              "select count(*) from supportv8.runtime_support_workspaces where installation_id='install-rollback'",
            )
          ).rows[0].count,
        ),
      ).toBe(0);
      await admin.query(
        "grant insert on supportv8.managed_support_registration_jobs to supportv8_app",
      );
      await store.acquire(input);
      await admin.query(
        "update supportv8.managed_support_registration_jobs set state='conflict',attempt_count=7 where installation_id='install-rollback'",
      );
      await store.acquire(input);
      expect(
        (
          await admin.query(
            "select state,attempt_count from supportv8.managed_support_registration_jobs where installation_id='install-rollback'",
          )
        ).rows[0],
      ).toEqual({ state: "conflict", attempt_count: 7 });
    });
    it("claims fairly without duplicates and recovers an expired lease after restart", async () => {
      for (const [suffix, account] of [
        ["a1", "account-a"],
        ["a2", "account-a"],
        ["a3", "account-a"],
        ["b1", "account-b"],
      ]) {
        await admin.query(
          "insert into supportv8.tenants(id,domain,name,servicev8_account_id) values($1,$2,$2,$3)",
          ["tenant_" + suffix, suffix + ".test", account],
        );
        await admin.query(
          "insert into supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state) values($1,$2,$3,$4,'runtime',$5,'owner',$6,$5,'workspace_created')",
          [
            "install-" + suffix,
            "acq-" + suffix,
            account,
            "registry-" + suffix,
            suffix + ".test",
            "tenant_" + suffix,
          ],
        );
        await admin.query(
          "insert into supportv8.managed_support_registration_jobs(installation_id,acquisition_id,account_id,registry_tenant_id,vertical_id,native_workspace_id) values($1,$2,$3,$4,'runtime',$5)",
          [
            "install-" + suffix,
            "acq-" + suffix,
            account,
            "registry-" + suffix,
            "tenant_" + suffix,
          ],
        );
      }
      const lifecycleUrl = new URL(url);
      lifecycleUrl.username = "supportv8_app";
      const first = new ManagedSupportRegistrationStore(
          lifecycleUrl.toString(),
        ),
        second = new ManagedSupportRegistrationStore(lifecycleUrl.toString());
      const [one, two] = await Promise.all([
        first.claim("worker-one", 3),
        second.claim("worker-two", 3),
      ]);
      const ids = [...one, ...two].map((x) => x.installationId);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...one, ...two].some((x) => x.accountId === "account-b")).toBe(
        true,
      );
      const leased = one[0] ?? two[0];
      expect(leased).toBeTruthy();
      await admin.query(
        "update supportv8.managed_support_registration_jobs set lease_expires_at=now()-interval '1 second' where installation_id=$1",
        [leased.installationId],
      );
      await first.close();
      await second.close();
      const restarted = new ManagedSupportRegistrationStore(
        lifecycleUrl.toString(),
      );
      expect(
        (await restarted.claim("worker-restarted", 8)).some(
          (x) => x.installationId === leased.installationId,
        ),
      ).toBe(true);
      await restarted.close();
    });
    it("ready revisits, lease-fenced tombstones, generation persistence and no resurrection", async () => {
      // Earlier claims are released only by expiry, mimicking crashed workers.
      await admin.query(
        "update supportv8.managed_support_registration_jobs set lease_expires_at=now()-interval '1 second',next_attempt_at=now(),state='ready' where state<>'conflict'",
      );
      const appUrl = new URL(url);
      appUrl.username = "supportv8_app";
      const store = new ManagedSupportRegistrationStore(appUrl.toString());
      const jobs = await store.claim("lifecycle-observer", 8);
      expect(jobs.length).toBeGreaterThan(0);
      const job = jobs[0];
      expect(
        (await store.observe("lifecycle-observer", job.installationId))
          .observedGeneration,
      ).toBe(0);
      await admin.query(
        "update supportv8.runtime_support_workspaces set state='tombstoned',deleted_at=now() where installation_id=$1",
        [job.installationId],
      );
      await expect(
        store.observe("wrong-worker", job.installationId),
      ).rejects.toThrow(/lease lost/);
      const results = await Promise.all([
        store.observe("lifecycle-observer", job.installationId),
        store.observe("lifecycle-observer", job.installationId),
      ]);
      expect(
        results.every(
          (x) => x.observedGeneration === 1 && x.state === "revocation_pending",
        ),
      ).toBe(true);
      const owner = new ManagedSupportAuthority({
        client: new PostgresClient(undefined, app),
        get: async () => {
          throw Error("Registry offline");
        },
      });
      const target = {
        accountId: job.accountId,
        tenantId: job.registryTenantId,
        installationId: job.installationId,
        verticalId: job.verticalId,
        workspaceId: job.workspaceId,
      };
      expect(await owner.lifecycle(target)).toMatchObject({
        decision: "permanently_revoked",
        observedGeneration: 1,
        reasonCode: "workspace_tombstoned",
      });
      for (const drift of [
        { accountId: "foreign" },
        { tenantId: "foreign" },
        { installationId: "foreign" },
        { workspaceId: "tenant_foreign" },
      ])
        await expect(
          owner.lifecycle({ ...target, ...drift }),
        ).rejects.toThrow();
      await expect(
        admin.query(
          "update supportv8.managed_support_registration_jobs set observed_generation=2 where installation_id=$1",
          [job.installationId],
        ),
      ).rejects.toThrow();
      await expect(
        admin.query(
          "update supportv8.managed_support_registration_jobs set applied_generation=2 where installation_id=$1",
          [job.installationId],
        ),
      ).rejects.toThrow();
      await store.finish("lifecycle-observer", job.installationId, {
        state: "ready",
        nextAttemptAt: new Date(0).toISOString(),
      });
      await store.close();
      const restarted = new ManagedSupportRegistrationStore(appUrl.toString());
      const recovered = (await restarted.claim("restarted-lifecycle", 8)).find(
        (x) => x.installationId === job.installationId,
      )!;
      expect(recovered.state).toBe("revocation_pending");
      expect(recovered.observedGeneration).toBe(1);
      await restarted.finish("restarted-lifecycle", job.installationId, {
        state: "revoked",
        connectionId: "11111111-1111-8111-8111-111111111111",
      });
      const row = (
        await admin.query(
          "select observed_generation,applied_generation,state from supportv8.managed_support_registration_jobs where installation_id=$1",
          [job.installationId],
        )
      ).rows[0];
      expect(row).toEqual({
        observed_generation: 1,
        applied_generation: 1,
        state: "revoked",
      });
      await expect(
        admin.query(
          "update supportv8.managed_support_registration_jobs set state='ready',desired_state='active',observed_generation=0,applied_generation=0 where installation_id=$1",
          [job.installationId],
        ),
      ).rejects.toThrow();
      await expect(
        admin.query(
          "update supportv8.runtime_support_workspaces set state='workspace_created',deleted_at=null where installation_id=$1",
          [job.installationId],
        ),
      ).rejects.toThrow();
      await expect(
        admin.query(
          "update supportv8.managed_support_registration_jobs set connection_id='22222222-2222-8222-8222-222222222222' where installation_id=$1",
          [job.installationId],
        ),
      ).rejects.toThrow();
      await restarted.close();
    });
  },
);

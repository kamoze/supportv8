import { it, expect } from "vitest";
import { Pool } from "pg";
import { PostgresClient } from "@/lib/db/pg-client";
import {
  ManagedSupportTicketReader,
  ManagedSupportAuthority,
} from "@/lib/service-app/managed-support-authority";
import { readFile } from "node:fs/promises";
const url = process.env.MANAGED_SUPPORT_TEST_DATABASE_URL;
it.skipIf(!url)(
  "real PostgreSQL enforces tenant-local exact reference lookup, ambiguity denial and immutable native mapping",
  async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "53097" ||
      parsed.pathname !== "/support_managed_bridge_test" ||
      parsed.search ||
      parsed.hash
    )
      throw Error("owned fixture required");
    const admin = new Pool({ connectionString: url });
    let app: Pool | undefined;
    let created = false;
    const role = "support_managed_fixture_reader";
    try {
      expect(
        (await admin.query("SELECT current_database() name")).rows[0].name,
      ).toBe("support_managed_bridge_test");
      expect(
        (
          await admin.query(
            "SELECT 1 FROM pg_namespace WHERE nspname='supportv8'",
          )
        ).rowCount,
      ).toBe(0);
      await admin.query(
        `CREATE SCHEMA supportv8; CREATE ROLE ${role} LOGIN; CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain varchar(128) UNIQUE,name text,servicev8_account_id varchar(128)); CREATE TABLE supportv8.issues(id text PRIMARY KEY,tenant_id varchar(64) REFERENCES supportv8.tenants(id),source text,external_id text,source_status text,priority text,summary text); ALTER TABLE supportv8.issues ENABLE ROW LEVEL SECURITY;ALTER TABLE supportv8.issues FORCE ROW LEVEL SECURITY;CREATE POLICY tenant_isolation_issues ON supportv8.issues USING(tenant_id=current_setting('app.current_tenant_id',true));`,
      );
      created = true;
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
        `INSERT INTO supportv8.tenants VALUES ('tenant_support_test','test','test','account-test'),('tenant_other_test','other','other','account-other');INSERT INTO supportv8.issues VALUES ('one','tenant_support_test','email','CASE-7','open','normal','private'),('two','tenant_other_test','email','CASE-7','closed','high','other private'),('three','tenant_other_test','email','OTHER-8','closed','high','other private');INSERT INTO supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state) VALUES ('support-install','operation-test','account-test','registry-test','runtime','test','member-test','tenant_support_test','test','workspace_created');GRANT USAGE ON SCHEMA supportv8 TO ${role};GRANT SELECT ON ALL TABLES IN SCHEMA supportv8 TO ${role};`,
      );
      parsed.username = role;
      parsed.password = "";
      app = new Pool({ connectionString: parsed.toString() });
      const client = new PostgresClient(undefined, app),
        reader = new ManagedSupportTicketReader(client);
      const target = {
        accountId: "account-test",
        tenantId: "registry-test",
        verticalId: "runtime" as const,
        installationId: "support-install",
        workspaceId: "tenant_support_test",
      };
      expect(await reader.lookup(target, "CASE-7")).toEqual({
        ticketRef: "CASE-7",
        status: "open",
        priority: "normal",
      });
      expect(await reader.lookup(target, "OTHER-8")).toBeNull();
      expect(
        await client.withTenantSession(target.workspaceId, (db) =>
          db.query("SELECT id FROM supportv8.issues"),
        ),
      ).toEqual([{ id: "one" }]);
      await admin.query(
        "INSERT INTO supportv8.issues VALUES ('duplicate','tenant_support_test','chat','CASE-7','open','urgent','private')",
      );
      expect(await reader.lookup(target, "CASE-7")).toBeNull();
      const projection = {
        ...target,
        productKind: "service_app",
        productId: "servicev8.service-app.supportv8",
        productVersion: "1.0.0",
        entitlementStatus: "active",
        installationState: "active",
        serviceAppReadiness: { state: "ready" },
        serviceAppPlanAccess: { state: "included" },
        serviceAppBinding: {
          schemaVersion: "servicev8.service-app-binding.v1",
          appKey: "supportv8",
          externalWorkspaceId: target.workspaceId,
          poolAccountId: target.accountId,
          provisioningState: "provisioned",
          poolBindingState: "verified",
        },
      };
      const authority = new ManagedSupportAuthority({
        client,
        get: async () => ({ installations: [projection] }),
      });
      expect(await authority.verify(target)).toBe(true);
      expect(
        await new ManagedSupportAuthority({
          client,
          get: async () => ({
            installations: [
              {
                ...projection,
                accountId: "account-other",
                serviceAppBinding: {
                  ...projection.serviceAppBinding,
                  poolAccountId: "account-other",
                },
              },
            ],
          }),
        }).verify({ ...target, accountId: "account-other" }),
      ).toBe(false);
    } finally {
      await app?.end();
      if (created) {
        await admin.query("DROP SCHEMA supportv8 CASCADE");
        await admin.query(`DROP ROLE ${role}`);
      }
      await admin.end();
    }
  },
  30000,
);

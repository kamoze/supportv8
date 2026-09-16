import { generateKeyPair, SignJWT } from "jose";
import { handleManagedSupport } from "@/lib/service-app/managed-support";
import { createManagedSupportAuthenticator } from "@/lib/service-app/managed-support-auth";
import {
  invocation,
  disclosure,
  policy,
  projection as ownerProjection,
  member,
  ownerEnv,
} from "./managed-support-source-fixture";
import { it, expect } from "vitest";
import { Pool } from "pg";
import { PostgresClient } from "@/lib/db/pg-client";
import {
  ManagedSupportTicketReader,
  ManagedSupportAuthority,
} from "@/lib/service-app/managed-support-authority";
import { readFile } from "node:fs/promises";
const url = process.env.MANAGED_SUPPORT_SOURCE_TEST_DATABASE_URL;
it.skipIf(!url)(
  "real PostgreSQL enforces tenant-local exact reference lookup, ambiguity denial and immutable native mapping",
  async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== "127.0.0.1" ||
      parsed.port !== "53097" ||
      parsed.pathname !== "/support_managed_source_test" ||
      parsed.search ||
      parsed.hash
    )
      throw Error("owned fixture required");
    const admin = new Pool({ connectionString: url });
    let app: Pool | undefined;
    let created = false;
    const role = "support_managed_source_reader";
    try {
      expect(
        (await admin.query("SELECT current_database() name")).rows[0].name,
      ).toBe("support_managed_source_test");
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
      const inv = invocation(),
        disc = disclosure("history_replay");
      let pending = true,
        memberRole = "STAFF",
        registryAvailable = true;
      const request: typeof fetch = async (url) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("token"))
          return Response.json({
            access_token: "fixture-workload",
            token_type: "Bearer",
            expires_in: 120,
          });
        if (path === "/internal/support-invocations/verify")
          return pending
            ? Response.json({ ok: true, invocation: inv })
            : new Response("{}", { status: 403 });
        if (path === "/internal/support-disclosures/verify")
          return Response.json({ ok: true, disclosure: disc });
        if (!registryAvailable) return new Response("{}", { status: 503 });
        if (path.endsWith("/configured")) return Response.json(policy());
        if (path.includes("/memberships/"))
          return Response.json({ ...member, role: memberRole });
        return Response.json({ installations: [ownerProjection] });
      };
      const sourceAuthority = new ManagedSupportAuthority({
        client,
        env: ownerEnv,
        request,
      });
      const { publicKey, privateKey } = await generateKeyPair("RS256");
      const authenticate = createManagedSupportAuthenticator({
        issuer: "https://keycloak.test",
        allowedClientIds: ["gateway-support"],
        allowedDataClientIds: ["gateway-support"],
        key: publicKey,
      });
      const signed = async (scope: string) =>
        new SignJWT({ azp: "gateway-support", scope })
          .setProtectedHeader({ alg: "RS256" })
          .setIssuer("https://keycloak.test")
          .setAudience("supportv8")
          .setSubject("service-account")
          .setJti("fixture")
          .setIssuedAt()
          .setExpirationTime("2m")
          .sign(privateKey);
      const call = async (output = false) =>
        handleManagedSupport(
          new Request(
            "https://support.test/internal/service-apps/support/invoke",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${await signed(output ? "supportv8:output:authorize" : "supportv8:tickets:read")}`,
              },
              body: JSON.stringify({
                target,
                operation: output
                  ? "support_output_access"
                  : "support_ticket_lookup",
                source: output
                  ? {
                      kind: "runtime",
                      disclosureId: disc.disclosureId,
                      digest: disc.digest,
                    }
                  : {
                      kind: "runtime",
                      invocationId: inv.invocationId,
                      digest: inv.digest,
                    },
                ...(!output ? { parameters: { ticketRef: "CASE-7" } } : {}),
              }),
            },
          ),
          {
            authenticate,
            verify: sourceAuthority.verify.bind(sourceAuthority),
            verifySource: sourceAuthority.verifySource.bind(sourceAuthority),
            lookup: reader.lookup.bind(reader),
          },
        );
      const result = await call();
      expect(result.status).toBe(200);
      expect(await result.json()).toEqual({
        ok: true,
        target,
        ticket: { reference: "CASE-7", status: "open", priority: "normal" },
      });
      pending = false;
      expect((await call()).status).toBe(403);
      expect((await call(true)).status).toBe(200);
      // SQL permission denial proves output access never reads native ticket data.
      await admin.query(
        "REVOKE SELECT ON supportv8.issues FROM support_managed_source_reader",
      );
      expect((await call(true)).status).toBe(200);
      pending = true;
      expect((await call()).status).toBe(503);
      await admin.query(
        "GRANT SELECT ON supportv8.issues TO support_managed_source_reader",
      );
      memberRole = "UNKNOWN";
      expect((await call()).status).toBe(403);
      expect((await call(true)).status).toBe(403);
      memberRole = "STAFF";
      registryAvailable = false;
      expect((await call()).status).toBe(403);
      expect((await call(true)).status).toBe(403);
      registryAvailable = true;
      await admin.query(
        "INSERT INTO supportv8.issues VALUES ('duplicate','tenant_support_test','chat','CASE-7','open','urgent','private')",
      );
      expect((await call()).status).toBe(404);
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

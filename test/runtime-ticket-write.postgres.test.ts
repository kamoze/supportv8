import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PostgresClient } from "@/lib/db/pg-client";
import {
  resolveOperationalSupportAccess,
  type SupportRuntimeScope,
} from "@/lib/service-app/runtime-access";
import { SupportAccessProjectionStore } from "@/lib/service-app/runtime-access-projection-store";
import { mapWorkspaceAccess, type AccessMembership } from "@/lib/service-app/runtime-access-projection";
import { RuntimeSupportTicketReader } from "@/lib/service-app/runtime-ticket-reader";

const enabled = process.env.SUPPORTV8_REAL_POSTGRES === "1";
const localFixture =
  "postgres://postgres@127.0.0.1:52996/support_runtime_rbac_test";
const sequenceFixture =
  "postgres://postgres@127.0.0.1:52996/support_runtime_rbac_test";
const ciFixture =
  "postgresql://postgres:support-workspace-test@127.0.0.1:5432/postgres";
function ownedDatabase(value: string): {
  url: string;
  database: string;
  port: number;
  serverHost: (value: string) => boolean;
} {
  if (
    value !== localFixture &&
    value !== sequenceFixture &&
    value !== ciFixture
  )
    throw new Error(
      "Runtime ticket write PostgreSQL proof requires an exact owned fixture URL",
    );
  const parsed = new URL(value);
  if (
    parsed.search ||
    parsed.hash ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.username !== "postgres"
  )
    throw new Error(
      "Runtime ticket write PostgreSQL proof requires an exact owned fixture URL",
    );
  const loopback = (host: string) => host === "127.0.0.1" || host === "::1";
  const privateNetwork = (host: string) =>
    loopback(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host);
  return {
    url: value,
    database: parsed.pathname.slice(1),
    port: Number(parsed.port),
    serverHost: value === ciFixture ? privateNetwork : loopback,
  };
}
describe("Runtime Support PostgreSQL fixture safety gate", () => {
  it.each([
    `${localFixture}?sslmode=disable`,
    `${localFixture}#fragment`,
    "postgres://other@127.0.0.1:52996/support_runtime_rbac_test",
    "postgres://postgres@database.example:52996/support_runtime_rbac_test",
    "postgres://postgres@127.0.0.1:52996/postgres",
  ])("rejects non-owned destination %s", (value) =>
    expect(() => ownedDatabase(value)).toThrow("exact owned fixture URL"),
  );
});
describe.skipIf(!enabled)(
  "Runtime Support ticket write genuine PostgreSQL boundary",
  () => {
    let admin: Pool, app: Pool, client: PostgresClient;
    let schemaCreated = false,
      readerCreated = false;
    const readerRole = "support_runtime_rbac_fixture_v1";
    const databaseUrl = process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL ?? "";
    const workspaceId =
      "tenant_rt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const otherWorkspaceId =
      "tenant_rt_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const scope: SupportRuntimeScope = {
      accountId: "acct-synthetic",
      tenantId: "registry-synthetic",
      verticalId: "runtime",
      installationId: "install-synthetic",
      workspaceId,
      subject: "current-admin",
    };
    const projection = {
      accountId: scope.accountId,
      tenantId: scope.tenantId,
      verticalId: "runtime",
      installationId: scope.installationId,
      principalId: "reservation-creator",
      tenantDomain: "synthetic-support",
      productId: "servicev8.service-app.supportv8",
      productVersion: "1.0.0",
      productKind: "service_app",
      entitlementStatus: "active",
      installationState: "active",
      serviceAppReadiness: { state: "ready" },
      serviceAppPlanAccess: { state: "included", planId: "scale" },
      serviceAppBinding: {
        schemaVersion: "servicev8.service-app-binding.v1",
        appKey: "supportv8",
        externalWorkspaceId: workspaceId,
        meteringTenantId: "synthetic-meter",
        poolAccountId: scope.accountId,
        provisioningState: "provisioned",
        poolBindingState: "verified",
      },
    };
    const current = async () => ({
      member: {
        accountId: scope.accountId,
        tenantId: scope.tenantId,
        identitySubject: scope.subject,
        email: "admin@synthetic.test",
        role: "ADMIN",
        status: "active",
        slug: "synthetic-support",
      },
      projection,
    });
    beforeAll(async () => {
      vi.stubEnv("SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED","true");
      const fixture = ownedDatabase(databaseUrl);
      const parsed = new URL(fixture.url);
      admin = new Pool({ connectionString: fixture.url });
      const identity = await admin.query<{
        db: string;
        host: string;
        port: number;
      }>(
        "select current_database() db,host(inet_server_addr()) host,inet_server_port() port",
      );
      expect(identity.rows[0]?.db).toBe(fixture.database);
      expect(identity.rows[0]?.port).toBe(fixture.port);
      expect(fixture.serverHost(identity.rows[0]?.host ?? "")).toBe(true);
      expect(
        (
          await admin.query(
            "SELECT 1 FROM pg_namespace WHERE nspname='supportv8'",
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
            readerRole,
          ])
        ).rowCount,
      ).toBe(0);
      if (fixture.url === sequenceFixture)
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
        `CREATE ROLE ${readerRole} LOGIN PASSWORD 'synthetic-only'`,
      );
      readerCreated = true;
      await admin.query("CREATE SCHEMA supportv8");
      schemaCreated = true;
      await admin.query(
        "CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain varchar(128) UNIQUE NOT NULL,name varchar(255) NOT NULL,operating_mode varchar(32) NOT NULL DEFAULT 'autonomous',servicev8_account_id varchar(128),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()); CREATE TABLE supportv8.issues(id varchar(64) PRIMARY KEY,tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id),source varchar(32) NOT NULL,external_id varchar(128) NOT NULL,source_url text NOT NULL DEFAULT '',customer_ref varchar(128) NOT NULL,customer_name varchar(255) NOT NULL,customer_tier varchar(32) NOT NULL DEFAULT 'standard',summary text NOT NULL,category varchar(64) NOT NULL DEFAULT 'support',product varchar(128) NOT NULL DEFAULT 'SupportV8',version varchar(64) NOT NULL DEFAULT '1.0',sentiment varchar(32) NOT NULL DEFAULT 'neutral',priority varchar(32) NOT NULL,business_impact varchar(32) NOT NULL DEFAULT 'low',resolution_risk_score numeric NOT NULL DEFAULT 0.1,source_status varchar(32) NOT NULL,tags text[] NOT NULL DEFAULT '{}',recommended_action text,timeline jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()); ALTER TABLE supportv8.issues ENABLE ROW LEVEL SECURITY; ALTER TABLE supportv8.issues FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_issues ON supportv8.issues USING(tenant_id=current_setting('app.current_tenant_id',true)) WITH CHECK (tenant_id=current_setting('app.current_tenant_id',true));",
      );
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
            "../migrations/006_runtime_ticket_read_index.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await admin.query(
        "INSERT INTO supportv8.tenants(id,domain,name,servicev8_account_id) VALUES($1,'synthetic-support','Synthetic',$2),($3,'other-support','Other','acct-other')",
        [workspaceId, scope.accountId, otherWorkspaceId],
      );
      await admin.query(
        "INSERT INTO supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state) VALUES($1,'operation-synthetic',$2,$3,'runtime','synthetic-support','reservation-creator',$4,'synthetic-support','workspace_created')",
        [scope.installationId, scope.accountId, scope.tenantId, workspaceId],
      );
      await admin.query(
        `INSERT INTO supportv8.issues(id,tenant_id,source,external_id,customer_ref,customer_name,summary,priority,source_status,created_at,updated_at) VALUES
      ('voice-1',$1,'voice','VOICE-1','customer-1','Voice customer','Voice escalation','urgent','open','2026-09-16T10:00:00Z','2026-09-16T12:00:00.123456Z'),
      ('handoff-1',$1,'orderv8_handoff','HANDOFF-1','customer-2','Handoff customer','Order handoff','normal','open','2026-09-16T09:00:00Z','2026-09-16T12:00:00.123455Z'),
      ('email-1',$1,'email','EMAIL-1','customer-3','Email customer','Email request','normal','open','2026-09-16T08:00:00Z','2026-09-16T11:00:00Z'),
      ('other-1',$2,'chat','OTHER-1','other','Other customer','Other ticket','normal','open','2026-09-16T08:00:00Z','2026-09-16T13:00:00Z')`,
        [workspaceId, otherWorkspaceId],
      );
      await admin.query(
        `GRANT USAGE ON SCHEMA supportv8 TO ${readerRole}; GRANT SELECT ON supportv8.tenants,supportv8.runtime_support_workspaces TO ${readerRole}; GRANT SELECT,INSERT,UPDATE ON supportv8.issues TO ${readerRole}`,
      );
      await admin.query(await readFile(new URL('../migrations/014_runtime_access_projection.sql',import.meta.url),'utf8'));
      await admin.query(await readFile(new URL('../migrations/015_runtime_access_receiver_receipts.sql',import.meta.url),'utf8'));
      await admin.query(`GRANT SELECT,INSERT,UPDATE ON supportv8.runtime_access_receiver_receipts,supportv8.runtime_access_projections,supportv8.runtime_access_cursors TO ${readerRole}; GRANT EXECUTE ON FUNCTION supportv8.list_runtime_access_targets(text,integer) TO ${readerRole}`);
      parsed.username = readerRole;
      parsed.password = "synthetic-only";
      app = new Pool({ connectionString: parsed.toString() });
      client = new PostgresClient(undefined, app);
    }, 30_000);
    afterAll(async () => {
      vi.unstubAllEnvs();
      await app?.end();
      if (admin) {
        if (schemaCreated) await admin.query("DROP SCHEMA supportv8 CASCADE");
        if (readerCreated) await admin.query(`DROP ROLE ${readerRole}`);
        await admin.end();
      }
    });
    it("joins the exact immutable native mapping while allowing another current admin", async () => {
      const access = await resolveOperationalSupportAccess(scope, {
        current,
        client,
      });
      expect(access).toMatchObject({
        workspaceId,
        subject: "current-admin",
        capability: "support:manage",
        domain: "synthetic-support",
      });
      const wrong = await resolveOperationalSupportAccess(
        { ...scope, accountId: "acct-other" },
        { current, client },
      );
      expect(wrong).toBeNull();
      const direct = async (account: string, tenant: string, native: string) =>
        client.withWorkspaceProvisioningSession(
          { tenantId: native, accountId: account, registryTenantId: tenant },
          (db) =>
            db.query(
              "SELECT installation_id FROM supportv8.runtime_support_workspaces",
            ),
        );
      expect(
        await direct(scope.accountId, scope.tenantId, workspaceId),
      ).toEqual([{ installation_id: scope.installationId }]);
      expect(await direct("acct-other", scope.tenantId, workspaceId)).toEqual(
        [],
      );
      expect(
        await direct(scope.accountId, "registry-other", workspaceId),
      ).toEqual([]);
      expect(
        await direct(scope.accountId, scope.tenantId, otherWorkspaceId),
      ).toEqual([]);
    });
    it("reads all sources with microsecond-safe paging and RLS isolation", async () => {
      const reader = new RuntimeSupportTicketReader({
        client,
        resolve: (value) =>
          resolveOperationalSupportAccess(value, { current, client }),
      });
      const first = await reader.list(scope, { limit: 1 });
      expect(first.tickets.map((x) => x.source)).toEqual(["voice"]);
      expect(first.nextCursor).toBeTruthy();
      const second = await reader.list(scope, {
        limit: 1,
        cursor: first.nextCursor,
      });
      expect(second.tickets.map((x) => x.source)).toEqual(["orderv8_handoff"]);
      const rest = await reader.list(scope, { limit: 100 });
      expect(rest.tickets.map((x) => x.source)).toEqual([
        "voice",
        "orderv8_handoff",
        "email",
      ]);
      expect(await reader.get(scope, "other-1")).toBeNull();
    });
    it("maps a current Viewer through the receiver and denies domain create and update without SQL writes",async()=>{
      const viewerCurrent=async()=>{const authority=await current();return {...authority,member:{...authority.member,role:'VIEWER'}};};
      const reader=new RuntimeSupportTicketReader({client,resolve:value=>resolveOperationalSupportAccess(value,{current:viewerCurrent,client})});
      expect((await reader.list(scope,{})).tickets.length).toBe(3);
      const before=await admin.query('SELECT * FROM supportv8.issues ORDER BY id');
      await expect(reader.create(scope,{customerName:'No write',summary:'No write',priority:'normal'})).rejects.toThrow('support_manage_denied');
      await expect(reader.update(scope,'voice-1',{status:'closed'})).rejects.toThrow('support_manage_denied');
      expect((await admin.query('SELECT * FROM supportv8.issues ORDER BY id')).rows).toEqual(before.rows);
    });
    it("persists manager create and update while preserving tenant isolation", async () => {
      const reader = new RuntimeSupportTicketReader({
        client,
        resolve: (value) =>
          resolveOperationalSupportAccess(value, { current, client }),
      });
      const created = await reader.create(scope, {
        customerName: "Synthetic Runtime Customer",
        summary: "Durable request",
        priority: "high",
      });
      expect(created.source).toBe("runtime_manual");
      const fresh = new RuntimeSupportTicketReader({
        client,
        resolve: (value) =>
          resolveOperationalSupportAccess(value, { current, client }),
      });
      expect((await fresh.get(scope, created.id))?.summary).toBe(
        "Durable request",
      );
      expect(
        (
          await fresh.update(scope, created.id, {
            summary: "Durable request updated",
            status: "resolved",
          })
        )?.status,
      ).toBe("resolved");
      const voiceBefore=await fresh.get(scope,"voice-1");
      await expect(fresh.update(scope,"voice-1",{status:"closed"})).rejects.toThrow("unsupported_ticket_source");
      expect(await fresh.get(scope,"voice-1")).toEqual(voiceBefore);
      expect(await fresh.get(scope, "other-1")).toBeNull();
      const readOnly = new RuntimeSupportTicketReader({
        client,
        resolve: async () => ({
          ...scope,
          capability: "support:read",
          email: "reader@synthetic.test",
          domain: "synthetic-support",
        }),
      });
      await expect(
        readOnly.update(scope, created.id, { status: "closed" }),
      ).rejects.toThrow("support_manage_denied");
      expect((await fresh.get(scope, created.id))?.status).toBe("resolved");
    });
    it('persists per-subject receipts, ignores duplicates/reordering, keeps local deny and enforces RLS',async()=>{
      const store=new SupportAccessProjectionStore(client);
      const member:AccessMembership={accountId:scope.accountId,tenantId:scope.tenantId,identitySubject:scope.subject,role:'admin',status:'active',revision:2,groupIds:['b1d580ef-e57d-40ec-a004-f0b2fa233424'],mappingStatus:'mapped'};
      expect(await store.eligible(scope)).toBe(true);expect((await store.targets('',4)).map(s=>s.installationId)).toEqual([scope.installationId]);expect(await store.cursor(scope)).toBe('');
      const first=await store.apply(scope,member,mapWorkspaceAccess(member,scope));
      expect(first.status).toBe('synced');expect(first.receiverSequence).toBe(1);
      expect(await new SupportAccessProjectionStore(client).apply(scope,member,mapWorkspaceAccess(member,scope))).toEqual(first);
      const revoked={...member,status:'suspended',revision:4};
      const latest=await store.apply(scope,revoked,mapWorkspaceAccess(revoked,scope));
      expect(latest.status).toBe('revoked');
      expect(await store.apply(scope,member,mapWorkspaceAccess(member,scope))).toEqual(latest);
      expect(await resolveOperationalSupportAccess(scope,{current,client})).toBeNull();
      const restored={...member,revision:5};await store.apply(scope,restored,mapWorkspaceAccess(restored,scope));
      await client.withWorkspaceProvisioningSession({tenantId:scope.workspaceId,accountId:scope.accountId,registryTenantId:scope.tenantId},db=>db.query('UPDATE supportv8.runtime_access_projections SET local_denied=true,local_capability=$1 WHERE installation_id=$2',['support:read',scope.installationId]));
      const next={...member,revision:6};expect((await store.apply(scope,next,mapWorkspaceAccess(next,scope))).status).toBe('blocked');
      expect(await resolveOperationalSupportAccess(scope,{current,client})).toBeNull();
      await client.withWorkspaceProvisioningSession({tenantId:scope.workspaceId,accountId:scope.accountId,registryTenantId:scope.tenantId},db=>db.query('UPDATE supportv8.runtime_access_projections SET local_denied=false WHERE installation_id=$1',[scope.installationId]));
      expect((await resolveOperationalSupportAccess(scope,{current,client}))?.capability).toBe('support:read');
      const secondScope={...scope,subject:'invited-member'};const second={...member,identitySubject:secondScope.subject,role:'viewer',revision:1};
      await store.apply(secondScope,second,mapWorkspaceAccess(second,secondScope));
      expect((await admin.query('SELECT count(*)::int n FROM supportv8.runtime_access_projections')).rows[0].n).toBe(2);
      expect((await admin.query('SELECT count(*)::int n FROM supportv8.runtime_access_audit')).rows[0].n).toBe(5);
      await expect(admin.query("UPDATE supportv8.runtime_access_audit SET status='synced'")).rejects.toThrow('access audit is immutable');
      await store.advance(scope,'','invited-member');expect(await store.cursor(scope)).toBe('invited-member');
      await expect(store.advance(scope,'','outdated')).rejects.toThrow('projection_cursor_changed');
      await store.fail(scope,'authority_unavailable');
      await expect(store.cursor(scope)).rejects.toThrow('projection_retry_not_due');expect(await store.targets('',4)).toEqual([]);
      await store.retry(scope);expect(await store.cursor(scope)).toBe('invited-member');
      expect(await store.eligible({...scope,tenantId:'other'})).toBe(false);
      await expect(store.apply({...scope,tenantId:'other'},member,mapWorkspaceAccess(member,scope))).rejects.toThrow('installation_unavailable');
    });
    it('sequences same-revision local policy changes and permits canonical promotion without overwriting ceilings',async()=>{
      const store=new SupportAccessProjectionStore(client),target={...scope,subject:'policy-member'};
      const membership:AccessMembership={accountId:scope.accountId,tenantId:scope.tenantId,identitySubject:target.subject,role:'viewer',status:'active',revision:1,groupIds:['b1d580ef-e57d-40ec-a004-f0b2fa233424'],mappingStatus:'mapped'};
      const initial=await store.apply(target,membership,mapWorkspaceAccess(membership,target));expect(initial.receiverSequence).toBe(1);
      const promoted={...membership,role:'admin',revision:2};
      const promotion=await store.apply(target,promoted,mapWorkspaceAccess(promoted,target));expect(promotion.receiverSequence).toBe(2);
      expect((await store.restriction(target))?.capability).toBe('support:manage');
      const policy=(denied:boolean,capability:string|null)=>client.withWorkspaceProvisioningSession({tenantId:scope.workspaceId,accountId:scope.accountId,registryTenantId:scope.tenantId},db=>db.query('UPDATE supportv8.runtime_access_projections SET local_denied=$1,local_capability=$2 WHERE installation_id=$3 AND identity_subject=$4',[denied,capability,target.installationId,target.subject]));
      await policy(true,null);
      const denied=await store.apply(target,promoted,mapWorkspaceAccess(promoted,target));expect(denied).toMatchObject({revision:2,receiverSequence:3,status:'blocked'});
      expect(await store.apply(target,promoted,mapWorkspaceAccess(promoted,target))).toEqual(denied);
      await policy(false,'support:read');
      const limited=await store.apply(target,promoted,mapWorkspaceAccess(promoted,target));expect(limited).toMatchObject({revision:2,receiverSequence:4,status:'blocked'});
      expect((await store.restriction(target))?.capability).toBe('support:read');
      await policy(false,null);
      expect(await store.apply(target,promoted,mapWorkspaceAccess(promoted,target))).toMatchObject({revision:2,receiverSequence:5,status:'synced'});
      const failure=await store.memberFailure(target,promoted,'unavailable','authority_unavailable');expect(failure).toMatchObject({receiverSequence:6,status:'unavailable',appliedRevision:null});
      expect(await store.attemptMember(target,2)).toBe(false);expect(await store.attemptMember(target,3)).toBe(true);
      await store.retry(scope);expect(await store.attemptMember(target,2)).toBe(true);
      expect(await store.apply(target,promoted,mapWorkspaceAccess(promoted,target))).toMatchObject({receiverSequence:7,status:'synced'});
      const removed={...promoted,status:'revoked',revision:3,groupIds:[],email:''};
      const tombstone=await store.apply(target,removed,mapWorkspaceAccess(removed,target));expect(tombstone).toMatchObject({receiverSequence:8,status:'revoked'});
      expect(await store.apply(target,promoted,mapWorkspaceAccess(promoted,target))).toEqual(tombstone);
      expect((await store.restriction(target))?.denied).toBe(true);
    });
  },
);

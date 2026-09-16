import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { PostgresClient } from "@/lib/db/pg-client";
import { resolveOperationalSupportAccess,type SupportRuntimeScope } from "@/lib/service-app/runtime-access";
import { RuntimeSupportTicketReader } from "@/lib/service-app/runtime-ticket-reader";

const enabled=process.env.SUPPORTV8_REAL_POSTGRES==="1";
describe.skipIf(!enabled)("Runtime Support access genuine PostgreSQL boundary",()=>{
  let admin:Pool,app:Pool,client:PostgresClient;
  const databaseUrl=process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL??"";
  const workspaceId="tenant_rt_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const otherWorkspaceId="tenant_rt_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const scope:SupportRuntimeScope={accountId:"acct-synthetic",tenantId:"registry-synthetic",verticalId:"runtime",installationId:"install-synthetic",workspaceId,subject:"current-admin"};
  const projection={accountId:scope.accountId,tenantId:scope.tenantId,verticalId:"runtime",installationId:scope.installationId,principalId:"reservation-creator",tenantDomain:"synthetic-support",productId:"servicev8.service-app.supportv8",productVersion:"1.0.0",productKind:"service_app",entitlementStatus:"active",installationState:"active",serviceAppReadiness:{state:"ready"},serviceAppPlanAccess:{state:"included",planId:"scale"},serviceAppBinding:{schemaVersion:"servicev8.service-app-binding.v1",appKey:"supportv8",externalWorkspaceId:workspaceId,meteringTenantId:"synthetic-meter",poolAccountId:scope.accountId,provisioningState:"provisioned",poolBindingState:"verified"}};
  const current=async()=>({member:{accountId:scope.accountId,tenantId:scope.tenantId,identitySubject:scope.subject,email:"admin@synthetic.test",role:"ADMIN",status:"active",slug:"synthetic-support"},projection});
  beforeAll(async()=>{
    expect(databaseUrl).toBeTruthy();const parsed=new URL(databaseUrl);expect([parsed.hostname,parsed.port,parsed.pathname]).toEqual(["127.0.0.1","52996","/support_runtime_access_test"]);
    admin=new Pool({connectionString:databaseUrl});
    const identity=await admin.query("select current_database() db,inet_server_addr()::text host,inet_server_port() port");expect(identity.rows[0]).toEqual({db:"support_runtime_access_test",host:"127.0.0.1/32",port:52996});
    await admin.query("DROP SCHEMA IF EXISTS supportv8 CASCADE; DROP ROLE IF EXISTS support_runtime_reader; CREATE ROLE support_runtime_reader LOGIN PASSWORD 'synthetic-only'; CREATE SCHEMA supportv8; CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain varchar(128) UNIQUE NOT NULL,name varchar(255) NOT NULL,operating_mode varchar(32) NOT NULL DEFAULT 'autonomous',servicev8_account_id varchar(128),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()); CREATE TABLE supportv8.issues(id varchar(64) PRIMARY KEY,tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id),source varchar(32) NOT NULL,external_id varchar(128) NOT NULL,customer_ref varchar(128) NOT NULL,customer_name varchar(255) NOT NULL,summary text NOT NULL,priority varchar(32) NOT NULL,source_status varchar(32) NOT NULL,created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL); ALTER TABLE supportv8.issues ENABLE ROW LEVEL SECURITY; ALTER TABLE supportv8.issues FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_isolation_issues ON supportv8.issues USING(tenant_id=current_setting('app.current_tenant_id',true)) WITH CHECK(tenant_id=current_setting('app.current_tenant_id',true));");
    await admin.query(await readFile(new URL("../migrations/005_runtime_support_workspaces.sql",import.meta.url),"utf8"));
    await admin.query(await readFile(new URL("../migrations/006_runtime_ticket_read_index.sql",import.meta.url),"utf8"));
    await admin.query("INSERT INTO supportv8.tenants(id,domain,name,servicev8_account_id) VALUES($1,'synthetic-support','Synthetic',$2),($3,'other-support','Other','acct-other')",[workspaceId,scope.accountId,otherWorkspaceId]);
    await admin.query("INSERT INTO supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state) VALUES($1,'operation-synthetic',$2,$3,'runtime','synthetic-support','reservation-creator',$4,'synthetic-support','workspace_created')",[scope.installationId,scope.accountId,scope.tenantId,workspaceId]);
    await admin.query(`INSERT INTO supportv8.issues(id,tenant_id,source,external_id,customer_ref,customer_name,summary,priority,source_status,created_at,updated_at) VALUES
      ('voice-1',$1,'voice','VOICE-1','customer-1','Voice customer','Voice escalation','urgent','open','2026-09-16T10:00:00Z','2026-09-16T12:00:00.123456Z'),
      ('handoff-1',$1,'orderv8_handoff','HANDOFF-1','customer-2','Handoff customer','Order handoff','normal','open','2026-09-16T09:00:00Z','2026-09-16T12:00:00.123455Z'),
      ('email-1',$1,'email','EMAIL-1','customer-3','Email customer','Email request','normal','open','2026-09-16T08:00:00Z','2026-09-16T11:00:00Z'),
      ('other-1',$2,'chat','OTHER-1','other','Other customer','Other ticket','normal','open','2026-09-16T08:00:00Z','2026-09-16T13:00:00Z')`,[workspaceId,otherWorkspaceId]);
    await admin.query("GRANT USAGE ON SCHEMA supportv8 TO support_runtime_reader; GRANT SELECT ON supportv8.tenants,supportv8.runtime_support_workspaces,supportv8.issues TO support_runtime_reader");
    parsed.username="support_runtime_reader";parsed.password="synthetic-only";app=new Pool({connectionString:parsed.toString()});client=new PostgresClient(undefined,app);
  },30_000);
  afterAll(async()=>{await app?.end();await admin?.end();});
  it("joins the exact immutable native mapping while allowing another current admin",async()=>{
    const access=await resolveOperationalSupportAccess(scope,{current,client});expect(access).toMatchObject({workspaceId,subject:"current-admin",capability:"support:manage",domain:"synthetic-support"});
    const wrong=await resolveOperationalSupportAccess({...scope,accountId:"acct-other"},{current,client});expect(wrong).toBeNull();
    const direct=async(account:string,tenant:string,native:string)=>client.withWorkspaceProvisioningSession({tenantId:native,accountId:account,registryTenantId:tenant},db=>db.query("SELECT installation_id FROM supportv8.runtime_support_workspaces"));
    expect(await direct(scope.accountId,scope.tenantId,workspaceId)).toEqual([{installation_id:scope.installationId}]);expect(await direct("acct-other",scope.tenantId,workspaceId)).toEqual([]);expect(await direct(scope.accountId,"registry-other",workspaceId)).toEqual([]);expect(await direct(scope.accountId,scope.tenantId,otherWorkspaceId)).toEqual([]);
  });
  it("reads all sources with microsecond-safe paging and RLS isolation",async()=>{
    const reader=new RuntimeSupportTicketReader({client,resolve:(value)=>resolveOperationalSupportAccess(value,{current,client})});const first=await reader.list(scope,{limit:1});expect(first.tickets.map(x=>x.source)).toEqual(["voice"]);expect(first.nextCursor).toBeTruthy();const second=await reader.list(scope,{limit:1,cursor:first.nextCursor});expect(second.tickets.map(x=>x.source)).toEqual(["orderv8_handoff"]);const rest=await reader.list(scope,{limit:100});expect(rest.tickets.map(x=>x.source)).toEqual(["voice","orderv8_handoff","email"]);expect(await reader.get(scope,"other-1")).toBeNull();
  });
});

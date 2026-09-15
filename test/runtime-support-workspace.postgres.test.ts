import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresClient } from "@/lib/db/pg-client";
import { RuntimeSupportWorkspaceStore, WorkspaceReservationConflictError } from "@/lib/service-app/workspace-reservation";

const enabled = process.env.SUPPORTV8_REAL_POSTGRES === "1";
describe.skipIf(!enabled)("runtime Support workspace genuine PostgreSQL boundary", () => {
  let dir:string|undefined, port:number, admin:Pool, app:Pool, store:RuntimeSupportWorkspaceStore;
  let adminUrl:string;
  const base = (suffix:string, overrides={}) => ({accountId:"acct-shared",registryTenantId:`reg-${suffix}`,installationId:`install-${suffix}`,operationId:`op-${suffix}`,tenantDomain:`${suffix}.support.test`,subject:`subject-${suffix}`,verticalId:"runtime" as const,...overrides});
  beforeAll(async () => {
    adminUrl=process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL ?? "";
    if (!adminUrl) {
      dir=await mkdtemp(join(tmpdir(),"supportv8-pg-")); port=25000+Math.floor(Math.random()*10000);
      expect(spawnSync("initdb",["-D",dir,"-A","trust","-U","postgres"],{stdio:"ignore"}).status).toBe(0);
      expect(spawnSync("pg_ctl",["-D",dir,"-o",`-h 127.0.0.1 -p ${port}`,"-w","start"],{stdio:"ignore"}).status).toBe(0);
      adminUrl=`postgresql://postgres@127.0.0.1:${port}/postgres`;
    } else port=Number(new URL(adminUrl).port || 5432);
    admin=new Pool({connectionString:adminUrl});
    await admin.query("CREATE ROLE support_app LOGIN PASSWORD 'support-workspace-test'; CREATE ROLE support_reader LOGIN PASSWORD 'support-workspace-test'; GRANT CREATE ON DATABASE postgres TO support_app");
    await admin.query("SET ROLE support_app; CREATE SCHEMA supportv8 AUTHORIZATION support_app; CREATE FUNCTION supportv8.current_tenant_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_setting('app.current_tenant_id',true) $$; CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain varchar(128) UNIQUE NOT NULL,name varchar(255) NOT NULL,operating_mode varchar(32) NOT NULL DEFAULT 'autonomous',servicev8_account_id varchar(128),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now()); CREATE UNIQUE INDEX uq_supportv8_tenants_servicev8_account ON supportv8.tenants(servicev8_account_id) WHERE servicev8_account_id IS NOT NULL; RESET ROLE");
    const migration=await readFile(new URL("../migrations/005_runtime_support_workspaces.sql",import.meta.url),"utf8");
    await admin.query("SET ROLE support_app"); await admin.query(migration); await admin.query("RESET ROLE");
    await admin.query("GRANT USAGE ON SCHEMA supportv8 TO support_reader; GRANT SELECT,UPDATE ON supportv8.runtime_support_workspaces TO support_reader");
    const parsed=new URL(adminUrl); parsed.username="support_app"; parsed.password="support-workspace-test";
    app=new Pool({connectionString:parsed.toString(),max:8}); store=new RuntimeSupportWorkspaceStore(new PostgresClient(undefined,app));
  },30000);
  afterAll(async()=>{await app?.end();await admin?.end();if(dir){spawnSync("pg_ctl",["-D",dir,"-m","fast","-w","stop"]);await rm(dir,{recursive:true,force:true});}});

  it("is stable across retry, restart, and concurrency while allowing two Registry tenants in one account",async()=>{
    const input=base("one"), [a,b]=await Promise.all([store.acquire(input),store.acquire(input)]); expect(a).toEqual(b);
    const parsed=new URL(adminUrl);parsed.username="support_app";parsed.password="support-workspace-test";const restartedPool=new Pool({connectionString:parsed.toString()});
    expect(await new RuntimeSupportWorkspaceStore(new PostgresClient(undefined,restartedPool)).acquire(input)).toEqual(a);await restartedPool.end();
    expect((await store.acquire(base("two"))).workspaceId).not.toBe(a.workspaceId);
    expect((await admin.query("SELECT indexname FROM pg_indexes WHERE schemaname='supportv8' AND indexname='uq_supportv8_tenants_servicev8_account'")).rowCount).toBe(0);
  });
  it("rejects changed scope, operation reuse, native/domain collision, rollback retry, and tombstone resurrection",async()=>{
    const input=base("conflict"); const made=await store.acquire(input);
    await expect(store.acquire({...input,subject:"changed"})).rejects.toBeInstanceOf(WorkspaceReservationConflictError);
    await expect(store.acquire(base("other-install",{operationId:input.operationId}))).rejects.toBeInstanceOf(WorkspaceReservationConflictError);
    await admin.query("SET ROLE support_app; INSERT INTO supportv8.tenants VALUES('tenant_collision','collision.support.test','collision','autonomous','another-account'); RESET ROLE");
    await expect(store.acquire(base("collision"))).rejects.toBeInstanceOf(WorkspaceReservationConflictError);
    expect((await admin.query("SELECT 1 FROM supportv8.runtime_support_workspaces WHERE installation_id='install-collision'")).rowCount).toBe(0);
    const c=await app.connect();try{await c.query("BEGIN");await c.query("SELECT set_config('app.current_tenant_id',$1,true),set_config('app.current_account_id',$2,true),set_config('app.current_registry_tenant_id',$3,true)",[made.workspaceId,input.accountId,input.registryTenantId]);await c.query("UPDATE supportv8.runtime_support_workspaces SET state='tombstoned',deleted_at=now() WHERE installation_id=$1",[input.installationId]);await c.query("COMMIT");}finally{c.release();}
    await expect(store.acquire(input)).rejects.toBeInstanceOf(WorkspaceReservationConflictError);
  });
  it("enforces restricted-role RLS and immutable identity guards",async()=>{
    const input=base("rls"), made=await store.acquire(input); const parsed=new URL(adminUrl);parsed.username="support_reader";parsed.password="support-workspace-test";const reader=new Pool({connectionString:parsed.toString()});
    const scoped=async(account:string,registry:string,sql:string)=>{const c=await reader.connect();try{await c.query("BEGIN");await c.query("SELECT set_config('app.current_tenant_id',$1,true),set_config('app.current_account_id',$2,true),set_config('app.current_registry_tenant_id',$3,true)",[made.workspaceId,account,registry]);const r=await c.query(sql);await c.query("ROLLBACK");return r;}finally{c.release();}};
    expect((await scoped(input.accountId,input.registryTenantId,"SELECT * FROM supportv8.runtime_support_workspaces")).rowCount).toBe(1);
    expect((await scoped("wrong",input.registryTenantId,"SELECT * FROM supportv8.runtime_support_workspaces")).rowCount).toBe(0);
    expect((await scoped(input.accountId,"wrong","SELECT * FROM supportv8.runtime_support_workspaces")).rowCount).toBe(0);
    await expect(scoped(input.accountId,input.registryTenantId,"UPDATE supportv8.runtime_support_workspaces SET account_id='changed'")).rejects.toThrow(/immutable/);
    await reader.end();
  });
});

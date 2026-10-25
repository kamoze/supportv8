import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {PostgresClient} from '../src/lib/db/pg-client';
import {resolveNativeWorkspaceBinding} from '../src/lib/auth/native-workspace-binding';
const enabled=process.env.SUPPORTV8_REAL_POSTGRES==='1';
const ci='postgresql://postgres:support-workspace-test@127.0.0.1:5432/postgres';
const local='postgres://postgres@127.0.0.1:52996/support_workspace_binding_test';
describe.skipIf(!enabled)('genuine PostgreSQL canonical/native binding and RLS',()=>{
 let admin:Pool,app:Pool;let schema=false,role=false;
 const workspace={id:'opaque-canonical-id',accountId:'canonical-account',slug:'existing',name:'Existing Company',status:'active' as const,url:'https://existing.support.servicev8.com/'};
 beforeAll(async()=>{
  const url=process.env.SUPPORTV8_WORKSPACE_TEST_DATABASE_URL??'';
  if(![ci,local].includes(url))throw Error('Expected exact owned disposable fixture');
  admin=new Pool({connectionString:url});
  const identity=(await admin.query('SELECT current_database() db,host(inet_server_addr()) host')).rows[0];
  expect(identity.db).toBe(new URL(url).pathname.slice(1));
  expect(identity.host==='127.0.0.1'||identity.host==='::1'||url===ci&&process.env.CI==='true'&&/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(identity.host)).toBe(true);
  if((await admin.query("SELECT 1 FROM pg_roles WHERE rolname='supportv8_app'")).rowCount)throw Error('Refuse pre-existing app role');
  if((await admin.query("SELECT 1 FROM pg_namespace WHERE nspname='supportv8'")).rowCount)throw Error('Refuse pre-existing schema');
  await admin.query("CREATE ROLE supportv8_app LOGIN PASSWORD 'binding-fixture-only' NOBYPASSRLS");role=true;
  await admin.query("CREATE SCHEMA supportv8;CREATE TABLE supportv8.tenants(id varchar(64) PRIMARY KEY,domain text NOT NULL,servicev8_account_id text,UNIQUE(id,domain,servicev8_account_id));ALTER TABLE supportv8.tenants ENABLE ROW LEVEL SECURITY;ALTER TABLE supportv8.tenants FORCE ROW LEVEL SECURITY;CREATE POLICY tenant_isolation ON supportv8.tenants USING(id=current_setting('app.current_tenant_id',true));GRANT USAGE ON SCHEMA supportv8 TO supportv8_app;GRANT SELECT ON supportv8.tenants TO supportv8_app;");schema=true;
  await admin.query(await readFile(new URL('../migrations/014_workspace_identity_bindings.sql',import.meta.url),'utf8'));
  await admin.query("INSERT INTO supportv8.tenants VALUES('tenant_existing','existing','canonical-account'),('tenant_foreign','foreign','foreign-account')");
  await admin.query("INSERT INTO supportv8.workspace_identity_bindings(registry_tenant_id,account_id,native_tenant_id,slug,origin,state,provenance) VALUES('opaque-canonical-id','canonical-account','tenant_existing','existing','https://existing.support.servicev8.com','active','synthetic fixture')");
  await admin.query("INSERT INTO supportv8.tenants VALUES('tenant_acme','acme','account-acme'),('tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559','runtime-acceptance','acct_5c88ae327c3a')");
  const parsed=new URL(url);parsed.username='supportv8_app';parsed.password='binding-fixture-only';app=new Pool({connectionString:parsed.toString()});PostgresClient.setTestClient(new PostgresClient('',app));
 });
 afterAll(async()=>{PostgresClient.setTestClient(null);await app?.end();if(schema)await admin.query('DROP SCHEMA supportv8 CASCADE');if(role)await admin.query('DROP ROLE supportv8_app');await admin?.end()});
 it('shows the prior unscoped discovery failure while the exact persisted crosswalk resolves a distinct native ID',async()=>{
  expect((await app.query("SELECT id FROM supportv8.tenants WHERE domain='existing'")).rows).toEqual([]);
  expect(await resolveNativeWorkspaceBinding(workspace)).toBe('tenant_existing');
  expect((await app.query('SELECT native_tenant_id FROM supportv8.workspace_identity_bindings')).rows).toEqual([]);
 });
 it('denies wrong canonical account, tenant, slug and origin',async()=>{
  for(const patch of [{id:'foreign'},{accountId:'foreign-account'},{slug:'foreign'},{url:'https://foreign.support.servicev8.com/'}])expect(await resolveNativeWorkspaceBinding({...workspace,...patch})).toBeNull();
 });
 it('refuses a canonical tenant split across accounts or a mismatched native tuple',async()=>{
  await expect(admin.query("INSERT INTO supportv8.workspace_identity_bindings(registry_tenant_id,account_id,native_tenant_id,slug,origin,state,provenance) VALUES('opaque-canonical-id','foreign-account','tenant_foreign','foreign','https://foreign.support.servicev8.com','active','synthetic fixture')")).rejects.toMatchObject({code:'23505'});
  await expect(admin.query("INSERT INTO supportv8.workspace_identity_bindings(registry_tenant_id,account_id,native_tenant_id,slug,origin,state,provenance) VALUES('foreign-canonical','wrong-account','tenant_foreign','foreign','https://foreign.support.servicev8.com','active','synthetic fixture')")).rejects.toMatchObject({code:'23503'});
 });
 it('imports only the two exact existing identities idempotently, preserving native IDs',async()=>{
  const sql=await readFile(new URL('../ops/workspace-recovery/existing-bindings-20261025.sql',import.meta.url),'utf8');
  for(let attempt=0;attempt<2;attempt++){await admin.query("BEGIN");try{await admin.query(sql);await admin.query("COMMIT");}catch(error){await admin.query("ROLLBACK");throw error;}}
  expect((await admin.query("SELECT native_tenant_id FROM supportv8.workspace_identity_bindings WHERE registry_tenant_id IN ('tenant-acme','tenant_5c88ae327c3a') ORDER BY registry_tenant_id")).rows).toEqual([{native_tenant_id:'tenant_acme'},{native_tenant_id:'tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559'}]);
  expect((await admin.query('SELECT count(*)::int n FROM supportv8.tenants')).rows[0].n).toBe(4);
 });
 it('runtime cannot insert, reassign or delete mappings',async()=>{
  for(const sql of ["UPDATE supportv8.workspace_identity_bindings SET account_id='foreign'","DELETE FROM supportv8.workspace_identity_bindings","INSERT INTO supportv8.workspace_identity_bindings DEFAULT VALUES"])await expect(app.query(sql)).rejects.toMatchObject({code:'42501'});
 });
 it('privileged reassignment and deletion are rejected, revocation withdraws access permanently',async()=>{
  await expect(admin.query("UPDATE supportv8.workspace_identity_bindings SET native_tenant_id='tenant_foreign'")).rejects.toMatchObject({code:'23514'});
  await expect(admin.query('DELETE FROM supportv8.workspace_identity_bindings')).rejects.toMatchObject({code:'23514'});
  await admin.query("UPDATE supportv8.workspace_identity_bindings SET state='revoked'");expect(await resolveNativeWorkspaceBinding(workspace)).toBeNull();
  await expect(admin.query("UPDATE supportv8.workspace_identity_bindings SET state='active'")).rejects.toMatchObject({code:'23514'});
 });
});

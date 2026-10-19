import {OperationalPgClient,type OperationalSqlBudget} from '@/lib/db/operational-sql-budget';
import { spawnSync } from 'node:child_process';
import { recordFixtureReceipt } from './fixtures/support-receiver-fixture';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PostgresClient } from '@/lib/db/pg-client';
import { RuntimeSupportTicketReader } from '@/lib/service-app/runtime-ticket-reader';
import { createSupportVoiceStore } from '@/lib/voice/support-voice-store';
import { OperationalOutboxStore, drainOperationalOutbox } from '@/lib/signals/operational-outbox';
import { canonicalJson, descriptorDigest } from '@/lib/signals/operational-contract';
const enabled = !!process.env.SUPPORT_OPERATIONAL_TEST_ADMIN_URL;
// A fresh, uniquely named database and restricted role are owned by this suite.
const database = `support_outbox_${process.pid}`, role = "supportv8_app";
let admin: Pool, owner: Pool, app: Pool, client: PostgresClient, store: OperationalOutboxStore;
import { target, certificate, pin } from './operational-fixtures';
import { qualifySupportSource, sourceResolver, currentLocalSource } from '@/lib/signals/operational-source';
async function rows() { return (await owner.query('select * from supportv8.operational_outbox order by captured_at,id')).rows; }
async function qualify(t = target) {
    await owner.query("update supportv8.managed_support_registration_jobs set lease_owner='qualifier',lease_expires_at=now()+interval '2 minutes' where installation_id=$1", [t.installationId]);
    const resolve = sourceResolver({ registryUrl: 'https://registry.fixture.invalid', credential: async () => 'synthetic', request: async () => { expect(Number((await owner.query("select count(*) from pg_stat_activity where usename=$1 and datname=current_database() and state='idle in transaction'",[role])).rows[0].count)).toBe(0); return Response.json(certificate(t)); }, local: t => currentLocalSource(t, client) });
    await qualifySupportSource({ accountId: t.accountId, registryTenantId: t.tenantId, installationId: t.installationId, acquisitionId: 'acq-' + t.installationId, workspaceId: t.workspaceId, verticalId: 'runtime', state: 'ready', attemptCount: 0 }, 'qualifier', { client, resolve, enabled: true });
    expect((await owner.query('select pin from supportv8.operational_qualifications where installation_id=$1', [t.installationId])).rows[0]?.pin).toEqual(pin(t));
}
const reader = () => new RuntimeSupportTicketReader({ client, resolve: async (s) => ({ ...s, capability: 'support:manage', email: 'synthetic@test.invalid', domain: 'fixture-a' }) });
const scope = { ...target, verticalId: 'runtime' as const, subject: 'admin-a' };
async function create(priority: 'normal' | 'urgent' = 'normal') { return reader().create(scope, { priority, customerName: 'PRIVATE NAME', summary: 'PRIVATE SUMMARY' }); }
describe.skipIf(!enabled)('Support native transactional operational outbox', () => {
    beforeAll(async () => {
        const raw = process.env.SUPPORT_OPERATIONAL_TEST_ADMIN_URL!;
        const url = new URL(raw);
        if (url.hostname !== '127.0.0.1' || !['55489', '5432'].includes(url.port) || url.pathname !== '/postgres' || url.username !== 'postgres' || url.search || url.hash)
            throw Error('owned Support fixture required');
        admin = new Pool({ connectionString: raw });
        await admin.query(`create database ${database}`);
        await admin.query(`create role ${role} login; create role supportv8_relay; create role supportv8_scaler`);
        url.pathname = '/' + database;
        owner = new Pool({ connectionString: url.toString() });
        await owner.query(`create schema supportv8 authorization postgres; set search_path=supportv8,public; grant usage on schema supportv8 to supportv8_app,supportv8_relay,supportv8_scaler; alter default privileges for role postgres in schema supportv8 grant select,insert,update,delete on tables to supportv8_app; create table supportv8.default_acl_probe(id text);`);
        expect((await owner.query("select tableowner from pg_tables where schemaname='supportv8' and tablename='default_acl_probe'")).rows[0].tableowner).toBe('postgres');
        expect((await owner.query("select has_table_privilege('supportv8_app','supportv8.default_acl_probe','INSERT,UPDATE,DELETE') inherited")).rows[0].inherited).toBe(true);
        const initial = await readFile(new URL('../migrations/001_initial_schema.sql', import.meta.url), 'utf8');
        await owner.query(initial.slice(0, initial.indexOf('-- 3. Problems Table')).replace('CREATE EXTENSION IF NOT EXISTS "vector";', '').replace(/^    embedding vector.*\n/m, '').replace(/^CREATE INDEX IF NOT EXISTS idx_issues_embedding.*\n/m, ''));
        await owner.query("create function supportv8.current_tenant_id() returns text language sql stable as $$select current_setting('app.current_tenant_id',true)$$");
        for (const file of ['003_voice_support_domain.sql', '005_runtime_support_workspaces.sql', '008_managed_support_registration_jobs.sql', '009_managed_support_permanent_lifecycle.sql', '011_operational_outbox.sql'])
            await owner.query(await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8'));
        for (const t of [target, { accountId: 'account-b', tenantId: 'registry-b', installationId: 'install-b', workspaceId: 'tenant_native_b' }]) {
            await owner.query('insert into supportv8.tenants(id,domain,name,servicev8_account_id) values($1,$2,$2,$3)', [t.workspaceId, 'fixture-' + t.installationId, t.accountId]);
            await owner.query("insert into supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,vertical_id,tenant_domain,subject,native_tenant_id,native_domain,state) values($1,$2,$3,$4,'runtime',$5,'owner',$6,$5,'workspace_created')", [t.installationId, 'acq-' + t.installationId, t.accountId, t.tenantId, 'fixture-' + t.installationId, t.workspaceId]);
            await owner.query("insert into supportv8.managed_support_registration_jobs(installation_id,acquisition_id,account_id,registry_tenant_id,vertical_id,native_workspace_id,state) values($1,$2,$3,$4,'runtime',$5,'ready')", [t.installationId, 'acq-' + t.installationId, t.accountId, t.tenantId, t.workspaceId]);
        }
        await owner.query(`create schema support_receiver_fixture; create table support_receiver_fixture.receipts(event_id text primary key,digest text not null,pin jsonb not null,ack jsonb not null);create table support_receiver_fixture.normalized(event_id text primary key references support_receiver_fixture.receipts(event_id));grant usage on schema support_receiver_fixture to ${role};grant select,insert on all tables in schema support_receiver_fixture to ${role};`);
        await owner.query(`grant usage on schema supportv8 to ${role}; grant select,insert,update on supportv8.issues,supportv8.voice_tool_effects to ${role}; grant select on supportv8.operational_outbox,supportv8.tenants,supportv8.runtime_support_workspaces,supportv8.managed_support_registration_jobs to ${role}; grant execute on function supportv8.qualify_operational_source(varchar,varchar,jsonb,jsonb) to ${role}; grant execute on function supportv8.claim_operational_outbox(varchar,integer),supportv8.finish_operational_outbox(uuid,varchar,bigint,uuid,varchar,varchar,jsonb,integer) to ${role}`);
        url.username = role;
        app = new Pool({ connectionString: url.toString(),Client:OperationalPgClient,connectionTimeoutMillis:1000 });
        client = new PostgresClient(undefined, app);
        store = new OperationalOutboxStore(app);
    }, 30000);
    afterAll(async () => { await app?.end(); await owner?.end(); if (admin) {
        await admin.query(`drop database if exists ${database}`);
        await admin.query(`drop role if exists ${role},supportv8_relay,supportv8_scaler`);
        await admin.end();
    } });
    it('preserves an immutable held fact when qualification is absent, never promotes history', async () => { await create(); const held = (await rows())[0]; expect(held.state).toBe('pending_authority'); expect(held.last_error_code).toBe('qualification_absent'); expect(held.provenance).toBeNull(); await qualify(); expect((await rows())[0]).toEqual(held); expect(await store.claim('worker', 8)).toEqual([]); });
    it('captures urgent creation once per declared created/escalated fact with SQL-native timestamps',async()=>{const t=await create('urgent');const facts=(await rows()).filter(r=>r.event.subject==='ticket:'+t.id);expect(facts.map(r=>r.event.type).sort()).toEqual(['com.servicev8.business.support.ticket-created.v1','com.servicev8.business.support.ticket-escalated.v1']);expect(facts[0].event.time).toBe(facts[1].event.time);expect(facts.every(r=>r.input_digest===descriptorDigest(r.event))).toBe(true);});
    it('captures actual manager transitions inside the native SQL transaction, and rollback emits nothing', async () => { const t = await create(); const before = (await rows()).length; await reader().update(scope, t.id, { status: 'escalated' }); await reader().update(scope, t.id, { status: 'escalated', summary: 'changed private' }); await reader().update(scope, t.id, { status: 'resolved' }); await reader().update(scope, t.id, { status: 'closed' }); await reader().update(scope, t.id, { status: 'open' }); await reader().update(scope, t.id, { status: 'resolved' }); expect((await rows()).length).toBe(before + 3); const events = (await rows()).filter(r => r.event.subject === 'ticket:' + t.id); expect(new Set(events.map(r => r.event.id)).size).toBe(4); expect(JSON.stringify(events)).not.toMatch(/PRIVATE|changed private/); expect(events.every(r => canonicalJson(r.provenance) === canonicalJson(pin()))).toBe(true); expect(events.every(r => Date.parse(r.event.time) <= Date.now())).toBe(true); const n = (await rows()).length; await expect(client.withTenantSession(target.workspaceId, async (db) => { await db.query("update supportv8.issues set source_status='escalated' where id=$1", [t.id]); throw Error('rollback'); })).rejects.toThrow('rollback'); expect((await rows()).length).toBe(n); });
    it('captures one voice fact per committed tool effect and rolls both back on effect failure', async () => {
        const voice = createSupportVoiceStore(client);
        const input = { tenantId: target.workspaceId, hireId: 'employee-hire', installationId: 'employee-install', sessionId: 'session-a', toolCallId: 'tool-a', customerName: 'PRIVATE VOICE', summary: 'PRIVATE TRANSCRIPT', priority: 'normal' };
        const before = (await rows()).length;
        const [one, two] = await Promise.all([voice.createTicket(input), voice.createTicket(input)]);
        expect(one).toEqual(two);
        expect((await rows()).length).toBe(before + 1);
        const last = (await rows()).at(-1);
        expect(last.provenance.installationId).toBe('install-a');
        await owner.query(`revoke insert on supportv8.voice_tool_effects from ${role}`);
        await expect(voice.createTicket({ ...input, toolCallId: 'tool-rollback' })).rejects.toThrow();
        expect((await rows()).length).toBe(before + 1);
        await owner.query(`grant insert on supportv8.voice_tool_effects to ${role}`);
        await voice.escalate({ ...input, toolCallId: 'escalate-a', ticketReference: one.reference, reason: 'PRIVATE REASON', urgency: 'urgent' });
        await voice.escalate({ ...input, toolCallId: 'escalate-a', ticketReference: one.reference, reason: 'PRIVATE REASON', urgency: 'urgent' });
        expect((await rows()).length).toBe(before + 2);
    });
    it('voice refuses ambiguous native references without changing tickets or recording an effect', async () => { const one = await create(), two = await create(); await client.withTenantSession(target.workspaceId, db => db.query('update supportv8.issues set external_id=$1 where id=$2', [one.ticketRef, two.id])); const n = (await rows()).length; const voice = createSupportVoiceStore(client); expect(await voice.ticket(target.workspaceId, one.ticketRef)).toBeNull(); expect(await voice.escalate({ tenantId: target.workspaceId, hireId: 'employee', installationId: 'employee-install', sessionId: 'ambiguous', toolCallId: 'ambiguous', ticketReference: one.ticketRef, reason: 'PRIVATE', urgency: 'urgent' })).toBeNull(); expect((await rows()).length).toBe(n); expect((await owner.query("select 1 from supportv8.voice_tool_effects where session_id='ambiguous'")).rowCount).toBe(0); });
    it('rejects immutable event/pin rewriting and tenant-RLS reads', async () => { const r = (await rows()).find(r => r.provenance); await expect(owner.query("update supportv8.operational_outbox set provenance=null where id=$1", [r.id])).rejects.toThrow(); await expect(owner.query("update supportv8.operational_outbox set event=jsonb_set(event,'{id}','\"changed\"') where id=$1", [r.id])).rejects.toThrow(); expect(await client.withTenantSession('tenant_native_b', db => db.query('select * from supportv8.operational_outbox'))).toEqual([]); expect((await app.query('select rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0]).toEqual({ rolsuper: false, rolbypassrls: false }); });
    it('restricts worker functions and evidence writes while fixing definer search_path',async()=>{const grants=(await owner.query("select has_table_privilege($1,'supportv8.operational_qualifications','INSERT') insert_qualification,has_table_privilege($1,'supportv8.operational_outbox','UPDATE') update_evidence",[role])).rows[0];expect(grants).toEqual({insert_qualification:false,update_evidence:false});const functions=(await owner.query("select p.prosecdef,p.proconfig,exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='supportv8' and p.proname in('capture_operational_issue','claim_operational_outbox','finish_operational_outbox','qualify_operational_source')")).rows;expect(functions).toHaveLength(4);expect(functions.every(f=>f.prosecdef&&!f.public_execute&&f.proconfig.includes('search_path=pg_catalog, supportv8'))).toBe(true);});
    it('removes bootstrap-inherited evidence DML without changing unrelated default privileges',async()=>{
      for(const table of ['operational_outbox','operational_qualifications']){
        for(const role of ['supportv8_app','supportv8_relay','supportv8_scaler']){
          const allowed=(await owner.query("select has_table_privilege($1,$2,'INSERT') i,has_table_privilege($1,$2,'UPDATE') u,has_table_privilege($1,$2,'DELETE') d",[role,'supportv8.'+table])).rows[0];
          expect(allowed).toEqual({i:false,u:false,d:false});
        }
        await expect(client.withTenantSession(target.workspaceId,db=>db.query(`update supportv8.${table} set native_workspace_id=native_workspace_id`))).rejects.toThrow(/permission denied/);
        await expect(client.withTenantSession(target.workspaceId,db=>db.query(`delete from supportv8.${table}`))).rejects.toThrow(/permission denied/);
        await expect(client.withTenantSession(target.workspaceId,db=>db.query(`insert into supportv8.${table} default values`))).rejects.toThrow(/permission denied/);
      }
      await owner.query('create table supportv8.default_acl_after_probe(id text)');
      expect((await owner.query("select has_table_privilege('supportv8_app','supportv8.default_acl_after_probe','INSERT,UPDATE,DELETE') inherited")).rows[0].inherited).toBe(true);
    });
    it('fences stale workers including same owner after restart', async () => { const [first] = await store.claim('same-owner', 1); await owner.query("update supportv8.operational_outbox set lease_expires_at=now()-interval '1 second' where id=$1", [first.id]); const [current] = await store.claim('same-owner', 1); expect(current.id).toBe(first.id); expect(current.lease_token).not.toBe(first.lease_token); await expect(store.finish(first, 'retry', 'delivery_unavailable')).rejects.toThrow(/lease lost/); await store.finish(current, 'retry', 'delivery_unavailable'); });
    it('retries unknown receipt outcomes with immutable identity and only valid complete ACKs deliver', async () => { await owner.query("update supportv8.operational_outbox set next_attempt_at=now(),lease_expires_at=null where state='pending'"); let mode = 'after-receipt'; let calls = 0; const send = async (row: any) => { calls++; if (mode === 'before-receipt')
        throw Error('crash'); const receipt = await recordFixtureReceipt(app, row); if (mode === 'after-receipt')
        throw Error('lost response'); if (mode === 'partial')
        return { status: 202, body: { receiptId: (receipt.body as any).receiptId } }; if (mode === 'foreign')
        return { status: receipt.status, body: { ...receipt.body, tenantId: 'foreign' } }; return receipt; }; const options = { store, verify: async () => true, send, enabled: true, limit: 64 }; for (const m of ['before-receipt', 'after-receipt', 'partial', 'foreign']) {
        mode = m;
        await drainOperationalOutbox(options);
        await owner.query("update supportv8.operational_outbox set next_attempt_at=now() where state='pending'");
        expect((await rows()).filter(r => r.state === 'delivered')).toHaveLength(0);
    } mode = 'valid'; for (let i = 0; i < 4; i++)
        await drainOperationalOutbox(options); expect((await rows()).filter(r => r.provenance && r.state !== 'delivered')).toHaveLength(0); const normalized = Number((await owner.query('select count(*) from support_receiver_fixture.normalized')).rows[0].count); expect(normalized).toBe((await rows()).filter(r => r.provenance).length); expect(calls).toBeGreaterThan(normalized); });
    it.each([['before-receipt', 72], ['after-receipt', 73], ['after-ack', 74]])('recovers a real worker process exit %s without duplicate normalized facts', async (mode, exitCode) => { const t = await create(); const row = (await rows()).find(r => r.event.subject === 'ticket:' + t.id); const outcome = spawnSync(process.execPath, ['--import', 'tsx', 'test/fixtures/support-outbox-crash-worker.ts', app.options.connectionString!, String(mode)], { encoding: 'utf8', timeout: 20000, env: process.env }); expect(outcome.status, outcome.stderr).toBe(exitCode); const crashed = (await rows()).find(r => r.id === row.id); expect(crashed.state).toBe('pending'); expect(crashed.lease_owner).toBe('crashing-worker'); const receiverBefore = Number((await owner.query('select count(*) from support_receiver_fixture.receipts where event_id=$1', [row.event.id])).rows[0].count); expect(receiverBefore).toBe(mode === 'before-receipt' ? 0 : 1); await owner.query("update supportv8.operational_outbox set lease_expires_at=now()-interval '1 second',next_attempt_at=now() where id=$1", [row.id]); await drainOperationalOutbox({ store: new OperationalOutboxStore(app), enabled: true, limit: 1, verify: async () => true, send: r => recordFixtureReceipt(app, r) }); const delivered = (await rows()).find(r => r.id === row.id); expect(delivered.state).toBe('delivered'); expect(delivered.event).toEqual(row.event); expect(delivered.provenance).toEqual(row.provenance); expect((await owner.query('select event_id from support_receiver_fixture.normalized where event_id=$1', [row.event.id])).rowCount).toBe(1); });
    it('SQL completion rejects partial/foreign ACKs, wrong HTTP pairing and stale qualification leases', async () => { const t = await create(); const [row] = await store.claim('ack-test', 1); expect(row.event.subject).toBe('ticket:' + t.id); const receipt = await recordFixtureReceipt(app, row); for (const ack of [{ receiptId: 'partial' }, { ...receipt.body, accountId: 'foreign' }, { ...receipt.body, extra: 1 }])
        await expect(store.finish(row, 'delivered', null, ack, receipt.status)).rejects.toThrow('invalid operational receipt'); await expect(store.finish(row, 'delivered', null, receipt.body, receipt.status === 202 ? 200 : 202)).rejects.toThrow('invalid operational receipt'); await expect(client.withTenantSession(target.workspaceId, db => db.query('select supportv8.qualify_operational_source($1,$2,$3,$4)', ['wrong-worker', target.installationId, pin(), certificate()]))).rejects.toThrow(/lease or owner lost/); await store.finish(row, 'delivered', null, receipt.body, receipt.status); });
    it('concurrent bounded claims are disjoint and both canonical tenants progress', async () => { const other = { accountId: 'account-b', tenantId: 'registry-b', installationId: 'install-b', workspaceId: 'tenant_native_b' }; await qualify(other); for (let i = 0; i < 6; i++)
        await create(); for (let i = 0; i < 2; i++)
        await new RuntimeSupportTicketReader({ client, resolve: async (s) => ({ ...s, capability: 'support:manage', email: 'b@test.invalid', domain: 'b' }) }).create({ ...other, verticalId: 'runtime', subject: 'b' }, { priority: 'normal', customerName: 'B', summary: 'B' }); const [one, two] = await Promise.all([store.claim('parallel-one', 64), new OperationalOutboxStore(app).claim('parallel-two', 64)]); const all = [...one, ...two]; expect(new Set(all.map(r => r.id)).size).toBe(all.length); expect(new Set(all.map(r => r.provenance.accountId))).toEqual(new Set(['account-a', 'account-b'])); for (const r of all) {
        expect(r.provenance.tenantId).toBe(r.provenance.accountId === 'account-a' ? 'registry-a' : 'registry-b');
        const ack = await recordFixtureReceipt(app, r);
        await store.finish(r, 'delivered', null, ack.body, ack.status);
    } });
    it('fresh owner denial never sends, including a new tenant and revoked source', async () => {
      const t = { accountId: 'account-b', tenantId: 'registry-b', installationId: 'install-b', workspaceId: 'tenant_native_b' };
      await qualify(t);
      const otherReader=new RuntimeSupportTicketReader({ client, resolve: async (s) => ({ ...s, capability: 'support:manage', email: 'b@test.invalid', domain: 'b' }) });
      const issue=await otherReader.create({ ...t, verticalId: 'runtime', subject: 'b' }, { priority: 'normal', customerName: 'B', summary: 'B' });
      const revoked=(await rows()).find(r=>r.event.subject==='ticket:'+issue.id);
      expect(revoked.provenance).toMatchObject(t);
      expect(await currentLocalSource(t, client)).toBe(true);
      expect(await currentLocalSource({ ...t, installationId: 'employee-install' }, client)).toBe(false);
      await owner.query("update supportv8.runtime_support_workspaces set state='tombstoned',deleted_at=now() where installation_id=$1", [t.installationId]);
      expect(await currentLocalSource(t, client)).toBe(false);
      let revokedSends=0,revokedVerified=0;
      await drainOperationalOutbox({ store, enabled: true, limit: 64,
        verify: async r=>{if(r.id===revoked.id){expect(r.provenance).toMatchObject(t);expect(r.event.id).toBe(revoked.event.id);revokedVerified++;}return currentLocalSource(r.provenance,client);},
        send: async r=>{if(r.provenance.accountId===t.accountId&&r.provenance.tenantId===t.tenantId&&r.provenance.installationId===t.installationId&&r.event.id===revoked.event.id){revokedSends++;throw Error('must not send revoked fact');}return recordFixtureReceipt(app,r);}
      });
      expect(revokedVerified).toBe(1);expect(revokedSends).toBe(0);
      expect((await rows()).find(r=>r.id===revoked.id)).toMatchObject({state:'pending',receipt:null,receipt_http_status:null,delivered_at:null,last_error_code:'operational_source_denied'});
      const before=(await rows()).length;
      const preserved=await otherReader.create({ ...t, verticalId: 'runtime', subject: 'b' }, { priority: 'normal', customerName: 'B', summary: 'Preserved after owner revocation' });
      expect((await rows()).length).toBe(before+1);
      expect((await rows()).find(r=>r.event.subject==='ticket:'+preserved.id)).toMatchObject({state:'pending_authority',provenance:null,last_error_code:'native_binding_unavailable'});
    });
    // Fix-round1 real-SQL regressions. GitOps executes these against its owned
    // isolated fixture; actual GREEN remains required for each source candidate.
    it.each(['operational_outbox','runtime_support_workspaces','managed_support_registration_jobs'])('bounds real locked SQL and releases its connection: %s',async table=>{
      const blocker=await owner.connect();await blocker.query('begin');await blocker.query(`lock table supportv8.${table} in access exclusive mode`);
      const budget:OperationalSqlBudget={deadline:Date.now()+120};
      const task=table==='operational_outbox'?store.claim('blocked-table',1,budget):table==='runtime_support_workspaces'?currentLocalSource(target,client,budget):client.withWorkspaceProvisioningSession({tenantId:target.workspaceId,accountId:target.accountId,registryTenantId:target.tenantId},db=>db.query('select supportv8.qualify_operational_source($1,$2,$3,$4)',['qualifier',target.installationId,pin(),certificate()]),budget);
      try{const outcome=await Promise.race([task.then(()=> 'resolved',()=> 'rejected'),new Promise<string>(r=>setTimeout(()=>r('still_pending'),500))]);expect(outcome).toBe('rejected');}
      finally{await blocker.query('rollback');blocker.release();await task.catch(()=>{});}
      expect(await currentLocalSource(target,client)).toBe(true);
      expect(Number((await owner.query("select count(*) from pg_stat_activity where usename=$1 and datname=current_database() and state='idle in transaction'",[role])).rows[0].count)).toBe(0);
    });
    it('refuses real pool exhaustion without queued claims, then recovers after the fixture releases',async()=>{
      const pool=new Pool({connectionString:app.options.connectionString,Client:OperationalPgClient,connectionTimeoutMillis:1000,max:1});
      const busy=new OperationalOutboxStore(pool),held=await pool.connect();
      try{for(let i=0;i<3;i++)await expect(busy.claim('pool-full',1,{deadline:Date.now()+100})).rejects.toThrow('operational_sql_pool_busy');expect(pool.waitingCount).toBe(0);expect(pool.totalCount).toBe(1);}
      finally{held.release();}
      try{expect(Array.isArray(await busy.claim('pool-recovered',1))).toBe(true);}finally{await pool.end();}
    });
    it('blocked delivery completion settles without a persisted ACK or late delivered state',async()=>{
      await create();const [row]=await store.claim('blocked-ack',1);const receipt=await recordFixtureReceipt(app,row);const blocker=await owner.connect();await blocker.query('begin');await blocker.query('select id from supportv8.operational_outbox where id=$1 for update',[row.id]);
      const task=store.finish(row,'delivered',null,receipt.body,receipt.status,{deadline:Date.now()+120});
      try{const outcome=await Promise.race([task.then(()=> 'resolved',()=> 'rejected'),new Promise<string>(r=>setTimeout(()=>r('still_pending'),500))]);expect(outcome).toBe('rejected');}
      finally{await blocker.query('rollback');blocker.release();await task.catch(()=>{});}
      const held=(await rows()).find(r=>r.id===row.id);expect(held.state).toBe('pending');expect(held.receipt).toBeNull();await store.finish(row,'delivered',null,receipt.body,receipt.status);
    });
    it.each(['outbox','qualification'])('rejects a lease expiring while the actual SQL row lock waits: %s',async kind=>{
      const blocker=await owner.connect();await blocker.query('begin');let row:any,task:Promise<unknown>;
      if(kind==='outbox'){
        await create();[row]=await store.claim('expires-under-lock',1);const receipt=await recordFixtureReceipt(app,row);
        await owner.query("update supportv8.operational_outbox set lease_expires_at=clock_timestamp()+interval '120 milliseconds' where id=$1",[row.id]);
        await blocker.query('select id from supportv8.operational_outbox where id=$1 for update',[row.id]);
        task=store.finish(row,'delivered',null,receipt.body,receipt.status,{deadline:Date.now()+800});
      }else{
        await owner.query("update supportv8.managed_support_registration_jobs set lease_owner='expires-under-lock',lease_expires_at=clock_timestamp()+interval '120 milliseconds' where installation_id=$1",[target.installationId]);
        await blocker.query('select installation_id from supportv8.runtime_support_workspaces where installation_id=$1 for update',[target.installationId]);
        task=client.withWorkspaceProvisioningSession({tenantId:target.workspaceId,accountId:target.accountId,registryTenantId:target.tenantId},db=>db.query('select supportv8.qualify_operational_source($1,$2,$3,$4)',['expires-under-lock',target.installationId,pin(),certificate()]),{deadline:Date.now()+800});
      }
      const unlock=new Promise<void>(resolve=>setTimeout(()=>{void blocker.query('rollback').then(()=>resolve());},250));
      try{await expect(task).rejects.toThrow(/lease/);}finally{await unlock;blocker.release();}
      if(kind==='outbox'){const held=(await rows()).find(r=>r.id===row.id);expect(held.state).toBe('pending');expect(held.receipt).toBeNull();}
    });

});

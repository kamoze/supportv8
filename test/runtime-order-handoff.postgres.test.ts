import {randomUUID} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {pgClient} from '@/lib/db/pg-client';
import {orderHandoffStore} from '@/lib/runtime/order-handoff-store';

describe.skipIf(!process.env.SUPPORTV8_TEST_DATABASE_URL)('SupportV8 order handoff PostgreSQL boundary',()=>{
  it('creates one tenant-scoped ticket and receipt for a case across retries',async()=>{
    const suffix=randomUUID().replaceAll('-','').slice(0,18);
    const tenantId=`tenant_${suffix}`;
    const otherTenant=`tenant_other_${suffix}`;
    const accountId=`account_${suffix}`;
    await pgClient.withTenantSession(tenantId,async db=>{
      await db.query(`INSERT INTO supportv8.tenants(id,domain,servicev8_account_id) VALUES($1,$2,$3),($4,$5,$6)`,[tenantId,`domain-${suffix}`,accountId,otherTenant,`other-${suffix}`,`other-account-${suffix}`]);
      await db.query(`INSERT INTO supportv8.knowledge_articles(title,summary,url,status,content) VALUES('Delayed order guidance','Review the accepted case and confirm ownership.',NULL,'active','delayed order')`);
    });
    const input={tenantId,caseRef:`case_${suffix}`,objectiveId:`objective_${suffix}`,installationId:`sophia_install_${suffix}`,hireId:`sophia_hire_${suffix}`,responseDueAt:'2026-09-14T17:00:00.000Z',nextStep:'Review the accepted case and confirm ownership.',knowledgeTitle:'Delayed order guidance'};
    const first=await orderHandoffStore.create(input);
    expect(first).toMatchObject({receiptRef:`supportv8:order-handoff:${input.caseRef}`,owner:'Sophia',nextStep:input.nextStep});
    expect(await orderHandoffStore.create(input)).toEqual(first);
    expect(await orderHandoffStore.get(tenantId,input.caseRef)).toMatchObject({ticketReference:first.ticketReference,objectiveId:input.objectiveId,installationId:input.installationId,hireId:input.hireId});
    await expect(orderHandoffStore.create({...input,hireId:'another-hire'})).rejects.toThrow('order_handoff_conflict');
    const own=await pgClient.withTenantSession(tenantId,db=>db.query<{external_id:string;customer_name:string;customer_ref:string}>(`SELECT external_id,customer_name,customer_ref FROM supportv8.issues WHERE external_id=$1`,[first.ticketReference]));
    expect(own).toEqual([{external_id:first.ticketReference,customer_name:'OrderV8 customer',customer_ref:input.caseRef}]);
    const other=await pgClient.withTenantSession(otherTenant,db=>db.query(`SELECT external_id FROM supportv8.issues WHERE external_id=$1`,[first.ticketReference]));
    expect(other).toEqual([]);
  });
});

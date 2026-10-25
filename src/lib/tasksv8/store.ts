import { pgClient, type PostgresClient } from '../db/pg-client';
import { ManagedSupportAuthority } from '../service-app/managed-support-authority';
import { resolveOperationalSupportAccess } from '../service-app/runtime-access';
import { parseTaskWorkBinding, type TaskWorkBinding } from './contract';
import { taskWorkEventMatches, type TaskWorkReceipt } from './authority';
import type { TaskWorkSourceFact } from './policy';
export type TaskWorkOutboxRow={id:string;native_workspace_id:string;installation_id:string;account_id:string;registry_tenant_id:string;issue_id:string;requested_by:string;source_revision:string|number;event:unknown;payload_digest:string;state:'pending'|'delivered';work_id:string|null;source_work_id?:string|null;lease_owner:string;lease_token:string;lease_generation:string|number};
export function taskWorkFact(row:TaskWorkOutboxRow):TaskWorkSourceFact {
 const binding=parseTaskWorkBinding({profile:'servicev8.task-work.v1',operation:'support_intake',provenanceRef:row.id,accountId:row.account_id,tenantId:row.registry_tenant_id,sourceSystem:'supportv8',sourceRecordId:row.issue_id,sourceRevision:Number(row.source_revision),workId:row.source_work_id??null,eventId:(row.event as any)?.id,payloadDigest:row.payload_digest});
 if(!binding||!taskWorkEventMatches(binding,row.event))throw Error('task_work_provenance_invalid');
 return {binding,event:row.event,requester:row.requested_by,target:{accountId:row.account_id,tenantId:row.registry_tenant_id,installationId:row.installation_id,workspaceId:row.native_workspace_id,verticalId:'runtime'}};
}
export class SupportTaskWorkStore {
 constructor(private readonly client:PostgresClient=pgClient){}
 async fact(ref:string):Promise<TaskWorkSourceFact|null>{const rows=await this.client.withSystemSession(db=>db.query<TaskWorkOutboxRow>('select * from supportv8.task_work_fact($1)',[ref]));return rows.length===1&&rows[0].state==='pending'?taskWorkFact(rows[0]):null;}
 async claim(worker:string,limit=16):Promise<TaskWorkOutboxRow[]>{return this.client.withSystemSession(db=>db.query<TaskWorkOutboxRow>('select * from supportv8.claim_task_work($1,$2)',[worker,limit]));}
 async finish(row:TaskWorkOutboxRow,receipt:unknown,error?:string,authorityExpiresAt?:number):Promise<void>{await this.client.withSystemSession(db=>db.query('select supportv8.finish_task_work($1,$2,$3,$4,$5,$6,$7)',[row.id,row.lease_owner,row.lease_generation,row.lease_token,receipt,error??null,authorityExpiresAt===undefined?null:new Date(authorityExpiresAt).toISOString()]));}
 async link(binding:TaskWorkBinding):Promise<TaskWorkOutboxRow|null>{const rows=await this.client.withSystemSession(db=>db.query<TaskWorkOutboxRow>('select * from supportv8.task_work_link($1,$2,$3,$4,$5)',[binding.accountId,binding.tenantId,binding.sourceRecordId,binding.sourceRevision,binding.workId]));return rows.length===1?rows[0]:null;}
 async record(row:TaskWorkOutboxRow,binding:TaskWorkBinding,event:unknown,authorityExpiresAt:number):Promise<TaskWorkReceipt>{const values=await this.client.withWorkspaceProvisioningSession({tenantId:row.native_workspace_id,accountId:row.account_id,registryTenantId:row.registry_tenant_id},db=>db.query<{receipt:TaskWorkReceipt}>('select supportv8.record_task_work_outcome($1,$2,$3,$4) receipt',[row.id,binding,event,new Date(authorityExpiresAt).toISOString()]));if(values.length!==1)throw Error('task_work_receipt_unavailable');return values[0].receipt;}
}
export async function currentTaskWorkSource(fact:TaskWorkSourceFact):Promise<boolean>{
 const access=await resolveOperationalSupportAccess({...fact.target,subject:fact.requester});
 if(access?.capability!=='support:manage')return false;
 const observation=await new ManagedSupportAuthority().lifecycle(fact.target);return observation.decision==='active';
}

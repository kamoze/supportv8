import { randomUUID } from 'node:crypto';
import { pgClient, type PostgresClient, type DatabaseSession } from '../db/pg-client';
import type { SupportRuntimeScope, SupportCapability } from './runtime-access';
import {
 exactMembership, validAccessRevision, SUPPORT_ACCESS_MAPPING, SUPPORT_PRODUCT,
 type AccessMembership, type AccessMapping, type AccessReceipt, type AppliedAccess, type FailureReason, type FailureStatus
} from './runtime-access-projection';

type StoredReceipt = {
 payload:AccessReceipt; failure_count:number; delivery_pending:boolean; retry_due:boolean; dead_letter:boolean;
};
type LocalSnapshot = {
 capability:SupportCapability|null; local_denied:boolean; local_capability:SupportCapability|null;
};
const receiptScope='native_tenant_id=$1 AND account_id=$2 AND registry_tenant_id=$3 AND installation_id=$4 AND identity_subject=$5';
const scopeValues=(s:SupportRuntimeScope)=>[s.workspaceId,s.accountId,s.tenantId,s.installationId,s.subject];
const backoff=`failure_count=least(failure_count+1,8),
 next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(failure_count,7)))),
 dead_letter=(failure_count+1>=8)`;
const applied=(payload:AccessReceipt):AppliedAccess=>({
 revision:payload.desiredRevision,appliedRevision:payload.appliedRevision,receiverSequence:payload.receiverSequence,
 receiptId:payload.receiptId,status:payload.status,reason:payload.reason
});

export class SupportAccessProjectionStore {
 constructor(private readonly client:PostgresClient=pgClient){}
 private run<T>(s:SupportRuntimeScope,fn:(db:DatabaseSession)=>Promise<T>){return this.client.withWorkspaceProvisioningSession({tenantId:s.workspaceId,accountId:s.accountId,registryTenantId:s.tenantId},fn);}
 async eligible(s:SupportRuntimeScope){return this.run(s,async db=>(await db.query(`SELECT installation_id FROM supportv8.runtime_support_workspaces WHERE installation_id=$1 AND native_tenant_id=$2 AND account_id=$3 AND registry_tenant_id=$4 AND vertical_id='runtime' AND state='workspace_created' AND deleted_at IS NULL`,[s.installationId,s.workspaceId,s.accountId,s.tenantId])).length===1);}
 async cursor(s:SupportRuntimeScope){return this.run(s,async db=>{await db.query(`INSERT INTO supportv8.runtime_access_cursors(native_tenant_id,account_id,registry_tenant_id,installation_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[s.workspaceId,s.accountId,s.tenantId,s.installationId]);const rows=await db.query<{after_subject:string;dead_letter:boolean;retry_due:boolean}>(`SELECT after_subject,dead_letter,next_attempt_at<=now() AS retry_due FROM supportv8.runtime_access_cursors WHERE installation_id=$1`,[s.installationId]);if(rows.length!==1)throw Error('projection_scope_mismatch');if(rows[0]!.dead_letter)throw Error('projection_dead_letter');if(!rows[0]!.retry_due)throw Error('projection_retry_not_due');return rows[0]!.after_subject;});}
 async advance(s:SupportRuntimeScope,expected:string,next:string){await this.run(s,async db=>{const rows=await db.query(`UPDATE supportv8.runtime_access_cursors SET after_subject=$3,failure_count=0,last_error=NULL,dead_letter=false,next_attempt_at=now(),updated_at=now() WHERE installation_id=$1 AND after_subject=$2 RETURNING installation_id`,[s.installationId,expected,next]);if(rows.length!==1)throw Error('projection_cursor_changed');});}
 async fail(s:SupportRuntimeScope,code:string){await this.run(s,db=>db.query(`UPDATE supportv8.runtime_access_cursors SET failure_count=least(failure_count+1,8),next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(failure_count,7)))),last_error=$2,dead_letter=(failure_count+1>=8),updated_at=now() WHERE installation_id=$1`,[s.installationId,['authority_unavailable','installation_unavailable','projection_revision_changed'].includes(code)?code:'reconciliation_unavailable']));}
 async retry(s:SupportRuntimeScope){await this.run(s,async db=>{
  await db.query(`UPDATE supportv8.runtime_access_cursors SET failure_count=0,next_attempt_at=now(),last_error=NULL,dead_letter=false WHERE installation_id=$1`,[s.installationId]);
  await db.query(`UPDATE supportv8.runtime_access_receiver_receipts SET next_attempt_at=now(),dead_letter=false,failure_count=0
   WHERE native_tenant_id=$1 AND account_id=$2 AND registry_tenant_id=$3 AND installation_id=$4`,scopeValues(s).slice(0,4));
 });}
 async targets(after:string,limit=4):Promise<SupportRuntimeScope[]>{return this.client.withSystemSession(async db=>{const rows=await db.query<{account_id:string;registry_tenant_id:string;installation_id:string;native_tenant_id:string}>(`SELECT * FROM supportv8.list_runtime_access_targets($1,$2)`,[after,limit]);return rows.map(r=>({accountId:r.account_id,tenantId:r.registry_tenant_id,installationId:r.installation_id,workspaceId:r.native_tenant_id,verticalId:'runtime',subject:'access-reconciler'}));});}
 private async readReceipt(db:DatabaseSession,s:SupportRuntimeScope):Promise<StoredReceipt|undefined>{
  const [row]=await db.query<StoredReceipt>(`SELECT payload,failure_count,delivery_pending,next_attempt_at<=now() AS retry_due,dead_letter
   FROM supportv8.runtime_access_receiver_receipts WHERE ${receiptScope}`,scopeValues(s));
  return row;
 }
 private async lockMember(db:DatabaseSession,s:SupportRuntimeScope,m:AccessMembership){
  const eligible=await db.query(`SELECT installation_id FROM supportv8.runtime_support_workspaces
   WHERE installation_id=$1 AND native_tenant_id=$2 AND account_id=$3 AND registry_tenant_id=$4
    AND vertical_id='runtime' AND state='workspace_created' AND deleted_at IS NULL`,[s.installationId,s.workspaceId,s.accountId,s.tenantId]);
  if(eligible.length!==1)throw Error('installation_unavailable');
  if(!exactMembership(s,m)||!validAccessRevision(m.revision))throw Error('authority_scope_mismatch');
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify(scopeValues(s))]);
 }
 private async saveReceipt(db:DatabaseSession,s:SupportRuntimeScope,m:AccessMembership,
  result:Pick<AppliedAccess,'appliedRevision'|'status'|'reason'>,snapshot:LocalSnapshot|null,existing:StoredReceipt|undefined){
  const previous=existing?.payload;
  const changed=await db.query(`SELECT 1 FROM supportv8.runtime_access_receiver_receipts WHERE ${receiptScope} AND policy_snapshot IS DISTINCT FROM $6::jsonb`,
   [...scopeValues(s),JSON.stringify(snapshot)]);
  if(previous&&previous.desiredRevision===m.revision&&previous.appliedRevision===result.appliedRevision
   &&previous.status===result.status&&previous.reason===result.reason&&previous.mappingVersion===SUPPORT_ACCESS_MAPPING&&!changed.length)return applied(previous);
  const payload:AccessReceipt={
   accountId:s.accountId,subject:s.subject,installationId:s.installationId,productId:SUPPORT_PRODUCT,
   desiredRevision:m.revision,appliedRevision:result.appliedRevision,receiverSequence:(previous?.receiverSequence??0)+1,
   mappingVersion:SUPPORT_ACCESS_MAPPING,status:result.status,receiptId:randomUUID(),reason:result.reason
  };
  if(!validAccessRevision(payload.receiverSequence))throw Error('receiver_sequence_exhausted');
  await db.query(`INSERT INTO supportv8.runtime_access_receiver_receipts
   (native_tenant_id,account_id,registry_tenant_id,installation_id,identity_subject,desired_revision,receiver_sequence,receipt_id,payload,policy_snapshot)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
   ON CONFLICT(native_tenant_id,account_id,registry_tenant_id,installation_id,identity_subject)
   DO UPDATE SET desired_revision=EXCLUDED.desired_revision,receiver_sequence=EXCLUDED.receiver_sequence,
    receipt_id=EXCLUDED.receipt_id,payload=EXCLUDED.payload,policy_snapshot=EXCLUDED.policy_snapshot,delivery_pending=true,
    failure_count=CASE WHEN runtime_access_receiver_receipts.desired_revision=EXCLUDED.desired_revision THEN runtime_access_receiver_receipts.failure_count ELSE 0 END,
    next_attempt_at=now(),dead_letter=false`,
   [...scopeValues(s),m.revision,payload.receiverSequence,payload.receiptId,JSON.stringify(payload),JSON.stringify(snapshot)]);
  return applied(payload);
 }
 async apply(s:SupportRuntimeScope,m:AccessMembership,mapping:AccessMapping):Promise<AppliedAccess>{return this.run(s,async db=>{
  await this.lockMember(db,s,m);
  const existing=await this.readReceipt(db,s);
  if(existing&&existing.payload.desiredRevision>m.revision)return applied(existing.payload);
  await db.query(`INSERT INTO supportv8.runtime_access_projections(native_tenant_id,account_id,registry_tenant_id,installation_id,identity_subject,applied_revision,mapping_version,group_ids,capability,status,receipt_id)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)
   ON CONFLICT(installation_id,identity_subject) DO UPDATE SET applied_revision=EXCLUDED.applied_revision,mapping_version=EXCLUDED.mapping_version,group_ids=EXCLUDED.group_ids,capability=EXCLUDED.capability,status=EXCLUDED.status,receipt_id=EXCLUDED.receipt_id,updated_at=now()
   WHERE supportv8.runtime_access_projections.applied_revision<EXCLUDED.applied_revision`,[...scopeValues(s),m.revision,SUPPORT_ACCESS_MAPPING,JSON.stringify(Array.isArray(m.groupIds)?m.groupIds:[]),mapping.capability,mapping.status,randomUUID()]);
  const [row]=await db.query<LocalSnapshot&{applied_revision:string;status:AccessMapping['status']}>(`
   SELECT applied_revision,status,capability,local_denied,local_capability FROM supportv8.runtime_access_projections
   WHERE ${receiptScope} FOR UPDATE`,scopeValues(s));
  if(!row)throw Error('projection_scope_mismatch');
  if(Number(row.applied_revision)!==m.revision)throw Error('projection_revision_changed');
  const snapshot={capability:row.capability,local_denied:row.local_denied,local_capability:row.local_capability};
  const limited=row.status==='synced'&&(row.local_denied||(row.capability==='support:manage'&&row.local_capability==='support:read'));
  const status=limited?'blocked':row.status;
  const reason=status==='blocked'?(limited?'local_policy_blocked':'mapping_blocked'):status==='revoked'?'membership_inactive':null;
  return this.saveReceipt(db,s,m,{appliedRevision:m.revision,status,reason},snapshot,existing);
 });}
 async attemptMember(s:SupportRuntimeScope,revision:number){return this.run(s,async db=>{
  const row=await this.readReceipt(db,s);
  return !row||row.payload.desiredRevision<revision||(row.payload.desiredRevision===revision&&!row.dead_letter&&row.retry_due);
 });}
 async pendingReceipt(s:SupportRuntimeScope,revision:number){return this.run(s,async db=>{
  const row=await this.readReceipt(db,s);
  return row?.payload.desiredRevision===revision&&row.delivery_pending?applied(row.payload):null;
 });}
 async memberFailure(s:SupportRuntimeScope,m:AccessMembership,status:FailureStatus,reason:FailureReason){return this.run(s,async db=>{
  await this.lockMember(db,s,m);
  const existing=await this.readReceipt(db,s);
  if(existing&&existing.payload.desiredRevision>m.revision)return applied(existing.payload);
  const [projection]=await db.query<{applied_revision:string}>(`SELECT applied_revision FROM supportv8.runtime_access_projections WHERE ${receiptScope}`,scopeValues(s));
  if(projection&&Number(projection.applied_revision)>m.revision)throw Error('projection_revision_changed');
  const receipt=await this.saveReceipt(db,s,m,{appliedRevision:null,status,reason},null,existing);
  await db.query(`UPDATE supportv8.runtime_access_receiver_receipts SET ${backoff} WHERE ${receiptScope} AND receipt_id=$6`,[...scopeValues(s),receipt.receiptId]);
  return receipt;
 });}
 async deliveryFailed(s:SupportRuntimeScope,receipt:AppliedAccess){await this.run(s,db=>db.query(`
  UPDATE supportv8.runtime_access_receiver_receipts SET delivery_pending=true,
   ${backoff} WHERE ${receiptScope} AND receipt_id=$6 AND delivery_pending AND next_attempt_at<=now()`,[...scopeValues(s),receipt.receiptId]));}
 async delivered(s:SupportRuntimeScope,receipt:AppliedAccess){await this.run(s,db=>db.query(`
  UPDATE supportv8.runtime_access_receiver_receipts SET delivery_pending=false,
   failure_count=CASE WHEN $7 THEN 0 ELSE failure_count END,
   next_attempt_at=CASE WHEN $7 THEN now() ELSE next_attempt_at END,dead_letter=CASE WHEN $7 THEN false ELSE dead_letter END
   WHERE ${receiptScope} AND receipt_id=$6`,[...scopeValues(s),receipt.receiptId,receipt.appliedRevision!==null]));}
 async restriction(s:SupportRuntimeScope):Promise<{denied:boolean;capability:SupportCapability|null}|null>{return this.run(s,async db=>{const rows=await db.query<{status:string;capability:SupportCapability|null;local_denied:boolean;local_capability:SupportCapability|null}>(`SELECT status,capability,local_denied,local_capability FROM supportv8.runtime_access_projections WHERE installation_id=$1 AND identity_subject=$2`,[s.installationId,s.subject]);if(!rows.length)return null;const r=rows[0]!;return {denied:r.local_denied||r.status!=='synced',capability:r.capability==='support:read'||r.local_capability==='support:read'?'support:read':r.capability};});}
}

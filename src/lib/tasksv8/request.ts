import { authorizeRuntimeSupportRequest,trustedRuntimeTenantHost } from '../service-app/runtime-session';
import { boundedJson } from './http';
import { pgClient,type PostgresClient } from '../db/pg-client';
import { exact,identifier,taskWorkUuid } from './contract';
import { taskWorkCanonical,taskWorkDigest } from './authority';
type Work={projectRef:string;workKind:'support_escalation';title:string;problemStatement:string;desiredOutcome:string;acceptanceCriteria:string[];constraints:string[];nonGoals:string[];requiredDeliverables:string[];verificationMethod:string;priority:'low'|'medium'|'high'|'urgent';severity:'none'|'minor'|'major'|'critical';labels:string[]};
export type SupportTaskWorkRequest={idempotencyKey:string;expectedTicketDigest:string;work:Work};
export function parseSupportTaskWorkRequest(value:unknown):SupportTaskWorkRequest|null {
 if(!exact(value,['idempotencyKey','expectedTicketDigest','work'])||!taskWorkUuid(value.idempotencyKey)||typeof value.expectedTicketDigest!=='string'||!/^[a-f0-9]{64}$/.test(value.expectedTicketDigest)||/^0+$/.test(value.expectedTicketDigest))return null;
 const w=value.work;if(!exact(w,['projectRef','workKind','title','problemStatement','desiredOutcome','acceptanceCriteria','constraints','nonGoals','requiredDeliverables','verificationMethod','priority','severity','labels'])||!identifier(w.projectRef)||w.workKind!=='support_escalation'||!['title','problemStatement','desiredOutcome','verificationMethod'].every(k=>typeof w[k]==='string'&&(w[k] as string).trim().length>0&&(w[k] as string).length<=(k==='title'?500:k==='verificationMethod'?1000:10000))||!['low','medium','high','urgent'].includes(String(w.priority))||!['none','minor','major','critical'].includes(String(w.severity)))return null;
 if(!['acceptanceCriteria','constraints','nonGoals','requiredDeliverables','labels'].every(k=>Array.isArray(w[k])&&(w[k] as unknown[]).length<=100&&(w[k] as unknown[]).every(v=>typeof v==='string'&&v.trim().length>0&&v.length<=(k==='labels'?100:1000)))||!(w.acceptanceCriteria as unknown[]).length||!(w.requiredDeliverables as unknown[]).length)return null;
 return value as SupportTaskWorkRequest;
}
export function createSupportTaskWorkRequestHandler(input:{authorize?:typeof authorizeRuntimeSupportRequest;client?:PostgresClient;enabled?:()=>boolean}={}) {
 return async(request:Request,issueId:string):Promise<Response>=>{
  const fail=(status:number,error:string)=>Response.json({error},{status,headers:{'cache-control':'no-store'}});
  if(!(input.enabled??(()=>process.env.SUPPORT_TASK_WORK_ENABLED==='true'))())return fail(503,'task_work_unavailable');
  if(!['GET','POST'].includes(request.method))return fail(405,'method_not_allowed');
  const host=trustedRuntimeTenantHost(request);if(!host||(request.method==='POST'&&request.headers.get('origin')!==`https://${host}`)||request.headers.has('authorization'))return fail(403,'same_origin_manager_required');
  try{
   const authorize=input.authorize??authorizeRuntimeSupportRequest,first=await authorize(request);
   if(!first)return fail(401,'authentication_required');if(first.role!=='support:manage')return fail(403,'support_management_required');
   if(!identifier(issueId))return fail(400,'invalid_ticket');
   if(request.method==='GET'){const s=first.session;const values=await(input.client??pgClient).withWorkspaceProvisioningSession({tenantId:s.workspaceId,accountId:s.accountId,registryTenantId:s.tenantId},db=>db.query("select jsonb_build_object('id',id,'summary',summary,'status',source_status,'priority',priority,'updatedAt',updated_at) snapshot from supportv8.issues where id=$1 and tenant_id=$2",[issueId,s.workspaceId]));if(values.length!==1)return fail(404,'ticket_not_found');return Response.json({ticket:values[0].snapshot,ticketDigest:taskWorkDigest(values[0].snapshot)},{headers:{'cache-control':'no-store'}});}
   let body:SupportTaskWorkRequest|null;try{body=parseSupportTaskWorkRequest(await boundedJson(request,32768));}catch{return fail(400,'invalid_task_work_request');}if(!body)return fail(400,'invalid_task_work_request');
   const current=await authorize(request);if(!current||current.role!=='support:manage'||taskWorkCanonical(current.session)!==taskWorkCanonical(first.session))return fail(403,'support_management_required');
   const s=current.session,rows=await(input.client??pgClient).withWorkspaceProvisioningSession({tenantId:s.workspaceId,accountId:s.accountId,registryTenantId:s.tenantId},db=>db.query('select id,state,source_revision from supportv8.request_task_work($1,$2,$3,$4)',[body.idempotencyKey,issueId,s.sub,body]));
   if(rows.length!==1)throw Error('task_work_unavailable');
   return Response.json({requestId:rows[0].id,state:rows[0].state,sourceRevision:Number(rows[0].source_revision)},{status:202,headers:{'cache-control':'no-store'}});
  }catch(error){const code=(error as {code?:string}).code;return fail(code==='42501'?403:code==='23505'?409:503,code==='23505'?'task_work_request_conflict':'task_work_unavailable');}
 };
}

import { boundedJson } from './http';
import { exact,identifier,type TaskWorkRequest } from './contract';
import { taskWorkCanonical, type createTaskWorkVerifier } from './authority';
import { taskWorkEndpoint } from './transport';
import { taskWorkFact,type SupportTaskWorkStore } from './store';
import type { TaskWorkSourceFact } from './policy';
export async function drainSupportTaskWork(input:{store:Pick<SupportTaskWorkStore,'claim'|'finish'>;current:(fact:TaskWorkSourceFact)=>Promise<boolean>;issue:(selector:TaskWorkRequest,signal:AbortSignal)=>Promise<string>;verify:ReturnType<typeof createTaskWorkVerifier>;tasksUrl:string;request?:typeof fetch;workerId:string;signal?:AbortSignal}) {
 const url=taskWorkEndpoint(input.tasksUrl);if(url.pathname!=='/')throw Error('task_work_configuration_required');url.pathname='/v1/work-intake/events';
 const rows=await input.store.claim(input.workerId,1);let delivered=0,failed=0;
 for(const row of rows){try{
  const signal=AbortSignal.any([input.signal??new AbortController().signal,AbortSignal.timeout(20000)]),fact=taskWorkFact(row);
  if(!await input.current(fact))throw Error('task_work_source_denied');signal.throwIfAborted();
  const token=await input.issue({schemaVersion:1,operation:'support_intake',provenanceRef:row.id,correlationId:row.id},signal);
  const verified=await input.verify(token,'support_intake',row.event);
  if(!verified||taskWorkCanonical(verified)!==taskWorkCanonical(fact.binding))throw Error('task_work_credential_mismatch');
  if(!await input.current(fact)||!await input.verify(token,'support_intake',row.event))throw Error('task_work_source_denied');signal.throwIfAborted();
  const response=await(input.request??fetch)(url,{method:'POST',redirect:'error',cache:'no-store',signal,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(row.event)});
  if(![200,201].includes(response.status)||response.redirected){void response.body?.cancel().catch(()=>{});throw Error('task_work_delivery_unavailable');}
  const ack=await boundedJson(response,8192,signal);
  if(!exact(ack,['receiptId','eventId','state','scope','workId','payloadDigest','sourceRevision'])||typeof ack.receiptId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(ack.receiptId)||ack.eventId!==fact.binding.eventId||!['recorded','duplicate'].includes(String(ack.state))||!exact(ack.scope,['accountId','tenantId'])||ack.scope.accountId!==fact.binding.accountId||ack.scope.tenantId!==fact.binding.tenantId||!identifier(ack.workId)||ack.payloadDigest!==fact.binding.payloadDigest||ack.sourceRevision!==fact.binding.sourceRevision)throw Error('task_work_receipt_mismatch');
  if(!await input.current(fact))throw Error('task_work_source_denied');signal.throwIfAborted();await input.store.finish(row,ack);delivered++;
 }catch{failed++;await input.store.finish(row,null,'task_work_delivery_unavailable');}}
 return {claimed:rows.length,delivered,failed};
}

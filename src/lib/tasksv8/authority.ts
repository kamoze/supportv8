import { createHash, type KeyObject } from 'node:crypto';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { exact, identifier, parseTaskWorkBinding, taskWorkActor, taskWorkOperations, taskWorkProfile, taskWorkUuid, type TaskWorkBinding, type TaskWorkOperation } from './contract';

export function taskWorkCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(taskWorkCanonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${taskWorkCanonical((value as Record<string,unknown>)[k])}`).join(',')}}`;
  const result=JSON.stringify(value); if(result===undefined) throw Error('task_work_invalid_json'); return result;
}
export function taskWorkDigest(value: unknown): string { return createHash('sha256').update(taskWorkCanonical(value)).digest('hex'); }
export function taskWorkEventMatches(binding: TaskWorkBinding, value: unknown): boolean {
  if(!value || typeof value!=='object' || Array.isArray(value))return false;
  const event=value as Record<string,any>, data=event.data;
  if(event.id!==binding.eventId || taskWorkDigest(event)!==binding.payloadDigest || !data || typeof data!=='object')return false;
  if(binding.operation.endsWith('_intake'))return event.source===`urn:servicev8:${binding.sourceSystem}` && event.type==='servicev8.work-intake.v1' && data.source?.system===binding.sourceSystem && data.source?.recordId===binding.sourceRecordId && data.source?.revision===binding.sourceRevision;
  if(binding.operation==='dominion_verification')return event.source==='urn:servicev8:dominion' && event.type==='servicev8.work-verification.v1' && data.workId===binding.workId && data.verifier==='dominion' && data.sourceIncidentId===binding.sourceRecordId && data.sourceRevision===binding.sourceRevision;
  return event.source==='urn:servicev8:tasksv8' && event.type==='servicev8.work-outcome.v1' && data.eventId===binding.eventId && data.workId===binding.workId && Array.isArray(data.sourceReferences) && data.sourceReferences.filter((r:any)=>r?.system===binding.sourceSystem).length===1 && data.sourceReferences.some((r:any)=>r?.system===binding.sourceSystem && r.recordId===binding.sourceRecordId);
}
const allowedClaims=['iss','aud','sub','azp','iat','nbf','exp','jti','calling_service','actor','scope','capabilities','purpose','account_id','tenant_id','task_work_profile','task_work_operation','task_work_binding'];
export function createTaskWorkVerifier(input:{issuer:string;key:JWTVerifyGetKey|KeyObject|CryptoKey;clients:Partial<Record<'tasks'|'supportv8'|'dominion',string>>}) {
  const url=new URL(input.issuer);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('task_work_configuration_required');
  return async(token:string,operation:TaskWorkOperation,event:unknown):Promise<TaskWorkBinding|null>=>{
    try {
      if(!token || token.length>16384)return null;
      const rule=taskWorkOperations[operation], {payload:p}=await jwtVerify(token,input.key as JWTVerifyGetKey,{issuer:input.issuer,audience:rule.audience,algorithms:['RS256'],requiredClaims:allowedClaims,clockTolerance:0});
      const now=Math.floor(Date.now()/1000), binding=parseTaskWorkBinding(p.task_work_binding);
      if(!binding || !exact(p,allowedClaims) || p.aud!==rule.audience || p.sub!==`service:${rule.producer}` || !input.clients[rule.producer] || p.azp!==input.clients[rule.producer] || p.calling_service!==rule.producer || p.scope!==rule.scope || taskWorkCanonical(p.actor)!==taskWorkCanonical(taskWorkActor) || taskWorkCanonical(p.capabilities)!==taskWorkCanonical([rule.scope]) || p.purpose!=='event_publish' || p.task_work_profile!==taskWorkProfile || p.task_work_operation!==operation || binding.operation!==operation || p.account_id!==binding.accountId || p.tenant_id!==binding.tenantId || !identifier(p.jti) || !Number.isSafeInteger(p.iat) || !Number.isSafeInteger(p.nbf) || !Number.isSafeInteger(p.exp) || p.nbf!==p.iat || p.iat!>now || p.exp!<=now || p.exp!<=p.iat! || p.exp!-p.iat!>120 || !taskWorkEventMatches(binding,event))return null;
      return binding;
    }catch{return null;}
  };
}
export type TaskWorkReceipt={receiptId:string;eventId:string;state:'recorded'|'duplicate';scope:{accountId:string;tenantId:string};workId:string;payloadDigest:string};
export function parseTaskWorkReceipt(value:unknown,binding:TaskWorkBinding):TaskWorkReceipt|null {
  if(!exact(value,['receiptId','eventId','state','scope','workId','payloadDigest']) || !taskWorkUuid(value.receiptId) || !['recorded','duplicate'].includes(String(value.state)) || !exact(value.scope,['accountId','tenantId']) || value.scope.accountId!==binding.accountId || value.scope.tenantId!==binding.tenantId || value.workId!==binding.workId || value.eventId!==binding.eventId || value.payloadDigest!==binding.payloadDigest)return null;
  return value as TaskWorkReceipt;
}

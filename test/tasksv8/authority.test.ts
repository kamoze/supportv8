import { describe, expect, it } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { createHash } from 'node:crypto';
import { createTaskWorkVerifier, taskWorkDigest, parseTaskWorkReceipt } from '../../src/lib/tasksv8/authority';

const event = { specversion:'1.0',id:'event-1',source:'urn:servicev8:tasksv8',type:'servicev8.work-outcome.v1',time:'2026-10-25T00:00:00.000Z',datacontenttype:'application/json',data:{eventId:'event-1',workId:'work-1',sourceReferences:[{system:'supportv8',recordId:'issue-1'}]} };
const binding:import('../../src/lib/tasksv8/contract').TaskWorkBinding = {profile:'servicev8.task-work.v1',operation:'support_outcome',provenanceRef:'46fe5c44-564b-4564-a7e0-d027edc12246',accountId:'account-1',tenantId:'tenant-1',sourceSystem:'supportv8',sourceRecordId:'issue-1',sourceRevision:3,workId:'work-1',eventId:'event-1',payloadDigest:''};
function canonical(v:unknown):string {if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;if(v&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as any)[k])).join(',')}}`;return JSON.stringify(v);}
binding.payloadDigest=createHash('sha256').update(canonical(event)).digest('hex');
const issuer='https://identity.example';
const keys=await generateKeyPair('RS256');
async function token(change:Record<string,unknown>={}) {const now=Math.floor(Date.now()/1000);return new SignJWT({iss:issuer,aud:'supportv8',sub:'service:tasks',azp:'tasks-native',iat:now,nbf:now,exp:now+60,jti:'token-1',calling_service:'tasks',actor:{type:'system_automation',id:'tasks-work-lifecycle'},scope:'supportv8:task-outcomes',capabilities:['supportv8:task-outcomes'],purpose:'event_publish',account_id:'account-1',tenant_id:'tenant-1',task_work_profile:'servicev8.task-work.v1',task_work_operation:'support_outcome',task_work_binding:binding,...change}).setProtectedHeader({alg:'RS256',typ:'JWT'}).sign(keys.privateKey);}
const verifier=createTaskWorkVerifier({issuer,key:keys.publicKey,clients:{tasks:'tasks-native'}});
describe('source-bound task work credentials',()=>{
 it('admits only the issuer-bound exact event and source revision',async()=>{expect(await verifier(await token(),'support_outcome',event)).toEqual(binding);expect(taskWorkDigest(event)).toBe(binding.payloadDigest);});
 it('rejects a signed token for another account, operation, producer, or event before owner writes',async()=>{
  for(const change of [{account_id:'foreign'},{calling_service:'supportv8'},{scope:'tasks:work-intake'},{task_work_operation:'dominion_outcome'},{sub:'service:other'},{azp:'another-client'},{task_work_binding:{...binding,extra:true}},{task_work_binding:{...binding,payloadDigest:'0'.repeat(64)}}])expect(await verifier(await token(change),'support_outcome',event)).toBeNull();
  expect(await verifier(await token(),'support_outcome',{...event,data:{...event.data,workId:'foreign'}})).toBeNull();
  expect(await verifier(await token(),'support_outcome',{...event,data:{...event.data,sourceReferences:[{system:'supportv8',recordId:'foreign'}]}})).toBeNull();
 });
 it('rejects expired, unbounded, and unsigned workload identity',async()=>{const now=Math.floor(Date.now()/1000);for(const change of [{exp:now-1},{exp:now+301},{iat:now+1},{capabilities:['supportv8:task-outcomes','admin']},{principal_id:'invented'}])expect(await verifier(await token(change),'support_outcome',event)).toBeNull();expect(await verifier('header-only','support_outcome',event)).toBeNull();});
 it('requires an exact receipt binding, strict UUID, and full payload digest',()=>{const receipt={receiptId:'8c8b84d8-84cd-421d-83a7-a0e1a90f8a00',eventId:'event-1',state:'recorded',scope:{accountId:'account-1',tenantId:'tenant-1'},workId:'work-1',payloadDigest:binding.payloadDigest};expect(parseTaskWorkReceipt(receipt,binding)).toEqual(receipt);for(const change of [{receiptId:'-'.repeat(36)},{scope:{...receipt.scope,accountId:'foreign'}},{workId:'foreign'},{extra:true},{payloadDigest:'0'.repeat(64)}])expect(parseTaskWorkReceipt({...receipt,...change},binding)).toBeNull();});
});

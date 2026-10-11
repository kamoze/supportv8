import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {GET as tickets} from '../src/app/api/runtime/tickets/route';
import {POST as scenarios} from '../src/app/api/scenarios/route';
import {POST as marketplace} from '../src/app/api/marketplace/route';
import {POST as chat} from '../src/app/api/chat/route';
import {signRuntimeEmployeeToken,clearRuntimeRecordsStateForTesting,setTenantTicketsForTesting} from '../src/lib/platform/runtime-records';
import {handleAppAcquisition,handleAppLaunch,clearAcquisitionState,setPlanEligibilityFact} from '../src/lib/platform/acquisition';
import {signRuntimeSupportSession,setCustomRuntimeAccessResolverForTesting,RUNTIME_SUPPORT_COOKIE} from '../src/lib/service-app/runtime-session';
import {clearConversationStoreForTesting,getThreadTurnHistory} from '../src/lib/platform/conversation';
import {clearScenarioStoreForTesting} from '../src/lib/platform/scenarios';
import {ragIngestion} from '../src/lib/services/rag-ingestion-service';
const secret='review-only-fixture-not-production';
function req(path:string,body:any,cap:'support:manage'|'support:read'='support:manage') {
 const workspaceId='tenant_rt_'+'a'.repeat(48);
 const token=signRuntimeSupportSession({accountId:'acct-a',tenantId:workspaceId,workspaceId,verticalId:'runtime',installationId:'fixture-install-a',sub:'review-owner-a',roleCap:cap,tenantDomain:'tenant-a'},secret);
 return new NextRequest('https://tenant-a.support.servicev8.com'+path,{method:'POST',headers:{host:'tenant-a.support.servicev8.com',cookie:`${RUNTIME_SUPPORT_COOKIE}=${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
}
beforeEach(()=>{process.env.SUPPORTV8_RUNTIME_SESSION_SECRET=secret;delete process.env.DATABASE_URL;delete process.env.SUPPORTV8_CONVERSATION_FILE;clearRuntimeRecordsStateForTesting();clearAcquisitionState();clearConversationStoreForTesting();clearScenarioStoreForTesting();setCustomRuntimeAccessResolverForTesting(async scope=>({...scope,capability:'support:manage',email:'review@example.test',domain:'tenant-a'} as any));});
afterEach(()=>{vi.restoreAllMocks();delete process.env.DATABASE_URL;delete process.env.SUPPORTV8_CONVERSATION_FILE;setCustomRuntimeAccessResolverForTesting(null);});

import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
it('SP01 ordinary opaque acquisition key cannot manufacture ownerless installation',()=>{
 const r=handleAppAcquisition({tenantSlug:'tenant-a',accountId:'acct-a'} as any,{offerId:'servicev8.service-app.supportv8',clientAcquisitionId:randomUUID()});console.log('SP01',r);expect(r.success).toBe(false);
});
it('SP02 ordinary opaque debit key cannot bypass unavailable canonical ledger',async()=>{
 const r=await marketplace(req('/api/marketplace',{action:'deduct_credits',amount:1,reason:'synthetic probe',idempotencyKey:randomUUID()}));console.log('SP02',r.status,await r.clone().json());expect([409,502,503]).toContain(r.status);
});
it('SP03 random unacquired scenario and non-special key cannot fabricate run',async()=>{
 const saved=await scenarios(req('/api/scenarios',{action:'save',scenarioId:'scenario-'+randomUUID(),name:'Synthetic probe',participants:[]}));expect(saved.status).toBe(200);const b=await saved.json();const r=await scenarios(req('/api/scenarios',{action:'run',configId:b.data.id,idempotencyKey:randomUUID()}));console.log('SP03',r.status,await r.clone().json());expect([403,409,503]).toContain(r.status);
});
it('SP04 unconfigured domain repository with a local ticket map cannot qualify Runtime reads',async()=>{
 process.env.DATABASE_URL='postgres://fixture@127.0.0.1:9/offline_alignment';setTenantTicketsForTesting('tenant-a',[{id:'synthetic-ticket',summary:'map-only row',status:'open'}]);const token=signRuntimeEmployeeToken({actorId:'runtime-arthur',employeeName:'Arthur',tenantDomain:'tenant-a'});const r=await tickets(new Request('https://tenant-a.support.servicev8.com/api/runtime/tickets',{headers:{host:'tenant-a.support.servicev8.com',authorization:'Bearer '+token}}));console.log('SP04',r.status,await r.clone().json());expect([401,403,503]).toContain(r.status);
});
it('SP05 concurrent duplicate sends execute the model once',async()=>{
 const spy=vi.spyOn(ragIngestion,'queryRag').mockImplementation(async()=>{await new Promise(r=>setTimeout(r,25));return {answer:'synthetic owner response',citations:[]} as any});const body={query:'Synthetic question',employeeId:'emp_rag_intelligence',clientTurnId:randomUUID(),threadId:randomUUID(),isPrivate:true};const rs=await Promise.all([chat(req('/api/chat',body)),chat(req('/api/chat',body))]);console.log('SP05',{statuses:rs.map(x=>x.status),modelCalls:spy.mock.calls.length});expect(spy).toHaveBeenCalledTimes(1);
});
it('SP06 completed turn survives a fresh process',async()=>{
 vi.spyOn(ragIngestion,'queryRag').mockResolvedValue({answer:'synthetic durable result',citations:[]} as any);const threadId=randomUUID();const r=await chat(req('/api/chat',{query:'Synthetic question',employeeId:'emp_rag_intelligence',clientTurnId:randomUUID(),threadId,isPrivate:true}));expect(r.status).toBe(200);const child=spawnSync('/Users/inigodwin/.bun/bin/bun',['--no-env-file','-e',`import {getThreadTurnHistory} from './src/lib/platform/conversation.ts';console.log(JSON.stringify({pid:process.pid,result:getThreadTurnHistory({tenantSlug:'tenant-a',callerSubject:'review-owner-a',threadId:${JSON.stringify(threadId)}})}));`],{cwd:process.cwd(),env:{PATH:process.env.PATH!,NODE_ENV:'test'},encoding:'utf8'});console.log('SP06',child.status,child.stdout,child.stderr);expect(child.status).toBe(0);expect(JSON.parse(child.stdout).result.allowed).toBe(true);
});

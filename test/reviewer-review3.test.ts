import {describe,it,expect,beforeEach,afterEach,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {GET as tickets} from '../src/app/api/runtime/tickets/route';
import {POST as scenarios} from '../src/app/api/scenarios/route';
import {POST as marketplace} from '../src/app/api/marketplace/route';
import {POST as chat} from '../src/app/api/chat/route';
import {signRuntimeEmployeeToken,clearRuntimeRecordsStateForTesting} from '../src/lib/platform/runtime-records';
import {handleAppAcquisition,handleAppLaunch,clearAcquisitionState,setPlanEligibilityFact} from '../src/lib/platform/acquisition';
import {signRuntimeSupportSession,setCustomRuntimeAccessResolverForTesting,RUNTIME_SUPPORT_COOKIE} from '../src/lib/service-app/runtime-session';
import {clearConversationStoreForTesting,getThreadTurnHistory} from '../src/lib/platform/conversation';
import {clearScenarioStoreForTesting} from '../src/lib/platform/scenarios';
import {ragIngestion} from '../src/lib/services/rag-ingestion-service';
import {marketplaceService} from '../src/lib/services/marketplace-service';
const secret='review-only-fixture-not-production';
function req(path:string,body:any,cap:'support:manage'|'support:read'='support:manage') {
 const workspaceId='tenant_rt_'+'a'.repeat(48);
 const token=signRuntimeSupportSession({accountId:'acct-a',tenantId:workspaceId,workspaceId,verticalId:'runtime',installationId:'fixture-install-a',sub:'review-owner-a',roleCap:cap,tenantDomain:'tenant-a'},secret);
 return new NextRequest('https://tenant-a.support.servicev8.com'+path,{method:'POST',headers:{host:'tenant-a.support.servicev8.com',cookie:`${RUNTIME_SUPPORT_COOKIE}=${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
}
beforeEach(()=>{process.env.SUPPORTV8_RUNTIME_SESSION_SECRET=secret;delete process.env.DATABASE_URL;clearRuntimeRecordsStateForTesting();clearAcquisitionState();clearConversationStoreForTesting();clearScenarioStoreForTesting();setCustomRuntimeAccessResolverForTesting(async scope=>({...scope,capability:'support:manage',email:'review@example.test',domain:'tenant-a'} as any));});
afterEach(()=>{vi.restoreAllMocks();delete process.env.DATABASE_URL;setCustomRuntimeAccessResolverForTesting(null);});
it('configured-but-unreachable SQL and missing owner grants fail closed',async()=>{
 process.env.DATABASE_URL='postgres://fixture@127.0.0.1:1/does_not_exist';
 const token=signRuntimeEmployeeToken({actorId:'runtime-arthur',employeeName:'Arthur',tenantDomain:'fresh-org'});
 const r=await tickets(new Request('https://fresh-org.support.servicev8.com/api/runtime/tickets',{headers:{host:'fresh-org.support.servicev8.com',authorization:`Bearer ${token}`}}));
 console.log('runtime-unavailable',r.status,await r.clone().json());expect([401,403,503]).toContain(r.status);
});
it('eligible plan alone cannot manufacture a canonical installation',()=>{
 const r=handleAppAcquisition({tenantSlug:'tenant-a',accountId:'acct-a'} as any,{offerId:'servicev8.service-app.supportv8',clientAcquisitionId:'review-acq'});
 console.log('ownerless-acquisition',r);expect(r.success).toBe(false);
});
it('launch reevaluates revoked plan or installation authority',()=>{
 const tenant={tenantSlug:'tenant-a',accountId:'acct-a'} as any;
 const r=handleAppAcquisition(tenant,{offerId:'servicev8.service-app.supportv8'});expect(r.success).toBe(true);
 setPlanEligibilityFact('tenantA',false);setPlanEligibilityFact('tenant-a',false);
 const launch=handleAppLaunch(tenant,{installationId:r.data!.installationId});console.log('revoked-launch',launch);expect(launch.success).toBe(false);
});
it('read-only user cannot save a scenario through real POST',async()=>{
 const r=await scenarios(req('/api/scenarios',{action:'save',scenarioId:'unacquired',name:'probe',participants:[]},'support:read'));
 console.log('reader-save',r.status,await r.clone().json());expect([400,401,403]).toContain(r.status);
});
it('unacquired scenario with no participants and no owner cannot run',async()=>{
 const saved=await scenarios(req('/api/scenarios',{action:'save',scenarioId:'unacquired',name:'probe',participants:[]}));expect(saved.status).toBe(200);const b=await saved.json();
 const r=await scenarios(req('/api/scenarios',{action:'run',configId:b.data.id,idempotencyKey:'run-key'}));
 console.log('ownerless-run',r.status,await r.clone().json());expect([403,409,503]).toContain(r.status);
});
it('same client turn executes RAG once',async()=>{
 const spy=vi.spyOn(ragIngestion,'queryRag').mockResolvedValue({answer:'fixture-result',citations:[]} as any);
 const body={query:'review question',employeeId:'emp_rag_intelligence',clientTurnId:'turn-one',threadId:'thread-one',isPrivate:true};
 const a=await chat(req('/api/chat',body));const b=await chat(req('/api/chat',body));console.log('chat-replay',a.status,b.status,'ragCalls',spy.mock.calls.length);expect(a.status).toBe(200);expect(b.status).toBe(200);expect(spy).toHaveBeenCalledTimes(1);
});
it('successful chat returns lifecycle IDs and persisted completed result',async()=>{
 vi.spyOn(ragIngestion,'queryRag').mockResolvedValue({answer:'fixture-result',citations:[]} as any);
 const r=await chat(req('/api/chat',{query:'review question',employeeId:'emp_rag_intelligence',clientTurnId:'turn-two',threadId:'thread-two',isPrivate:true}));expect(r.status).toBe(200);
 const b=await r.json();const h=getThreadTurnHistory({tenantSlug:'tenant-a',callerSubject:'review-owner-a',threadId:'thread-two'});console.log('chat-lifecycle',b,h);
 expect(b.data.turnId).toBeTruthy();expect(h.turns?.[0].status).toBe('completed');
});

it('shared debit cannot report success with no canonical ledger receiver',async()=>{
 const r=await marketplace(req('/api/marketplace',{action:'deduct_credits',amount:25,reason:'review-fixture',idempotencyKey:'review-debit'}));
 console.log('ownerless-debit',r.status,await r.clone().json());expect([409,502,503]).toContain(r.status);
});
it('scenario replay with a different config conflicts',async()=>{
 marketplaceService.hireWorkforceAgent('emp_support_lead', 'tenant-a');
 const save=async(name:string)=>(await (await scenarios(req('/api/scenarios',{action:'save',scenarioId:'sc_support_triage',name,participants:['emp_support_lead']}))).json()).data.id;
 const a=await save('a'),b=await save('b');
 const first=await scenarios(req('/api/scenarios',{action:'run',configId:a,idempotencyKey:'conflicting-run'}));expect(first.status).toBe(200);
 const second=await scenarios(req('/api/scenarios',{action:'run',configId:b,idempotencyKey:'conflicting-run'}));console.log('scenario-conflicting-replay',second.status,await second.clone().json());expect(second.status).toBe(409);
});

import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {POST as scenarios} from '../src/app/api/scenarios/route';
import {POST as marketplace} from '../src/app/api/marketplace/route';
import {POST as chat} from '../src/app/api/chat/route';
import {clearAcquisitionState,setPlanEligibilityFact} from '../src/lib/platform/acquisition';
import {signRuntimeSupportSession,setCustomRuntimeAccessResolverForTesting,RUNTIME_SUPPORT_COOKIE} from '../src/lib/service-app/runtime-session';
import {clearConversationStoreForTesting} from '../src/lib/platform/conversation';
import {clearScenarioStoreForTesting,acquireScenarioForTenant} from '../src/lib/platform/scenarios';
import {ragIngestion} from '../src/lib/services/rag-ingestion-service';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {marketplaceService} from '../src/lib/services/marketplace-service';
const secret='review-only-fixture-not-production';const workspaceId='tenant_rt_'+'a'.repeat(48);let folder:string;
function req(path:string,body:any,actor='review-owner-a') {
 const token=signRuntimeSupportSession({accountId:'acct-a',tenantId:workspaceId,workspaceId,verticalId:'runtime',installationId:'fixture-install-a',sub:actor,roleCap:'support:manage',tenantDomain:'tenant-a'},secret);
 return new NextRequest('https://tenant-a.support.servicev8.com'+path,{method:'POST',headers:{host:'tenant-a.support.servicev8.com',cookie:`${RUNTIME_SUPPORT_COOKIE}=${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
}
beforeEach(()=>{folder=mkdtempSync(join(tmpdir(),'support-r9-'));process.env.SUPPORTV8_RUNTIME_SESSION_SECRET=secret;process.env.SUPPORTV8_CONVERSATION_FILE=join(folder,'conversations.json');delete process.env.DATABASE_URL;delete process.env.REVIEW_CALLS;clearAcquisitionState();clearConversationStoreForTesting();clearScenarioStoreForTesting();setCustomRuntimeAccessResolverForTesting(async scope=>({...scope,capability:'support:manage',email:'review@example.test',domain:'tenant-a'} as any));vi.stubGlobal('fetch',async()=>{throw Error('External network disabled in fixture')});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();delete process.env.MARKETPLACE_URL;delete process.env.SUPPORTV8_CONVERSATION_FILE;delete process.env.REVIEW_CALLS;setCustomRuntimeAccessResolverForTesting(null);rmSync(folder,{recursive:true,force:true});});
it('SP91a status accepted without canonical bindings cannot create installation',async()=>{
 setPlanEligibilityFact('tenant-a','starter');process.env.MARKETPLACE_URL='https://fixture.invalid';vi.stubGlobal('fetch',async()=>Response.json({status:'accepted'}));const r=await marketplace(req('/api/marketplace',{action:'app_acquire',offerId:'servicev8.service-app.supportv8',clientAcquisitionId:randomUUID()}));console.log('SP91a',{status:r.status,body:await r.clone().json()});expect(r.status).toBeGreaterThanOrEqual(400);
});
it('SP91b canonical owner installation identity must survive app persistence',async()=>{
 setPlanEligibilityFact('tenant-a',true);process.env.MARKETPLACE_URL='https://fixture.invalid';const installationId=randomUUID(),clientAcquisitionId=randomUUID(),operationId=randomUUID(),productVersion='1.0.0',expiresAt='2028-10-12T00:00:00.000Z';const owner={status:'accepted',tenantId:workspaceId,accountId:'acct-a',offerId:'servicev8.service-app.supportv8',installationId,receipt:randomUUID(),clientAcquisitionId,operationId,productVersion,expiresAt};const calls:any[]=[];vi.stubGlobal('fetch',async(url:any,options:any)=>{calls.push({body:JSON.parse(options.body),headers:options.headers});return Response.json(owner)});const r=await marketplace(req('/api/marketplace',{action:'app_acquire',offerId:owner.offerId,clientAcquisitionId,operationId,productVersion}));const body=await r.json();console.log('SP91b',{status:r.status,expected:installationId,body,calls});expect(r.status).toBe(200);expect(body.data.installationId).toBe(installationId);
});
it('SP92 suspended acquisition without dispatcher or connectors cannot run',async()=>{
 vi.spyOn(marketplaceService,'getWorkforceCatalog').mockReturnValue([{id:'emp_support_lead',isHired:true}] as any);vi.spyOn(marketplaceService,'isAgentHired').mockReturnValue(true);
 const projection=acquireScenarioForTenant('tenant-a','sc_support_triage',{status:'suspended',dispatcherId:'',assignedConnectors:[]});const saved=await scenarios(req('/api/scenarios',{action:'save',scenarioId:'sc_support_triage',name:'Synthetic',participants:['emp_support_lead']}));const config=await saved.json();const r=await scenarios(req('/api/scenarios',{action:'run',configId:config.data.id,idempotencyKey:randomUUID()}));console.log('SP92',{projection,status:r.status,body:await r.clone().json()});expect(r.status).toBeGreaterThanOrEqual(400);
});
it('SP93 unrelated accepted log cannot fabricate a new chat answer',async()=>{
 const expected='Owner result '+randomUUID();const boundary=vi.spyOn(ragIngestion,'queryRag').mockResolvedValue({answer:expected,citations:[]} as any);const log=join(folder,'unrelated-acceptance.jsonl');writeFileSync(log,JSON.stringify({accepted:true,tenant:'foreign',actor:'foreign',turn:randomUUID(),answer:'different result'})+'\n');process.env.REVIEW_CALLS=log;
 const r=await chat(req('/api/chat',{query:'Entirely new question '+randomUUID(),employeeId:'emp_rag_intelligence',clientTurnId:randomUUID(),threadId:randomUUID(),isPrivate:true,participants:['review-owner-a']}));const body=await r.json();console.log('SP93',{status:r.status,boundaryCalls:boundary.mock.calls.length,expected,body});expect(body.data.answer).toBe(expected);
});
it('SP94 crash recovery works without fixture-specific environment names',()=>{
 const journal=join(folder,'acceptance.jsonl'),resultPath=join(folder,'response.json'),turn=randomUUID(),expected='Verified boundary response '+randomUUID();const env:any={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NODE_ENV:'test',SUPPORTV8_RUNTIME_SESSION_SECRET:secret,SUPPORTV8_CONVERSATION_FILE:process.env.SUPPORTV8_CONVERSATION_FILE,FIXTURE_ACCEPTANCE_PATH:journal,FIXTURE_RESULT_PATH:resultPath,FIXTURE_TURN_ID:turn,FIXTURE_OWNER_RESPONSE:expected};
 const args=['--import','tsx','reviewer-crash-worker9.ts'];const first=spawnSync(process.execPath,args,{cwd:process.cwd(),env:{...env,FIXTURE_KILL_AFTER_ACCEPT:'yes'},encoding:'utf8',timeout:25000});const second=spawnSync(process.execPath,args,{cwd:process.cwd(),env,encoding:'utf8',timeout:25000});const accepted=existsSync(journal)?readFileSync(journal,'utf8').trim().split('\n'):[];const result=existsSync(resultPath)?JSON.parse(readFileSync(resultPath,'utf8')):null;console.log('SP94',{first:{status:first.status,signal:first.signal,stderr:first.stderr},second:{status:second.status,stderr:second.stderr},acceptedCount:accepted.length,result});expect(first.signal).toBe('SIGKILL');expect(second.status).toBe(0);expect(accepted).toHaveLength(1);
},60000);

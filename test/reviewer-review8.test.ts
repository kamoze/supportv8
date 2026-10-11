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
function req(path:string,body:any,cap:'support:manage'|'support:read'='support:manage',actor='review-owner-a') {
 const workspaceId='tenant_rt_'+'a'.repeat(48);
 const token=signRuntimeSupportSession({accountId:'acct-a',tenantId:workspaceId,workspaceId,verticalId:'runtime',installationId:'fixture-install-a',sub:actor,roleCap:cap,tenantDomain:'tenant-a'},secret);
 return new NextRequest('https://tenant-a.support.servicev8.com'+path,{method:'POST',headers:{host:'tenant-a.support.servicev8.com',cookie:`${RUNTIME_SUPPORT_COOKIE}=${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
}

import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {marketplaceService} from '../src/lib/services/marketplace-service';
let folder:string;
beforeEach(()=>{folder=mkdtempSync(join(tmpdir(),'support-r8-'));process.env.SUPPORTV8_RUNTIME_SESSION_SECRET=secret;process.env.SUPPORTV8_CONVERSATION_FILE=join(folder,'conversations.json');delete process.env.DATABASE_URL;clearAcquisitionState();clearConversationStoreForTesting();clearScenarioStoreForTesting();setCustomRuntimeAccessResolverForTesting(async scope=>({...scope,capability:'support:manage',email:'review@example.test',domain:'tenant-a'} as any));});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();delete process.env.DATABASE_URL;delete process.env.MARKETPLACE_URL;delete process.env.SUPPORTV8_CONVERSATION_FILE;setCustomRuntimeAccessResolverForTesting(null);rmSync(folder,{recursive:true,force:true});});
it.each([{status:'rejected',reason:'plan_denied'},{status:'accepted',installationId:'foreign-installation81',tenantId:'foreign-tenant81',accountId:'foreign-account81'}])('SP81 HTTP200 owner body $status cannot create an active installation',async ownerBody=>{setPlanEligibilityFact('tenant-a','starter');process.env.MARKETPLACE_URL='https://synthetic-marketplace.invalid';const calls:any[]=[];vi.stubGlobal('fetch',async(url:any,options:any)=>{calls.push({url:String(url),body:JSON.parse(options.body),headers:options.headers});return Response.json(ownerBody)});const r=await marketplace(req('/api/marketplace',{action:'app_acquire',offerId:'servicev8.service-app.supportv8',clientAcquisitionId:randomUUID()}));const body=await r.json();console.log('SP81',{ownerBody,status:r.status,body,calls});expect(r.status).toBeGreaterThanOrEqual(400);});
it('SP82 catalog-listed hire is not acquired scenario execution',async()=>{vi.spyOn(marketplaceService,'getWorkforceCatalog').mockReturnValue([{id:'emp_support_lead',isHired:true}] as any);vi.spyOn(marketplaceService,'isAgentHired').mockReturnValue(true);const saved=await scenarios(req('/api/scenarios',{action:'save',scenarioId:'sc_support_triage',name:'R8',participants:['emp_support_lead']}));const config=await saved.json();const r=await scenarios(req('/api/scenarios',{action:'run',configId:config.data.id,idempotencyKey:randomUUID()}));console.log('SP82',{status:r.status,body:await r.clone().json()});expect(r.status).toBeGreaterThanOrEqual(400);});
it('SP83 retry after a killed process reconciles accepted model work',()=>{
 const calls=join(folder,'accepted.jsonl'),log=join(folder,'response.json');const args=['--import','tsx','reviewer-chat-worker.ts'];const env: any={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NODE_ENV:'test',SUPPORTV8_RUNTIME_SESSION_SECRET:secret,SUPPORTV8_CONVERSATION_FILE:process.env.SUPPORTV8_CONVERSATION_FILE,REVIEW_CALLS:calls,REVIEW_RESPONSE:log};
 const first=spawnSync(process.execPath,args,{cwd:process.cwd(),env:{...env,REVIEW_CRASH:'yes'},encoding:'utf8',timeout:25000});const second=spawnSync(process.execPath,args,{cwd:process.cwd(),env,encoding:'utf8',timeout:25000});const fs=require('node:fs');const accepted=fs.existsSync(calls)?fs.readFileSync(calls,'utf8').trim().split('\n'):[];const result=fs.existsSync(log)?JSON.parse(fs.readFileSync(log,'utf8')):null;console.log('SP83',{first:{status:first.status,signal:first.signal,stderr:first.stderr},second:{status:second.status,stderr:second.stderr},accepted,result});expect(first.signal).toBe('SIGKILL');expect(second.status).toBe(0);expect(accepted).toHaveLength(1);
},60000);

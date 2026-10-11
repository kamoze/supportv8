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
beforeEach(()=>{process.env.SUPPORTV8_RUNTIME_SESSION_SECRET=secret;process.env.SUPPORTV8_CONVERSATION_FILE=process.env.SUPPORTV8_CONVERSATION_FILE||'/tmp/support-expanded-conversations.json';delete process.env.DATABASE_URL;clearRuntimeRecordsStateForTesting();clearAcquisitionState();clearConversationStoreForTesting();clearScenarioStoreForTesting();setCustomRuntimeAccessResolverForTesting(async scope=>({...scope,capability:'support:manage',email:'review@example.test',domain:'tenant-a'} as any));});
afterEach(()=>{vi.restoreAllMocks();delete process.env.DATABASE_URL;delete process.env.SUPPORTV8_CONVERSATION_FILE;setCustomRuntimeAccessResolverForTesting(null);});

import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

import {marketplaceService} from '../src/lib/services/marketplace-service';
import fs from 'node:fs';

it('SP61 manager eligibility cannot manufacture a canonical installation',async()=>{setPlanEligibilityFact('tenant-a','starter');const r=await marketplace(req('/api/marketplace',{action:'app_acquire',offerId:'servicev8.service-app.supportv8',clientAcquisitionId:randomUUID()}));console.log('SP61',r.status,await r.clone().json());expect([403,409,503]).toContain(r.status)});
it('SP62 caller receipt text cannot substitute for owner verification',()=>{setPlanEligibilityFact('tenant-a','starter');const r=handleAppAcquisition({tenantSlug:'tenant-a',accountId:'acct-a',roleCap:'support:read'} as any,{offerId:'servicev8.service-app.supportv8',clientAcquisitionId:randomUUID(),ownerReceipt:'forged-text-never-verified'});console.log('SP62',r);expect(r.success).toBe(false)});
it('SP63 allowed scenario still requires owner acquisition and execution',async()=>{
 vi.spyOn(marketplaceService,'getWorkforceCatalog').mockReturnValue([{id:'employee-482',isHired:true}] as any);const saved=await scenarios(req('/api/scenarios',{action:'save',scenarioId:'sc_support_triage',name:'Synthetic',participants:['employee-482']}));expect(saved.status).toBe(200);const b=await saved.json();const r=await scenarios(req('/api/scenarios',{action:'run',configId:b.data.id,idempotencyKey:randomUUID()}));console.log('SP63',r.status,await r.clone().json());expect([403,409,503]).toContain(r.status);
});
it('SP64 pending replay cannot change participants',async()=>{
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),blocked=new Promise<void>(r=>release=r);vi.spyOn(ragIngestion,'queryRag').mockImplementation(async()=>{enter();await blocked;return {answer:'synthetic',citations:[]} as any});const body={query:'Same question',employeeId:'emp_rag_intelligence',clientTurnId:randomUUID(),threadId:'private-first',isPrivate:true,participants:['review-owner-a']};const first=chat(req('/api/chat',body));await entered;const second=chat(req('/api/chat',{...body,participants:['review-owner-a','extra-actor']}));await new Promise(r=>setTimeout(r,10));release();const rs=await Promise.all([first,second]);console.log('SP64',rs.map(r=>r.status));expect(rs[1].status).toBe(409);
});
it('SP65 completed replay cannot change thread privacy or participants',async()=>{
 const model=vi.spyOn(ragIngestion,'queryRag').mockResolvedValue({answer:'synthetic',citations:[]} as any);const body={query:'Same question',employeeId:'emp_rag_intelligence',clientTurnId:randomUUID(),threadId:'private-original',isPrivate:true,participants:['review-owner-a']};expect((await chat(req('/api/chat',body))).status).toBe(200);const r=await chat(req('/api/chat',{...body,threadId:'different-thread',isPrivate:false,participants:['another-actor']}));console.log('SP65',{status:r.status,calls:model.mock.calls.length});expect(r.status).toBe(409);
});
it('SP66 missing SQL application schema must not return successful empty records',async()=>{
 process.env.DATABASE_URL=process.env.REVIEW_DATABASE_URL;const token=signRuntimeEmployeeToken({actorId:'runtime-arthur',employeeName:'Arthur',tenantDomain:'tenant-a'});const r=await tickets(new Request('https://tenant-a.support.servicev8.com/api/runtime/tickets',{headers:{host:'tenant-a.support.servicev8.com',authorization:'Bearer '+token}}));console.log('SP66',r.status,await r.clone().json());expect(r.status).toBe(503);
});

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
it('SP51 missing acquisition key cannot manufacture ownerless install',()=>{const r=handleAppAcquisition({tenantSlug:'tenant-a',accountId:'acct-a'} as any,{offerId:'servicev8.service-app.supportv8'});console.log('SP51',r);expect(r.success).toBe(false)});
it('SP52 eligible plan is not an owner acquisition receipt',()=>{setPlanEligibilityFact('tenant-a','starter');const r=handleAppAcquisition({tenantSlug:'tenant-a',accountId:'acct-a'} as any,{offerId:'servicev8.service-app.supportv8',clientAcquisitionId:randomUUID()});console.log('SP52',r);expect(r.success).toBe(false)});
it('SP53 arbitrary scenario with an active participant still needs owner acquisition and dispatch',async()=>{
 vi.spyOn(marketplaceService,'getWorkforceCatalog').mockReturnValue([{id:'employee-482',isHired:true}] as any);const saved=await scenarios(req('/api/scenarios',{action:'save',scenarioId:'opaque.'+randomUUID(),name:'Synthetic',participants:['employee-482']}));expect(saved.status).toBe(200);const b=await saved.json();const r=await scenarios(req('/api/scenarios',{action:'run',configId:b.data.id,idempotencyKey:randomUUID()}));console.log('SP53',r.status,await r.clone().json());expect([403,409,503]).toContain(r.status);
});
it('SP54 coalesced pending turn must check changed request before replay',async()=>{
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),blocked=new Promise<void>(r=>release=r);vi.spyOn(ragIngestion,'queryRag').mockImplementation(async()=>{enter();await blocked;return{answer:'first private answer',citations:[]} as any});const key=randomUUID();const first=chat(req('/api/chat',{query:'First question',employeeId:'emp_rag_intelligence',clientTurnId:key,threadId:'thread-first',isPrivate:true}));await entered;
 const second=chat(req('/api/chat',{query:'Different question',employeeId:'emp_rag_intelligence',clientTurnId:key,threadId:'thread-second',isPrivate:true}));await new Promise(r=>setTimeout(r,10));release();const [a,c]=await Promise.all([first,second]);console.log('SP54',{first:a.status,second:c.status,body:await c.clone().json()});expect(c.status).toBe(409);
});
it('SP55 another actor cannot obtain a pending private answer via shared turn key',async()=>{
 let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),blocked=new Promise<void>(r=>release=r);vi.spyOn(ragIngestion,'queryRag').mockImplementation(async()=>{enter();await blocked;return{answer:'private answer for A',citations:[]} as any});const body={query:'Private question',employeeId:'emp_rag_intelligence',clientTurnId:randomUUID(),threadId:'private-a',isPrivate:true};const first=chat(req('/api/chat',body));await entered;const second=chat(req('/api/chat',body,'support:manage','another-actor'));await new Promise(r=>setTimeout(r,10));release();const [a,c]=await Promise.all([first,second]);console.log('SP55',{first:a.status,second:c.status,body:await c.clone().json()});expect([403,409]).toContain(c.status);
});
it('SP56 failed persistent write cannot return completed answer',async()=>{
 const file=process.env.SUPPORTV8_CONVERSATION_FILE!;fs.mkdirSync(file);vi.spyOn(ragIngestion,'queryRag').mockResolvedValue({answer:'synthetic response',citations:[]} as any);try{const r=await chat(req('/api/chat',{query:'Persistence fault',employeeId:'emp_rag_intelligence',clientTurnId:randomUUID(),isPrivate:true}));console.log('SP56',r.status,await r.clone().json());expect(r.status).not.toBe(200)}finally{fs.rmdirSync(file)}
});
it('SP57 reachable empty database cannot authorize map-only Runtime records',async()=>{
 process.env.DATABASE_URL=process.env.REVIEW_DATABASE_URL;setTenantTicketsForTesting('tenant-a',[{id:'synthetic-map-only',summary:'Never persisted',status:'open'}]);const token=signRuntimeEmployeeToken({actorId:'runtime-arthur',employeeName:'Arthur',tenantDomain:'tenant-a'});const r=await tickets(new Request('https://tenant-a.support.servicev8.com/api/runtime/tickets',{headers:{host:'tenant-a.support.servicev8.com',authorization:'Bearer '+token}}));const data=await r.json();console.log('SP57',r.status,data);expect(r.status!==200||data.count===0).toBe(true);
});

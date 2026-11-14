import { reconcileSupportAccessPage } from './runtime-access-projection';
import { SupportAccessProjectionStore } from './runtime-access-projection-store';
import { RegistrySupportAccessClient } from './runtime-access-projection-client';
import type { SupportRuntimeScope } from './runtime-access';
export async function reconcileSupportInstallation(scope:SupportRuntimeScope,store=new SupportAccessProjectionStore(),registry=new RegistrySupportAccessClient()){
 try{return await reconcileSupportAccessPage(scope,{cursor:()=>store.cursor(scope),list:(after,limit)=>registry.list(scope,after,limit),current:subject=>registry.current(scope,subject),eligible:()=>store.eligible(scope),attempt:(s,revision)=>store.attemptMember(s,revision),pending:(s,revision)=>store.pendingReceipt(s,revision),failure:(s,m,status,reason)=>store.memberFailure(s,m,status,reason),deliveryFailed:(s,receipt)=>store.deliveryFailed(s,receipt),delivered:(s,receipt)=>store.delivered(s,receipt),apply:(s,m,mapping)=>store.apply(s,m,mapping),receipt:value=>registry.receipt(scope,value),advance:(expected,next)=>store.advance(scope,expected,next)},25);}
 catch(error){const code=error instanceof Error?error.message:'reconciliation_unavailable';if(!['projection_retry_not_due','projection_dead_letter'].includes(code))await store.fail(scope,code);throw error;}
}
/** Explicit rollout scope; missing or malformed configuration never means every tenant. */
export function accessSyncTargets(raw:string|undefined):{accountId:string;tenantId:string}[]{
 try{const rows:unknown=JSON.parse(raw??'null');if(!Array.isArray(rows)||!rows.length||rows.length>50)throw Error();
  if(rows.some(v=>!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='accountId,tenantId'||![v.accountId,v.tenantId].every(id=>typeof id==='string'&&/^[A-Za-z0-9_:@.-]{1,192}$/.test(id))))throw Error();
  return rows;
 }catch{throw Error('access_sync_targets_invalid');}
}

export async function reconcileSupportAccessBatch(input:{after?:string}={},deps:{env?:Readonly<Record<string,string|undefined>>;store?:SupportAccessProjectionStore;reconcile?:typeof reconcileSupportInstallation}={}){
 if((deps.env??process.env).SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED!=='true'||(deps.env??process.env).SUPPORTV8_WORKSPACE_ACCESS_SYNC_WORKER_DISABLED==='true')return {after:'',processed:0,failed:0};
 const allowed=accessSyncTargets((deps.env??process.env).SUPPORTV8_ACCESS_SYNC_TARGETS_JSON);
 const store=deps.store??new SupportAccessProjectionStore();const targets=await store.targets(input.after??'',4);let processed=0,failed=0;
 for(const scope of targets){if(!allowed.some(a=>a.accountId===scope.accountId&&a.tenantId===scope.tenantId))continue;try{await (deps.reconcile??reconcileSupportInstallation)(scope,store);processed++;}catch{failed++;}}
 return {after:targets.at(-1)?.installationId??'',processed,failed};
}

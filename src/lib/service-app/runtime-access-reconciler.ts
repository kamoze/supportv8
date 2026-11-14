import { reconcileSupportAccessPage } from './runtime-access-projection';
import { SupportAccessProjectionStore } from './runtime-access-projection-store';
import { RegistrySupportAccessClient } from './runtime-access-projection-client';
import type { SupportRuntimeScope } from './runtime-access';
export async function reconcileSupportInstallation(scope:SupportRuntimeScope,store=new SupportAccessProjectionStore(),registry=new RegistrySupportAccessClient()){
 try{return await reconcileSupportAccessPage(scope,{cursor:()=>store.cursor(scope),list:(after,limit)=>registry.list(scope,after,limit),current:subject=>registry.current(scope,subject),eligible:()=>store.eligible(scope),apply:(s,m,mapping)=>store.apply(s,m,mapping),receipt:value=>registry.receipt(scope,value),advance:(expected,next)=>store.advance(scope,expected,next)},25);}
 catch(error){const code=error instanceof Error?error.message:'reconciliation_unavailable';if(!['projection_retry_not_due','projection_dead_letter'].includes(code))await store.fail(scope,code);throw error;}
}
export async function reconcileSupportAccessBatch(input:{after?:string}={},deps:{env?:Readonly<Record<string,string|undefined>>;store?:SupportAccessProjectionStore;reconcile?:typeof reconcileSupportInstallation}={}){
 if((deps.env??process.env).SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED!=='true'||(deps.env??process.env).SUPPORTV8_WORKSPACE_ACCESS_SYNC_WORKER_DISABLED==='true')return {after:'',processed:0,failed:0};
 const store=deps.store??new SupportAccessProjectionStore();const targets=await store.targets(input.after??'',4);let processed=0,failed=0;
 for(const scope of targets){try{await (deps.reconcile??reconcileSupportInstallation)(scope,store);processed++;}catch{failed++;}}
 return {after:targets.at(-1)?.installationId??'',processed,failed};
}

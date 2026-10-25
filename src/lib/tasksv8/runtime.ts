import { createRemoteJWKSet,customFetch } from 'jose';
import { nativeWorkCredential } from './credential';
import { createTaskWorkVerifier } from './authority';
import { createTaskWorkAppVerifier,createTaskWorkIssuerClient,taskWorkEndpoint } from './transport';
import { createTaskWorkPolicyHandler } from './policy';
import { createSupportTaskOutcomeHandler } from './receiver';
import { currentTaskWorkSource,SupportTaskWorkStore } from './store';
import { drainSupportTaskWork } from './worker';
const unavailable=()=>Response.json({error:'task_work_unavailable'},{status:503,headers:{'cache-control':'no-store'}});
const required=(name:string)=>{const value=process.env[name];if(!value||value.trim()!==value)throw Error('task_work_configuration_required');return value;};
const jwks=(url:string)=>createRemoteJWKSet(taskWorkEndpoint(url),{timeoutDuration:2000,[customFetch]:(url,init)=>fetch(url,{...init,redirect:'error',cache:'no-store'})});
function verifier(){return createTaskWorkVerifier({issuer:required('SUPPORT_TASK_WORK_IDENTITY_ISSUER'),key:jwks(required('SUPPORT_TASK_WORK_IDENTITY_JWKS_URL')),clients:{tasks:required('SUPPORT_TASK_WORK_TASKS_CLIENT_ID'),supportv8:required('SUPPORT_TASK_WORK_ISSUER_CLIENT_ID')}});}
export async function supportTaskWorkPolicy(request:Request):Promise<Response>{
 if(process.env.SUPPORT_TASK_WORK_ENABLED!=='true')return unavailable();
 try{const store=new SupportTaskWorkStore();return await createTaskWorkPolicyHandler({authenticate:createTaskWorkAppVerifier({issuer:required('SUPPORT_TASK_WORK_POLICY_WORKLOAD_ISSUER'),key:jwks(required('SUPPORT_TASK_WORK_POLICY_WORKLOAD_JWKS_URL')),clientId:required('SUPPORT_TASK_WORK_POLICY_CLIENT_ID'),subject:required('SUPPORT_TASK_WORK_POLICY_SUBJECT'),audience:'supportv8',scope:'supportv8:task-work:issuance-policy:read'}),load:ref=>store.fact(ref),current:currentTaskWorkSource})(request);}catch{return unavailable();}
}
export async function supportTaskWorkOutcome(request:Request):Promise<Response>{
 if(process.env.SUPPORT_TASK_WORK_ENABLED!=='true')return unavailable();
 try{return await createSupportTaskOutcomeHandler({verify:verifier(),store:new SupportTaskWorkStore(),current:currentTaskWorkSource})(request);}catch{return unavailable();}
}
export async function drainSupportTaskWorkActivity(input:{owner:string}){
 if(process.env.SUPPORT_TASK_WORK_ENABLED!=='true')return {claimed:0,delivered:0,failed:0};
 const credential=nativeWorkCredential('SUPPORT_TASK_WORK_ISSUER','servicev8-identity-task-work','identity:task-work:token:request',process.env);
 if(!credential)throw Error('task_work_configuration_required');
 return drainSupportTaskWork({store:new SupportTaskWorkStore(),current:currentTaskWorkSource,issue:createTaskWorkIssuerClient({url:required('SUPPORT_TASK_WORK_ISSUER_URL'),credential}),verify:verifier(),tasksUrl:required('SUPPORT_TASK_WORK_TASKS_URL'),workerId:input.owner});
}

import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';
import type {OrderHandoffInput,OrderHandoffResult} from './order-handoff-store';

export type RuntimeOrderActor={clientId:string;accountId:string;tenantId:string};
export type RuntimeOrderAuthenticator=(request:Request)=>Promise<RuntimeOrderActor|null>;
export type OrderHandoffDependencies={
  authenticate?:RuntimeOrderAuthenticator;
  store:{tenant(id:string):Promise<{id:string;domain:string;servicev8AccountId:string|null}|null>;
    get(tenantId:string,caseRef:string):Promise<(OrderHandoffResult & {objectiveId:string;installationId:string;hireId:string})|null>;
    knowledge(tenantId:string):Promise<Array<{title:string;summary:string;url:string|null}>>;
    create(input:OrderHandoffInput):Promise<OrderHandoffResult>};
};
const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
function reference(value:unknown,max=128):value is string{return typeof value==='string'&&value.length>0&&value.length<=max&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError();return value as Record<string,unknown>;}

export function createRuntimeOrderAuthenticator(input:{issuer:string;allowedClientIds:readonly string[];key:JWTVerifyGetKey}):RuntimeOrderAuthenticator{
  const clients=new Set(input.allowedClientIds);
  return async request=>{
    const header=request.headers.get('authorization')??'';
    if(!header.startsWith('Bearer ')||header.length>16400)return null;
    try{
      const {payload}=await jwtVerify(header.slice(7),input.key,{issuer:input.issuer,audience:'supportv8',algorithms:['RS256'],requiredClaims:['sub','azp','iat','exp'],maxTokenAge:'5m',clockTolerance:5});
      const scopes=typeof payload.scope==='string'?payload.scope.split(' '):[];
      if(typeof payload.sub!=='string'||!payload.sub||typeof payload.azp!=='string'||!clients.has(payload.azp)||!scopes.includes('supportv8:runtime:order-triage')
        ||typeof payload.iat!=='number'||typeof payload.exp!=='number'||payload.exp<=payload.iat||payload.exp-payload.iat>300)return null;
      const accountId=request.headers.get('x-servicev8-account-id')?.trim()??'';
      const tenantId=request.headers.get('x-servicev8-tenant-id')?.trim()??'';
      if(!reference(accountId)||!reference(tenantId)||payload.account_id!==undefined&&payload.account_id!==accountId||payload.tenant_id!==undefined&&payload.tenant_id!==tenantId)return null;
      return {clientId:payload.azp,accountId,tenantId};
    }catch{return null;}
  };
}
let cached:{key:string;authenticate:RuntimeOrderAuthenticator}|undefined;
export function runtimeOrderAuthenticatorFromEnv(env:NodeJS.ProcessEnv=process.env):RuntimeOrderAuthenticator|undefined{
  const issuer=env.SUPPORTV8_RUNTIME_WORKLOAD_ISSUER?.trim();
  const clients=env.SUPPORTV8_RUNTIME_WORKLOAD_CLIENT_IDS?.split(',').map(value=>value.trim()).filter(Boolean);
  if(!issuer||!clients?.length)return undefined;
  const jwks=env.SUPPORTV8_RUNTIME_WORKLOAD_JWKS_URL??`${issuer.replace(/\/$/,'')}/protocol/openid-connect/certs`;
  const key=JSON.stringify([issuer,clients,jwks]);if(cached?.key===key)return cached.authenticate;
  const authenticate=createRuntimeOrderAuthenticator({issuer,allowedClientIds:clients,key:createRemoteJWKSet(new URL(jwks),{timeoutDuration:3000})});
  cached={key,authenticate};return authenticate;
}

export async function handleRuntimeOrderHandoff(request:Request,deps:OrderHandoffDependencies):Promise<Response>{
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  if(!deps.authenticate)return reply(503,{error:'runtime_order_handoff_unavailable'});
  const actor=await deps.authenticate(request);if(!actor)return reply(401,{error:'runtime_workload_not_authorized'});
  try{
    const raw=await request.text();if(Buffer.byteLength(raw)>8192)return reply(413,{error:'payload_too_large'});
    const body=record(JSON.parse(raw));
    if(Object.keys(body).sort().join(',')!=='caseRef,hireId,installationId,objectiveId,orderReceiptRef,responseDueAt,tenantDomain')throw new TypeError();
    if(!reference(body.caseRef)||!reference(body.hireId)||!reference(body.installationId)||!reference(body.objectiveId)||!reference(body.tenantDomain)
      ||body.orderReceiptRef!==`orderv8:case:${body.caseRef}`||typeof body.responseDueAt!=='string'||!Number.isFinite(Date.parse(body.responseDueAt)))throw new TypeError();
    const tenant=await deps.store.tenant(actor.tenantId);
    if(!tenant||tenant.id!==actor.tenantId||tenant.servicev8AccountId!==actor.accountId||tenant.domain!==body.tenantDomain)return reply(403,{error:'tenant_scope_denied'});
    const prior=await deps.store.get(actor.tenantId,body.caseRef);
    if(prior){
      if(prior.objectiveId!==body.objectiveId||prior.installationId!==body.installationId||prior.hireId!==body.hireId)return reply(409,{error:'order_handoff_conflict'});
      return reply(200,{ticket:{reference:prior.ticketReference,status:'open'},receiptRef:prior.receiptRef,owner:prior.owner,nextStep:prior.nextStep,knowledgeTitle:prior.knowledgeTitle});
    }
    const results=await deps.store.knowledge(actor.tenantId);
    const top=results[0];
    if(!top||!top.title?.trim()||!top.summary?.trim())return reply(409,{error:'approved_support_guidance_unavailable'});
    const nextStep=top.summary.trim().slice(0,500);
    const saved=await deps.store.create({tenantId:actor.tenantId,caseRef:body.caseRef,objectiveId:body.objectiveId,installationId:body.installationId,hireId:body.hireId,responseDueAt:body.responseDueAt,nextStep,knowledgeTitle:top.title.trim().slice(0,200)});
    if(!reference(saved.ticketReference)||saved.receiptRef!==`supportv8:order-handoff:${body.caseRef}`||saved.owner!=='Sophia'||!saved.nextStep.trim())throw new Error('invalid_support_receipt');
    return reply(201,{ticket:{reference:saved.ticketReference,status:'open'},receiptRef:saved.receiptRef,owner:saved.owner,nextStep:saved.nextStep,knowledgeTitle:saved.knowledgeTitle});
  }catch(error){
    if(error instanceof TypeError||error instanceof SyntaxError)return reply(400,{error:'invalid_request'});
    if(error instanceof Error&&error.message==='order_handoff_conflict')return reply(409,{error:'order_handoff_conflict'});
    return reply(503,{error:'runtime_order_handoff_unavailable'});
  }
}

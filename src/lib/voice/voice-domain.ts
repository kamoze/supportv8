import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';

export type VoiceDomainIdentity={clientId:string;scopes:readonly string[]};
export type VoiceDomainAuthenticator=(request:Request)=>Promise<VoiceDomainIdentity|null>;
export function createVoiceDomainAuthenticator(input:{issuer:string;allowedClientIds:readonly string[];key:JWTVerifyGetKey}):VoiceDomainAuthenticator{
  const clients=new Set(input.allowedClientIds);
  return async request=>{
    const header=request.headers.get('authorization')??'';if(!header.startsWith('Bearer '))return null;
    try{
      const {payload}=await jwtVerify(header.slice(7),input.key,{issuer:input.issuer,audience:'supportv8',algorithms:['RS256'],
        requiredClaims:['sub','azp','iat','exp'],maxTokenAge:'5m',clockTolerance:5});
      if(typeof payload.azp!=='string'||!clients.has(payload.azp)||typeof payload.sub!=='string'||!payload.sub
        ||typeof payload.iat!=='number'||typeof payload.exp!=='number'||payload.exp<=payload.iat||payload.exp-payload.iat>300
        ||typeof payload.scope!=='string'||!payload.scope.split(' ').includes('supportv8:voice:read'))return null;
      return {clientId:payload.azp,scopes:payload.scope.split(' ')};
    }catch{return null;}
  };
}
let cached:{key:string;authenticate:VoiceDomainAuthenticator}|undefined;
export function voiceDomainAuthenticatorFromEnv(env:NodeJS.ProcessEnv=process.env):VoiceDomainAuthenticator|undefined{
  const issuer=env.SUPPORTV8_VOICE_WORKLOAD_ISSUER?.trim();
  const clients=env.SUPPORTV8_VOICE_WORKLOAD_CLIENT_IDS?.split(',').map(value=>value.trim()).filter(Boolean);
  if(!issuer||!clients?.length)return undefined;
  const jwks=env.SUPPORTV8_VOICE_WORKLOAD_JWKS_URL??`${issuer.replace(/\/$/,'')}/protocol/openid-connect/certs`;
  const key=JSON.stringify([issuer,clients,jwks]);if(cached?.key===key)return cached.authenticate;
  const authenticate=createVoiceDomainAuthenticator({issuer,allowedClientIds:clients,key:createRemoteJWKSet(new URL(jwks),{timeoutDuration:3000})});
  cached={key,authenticate};return authenticate;
}

export type VoiceDomainStore={
  tenant(id:string):Promise<{id:string;domain:string;servicev8AccountId:string|null}|null>;
  ticket(tenantId:string,reference:string):Promise<{tenantId:string;reference:string;status:string;priority:string}|null>;
  createTicket(input:{tenantId:string;hireId:string;installationId:string;sessionId:string;toolCallId:string;customerName:string;summary:string;priority:string}):Promise<{tenantId:string;reference:string;status:string}>;
  knowledge(tenantId:string,query:string):Promise<Array<{title:string;summary:string;url:string|null}>>;
  escalate(input:{tenantId:string;hireId:string;installationId:string;sessionId:string;toolCallId:string;ticketReference:string;reason:string;urgency:string}):Promise<{tenantId:string;reference:string;status:string}|null>;
};
const bindingFields=['accountId','tenantId','tenantDomain','verticalId','acquisitionId','installationId','entitlementId','hireId','productId'];
const reply=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError();return value as Record<string,unknown>;}
function text(value:unknown,max=512):string{if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max||/[\u0000-\u001f]/.test(value))throw new TypeError();return value;}
function exact(value:Record<string,unknown>,keys:readonly string[]){if(Object.keys(value).some(key=>!keys.includes(key)))throw new TypeError();}

/** Internal Domain API. Provider callbacks terminate at Voice Agents, never here. */
export async function handleVoiceDomainRequest(request:Request,deps:{authenticate?:VoiceDomainAuthenticator;store:VoiceDomainStore}):Promise<Response>{
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'});
  if(!deps.authenticate)return reply(503,{error:'voice_domain_unavailable'});
  const identity=await deps.authenticate(request);if(!identity)return reply(401,{error:'voice_workload_not_authorized'});
  try{
    const raw=await request.text();if(raw.length>16384)return reply(413,{error:'payload_too_large'});
    const body=record(JSON.parse(raw));exact(body,['binding','sessionId','toolCallId','action','parameters']);
    const binding=record(body.binding);exact(binding,bindingFields);for(const field of bindingFields)text(binding[field]);
    const sessionId=text(body.sessionId,128),toolCallId=text(body.toolCallId,128),action=text(body.action,64),parameters=record(body.parameters);
    if(binding.verticalId!=='supportv8'||binding.productId!=='servicev8.ai-support-agent')return reply(403,{error:'voice_scope_denied'});
    const tenant=await deps.store.tenant(String(binding.tenantId));
    if(!tenant||tenant.id!==binding.tenantId||tenant.domain!==binding.tenantDomain||tenant.servicev8AccountId!==binding.accountId)return reply(403,{error:'voice_scope_denied'});
    if(action==='support_ticket_lookup'){
      exact(parameters,['ticketReference']);const ticket=await deps.store.ticket(tenant.id,text(parameters.ticketReference,128));
      if(!ticket||ticket.tenantId!==tenant.id)return reply(200,{ok:false,code:'ticket_not_found'});
      return reply(200,{ok:true,ticket:{reference:ticket.reference,status:ticket.status,priority:ticket.priority}});
    }
    if(action==='support_knowledge_search'){
      exact(parameters,['query']);const results=await deps.store.knowledge(tenant.id,text(parameters.query,200));
      return reply(200,{ok:true,results:results.slice(0,5).map(row=>({title:row.title,summary:row.summary,url:row.url}))});
    }
    if(action==='support_ticket_create'){
      exact(parameters,['customerName','summary','priority']);const priority=text(parameters.priority,16);
      if(!['low','normal','high','urgent'].includes(priority))throw new TypeError();
      const ticket=await deps.store.createTicket({tenantId:tenant.id,hireId:String(binding.hireId),installationId:String(binding.installationId),sessionId,toolCallId,
        customerName:text(parameters.customerName,200),summary:text(parameters.summary,1000),priority});
      if(ticket.tenantId!==tenant.id)return reply(409,{error:'voice_ticket_conflict'});
      return reply(200,{ok:true,ticket:{reference:ticket.reference,status:ticket.status}});
    }
    if(action==='support_escalation_create'){
      if(!identity.scopes.includes('supportv8:voice:escalate'))return reply(403,{error:'voice_scope_denied'});
      exact(parameters,['ticketReference','reason','urgency']);const urgency=text(parameters.urgency,16);if(!['normal','urgent'].includes(urgency))throw new TypeError();
      const result=await deps.store.escalate({tenantId:tenant.id,hireId:String(binding.hireId),installationId:String(binding.installationId),sessionId,toolCallId,
        ticketReference:text(parameters.ticketReference,128),reason:text(parameters.reason,1000),urgency});
      if(!result)return reply(200,{ok:false,code:'ticket_not_found'});if(result.tenantId!==tenant.id)return reply(409,{error:'voice_ticket_conflict'});
      return reply(200,{ok:true,escalation:{reference:result.reference,status:'escalated'}});
    }
    return reply(400,{error:'unsupported_voice_action'});
  }catch(error){if(error instanceof TypeError||error instanceof SyntaxError)return reply(400,{error:'invalid_request'});return reply(503,{error:'voice_domain_unavailable'});}
}

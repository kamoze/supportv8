import {InvalidWorkspaceReservationInputError,WorkspaceReservationConflictError,validateRuntimeSupportWorkspaceInput,type RuntimeSupportWorkspace,type RuntimeSupportWorkspaceInput} from './workspace-reservation';
import {SupportProvisionScopeError,type SupportProvisionAuthenticator} from './provision-auth';

type Dependencies={authenticate?:SupportProvisionAuthenticator;acquire(input:RuntimeSupportWorkspaceInput):Promise<RuntimeSupportWorkspace>};
const reply=(status:number,body:unknown,headers?:HeadersInit)=>Response.json(body,{status,headers:{'cache-control':'no-store',...headers}});
const allowed=['accountId','companyDisplayName','installationId','operationId','subject','tenantDomain','tenantId','verticalId'];
const required=allowed.filter(key=>key!=='companyDisplayName');

async function boundedBody(request:Request):Promise<string>{
  const declared=request.headers.get('content-length');if(declared&&Number(declared)>8192)throw new RangeError();
  if(!request.body)return '';
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192)throw new RangeError();chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>undefined);throw error;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}

function topLevelKeys(raw:string):string[]{
  const keys:string[]=[];let depth=0,inString=false,escaped=false,stringStart=-1;
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(inString){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c==='"'){inString=false;if(depth===1){let j=i+1;while(/\s/.test(raw[j]??''))j++;if(raw[j]===':')keys.push(JSON.parse(raw.slice(stringStart,i+1)));}}continue;}
    if(c==='"'){inString=true;stringStart=i;}else if(c==='{')depth++;else if(c==='}')depth--;
  }
  return keys;
}

export async function handleSupportProvisionRequest(request:Request,deps:Dependencies):Promise<Response>{
  if(request.method!=='POST')return reply(405,{error:'method_not_allowed'},{allow:'POST'});
  if(!deps.authenticate)return reply(503,{error:'support_provision_unavailable'});
  let actor;
  try{actor=await deps.authenticate(request);}catch(error){if(error instanceof SupportProvisionScopeError)return reply(403,{error:'support_provision_scope_denied'});return reply(503,{error:'support_provision_unavailable'});}
  if(!actor)return reply(401,{error:'support_provision_not_authorized'});
  let mapped:RuntimeSupportWorkspaceInput;
  try{
    if(new URL(request.url).search)return reply(400,{error:'invalid_request'});
    const raw=await boundedBody(request);const parsed:unknown=JSON.parse(raw);
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new TypeError();
    const keys=topLevelKeys(raw);if(new Set(keys).size!==keys.length)throw new TypeError();
    const input=parsed as Record<string,unknown>;const bodyKeys=Object.keys(input);
    if(bodyKeys.some(key=>!allowed.includes(key))||required.some(key=>!(key in input)))throw new TypeError();
    if(actor.accountId!==undefined&&input.accountId!==actor.accountId||actor.tenantId!==undefined&&input.tenantId!==actor.tenantId)return reply(403,{error:'support_provision_scope_denied'});
    mapped=validateRuntimeSupportWorkspaceInput({accountId:input.accountId,registryTenantId:input.tenantId,installationId:input.installationId,operationId:input.operationId,tenantDomain:input.tenantDomain,verticalId:input.verticalId,subject:input.subject,...(input.companyDisplayName===undefined?{}:{companyDisplayName:input.companyDisplayName})});
    if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(mapped.tenantDomain))throw new InvalidWorkspaceReservationInputError();
  }catch(error){
    if(error instanceof RangeError)return reply(413,{error:'payload_too_large'});
    if(error instanceof SyntaxError||error instanceof TypeError||error instanceof InvalidWorkspaceReservationInputError)return reply(400,{error:'invalid_request'});
    return reply(503,{error:'support_provision_unavailable'});
  }
  try{
    const saved=await deps.acquire(mapped);
    if(saved.status!=='workspace_created'||saved.domain!==mapped.tenantDomain||!/^tenant_rt_[0-9a-f]{48}$/.test(saved.workspaceId))throw new Error('invalid_workspace_result');
    return reply(200,{schemaVersion:'servicev8.support-workspace.v1',status:'workspace_created',readiness:'configuration_required',workspaceId:saved.workspaceId,tenantDomain:mapped.tenantDomain});
  }catch(error){
    if(error instanceof WorkspaceReservationConflictError)return reply(409,{error:'workspace_reservation_conflict'});
    return reply(503,{error:'support_provision_unavailable'});
  }
}

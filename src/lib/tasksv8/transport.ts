import { type KeyObject } from 'node:crypto';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { exact, identifier, parseTaskWorkRequest,type TaskWorkRequest } from './contract';
import { boundedJson } from './http';
export function taskWorkEndpoint(raw:string,path?:string):URL {const url=new URL(raw);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(path&&url.pathname!==path))throw Error('task_work_configuration_required');return url;}
export function createTaskWorkAppVerifier(input:{issuer:string;key:JWTVerifyGetKey|KeyObject|CryptoKey;clientId:string;subject:string;audience:string;scope:string}) {
 taskWorkEndpoint(input.issuer);if(!identifier(input.clientId)||!identifier(input.subject))throw Error('task_work_configuration_required');
 return async(request:Request):Promise<boolean>=>{try{const h=request.headers.get('authorization')??'';if(!/^Bearer [\x21-\x7e]{1,16384}$/.test(h))return false;const {payload:p}=await jwtVerify(h.slice(7),input.key as JWTVerifyGetKey,{issuer:input.issuer,audience:input.audience,algorithms:['RS256'],requiredClaims:['sub','azp','iat','exp','scope','preferred_username'],clockTolerance:0});const now=Math.floor(Date.now()/1000),allowed=['iss','aud','sub','azp','iat','exp','nbf','jti','scope','preferred_username','typ','acr','realm_access','resource_access','client_id','clientHost','clientAddress'];return p.aud===input.audience&&p.sub===input.subject&&p.azp===input.clientId&&p.scope===input.scope&&p.preferred_username===`service-account-${input.clientId}`&&Object.keys(p).every(k=>allowed.includes(k))&&(p.client_id===undefined||p.client_id===input.clientId)&&Number.isSafeInteger(p.iat)&&Number.isSafeInteger(p.exp)&&p.iat!<=now&&p.exp!>now&&p.exp!>p.iat!&&p.exp!-p.iat!<=120;}catch{return false;}};
}
export function createTaskWorkIssuerClient(input:{url:string;credential:(signal:AbortSignal)=>Promise<string>;request?:typeof fetch}) {
 const url=taskWorkEndpoint(input.url,'/v1/tokens/task-work');
 return async(selector:TaskWorkRequest,parent:AbortSignal):Promise<string>=>{
  if(!parseTaskWorkRequest(selector))throw Error('task_work_selector_invalid');
  const signal=AbortSignal.any([parent,AbortSignal.timeout(10000)]),token=await input.credential(signal);signal.throwIfAborted();
  const response=await(input.request??fetch)(url,{method:'POST',redirect:'error',cache:'no-store',signal,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(selector)});
  if(response.status!==200||response.redirected){void response.body?.cancel().catch(()=>{});throw Error('task_work_issuance_unavailable');}
  const body=await boundedJson(response,32768,signal);signal.throwIfAborted();
  if(!exact(body,['access_token','token_type','expires_in','issued_token_type'])||typeof body.access_token!=='string'||!body.access_token||body.access_token.length>16384||body.token_type!=='Bearer'||body.issued_token_type!=='urn:ietf:params:oauth:token-type:access_token'||!Number.isSafeInteger(body.expires_in)||Number(body.expires_in)<1||Number(body.expires_in)>120)throw Error('task_work_issuance_invalid');
  return body.access_token;
 };
}

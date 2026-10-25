import {readFile} from 'node:fs/promises';
import {createRemoteJWKSet,customFetch} from 'jose';
import {taskWorkEndpoint,createTaskWorkAppVerifier} from './transport';
import {boundedJson} from './http';
export function nativeWorkCredential(prefix:string,audience:string,scope:string,env:NodeJS.ProcessEnv=process.env,request:typeof fetch=fetch){
 const required=(suffix:string)=>{const v=env[prefix+'_'+suffix];if(!v||v.trim()!==v)throw Error('task_work_configuration_required');return v;};
 const issuer=required('WORKLOAD_ISSUER'),file=required('SECRET_FILE'),client=required('CLIENT_ID'),subject=required('SUBJECT');if(!file.startsWith('/'))throw Error('task_work_configuration_required');
 const tokenUrl=taskWorkEndpoint(issuer);tokenUrl.pathname=tokenUrl.pathname.replace(/\/$/,'')+'/protocol/openid-connect/token';
 const key=createRemoteJWKSet(taskWorkEndpoint(required('WORKLOAD_JWKS_URL')),{timeoutDuration:2000,[customFetch]:(url,init)=>request(url,{...init,redirect:'error',cache:'no-store'})});
 const verify=createTaskWorkAppVerifier({issuer,key,clientId:client,subject,audience,scope});
 return async(parent:AbortSignal)=>{
  const signal=AbortSignal.any([parent,AbortSignal.timeout(5000)]),secret=(await readFile(file,'utf8')).trim();if(!secret||secret.length>4096)throw Error('task_work_configuration_required');signal.throwIfAborted();
  const response=await request(tokenUrl,{method:'POST',redirect:'error',cache:'no-store',signal,headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:client,client_secret:secret,audience,scope})});
  if(response.status!==200||response.redirected){void response.body?.cancel().catch(()=>{});throw Error('task_work_workload_unavailable');}
  const body=await boundedJson(response,32768,signal) as Record<string,unknown>;
  if(!body||body.token_type!=='Bearer'||typeof body.access_token!=='string'||body.access_token.length>16384||!await verify(new Request('https://workload.invalid',{headers:{authorization:'Bearer '+body.access_token}})))throw Error('task_work_workload_unavailable');signal.throwIfAborted();return body.access_token;
 };
}

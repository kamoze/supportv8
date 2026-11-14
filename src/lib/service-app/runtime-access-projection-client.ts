import type { SupportRuntimeScope } from './runtime-access';
import type { AccessMembership, AccessReceipt } from './runtime-access-projection';
import { SUPPORT_PRODUCT } from './runtime-access-projection';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function url(value:string|undefined,root=false){const parsed=new URL(value??'');if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash||(root&&parsed.pathname!=='/'))throw Error('authority_unavailable');return parsed;}
async function json(response:Response,limit:number):Promise<unknown>{if(!response.ok||!response.body)throw Error('authority_unavailable');const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>limit){await reader.cancel();throw Error('authority_unavailable');}chunks.push(item.value);}}finally{reader.releaseLock();}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
/** Dedicated configured Support workload; no Runtime shared secret or human impersonation. */
export class RegistrySupportAccessClient {
 constructor(private readonly env:Readonly<Record<string,string|undefined>>=process.env,private readonly request:typeof fetch=fetch){}
 private async post(s:SupportRuntimeScope,action:'read'|'receipt',body:Record<string,unknown>):Promise<unknown>{
  const issuer=url(this.env.SERVICEV8_OIDC_ISSUER),origin=url(this.env.REGISTRY_URL,true);
  const clientId=this.env.SUPPORTV8_ACCESS_REGISTRY_CLIENT_ID?.trim(),secret=this.env.SUPPORTV8_ACCESS_REGISTRY_CLIENT_SECRET?.trim();
  if(!clientId||!secret)throw Error('authority_unavailable');
  const tokenResponse=await this.request(new URL(`${issuer.pathname.replace(/\/$/,'')}/protocol/openid-connect/token`,issuer),{method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:secret,audience:'servicev8-registry',scope:`registry:workspace-access:${action}`}),headers:{'content-type':'application/x-www-form-urlencoded'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
  const token=await json(tokenResponse,8192);if(!object(token)||typeof token.access_token!=='string'||!token.access_token)throw Error('authority_unavailable');
  const response=await this.request(new URL(`/v1/workspace-access/${encodeURIComponent(s.tenantId)}/${action}`,origin),{method:'POST',headers:{authorization:`Bearer ${token.access_token}`,'content-type':'application/json'},body:JSON.stringify({...body,accountId:s.accountId,installationId:s.installationId,...(action==='receipt'?{productId:SUPPORT_PRODUCT}:{})}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});
  return json(response,256000);
 }
 async list(s:SupportRuntimeScope,after:string,limit:number):Promise<{memberships:AccessMembership[];nextCursor:string|null}>{const value=await this.post(s,'read',{after,limit});if(!object(value)||!Array.isArray(value.memberships)||!(value.nextCursor===null||typeof value.nextCursor==='string'))throw Error('authority_unavailable');return value as {memberships:AccessMembership[];nextCursor:string|null};}
 async current(s:SupportRuntimeScope,subject:string):Promise<AccessMembership|null>{const value=await this.post(s,'read',{subject});if(!object(value)||!(value.membership===null||object(value.membership)))throw Error('authority_unavailable');return value.membership as AccessMembership|null;}
 async receipt(s:SupportRuntimeScope,value:AccessReceipt):Promise<void>{await this.post(s,'receipt',value);}
}

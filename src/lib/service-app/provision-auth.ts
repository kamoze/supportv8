import {createRemoteJWKSet,jwtVerify,type JWTVerifyGetKey} from 'jose';

export type SupportProvisionActor={clientId:string;accountId?:string;tenantId?:string};
export type SupportProvisionAuthenticator=(request:Request)=>Promise<SupportProvisionActor|null>;

export class SupportProvisionScopeError extends Error{
  constructor(){super('support_provision_scope_denied');this.name='SupportProvisionScopeError';}
}

const optionalReference=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);

export function createSupportProvisionAuthenticator(input:{issuer:string;allowedClientIds:readonly string[];key:JWTVerifyGetKey|CryptoKey|Uint8Array}):SupportProvisionAuthenticator{
  const clients=new Set(input.allowedClientIds);
  return async request=>{
    const header=request.headers.get('authorization')??'';
    if(!header.startsWith('Bearer ')||header.length>16400)return null;
    try{
      const {payload}=await jwtVerify(header.slice(7),input.key,{issuer:input.issuer,audience:'supportv8',algorithms:['RS256'],requiredClaims:['sub','azp','iat','exp'],maxTokenAge:'5m',clockTolerance:5});
      if(typeof payload.sub!=='string'||!payload.sub||typeof payload.azp!=='string'||!payload.azp||!clients.has(payload.azp)
        ||typeof payload.iat!=='number'||typeof payload.exp!=='number'||payload.exp<=payload.iat||payload.exp-payload.iat>300)return null;
      if(payload.account_id!==undefined&&!optionalReference(payload.account_id))return null;
      if(payload.tenant_id!==undefined&&!optionalReference(payload.tenant_id))return null;
      const scopes=typeof payload.scope==='string'?payload.scope.split(/\s+/).filter(Boolean):[];
      if(!scopes.includes('supportv8:service-app:provision'))throw new SupportProvisionScopeError();
      return {clientId:payload.azp,...(payload.account_id===undefined?{}:{accountId:payload.account_id as string}),...(payload.tenant_id===undefined?{}:{tenantId:payload.tenant_id as string})};
    }catch(error){
      if(error instanceof SupportProvisionScopeError)throw error;
      return null;
    }
  };
}

let cached:{key:string;authenticate:SupportProvisionAuthenticator}|undefined;
export function supportProvisionAuthenticatorFromEnv(env:Record<string,string|undefined>=process.env):SupportProvisionAuthenticator|undefined{
  const issuer=env.SUPPORTV8_PROVISION_WORKLOAD_ISSUER?.trim();
  const clients=env.SUPPORTV8_PROVISION_WORKLOAD_CLIENT_IDS?.split(',').map(value=>value.trim()).filter(Boolean);
  if(!issuer||!clients?.length)return undefined;
  const jwks=env.SUPPORTV8_PROVISION_WORKLOAD_JWKS_URL?.trim()||`${issuer.replace(/\/$/,'')}/protocol/openid-connect/certs`;
  const cacheKey=JSON.stringify([issuer,clients,jwks]);
  if(cached?.key===cacheKey)return cached.authenticate;
  try{
    const authenticate=createSupportProvisionAuthenticator({issuer,allowedClientIds:clients,key:createRemoteJWKSet(new URL(jwks),{timeoutDuration:3000})});
    cached={key:cacheKey,authenticate};return authenticate;
  }catch{return undefined;}
}

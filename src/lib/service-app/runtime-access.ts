import { pgClient, type PostgresClient } from "../db/pg-client";

export type SupportRuntimeScope = {
  accountId: string;
  tenantId: string;
  verticalId: "runtime";
  installationId: string;
  workspaceId: string;
  subject: string;
};
export type SupportCapability = "support:read" | "support:manage";
export type OperationalSupportAccess = SupportRuntimeScope & {
  capability: SupportCapability;
  email: string;
  domain: string;
  planId?: string;
  poolAccountId?: string;
  credits?: number;
};
export type BootstrapSupportAccess = { verified: true };

type RegistryMember = { accountId:unknown;tenantId:unknown;identitySubject:unknown;email:unknown;role:unknown;status:unknown;slug:unknown;displayName?:unknown };
type RegistryProjection = Record<string, unknown>;
type CurrentAuthority = { member: RegistryMember; projection: RegistryProjection };
type LocalWorkspace = { installationId:string;accountId:string;tenantId:string;verticalId:"runtime";workspaceId:string;domain:string;ownerAccountId:string;creatorSubject:string };
type Environment = Readonly<Record<string,string|undefined>>;
type Dependencies = { now?:()=>number; current?:(scope:SupportRuntimeScope)=>Promise<CurrentAuthority|null>; local?:(scope:SupportRuntimeScope)=>Promise<LocalWorkspace|null>; client?:PostgresClient };

const roleCapabilities:Readonly<Record<string,SupportCapability>>={OWNER:"support:manage",ADMIN:"support:manage",MANAGER:"support:read",STAFF:"support:read",MEMBER:"support:read"};
const reference=/^[A-Za-z0-9_:@.-]{1,192}$/;
const workspace=/^tenant_[a-z0-9_]{1,56}$/;
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value);

export function parseSupportRuntimeScope(value:unknown):SupportRuntimeScope|null {
  if(!object(value)) return null;
  const fields=["accountId","tenantId","verticalId","installationId","workspaceId","subject"];
  if(Object.keys(value).length!==fields.length||!fields.every(field=>Object.hasOwn(value,field))||value.verticalId!=="runtime") return null;
  if(![value.accountId,value.tenantId,value.installationId,value.subject].every(item=>typeof item==="string"&&reference.test(item))||typeof value.workspaceId!=="string"||!workspace.test(value.workspaceId)) return null;
  return value as SupportRuntimeScope;
}

function configuredUrl(value:string|undefined,rootOnly=false):URL|null {
  try { const url=new URL(value?.trim()??""); if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.search||url.hash||(rootOnly&&url.pathname!=="/")) return null; return url; }
  catch { return null; }
}
async function boundedJson(response:Response,limit=64_000):Promise<unknown>{
  const declared=response.headers.get("content-length");
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit)) throw new Error("authority_unavailable");
  if(!response.body)return JSON.parse(await response.text()) as unknown;
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>limit)throw new Error("authority_unavailable");chunks.push(value);}}}
  finally{reader.releaseLock();}
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as unknown;
}

export class RegistrySupportAuthority {
  private readonly env:Environment; private readonly request:typeof fetch;
  constructor(deps:{env?:Environment;request?:typeof fetch}={}){this.env=deps.env??process.env;this.request=deps.request??fetch;}
  private async token():Promise<string>{
    const issuer=configuredUrl(this.env.SERVICEV8_OIDC_ISSUER); const clientId=this.env.SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID?.trim(); const secret=this.env.SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET?.trim();
    if(!issuer||!clientId||!secret) throw new Error("authority_unavailable");
    const endpoint=new URL(`${issuer.pathname.replace(/\/$/,"")}/protocol/openid-connect/token`,issuer);
    const response=await this.request(endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",client_id:clientId,client_secret:secret,audience:"servicev8-registry",scope:"registry:memberships:read registry:installations:read"}),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(5_000)});
    const body=await boundedJson(response,8_192); if(!response.ok||!object(body)||typeof body.access_token!=="string"||!body.access_token) throw new Error("authority_unavailable"); return body.access_token;
  }
  private async get(url:URL):Promise<unknown>{
    const token=await this.token(); const response=await this.request(url,{method:"GET",headers:{authorization:`Bearer ${token}`,accept:"application/json"},redirect:"error",cache:"no-store",signal:AbortSignal.timeout(5_000)});
    if(!response.ok) throw new Error("authority_unavailable"); return boundedJson(response);
  }
  async read(scope:SupportRuntimeScope):Promise<CurrentAuthority|null>{
    const parsed=parseSupportRuntimeScope(scope); const origin=configuredUrl(this.env.REGISTRY_URL,true); if(!parsed||!origin) return null;
    try {
      const membershipUrl=new URL(`/v1/tenants/${encodeURIComponent(parsed.tenantId)}/memberships/${encodeURIComponent(parsed.subject)}`,origin); membershipUrl.searchParams.set("accountId",parsed.accountId);
      const projectionUrl=new URL("/v1/projections/installations",origin); for(const [key,value] of [["accountId",parsed.accountId],["tenantId",parsed.tenantId],["installationId",parsed.installationId]] as const) projectionUrl.searchParams.set(key,value);
      const [memberValue,projectionValue]=await Promise.all([this.get(membershipUrl),this.get(projectionUrl)]);
      if(!object(memberValue)||!object(projectionValue)||!Array.isArray(projectionValue.installations)) return null;
      const exact=projectionValue.installations.filter(item=>object(item)&&item.accountId===parsed.accountId&&item.tenantId===parsed.tenantId&&item.verticalId==="runtime"&&item.installationId===parsed.installationId);
      return exact.length===1?{member:memberValue as RegistryMember,projection:exact[0] as RegistryProjection}:null;
    } catch { return null; }
  }
}

async function readLocalWorkspace(scope:SupportRuntimeScope,client:PostgresClient):Promise<LocalWorkspace|null>{
  try{return await client.withWorkspaceProvisioningSession({tenantId:scope.workspaceId,accountId:scope.accountId,registryTenantId:scope.tenantId},async db=>{
    const rows=await db.query<Record<string,string>>(`SELECT w.installation_id,w.account_id,w.registry_tenant_id,w.vertical_id,w.native_tenant_id,w.native_domain,w.subject,t.servicev8_account_id
      FROM supportv8.runtime_support_workspaces w JOIN supportv8.tenants t
        ON t.id=w.native_tenant_id AND t.domain=w.native_domain AND t.servicev8_account_id=w.account_id
      WHERE w.installation_id=$1 AND w.account_id=$2 AND w.registry_tenant_id=$3 AND w.vertical_id='runtime'
        AND w.native_tenant_id=$4 AND w.state='workspace_created' AND w.deleted_at IS NULL`,[scope.installationId,scope.accountId,scope.tenantId,scope.workspaceId]);
    const row=rows.length===1?rows[0]:undefined; return row?{installationId:row.installation_id!,accountId:row.account_id!,tenantId:row.registry_tenant_id!,verticalId:"runtime",workspaceId:row.native_tenant_id!,domain:row.native_domain!,ownerAccountId:row.servicev8_account_id!,creatorSubject:row.subject!}:null;
  });}catch{return null;}
}

function common(scope:SupportRuntimeScope,current:CurrentAuthority,local:LocalWorkspace,now:number):{capability:SupportCapability;email:string;domain:string;planId?:string;poolAccountId?:string;credits?:number}|null{
  const {member,projection:p}=current;
  if(member.accountId!==scope.accountId||member.tenantId!==scope.tenantId||member.identitySubject!==scope.subject||member.status!=="active"||typeof member.email!=="string"||!member.email.trim()||typeof member.role!=="string"||typeof member.slug!=="string") return null;
  const capability=roleCapabilities[member.role.toUpperCase()]; if(!capability) return null;
  if(p.accountId!==scope.accountId||p.tenantId!==scope.tenantId||p.verticalId!=="runtime"||p.installationId!==scope.installationId||p.productId!=="servicev8.service-app.supportv8"||p.productVersion!=="1.0.0"||p.productKind!=="service_app"||p.entitlementStatus!=="active"||p.tenantDomain!==member.slug) return null;
  if(p.expiresAt!==undefined&&(typeof p.expiresAt!=="string"||!Number.isFinite(Date.parse(p.expiresAt))||Date.parse(p.expiresAt)<=now)) return null;
  if(local.installationId!==scope.installationId||local.accountId!==scope.accountId||local.tenantId!==scope.tenantId||local.verticalId!=="runtime"||local.workspaceId!==scope.workspaceId||local.domain!==member.slug||local.ownerAccountId!==scope.accountId) return null;

  const binding = object(p.serviceAppBinding) ? p.serviceAppBinding as Record<string, unknown> : undefined;
  const poolAccountId = typeof binding?.poolAccountId === "string" ? binding.poolAccountId : undefined;
  const planAccess = object(p.serviceAppPlanAccess) ? p.serviceAppPlanAccess as Record<string, unknown> : undefined;
  const rawPlanId = p.planId || p.plan || p.tier || (typeof planAccess?.planId === "string" ? planAccess.planId : undefined) || (planAccess?.state === "included" ? (p.planId || "starter") : undefined);
  const planId = typeof rawPlanId === "string" ? rawPlanId : undefined;
  const rawCredits = p.credits ?? p.creditsBalance;
  const credits = typeof rawCredits === "number" && Number.isFinite(rawCredits) ? rawCredits : undefined;

  return {capability,email:member.email,domain:local.domain,planId,poolAccountId,credits};
}

async function dependencies(scope:SupportRuntimeScope,deps:Dependencies):Promise<[CurrentAuthority,LocalWorkspace]|null>{
  const authority=new RegistrySupportAuthority();
  const currentReader=deps.current??authority.read.bind(authority);
  try { const [current,local]=await Promise.all([currentReader(scope),(deps.local??((s)=>readLocalWorkspace(s,deps.client??pgClient)))(scope)]); return current&&local?[current,local]:null; } catch{return null;}
}
export async function resolveOperationalSupportAccess(value:unknown,deps:Dependencies={}):Promise<OperationalSupportAccess|null>{
  const scope=parseSupportRuntimeScope(value); if(!scope)return null; const found=await dependencies(scope,deps); if(!found)return null; const allowed=common(scope,found[0],found[1],(deps.now??Date.now)()); if(!allowed)return null;
  const p=found[0].projection,b=p.serviceAppBinding;
  if(p.installationState!=="active"||!object(p.serviceAppReadiness)||p.serviceAppReadiness.state!=="ready"||!object(p.serviceAppPlanAccess)||p.serviceAppPlanAccess.state!=="included"||!object(b)||b.schemaVersion!=="servicev8.service-app-binding.v1"||b.appKey!=="supportv8"||b.externalWorkspaceId!==scope.workspaceId||b.poolAccountId!==scope.accountId||b.provisioningState!=="provisioned"||b.poolBindingState!=="verified")return null;
  return {...scope,...allowed};
}
export async function resolveBootstrapSupportAccess(value:unknown,deps:Dependencies={}):Promise<BootstrapSupportAccess|null>{
  const scope=parseSupportRuntimeScope(value);if(!scope)return null;const found=await dependencies(scope,deps);if(!found)return null;const allowed=common(scope,found[0],found[1],(deps.now??Date.now)());if(!allowed||allowed.capability!=="support:manage"||found[1].creatorSubject!==scope.subject||found[0].projection.principalId!==scope.subject||!["provisioning","configuration_required","active"].includes(String(found[0].projection.installationState)))return null;return {verified:true};
}

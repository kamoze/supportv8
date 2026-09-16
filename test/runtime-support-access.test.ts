import { describe, expect, it, vi } from "vitest";
import {
  RegistrySupportAuthority,
  resolveBootstrapSupportAccess,
  resolveOperationalSupportAccess,
  type SupportRuntimeScope,
} from "@/lib/service-app/runtime-access";

const scope: SupportRuntimeScope = { accountId:"acct-1",tenantId:"registry-1",verticalId:"runtime",installationId:"install-1",workspaceId:"tenant_rt_1234567890abcdef1234567890abcdef1234567890abcdef",subject:"member-2" };
const member = { accountId:scope.accountId,tenantId:scope.tenantId,identitySubject:scope.subject,email:"member@example.test",role:"STAFF",status:"active",slug:"acme-support",displayName:"Acme" };
const binding = { schemaVersion:"servicev8.service-app-binding.v1",appKey:"supportv8",externalWorkspaceId:scope.workspaceId,meteringTenantId:"meter-1",poolAccountId:scope.accountId,provisioningState:"provisioned",poolBindingState:"verified" };
const projection = { accountId:scope.accountId,tenantId:scope.tenantId,verticalId:"runtime",installationId:scope.installationId,principalId:"creator-1",tenantDomain:"acme-support",productId:"servicev8.service-app.supportv8",productVersion:"1.0.0",productKind:"service_app",entitlementStatus:"active",installationState:"active",serviceAppReadiness:{state:"ready"},serviceAppPlanAccess:{state:"included",planId:"scale"},serviceAppBinding:binding };
const local = { installationId:scope.installationId,accountId:scope.accountId,tenantId:scope.tenantId,verticalId:"runtime" as const,workspaceId:scope.workspaceId,domain:"acme-support",ownerAccountId:scope.accountId,creatorSubject:"creator-1" };

describe("current Runtime Support access",()=>{
  it.each([["OWNER","support:manage"],["ADMIN","support:manage"],["MANAGER","support:read"],["STAFF","support:read"],["MEMBER","support:read"]])("maps %s to %s",async(role,capability)=>{
    const result=await resolveOperationalSupportAccess(scope,{current:async()=>({member:{...member,role},projection}),local:async()=>local});
    expect(result).toMatchObject({...scope,capability,email:member.email,domain:"acme-support"});
  });
  it.each([
    ["unknown role",{member:{...member,role:"FINANCE"},projection},local],
    ["suspended member",{member:{...member,status:"suspended"},projection},local],
    ["wrong account",{member,projection:{...projection,accountId:"other"}},local],
    ["wrong tenant",{member,projection:{...projection,tenantId:"other"}},local],
    ["wrong subject",{member:{...member,identitySubject:"other"},projection},local],
    ["wrong installation",{member,projection:{...projection,installationId:"other"}},local],
    ["wrong native",{member,projection:{...projection,serviceAppBinding:{...binding,externalWorkspaceId:"tenant_wrong"}}},local],
    ["wrong domain",{member,projection:{...projection,tenantDomain:"other"}},local],
    ["wrong product",{member,projection:{...projection,productId:"servicev8.ai-support-agent"}},local],
    ["wrong version",{member,projection:{...projection,productVersion:"2.0.0"}},local],
    ["plan omitted",{member,projection:{...projection,serviceAppPlanAccess:{state:"not_included"}}},local],
    ["expired",{member,projection:{...projection,expiresAt:"2026-09-15T00:00:00.000Z"}},local],
    ["not ready",{member,projection:{...projection,serviceAppReadiness:{state:"blocked"}}},local],
    ["missing mapping",{member,projection},null],
  ])("denies %s",async(_name,current,mapping)=>{
    expect(await resolveOperationalSupportAccess(scope,{now:()=>Date.parse("2026-09-16T00:00:00Z"),current:async()=>current as never,local:async()=>mapping as never})).toBeNull();
  });
  it("allows a different current administrator than the immutable reservation creator",async()=>{
    expect((await resolveOperationalSupportAccess(scope,{current:async()=>({member:{...member,role:"ADMIN"},projection}),local:async()=>local}))?.subject).toBe("member-2");
  });
  it("keeps bootstrap data-free and limited to the initiating current admin",async()=>{
    const bootstrapProjection={...projection,principalId:"creator-1",installationState:"configuration_required"};
    delete (bootstrapProjection as Record<string,unknown>).serviceAppBinding;
    delete (bootstrapProjection as Record<string,unknown>).serviceAppReadiness;
    delete (bootstrapProjection as Record<string,unknown>).serviceAppPlanAccess;
    const creatorScope={...scope,subject:"creator-1"};
    const result=await resolveBootstrapSupportAccess(creatorScope,{current:async()=>({member:{...member,identitySubject:"creator-1",role:"OWNER"},projection:bootstrapProjection}),local:async()=>local});
    expect(result).toEqual({verified:true});
    expect(await resolveBootstrapSupportAccess(scope,{current:async()=>({member:{...member,role:"ADMIN"},projection:bootstrapProjection}),local:async()=>local})).toBeNull();
  });
  it("fetches exact current membership and installation without caching",async()=>{
    const request=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      const url=String(input);
      if(url.includes("openid-connect/token")) return Response.json({access_token:"token"});
      if(url.includes("/memberships/")) return Response.json(member);
      return Response.json({installations:[projection]});
    });
    const authority=new RegistrySupportAuthority({env:{REGISTRY_URL:"https://registry.example/",SERVICEV8_OIDC_ISSUER:"https://id.example/realms/servicev8",SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID:"support-runtime-reader",SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET:"secret"},request});
    expect(await authority.read(scope)).toEqual({member,projection});
    expect(await authority.read(scope)).toEqual({member,projection});
    expect(request).toHaveBeenCalledTimes(8);
    const calls=request.mock.calls.map(([url,init])=>({url:String(url),init}));
    expect(calls.filter(c=>c.url.includes("/memberships/"))).toHaveLength(2);
    expect(calls.filter(c=>c.url.includes("/projections/installations"))).toHaveLength(2);
    for(const call of calls) expect(call.init).toMatchObject({cache:"no-store",redirect:"error"});
  });
});

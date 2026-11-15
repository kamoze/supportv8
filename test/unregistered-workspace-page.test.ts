import { workspaceDiscoveryLimiter } from "../src/lib/auth/workspace-discovery-limit";
vi.mock("@/lib/auth/workspace-discovery-limit",()=>({workspaceDiscoveryLimiter:{enforce:vi.fn(async()=>{})}}));
import { describe, it, expect, vi, afterEach } from "vitest";
import type { TenantWorkspaceRecord } from "../src/lib/tenant-resolver";
import { NextRequest } from "next/server";
import { resolvePageWorkspace } from "../src/lib/auth/page-workspace";
import { GET } from "../src/app/login/route";
const host = "dex.support.servicev8.com";
const record: TenantWorkspaceRecord = {id:"tenant-dex",accountId:"account-dex",slug:"dex",name:"Verified Company",status:"active",url:`https://${host}/`};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("server page registration boundary",()=>{
 it("rate-limit failure denies before calling Registry",async()=>{
  vi.mocked(workspaceDiscoveryLimiter.enforce).mockRejectedValueOnce(Error("limit"));const lookup=vi.fn();
  expect(await resolvePageWorkspace(new Headers({host}),lookup)).toBe("unavailable");expect(lookup).not.toHaveBeenCalled();
 });
 it("never treats a syntactically valid subdomain as a registered workspace",async()=>{
  expect(await resolvePageWorkspace(new Headers({host}),async()=>null)).toBe("missing");
 });
 it("accepts only current active exact registered origin",async()=>{
  expect(await resolvePageWorkspace(new Headers({host}),async()=>record)).toBe("tenant");
  for(const changed of [{status:"suspended" as const},{url:"https://other.support.servicev8.com/"},{slug:"other"}]) expect(await resolvePageWorkspace(new Headers({host}),async()=>({...record,...changed}))).toBe("missing");
 });
 it("rejects conflicting/forged hosts before directory lookup",async()=>{
  const lookup=vi.fn();
  expect(await resolvePageWorkspace(new Headers({host,"x-forwarded-host":"acme.support.servicev8.com"}),lookup)).toBe("missing");
  expect(await resolvePageWorkspace(new Headers({host,forwarded:"host=acme.support.servicev8.com"}),lookup)).toBe("missing");
  expect(lookup).not.toHaveBeenCalled();
 });
 it("keeps the global workspace selector available and fails closed on owner outage",async()=>{
  const lookup=vi.fn().mockRejectedValue(Error("unavailable"));
  expect(await resolvePageWorkspace(new Headers({host:"support.servicev8.com"}),lookup)).toBe("global");expect(lookup).not.toHaveBeenCalled();
  expect(await resolvePageWorkspace(new Headers({host}),lookup)).toBe("unavailable");
 });
 it.each([404,503,200])("mounted login GET returns no credentials and correct result for Registry status %s",async(status)=>{
  vi.stubEnv("REGISTRY_URL","https://registry.example.test");vi.stubEnv("SERVICEV8_OIDC_ISSUER","https://identity.example.test/realms/servicev8");vi.stubEnv("SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID","fixture-reader");vi.stubEnv("SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET","fixture-secret");
  vi.stubGlobal("fetch",vi.fn(async(input)=>String(input).includes("/token") ? Response.json({access_token:"fixture",token_type:"Bearer",expires_in:120}) : status===200 ? Response.json({schemaVersion:1,productAppKey:"support",tenantId:"canonical-dex",accountId:"account-dex",slug:"dex",companyName:"Registered Company",origin:`https://${host}`}) : new Response(null,{status})));
  const response=await GET(new NextRequest(`https://${host}/login`,{headers:{host}}));
  expect(response.status).toBe(status===200?302:status);expect(response.headers.get("cache-control")).toBe("no-store");expect(await response.text()).not.toMatch(/<input|Welcome to Dex/);
 });
});

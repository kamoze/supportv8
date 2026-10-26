import {afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('@/lib/auth/workspace-discovery-limit',()=>({workspaceDiscoveryLimiter:{enforce:vi.fn(async()=>{})}}));
import {NextRequest} from 'next/server';
import {createHmac} from 'node:crypto';
import {PostgresClient} from '../src/lib/db/pg-client';
import {RuntimeSupportWorkspaceStore} from '../src/lib/service-app/workspace-reservation';
import {signRuntimeSupportSession,verifyRuntimeSupportSession} from '../src/lib/service-app/runtime-session';
import {requiresWorkspaceOwnerVerification,requireVerifiedWorkspaceOwner} from '../src/lib/auth/workspace-owner-verification';
import {createWorkspaceDiscovery} from '../src/lib/auth/workspace-discovery';
import {resolvePageWorkspace} from '../src/lib/auth/page-workspace';
import {GET,POST} from '../src/app/api/workspace/lookup/route';
import {GET as login} from '../src/app/login/route';
import {GET as verificationPage} from '../src/app/workspace-verification-required/route';
const pending=[['lexiflowers','tenant_lexiflowers'],['bookdemo','tenant_bookdemo'],['booksdemo','tenant_booksdemo'],['asun-palace-store','tenant_asun_palace_store']];
afterEach(()=>vi.restoreAllMocks());
describe('required legacy owner verification',()=>{
 it.each(pending)('holds %s by both original slug and native ID, even after a rename',async(slug,nativeTenantId)=>{
  expect(requiresWorkspaceOwnerVerification({slug})).toBe(true);
  expect(requiresWorkspaceOwnerVerification({slug:'renamed-workspace',nativeTenantId})).toBe(true);
  expect(()=>requireVerifiedWorkspaceOwner({nativeTenantId})).toThrow('Owner verification is required');
  const request=vi.fn();await expect(createWorkspaceDiscovery({},request)(slug)).rejects.toMatchObject({status:409,code:'workspace_owner_verification_required'});expect(request).not.toHaveBeenCalled();
 });
 it('does not classify unknown or confirmed workspaces as verified or held',()=>{
  for(const slug of ['acme','runtime-acceptance','random-host'])expect(requiresWorkspaceOwnerVerification({slug})).toBe(false);
 });
 it.each(['GET','POST'])('mounted %s discovery reports verification required, never a redirect or login fields',async method=>{
  const req=new NextRequest('https://support.servicev8.com/api/workspace/lookup'+(method==='GET'?'?workspace=lexiflowers':''),{method,headers:{host:'support.servicev8.com','content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({workspace:'lexiflowers'})}:{})});
  const response=await (method==='GET'?GET(req):POST(req));expect(response.status).toBe(409);expect(response.headers.get('location')).toBeNull();expect(response.headers.get('cache-control')).toBe('no-store');expect(await response.json()).toMatchObject({success:false,error:'workspace_owner_verification_required'});
 });
 it('tenant login and server page gate keep credentials hidden with an actionable verification state',async()=>{
  const host='booksdemo.support.servicev8.com';expect(await resolvePageWorkspace(new Headers({host}))).toBe('verification_required');
  const response=await login(new NextRequest(`https://${host}/login`,{headers:{host}}));expect(response.status).toBe(409);expect(await response.text()).toContain('Workspace owner verification required');
  const page=verificationPage();expect(page.status).toBe(409);const html=await page.text();expect(html).not.toMatch(/<input|type="password"/);expect(html).toContain('data is preserved');
 });
});


it('rejects product-qualified Runtime provisioning aliases before any database operation',async()=>{
 const client=new PostgresClient(''),database=vi.spyOn(client,'withWorkspaceProvisioningSession');
 const store=new RuntimeSupportWorkspaceStore(client);
 for(const tenantDomain of ['booksdemo','booksdemo.support','booksdemo.support.servicev8.com'])await expect(store.acquire({accountId:'account',registryTenantId:'canonical',installationId:'installation',operationId:'operation',tenantDomain,subject:'subject',verticalId:'runtime'})).rejects.toMatchObject({status:409});
 expect(database).not.toHaveBeenCalled();
});
it('does not issue a Runtime cookie or accept an earlier validly signed session for a held workspace',()=>{
 const secret='synthetic-only-'.repeat(4),now=1000,input={accountId:'account',tenantId:'canonical',verticalId:'runtime' as const,installationId:'installation',workspaceId:'tenant_rt_'+'a'.repeat(48),sub:'subject',tenantDomain:'booksdemo',roleCap:'support:read' as const};
 expect(signRuntimeSupportSession(input,secret,now)).toBeNull();
 const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const body=Buffer.from(JSON.stringify({version:'servicev8.support-session.v1',aud:'supportv8-runtime-session',...input,iat:now,exp:now+60})).toString('base64url');
 const token=header+'.'+body+'.'+createHmac('sha256',secret).update(header+'.'+body).digest('base64url');
 expect(verifyRuntimeSupportSession(token,secret,'booksdemo.support.servicev8.com',now)).toBeNull();
});

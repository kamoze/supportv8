import { beforeEach, expect, it, vi } from 'vitest';
const auth=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/service-app/runtime-session',()=>({authorizeRuntimeSupportRequest:auth,readRuntimeSupportCookie:(r:Request)=>r.headers.get('cookie')?.includes('__Host-sv8_runtime_support=')?'present':null}));
import {resolveRequestTenant} from '@/lib/auth/request-tenant';
const request=(method='GET',host='acme.support.servicev8.com')=>new Request(`https://${host}/api/issues`,{method,headers:{host,cookie:'__Host-sv8_runtime_support=test'}});
beforeEach(()=>{auth.mockResolvedValue({access:{email:'person@example.test'},session:{workspaceId:'tenant_rt_'+'a'.repeat(48),tenantDomain:'acme',sub:'user1'},role:'support:manage'});});
it('maps verified handoff to native workspace ID and tenant leadership without global admin',async()=>{
 const c=await resolveRequestTenant(request(),{requireAuthentication:true});
 expect(c).toMatchObject({tenantId:'tenant_rt_'+'a'.repeat(48),tenantSlug:'acme',authenticated:true,userId:'user1',roles:['support_cx_lead']});
});
it('does not derive native workspace ID from slug',async()=>{
 const c=await resolveRequestTenant(request());expect(c.tenantId).not.toBe('tenant_acme');
});
it('fails closed on invalid or revoked handoff even in development',async()=>{auth.mockResolvedValue(null);await expect(resolveRequestTenant(request())).rejects.toThrow();});
it('read-only handoff cannot mutate native APIs',async()=>{auth.mockResolvedValue({access:{email:'person@example.test'},session:{workspaceId:'tenant_rt_'+'a'.repeat(48),tenantDomain:'acme',sub:'user1'},role:'support:read'});await expect(resolveRequestTenant(request('POST'))).rejects.toThrow();expect((await resolveRequestTenant(request())).roles).toEqual(['support_operator','support_observer']);});

it('rejects a host-derived tenant inconsistent with the verified session',async()=>{await expect(resolveRequestTenant(request('GET','other.support.servicev8.com'))).rejects.toThrow('Workspace host mismatch');});

it('allows customer chat intake for runtime sessions including read-only role while restricting operator replies',async()=>{
  const chatIntakeRequest = new Request('https://acme.support.servicev8.com/api/chat/session', {
    method: 'POST',
    headers: { host: 'acme.support.servicev8.com', cookie: '__Host-sv8_runtime_support=test' },
  });
  const customerMessageRequest = new Request('https://acme.support.servicev8.com/api/chat/message', {
    method: 'POST',
    headers: { host: 'acme.support.servicev8.com', cookie: '__Host-sv8_runtime_support=test' },
  });
  const operatorReplyRequest = new Request('https://acme.support.servicev8.com/api/chat/message', {
    method: 'POST',
    headers: { host: 'acme.support.servicev8.com', cookie: '__Host-sv8_runtime_support=test' },
  });

  // support:manage can perform customer intake and operator replies
  auth.mockResolvedValue({
    access: { email: 'admin@example.test' },
    session: { workspaceId: 'tenant_rt_' + 'a'.repeat(48), tenantDomain: 'acme', sub: 'user1' },
    role: 'support:manage',
  });
  await expect(resolveRequestTenant(chatIntakeRequest)).resolves.toMatchObject({ tenantId: 'tenant_rt_' + 'a'.repeat(48) });
  await expect(resolveRequestTenant(customerMessageRequest, { requireAuthentication: false })).resolves.toMatchObject({ tenantId: 'tenant_rt_' + 'a'.repeat(48) });
  await expect(resolveRequestTenant(operatorReplyRequest, { requireAuthentication: true })).resolves.toMatchObject({ tenantId: 'tenant_rt_' + 'a'.repeat(48), roles: ['support_cx_lead'] });

  // support:read can perform customer intake, but not operator replies
  auth.mockResolvedValue({
    access: { email: 'viewer@example.test' },
    session: { workspaceId: 'tenant_rt_' + 'a'.repeat(48), tenantDomain: 'acme', sub: 'user2' },
    role: 'support:read',
  });
  await expect(resolveRequestTenant(chatIntakeRequest)).resolves.toMatchObject({ tenantId: 'tenant_rt_' + 'a'.repeat(48) });
  await expect(resolveRequestTenant(customerMessageRequest, { requireAuthentication: false })).resolves.toMatchObject({ tenantId: 'tenant_rt_' + 'a'.repeat(48) });
  await expect(resolveRequestTenant(operatorReplyRequest, { requireAuthentication: true })).rejects.toThrow('This workspace role is read only');
});


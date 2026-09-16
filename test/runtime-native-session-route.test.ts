import {expect,it,vi} from 'vitest';
const authorize=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/service-app/runtime-session',()=>({authorizeRuntimeSupportRequest:authorize}));
import {GET} from '@/app/api/auth/workspace-session/route';
const req=()=>new Request('https://acme.support.servicev8.com/api/auth/workspace-session',{headers:{host:'acme.support.servicev8.com',cookie:'__Host-sv8_runtime_support=secret-not-for-browser'}});
it('returns only a display session, expires with the source session and never returns credentials',async()=>{
 authorize.mockResolvedValue({session:{iat:100,exp:200,tenantDomain:'acme'},access:{email:'owner@example.test'},role:'support:manage'});
 const res=await GET(req());expect(res.headers.get('cache-control')).toBe('no-store');
 const body=await res.json();expect(body.session).toMatchObject({role:'cx_lead',email:'owner@example.test',expiresAt:200000});expect(JSON.stringify(body)).not.toContain('secret-not-for-browser');
});
it('denies revoked membership and unavailable authority without cached positive access',async()=>{
 authorize.mockResolvedValue(null);expect((await GET(req())).status).toBe(401);
 authorize.mockRejectedValue(Error('unavailable'));expect((await GET(req())).status).toBe(503);
});

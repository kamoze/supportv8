import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({handle:vi.fn(),authenticate:vi.fn(),acquire:vi.fn()}));
vi.mock('@/lib/service-app/provision-auth',()=>({supportProvisionAuthenticatorFromEnv:()=>mocks.authenticate}));
vi.mock('@/lib/service-app/provision-route',()=>({handleSupportProvisionRequest:mocks.handle}));
vi.mock('@/lib/service-app/workspace-reservation',()=>({runtimeSupportWorkspaceStore:{acquire:mocks.acquire}}));
import {DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT,dynamic,runtime} from '@/app/internal/service-app/v1/provision/route';

describe('Next Support provision wiring',()=>{
  beforeEach(()=>mocks.handle.mockReset().mockResolvedValue(new Response(null,{status:204})));
  it('uses the authenticated owner boundary and native store',async()=>{
    const request=new Request('https://support.test/internal/service-app/v1/provision',{method:'POST'});await POST(request);
    const [,deps]=mocks.handle.mock.calls[0];expect(mocks.handle).toHaveBeenCalledWith(request,expect.objectContaining({authenticate:mocks.authenticate}));
    const input={accountId:'account-1'};await deps.acquire(input);expect(mocks.acquire).toHaveBeenCalledWith(input);expect(runtime).toBe('nodejs');expect(dynamic).toBe('force-dynamic');
  });
  it.each([
    ['GET',GET],['HEAD',HEAD],['OPTIONS',OPTIONS],['PUT',PUT],['PATCH',PATCH],['DELETE',DELETE],
  ])('explicitly delegates %s through the common 405 rejection handler',async(method,handler)=>{
    mocks.handle.mockResolvedValueOnce(new Response(null,{status:405,headers:{allow:'POST','cache-control':'no-store'}}));
    const request=new Request('https://support.test/internal/service-app/v1/provision',{method});const response=await handler(request);
    expect(mocks.handle).toHaveBeenCalledWith(request,expect.objectContaining({authenticate:undefined}));
    expect(response.status).toBe(405);expect(response.headers.get('allow')).toBe('POST');expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({handle:vi.fn(),authenticate:vi.fn(),acquire:vi.fn()}));
vi.mock('@/lib/service-app/provision-auth',()=>({supportProvisionAuthenticatorFromEnv:()=>mocks.authenticate}));
vi.mock('@/lib/service-app/provision-route',()=>({handleSupportProvisionRequest:mocks.handle}));
vi.mock('@/lib/service-app/workspace-reservation',()=>({runtimeSupportWorkspaceStore:{acquire:mocks.acquire}}));
import {GET,POST,dynamic,runtime} from '@/app/internal/service-app/v1/provision/route';

describe('Next Support provision wiring',()=>{
  beforeEach(()=>mocks.handle.mockReset().mockResolvedValue(new Response(null,{status:204})));
  it('uses the authenticated owner boundary and native store',async()=>{
    const request=new Request('https://support.test/internal/service-app/v1/provision',{method:'POST'});await POST(request);
    const [,deps]=mocks.handle.mock.calls[0];expect(mocks.handle).toHaveBeenCalledWith(request,expect.objectContaining({authenticate:mocks.authenticate}));
    const input={accountId:'account-1'};await deps.acquire(input);expect(mocks.acquire).toHaveBeenCalledWith(input);expect(runtime).toBe('nodejs');expect(dynamic).toBe('force-dynamic');
  });
  it('explicitly delegates GET for a no-store 405',async()=>{const request=new Request('https://support.test/internal/service-app/v1/provision');await GET(request);expect(mocks.handle).toHaveBeenCalledWith(request,expect.any(Object));});
});

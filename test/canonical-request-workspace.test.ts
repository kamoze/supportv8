import {afterEach,describe,it,expect,vi} from 'vitest';
const f=vi.hoisted(()=>({discover:vi.fn(),current:vi.fn()}));
vi.mock('../src/lib/auth/workspace-discovery',()=>({discoverWorkspace:f.discover}));
vi.mock('../src/lib/auth/native-login-authority',()=>({nativeLoginAuthority:{current:f.current}}));
import {authorizeCanonicalRequestWorkspace} from '../src/lib/auth/canonical-request-workspace';
afterEach(()=>vi.resetAllMocks());
const deniedHosts:Array<Record<string,string>>=[{host:'support.servicev8.com'},{host:'bad.example'},{host:'acme.support.servicev8.com','x-forwarded-host':'foreign.support.servicev8.com'},{host:'acme.support.servicev8.com',forwarded:'host=foreign.support.servicev8.com'}];
const claims={sub:'shared-subject',tenant_id:'canonical-id',account_id:'account'};
describe('canonical request workspace uses the verified public host',()=>{
 it('passes signed claims and exact host registration to the fresh authority, ignoring tenant query/header hints',async()=>{
  const registered={id:'canonical-id',slug:'acme'};f.discover.mockResolvedValue(registered);f.current.mockResolvedValue({...registered,nativeTenantId:'tenant_acme'});
  const request=new Request('https://acme.support.servicev8.com/api/issues?tenant=foreign',{headers:{host:'acme.support.servicev8.com','x-servicev8-tenant-domain':'foreign'}});
  expect(await authorizeCanonicalRequestWorkspace(claims,request)).toMatchObject({nativeTenantId:'tenant_acme'});
  expect(f.discover).toHaveBeenCalledWith('acme');expect(f.current).toHaveBeenCalledWith(registered,claims,request);
 });
 it.each(deniedHosts)('denies absent/foreign/conflicting tenant host before discovery: %j',async headers=>{
  await expect(authorizeCanonicalRequestWorkspace(claims,new Request('https://acme.support.servicev8.com/api/issues',{headers}))).rejects.toMatchObject({status:403});expect(f.discover).not.toHaveBeenCalled();expect(f.current).not.toHaveBeenCalled();
 });
 it('propagates current membership/mapping denial instead of using a previous native ID',async()=>{
  f.discover.mockResolvedValue({id:'canonical-id',slug:'acme'});f.current.mockRejectedValue(new Error('revoked'));
  await expect(authorizeCanonicalRequestWorkspace(claims,new Request('https://acme.support.servicev8.com/api/issues',{headers:{host:'acme.support.servicev8.com'}}))).rejects.toThrow('revoked');
 });
});

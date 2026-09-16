import {generateKeyPair,SignJWT} from 'jose';
import {describe,expect,it,vi} from 'vitest';
import {createSupportProvisionAuthenticator,SupportProvisionScopeError,supportProvisionAuthenticatorFromEnv} from '@/lib/service-app/provision-auth';
import {handleSupportProvisionRequest} from '@/lib/service-app/provision-route';
import {WorkspaceReservationConflictError} from '@/lib/service-app/workspace-reservation';

const body={installationId:'install-1',operationId:'operation-1',accountId:'account-1',tenantId:'registry-tenant-1',tenantDomain:'acme-support',verticalId:'runtime',subject:'service-app-installation',companyDisplayName:'Acme'};
const request=(value:unknown=body,headers?:HeadersInit)=>new Request('https://support.test/internal/service-app/v1/provision',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(value)});

describe('Support provision authentication',()=>{
  it('accepts only a short-lived dedicated RS256 workload token',async()=>{
    const {privateKey,publicKey}=await generateKeyPair('RS256');
    const now=Math.floor(Date.now()/1000);
    const token=await new SignJWT({azp:'registry-provision',scope:'supportv8:service-app:provision',account_id:'account-1',tenant_id:'registry-tenant-1'}).setProtectedHeader({alg:'RS256'}).setSubject('registry-workload').setIssuer('https://issuer.test').setAudience('supportv8').setIssuedAt(now).setExpirationTime(now+120).sign(privateKey);
    const authenticate=createSupportProvisionAuthenticator({issuer:'https://issuer.test',allowedClientIds:['registry-provision'],key:publicKey});
    await expect(authenticate(request(body,{authorization:`Bearer ${token}`}))).resolves.toEqual({clientId:'registry-provision',accountId:'account-1',tenantId:'registry-tenant-1'});
  });
  it.each([
    ['wrong issuer',{issuer:'https://wrong.test'}],['wrong audience',{audience:'other'}],['unknown client',{azp:'other'}],['expired',{expirationTime:-10}],['too long lived',{expirationTime:301}],['malformed account claim',{account_id:4}],
  ])('rejects %s',async(_label,change)=>{
    const {privateKey,publicKey}=await generateKeyPair('RS256'); const now=Math.floor(Date.now()/1000);
    const claims={azp:'registry-provision',scope:'supportv8:service-app:provision',account_id:'account-1',...change};
    let jwt=new SignJWT(claims).setProtectedHeader({alg:'RS256'}).setSubject('registry').setIssuer((change as {issuer?:string}).issuer??'https://issuer.test').setAudience((change as {audience?:string}).audience??'supportv8').setIssuedAt(now);
    jwt=jwt.setExpirationTime(now+((change as {expirationTime?:number}).expirationTime??120));
    const token=await jwt.sign(privateKey);
    const auth=createSupportProvisionAuthenticator({issuer:'https://issuer.test',allowedClientIds:['registry-provision'],key:publicKey});
    await expect(auth(request(body,{authorization:`Bearer ${token}`}))).resolves.toBeNull();
  });
  it('limits the authorization header',async()=>{
    const {publicKey}=await generateKeyPair('RS256');
    const auth=createSupportProvisionAuthenticator({issuer:'https://issuer.test',allowedClientIds:['registry-provision'],key:publicKey});
    await expect(auth(request(body,{authorization:`Bearer ${'x'.repeat(16400)}`}))).resolves.toBeNull();
  });
  it('distinguishes a valid credential with the wrong scope',async()=>{
    const {privateKey,publicKey}=await generateKeyPair('RS256');const now=Math.floor(Date.now()/1000);
    const token=await new SignJWT({azp:'registry-provision',scope:'supportv8:runtime:order-triage'}).setProtectedHeader({alg:'RS256'}).setSubject('registry').setIssuer('https://issuer.test').setAudience('supportv8').setIssuedAt(now).setExpirationTime(now+120).sign(privateKey);
    const auth=createSupportProvisionAuthenticator({issuer:'https://issuer.test',allowedClientIds:['registry-provision'],key:publicKey});
    await expect(auth(request(body,{authorization:`Bearer ${token}`}))).rejects.toBeInstanceOf(SupportProvisionScopeError);
  });
  it('fails closed on missing or malformed dedicated configuration',()=>{
    expect(supportProvisionAuthenticatorFromEnv({})).toBeUndefined();
    expect(supportProvisionAuthenticatorFromEnv({SUPPORTV8_PROVISION_WORKLOAD_ISSUER:'https://issuer.test',SUPPORTV8_PROVISION_WORKLOAD_CLIENT_IDS:'registry',SUPPORTV8_PROVISION_WORKLOAD_JWKS_URL:'not a url'})).toBeUndefined();
  });
});

describe('Support provision request',()=>{
  const deps=()=>({authenticate:vi.fn(async()=>({clientId:'registry',accountId:'account-1',tenantId:'registry-tenant-1'})),acquire:vi.fn(async()=>({status:'workspace_created' as const,workspaceId:'tenant_rt_0123456789abcdef0123456789abcdef0123456789abcdef',domain:'acme-support'}))});
  it('maps exact owner scope and returns truthful partial readiness',async()=>{
    const d=deps(); const response=await handleSupportProvisionRequest(request(),d);
    expect(d.acquire).toHaveBeenCalledOnce(); expect(d.acquire).toHaveBeenCalledWith({accountId:'account-1',registryTenantId:'registry-tenant-1',installationId:'install-1',operationId:'operation-1',tenantDomain:'acme-support',verticalId:'runtime',subject:'service-app-installation',companyDisplayName:'Acme'});
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({schemaVersion:'servicev8.support-workspace.v1',status:'workspace_created',readiness:'configuration_required',workspaceId:'tenant_rt_0123456789abcdef0123456789abcdef0123456789abcdef',tenantDomain:'acme-support'});
  });
  it('authenticates before reading the body',async()=>{
    let read=false; const unread={method:'POST',url:'https://support.test/internal/service-app/v1/provision',headers:new Headers(),get body(){read=true;throw new Error('must not read');}} as unknown as Request;
    const response=await handleSupportProvisionRequest(unread,{authenticate:async()=>null,acquire:vi.fn()});
    expect(response.status).toBe(401);expect(read).toBe(false);
  });
  it.each([
    ['query parameters',new Request('https://support.test/internal/service-app/v1/provision?x=1',{method:'POST',body:JSON.stringify(body)})],
    ['unknown field',request({...body,plan:'paid'})],['missing field',request(Object.fromEntries(Object.entries(body).filter(([key])=>key!=='subject')))],
    ['wrong vertical',request({...body,verticalId:'support'})],['bad slug',request({...body,tenantDomain:'Acme.example'})],
  ])('rejects %s',async(_label,req)=>expect((await handleSupportProvisionRequest(req,deps())).status).toBe(400));
  it('denies a body that mismatches authenticated claims',async()=>expect((await handleSupportProvisionRequest(request({...body,accountId:'account-2'}),deps())).status).toBe(403));
  it('rejects duplicate semantic fields',async()=>{
    const raw=JSON.stringify(body).replace('"operationId":"operation-1"','"operationId":"operation-1","operationId":"operation-2"');
    expect((await handleSupportProvisionRequest(new Request('https://support.test/internal/service-app/v1/provision',{method:'POST',body:raw}),deps())).status).toBe(400);
  });
  it('bounds streamed bodies',async()=>{
    const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(9000));controller.close();}});
    expect((await handleSupportProvisionRequest(new Request('https://support.test/internal/service-app/v1/provision',{method:'POST',body:stream,duplex:'half'} as RequestInit),deps())).status).toBe(413);
  });
  it('maps conflicts, invalid persisted results, and failures safely',async()=>{
    const conflict=deps();conflict.acquire.mockRejectedValue(new WorkspaceReservationConflictError());expect((await handleSupportProvisionRequest(request(),conflict)).status).toBe(409);
    const invalid=deps();invalid.acquire.mockResolvedValue({status:'workspace_created',workspaceId:'other',domain:'acme-support'});expect((await handleSupportProvisionRequest(request(),invalid)).status).toBe(503);
    const failed=deps();failed.acquire.mockRejectedValue(new Error('private database detail'));const response=await handleSupportProvisionRequest(request(),failed);expect(response.status).toBe(503);expect(await response.text()).not.toContain('private');
  });
  it('sanitizes authenticator failures and maps scope denial',async()=>{
    const unavailable=await handleSupportProvisionRequest(request(),{authenticate:async()=>{throw new Error('key provider detail');},acquire:vi.fn()});expect(unavailable.status).toBe(503);expect(await unavailable.text()).not.toContain('provider');
    const denied=await handleSupportProvisionRequest(request(),{authenticate:async()=>{throw new SupportProvisionScopeError();},acquire:vi.fn()});expect(denied.status).toBe(403);
  });
  it('returns 405 with Allow and no-store',async()=>{const d=deps();const response=await handleSupportProvisionRequest(new Request('https://support.test/internal/service-app/v1/provision'),d);expect(response.status).toBe(405);expect(response.headers.get('allow')).toBe('POST');expect(response.headers.get('cache-control')).toBe('no-store');expect(d.authenticate).not.toHaveBeenCalled();});
});

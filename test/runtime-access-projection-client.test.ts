import { expect,it,vi } from 'vitest';
import { RegistrySupportAccessClient } from '@/lib/service-app/runtime-access-projection-client';
const scope={accountId:'acct-1',tenantId:'registry-1',installationId:'install-1',workspaceId:'tenant_fixture',verticalId:'runtime' as const,subject:'user-2'};
const env={SERVICEV8_OIDC_ISSUER:'https://identity.test/realms/servicev8',REGISTRY_URL:'https://registry.test/',SUPPORTV8_ACCESS_REGISTRY_CLIENT_ID:'support-access',SUPPORTV8_ACCESS_REGISTRY_CLIENT_SECRET:'synthetic-client-secret'};
it('uses exact product-bound scope, no cache, no redirects and bounded reads',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const request=vi.fn(async(url:unknown,init:RequestInit={})=>{calls.push({url:String(url),init});return String(url).includes('/token')?Response.json({access_token:'synthetic-token'}):Response.json({membership:null});});
 expect(await new RegistrySupportAccessClient(env,request).current(scope,'user-2')).toBeNull();
 expect(String(calls[0]!.init.body)).toContain('scope=registry%3Aworkspace-access%3Aread');
 expect(String(calls[0]!.init.body)).toContain('audience=servicev8-registry');
 expect(JSON.parse(String(calls[1]!.init.body))).toEqual({subject:'user-2',accountId:'acct-1',installationId:'install-1'});
 expect(calls[1]!.url).toBe('https://registry.test/v1/workspace-access/registry-1/read');
 expect(calls.every(c=>c.init.cache==='no-store'&&c.init.redirect==='error'&&c.init.signal)).toBe(true);
});
it('never falls back to Runtime shared secrets or ordinary read credentials',async()=>{
 const request=vi.fn();
 await expect(new RegistrySupportAccessClient({...env,SUPPORTV8_ACCESS_REGISTRY_CLIENT_SECRET:undefined,SUPPORTV8_SERVICE_APP_RUNTIME_SECRET:'shared',SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET:'ordinary'},request).current(scope,'user-2')).rejects.toThrow('authority_unavailable');
 expect(request).not.toHaveBeenCalled();
});
it('does not treat failed, oversized or malformed authority responses as a membership',async()=>{
 for(const response of [()=>new Response('unavailable',{status:503}),()=>Response.json({membership:'invalid'}),()=>Response.json({membership:{huge:'x'.repeat(256001)}})]){
  const request=vi.fn(async(url:unknown)=>String(url).includes('/token')?Response.json({access_token:'synthetic-token'}):response());
  await expect(new RegistrySupportAccessClient(env,request).current(scope,'user-2')).rejects.toThrow();
 }
});

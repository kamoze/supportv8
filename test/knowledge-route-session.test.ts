import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth/keycloak', async original => ({
  ...await original<typeof import('@/lib/auth/keycloak')>(), verifySupportAccessToken: vi.fn(),
}));
vi.mock('@/lib/service-app/runtime-session', async original => ({
  ...await original<typeof import('@/lib/service-app/runtime-session')>(), authorizeRuntimeSupportRequest: vi.fn(),
}));
vi.mock('@/lib/services/rag-ingestion-service', () => ({ragIngestion:{
  getDurableDocuments:vi.fn(), getDurableArticles:vi.fn(), ingestTicketToRag:vi.fn(),
}}));
import { verifySupportAccessToken } from '@/lib/auth/keycloak';
import { authorizeRuntimeSupportRequest } from '@/lib/service-app/runtime-session';
import { ragIngestion } from '@/lib/services/rag-ingestion-service';
import { GET, POST } from '@/app/api/knowledge/route';
const request=(method='GET',credential?:string)=>new NextRequest('https://owned.support.servicev8.com/api/knowledge?tenant=foreign',{
  method,headers:{host:'owned.support.servicev8.com','content-type':'application/json','x-tenant-slug':'foreign',
    ...(credential?{authorization:'Bearer '+credential}:{})},
  ...(method==='POST'?{body:JSON.stringify({action:'ingest_ticket',ticket:{externalId:'ticket-1',summary:'Resolution'}})}:{}),
});
beforeEach(()=>{
  vi.resetAllMocks();vi.stubEnv('NODE_ENV','production');
  vi.mocked(ragIngestion.getDurableDocuments).mockResolvedValue([]);
  vi.mocked(ragIngestion.getDurableArticles).mockResolvedValue([]);
  vi.mocked(ragIngestion.ingestTicketToRag).mockResolvedValue({document:{id:'doc'},chunks:[]} as any);
});
afterEach(()=>vi.unstubAllEnvs());
const noAccess=()=>{for(const fn of Object.values(ragIngestion))expect(fn).not.toHaveBeenCalled();};
describe('Knowledge route with production request-tenant resolver',()=>{
  it('denies absent and invalid tokens without reading or writing tenant records',async()=>{
    expect((await GET(request())).status).toBe(401);
    expect((await POST(request('POST'))).status).toBe(401);
    vi.mocked(verifySupportAccessToken).mockRejectedValue(new Error('expired'));
    expect((await GET(request('GET','expired'))).status).toBe(401);
    expect((await POST(request('POST','expired'))).status).toBe(401);
    noAccess();
  });
  it('denies a foreign verified token and a revoked Runtime session before RAG access',async()=>{
    vi.mocked(verifySupportAccessToken).mockResolvedValue({sub:'actor',tenant_id:'tenant_foreign',realm_access:{roles:['support_operator']}});
    expect((await POST(request('POST','foreign'))).status).toBe(403);
    vi.mocked(authorizeRuntimeSupportRequest).mockResolvedValue(null);
    const revoked=request('POST');revoked.headers.set('cookie','__Host-sv8_runtime_support=revoked');
    expect((await POST(revoked)).status).toBe(401);
    noAccess();
  });
  it('permits only verified same-tenant read/manage roles despite conflicting URL selectors',async()=>{
    vi.mocked(verifySupportAccessToken).mockResolvedValue({sub:'actor',tenant_id:'tenant_owned',realm_access:{roles:['support_observer']}});
    expect((await GET(request('GET','valid'))).status).toBe(200);
    expect(ragIngestion.getDurableDocuments).toHaveBeenCalledWith('tenant_owned');
    expect((await POST(request('POST','valid'))).status).toBe(403);
    expect(ragIngestion.ingestTicketToRag).not.toHaveBeenCalled();
    vi.mocked(verifySupportAccessToken).mockResolvedValue({sub:'actor',tenant_id:'tenant_owned',realm_access:{roles:['support_operator']}});
    expect((await POST(request('POST','valid'))).status).toBe(200);
    expect(ragIngestion.ingestTicketToRag).toHaveBeenCalledWith({tenantId:'tenant_owned',ticket:{externalId:'ticket-1',summary:'Resolution'}});
  });
});

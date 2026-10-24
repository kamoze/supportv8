import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth/request-tenant', async original => ({
  ...await original<typeof import('@/lib/auth/request-tenant')>(), resolveRequestTenant: vi.fn(),
}));
vi.mock('@/lib/services/rag-ingestion-service', () => ({ ragIngestion: {
  getDurableDocuments: vi.fn(), getDurableArticles: vi.fn(), ingestTicketToRag: vi.fn(),
} }));
vi.mock('@/lib/services/knowledge-service', () => ({ knowledgeService: {
  getArticles: vi.fn(), getGaps: vi.fn(), getProposals: vi.fn(), publishProposal: vi.fn(),
} }));
import { resolveRequestTenant, RequestAuthError } from '@/lib/auth/request-tenant';
import { ragIngestion } from '@/lib/services/rag-ingestion-service';
import { knowledgeService } from '@/lib/services/knowledge-service';
import { GET, POST } from '@/app/api/knowledge/route';
const canonical = { tenantId:'tenant_verified_workspace', tenantSlug:'verified-workspace', authenticated:true,
  userId:'verified-actor', roles:['support_operator'], runtimeLinked:true };
const ticket = { externalId:'ticket-1', summary:'Verified resolution' };
const request = (method:string, action='ingest_ticket') => new NextRequest('https://verified-workspace.support.servicev8.com/api/knowledge?tenant=foreign', {
  method, headers:{'content-type':'application/json','x-tenant-slug':'foreign'},
  ...(method==='POST'?{body:JSON.stringify({action,ticket,proposalId:'foreign-proposal'})}:{}),
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(resolveRequestTenant).mockResolvedValue(canonical);
  vi.mocked(ragIngestion.getDurableDocuments).mockResolvedValue([]);
  vi.mocked(ragIngestion.getDurableArticles).mockResolvedValue([]);
  vi.mocked(ragIngestion.ingestTicketToRag).mockResolvedValue({document:{id:'verified-document'},chunks:[]} as any);
});
function noOwnerAccess() {
  for (const method of Object.values(ragIngestion)) expect(method).not.toHaveBeenCalled();
  for (const method of Object.values(knowledgeService)) expect(method).not.toHaveBeenCalled();
}
describe('Knowledge route authority', () => {
  it.each([401,403] as const)('rejects auth status %s before reads or writes, without tenant fallback', async status => {
    vi.mocked(resolveRequestTenant).mockRejectedValue(new RequestAuthError('denied',status));
    expect((await GET(request('GET'))).status).toBe(status);
    expect((await POST(request('POST'))).status).toBe(status);
    noOwnerAccess();
  });
  it('keeps authority outages closed before owner access', async () => {
    vi.mocked(resolveRequestTenant).mockRejectedValue(new Error('registry unavailable'));
    expect((await GET(request('GET'))).status).toBe(500);
    expect((await POST(request('POST'))).status).toBeGreaterThanOrEqual(400);
    noOwnerAccess();
  });
  it('requires a read role and a manage role for ingestion', async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({...canonical,roles:[]});
    expect((await GET(request('GET'))).status).toBe(403);
    vi.mocked(resolveRequestTenant).mockResolvedValue({...canonical,roles:['support_observer']});
    expect((await POST(request('POST'))).status).toBe(403);
    noOwnerAccess();
  });
  it('reads only canonical tenant records and never exposes global demo proposals', async () => {
    vi.mocked(resolveRequestTenant).mockResolvedValue({...canonical,roles:['support_observer']});
    const response=await GET(request('GET'));
    expect(response.status).toBe(200);
    expect(resolveRequestTenant).toHaveBeenCalledWith(expect.anything(),{requireAuthentication:true});
    expect(ragIngestion.getDurableDocuments).toHaveBeenCalledWith(canonical.tenantId);
    expect(ragIngestion.getDurableArticles).toHaveBeenCalledWith(canonical.tenantId);
    expect((await response.json()).data).toEqual({articles:[],documents:[],gaps:[],proposals:[],webSources:[]});
    for (const method of Object.values(knowledgeService)) expect(method).not.toHaveBeenCalled();
  });
  it('ingests an authorized ticket only in the canonical tenant', async () => {
    const response=await POST(request('POST'));
    expect(response.status).toBe(200);
    expect(resolveRequestTenant).toHaveBeenCalledWith(expect.anything(),{requireAuthentication:true});
    expect(ragIngestion.ingestTicketToRag).toHaveBeenCalledTimes(1);
    expect(ragIngestion.ingestTicketToRag).toHaveBeenCalledWith({tenantId:canonical.tenantId,ticket});
  });
  it('refuses legacy global proposal publication without inventing scoped authority', async () => {
    const response=await POST(request('POST','publish'));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({success:false,error:'knowledge_publication_unavailable'});
    noOwnerAccess();
  });
});

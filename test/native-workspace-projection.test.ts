import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/auth/request-tenant',async original=>({...await original<typeof import('@/lib/auth/request-tenant')>(),resolveRequestTenant:vi.fn()}));
vi.mock('@/lib/db/chat-repository',()=>({chatRepository:{listWorkspaceIssuesByIds:vi.fn(),startSession:vi.fn(),listChatIssues:vi.fn()}}));
import {resolveRequestTenant,RequestAuthError} from '@/lib/auth/request-tenant';
import {chatRepository} from '@/lib/db/chat-repository';
import {GET,POST} from '@/app/api/issues/route';
const request=(ids:string[],extra='')=>new NextRequest('https://alpha.support.servicev8.com/api/issues?'+new URLSearchParams([...ids.map(id=>['workspaceIssueId',id]),['tenantId','foreign']])+extra);
beforeEach(()=>{vi.stubEnv('DATABASE_URL','postgresql://test');vi.mocked(resolveRequestTenant).mockResolvedValue({tenantId:'canonical-workspace',tenantSlug:'alpha',authenticated:true,runtimeLinked:true,roles:['support_operator']} as never);vi.mocked(chatRepository.listWorkspaceIssuesByIds).mockResolvedValue([]);});
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();});
it('projects at most31 exact native IDs only in the freshly authorized canonical workspace',async()=>{
 const ids=Array.from({length:31},(_,i)=>'issue-'+i);
 expect((await GET(request(ids))).status).toBe(200);
 expect(chatRepository.listWorkspaceIssuesByIds).toHaveBeenCalledWith('canonical-workspace',ids);
 expect(resolveRequestTenant).toHaveBeenCalledWith(expect.anything(),{requireAuthentication:true});
});
it.each([[''],['../foreign'],Array.from({length:32},(_,i)=>'id'+i),['x'.repeat(193)],['duplicate','duplicate']].map(ids=>[ids]))('rejects invalid or oversized exact projection%j',async ids=>{
 expect((await GET(request(ids))).status).toBe(400);expect(chatRepository.listWorkspaceIssuesByIds).not.toHaveBeenCalled();
});
it('does not open a new projection to non-Runtime or revoked sessions',async()=>{
 vi.mocked(resolveRequestTenant).mockResolvedValue({tenantId:'x',authenticated:true,roles:['support_operator']} as never);
 expect((await GET(request(['id']))).status).toBe(403);
 vi.mocked(resolveRequestTenant).mockRejectedValue(new RequestAuthError('Revoked',403));
 expect((await GET(request(['id']))).status).toBe(403);expect(chatRepository.listWorkspaceIssuesByIds).not.toHaveBeenCalled();
});

it('preserves rich manual creation through the existing authenticated canonical owner',async()=>{
 vi.mocked(resolveRequestTenant).mockResolvedValue({tenantId:'canonical-workspace',tenantSlug:'alpha',accountId:'account',authenticated:true,runtimeLinked:true,displayName:'Operator',roles:['support_cx_lead']});
 vi.mocked(chatRepository.startSession).mockResolvedValue({id:'created-session'} as never);
 vi.mocked(chatRepository.listChatIssues).mockResolvedValue([{id:'created-ticket',tenantId:'canonical-workspace'}] as never);
 const body={action:'create_manual',tenantId:'foreign',customerName:'Customer',customerEmail:'customer@example.test',summary:'Delivery question',stream:'enquiries',priority:'high',channel:'email',customerId:'customer-ref',customerPhone:'5550100',companyName:'Example',customerTier:'enterprise'};
 const result=await POST(new NextRequest('https://alpha.support.servicev8.com/api/issues',{method:'POST',headers:{origin:'https://alpha.support.servicev8.com','content-type':'application/json'},body:JSON.stringify(body)}));
 expect(result.status).toBe(201);
 expect(chatRepository.startSession).toHaveBeenCalledWith(expect.objectContaining({tenantId:'canonical-workspace',accountId:'account',stream:'enquiries',customerEmail:'customer@example.test',channel:'email',source:'email',manual:{operatorName:'Operator',priority:'high'},intakeData:expect.objectContaining({customerId:'customer-ref',customerPhone:'5550100',companyName:'Example',customerTier:'enterprise'})}));
});
it('fails closed when the native detail store is unavailable',async()=>{
 vi.stubEnv('DATABASE_URL','');expect((await GET(request(['id']))).status).toBe(503);expect(chatRepository.listWorkspaceIssuesByIds).not.toHaveBeenCalled();
});

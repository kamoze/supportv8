import {expect,it,vi} from 'vitest';
import {ChatRepository} from '@/lib/db/chat-repository';
it('native workspace lists all durable sources inside the authenticated tenant session',async()=>{
 const query=vi.fn().mockResolvedValue([]);
 const scoped=vi.fn(async (_tenant:string,run:(db:unknown)=>unknown)=>run({query}));
 const store=new ChatRepository({withTenantSession:scoped} as never);
 await store.listWorkspaceIssues('tenant_rt_test');
 expect(scoped.mock.calls[0][0]).toBe('tenant_rt_test');
 expect(query.mock.calls[0][0]).toContain('LEFT JOIN');
 expect(query.mock.calls[0][1]).toContain(true);
});
it('native updates remain tenant-scoped and ordinary chat updates keep their source restriction',async()=>{
 const query=vi.fn().mockResolvedValue([]);
 const scoped=vi.fn(async (_tenant:string,run:(db:unknown)=>unknown)=>run({query}));
 const store=new ChatRepository({withTenantSession:scoped} as never);
 await store.updateWorkspaceIssue('tenant_rt_test','issue-runtime',{priority:'high'});
 expect(scoped.mock.calls[0][0]).toBe('tenant_rt_test');expect(query.mock.calls[0][1][11]).toBe(true);
 query.mockClear();await store.updateChatIssue('tenant_regular','issue-chat',{priority:'normal'});
 expect(query.mock.calls[0][1][11]).toBe(false);
});

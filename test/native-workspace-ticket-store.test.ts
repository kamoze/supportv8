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

it('bounds native detail hydration before querying and uses exact IDs inside tenant RLS',async()=>{
 const query=vi.fn().mockResolvedValue([]);
 const scoped=vi.fn(async (_tenant:string,run:(db:unknown)=>unknown)=>run({query}));
 const store=new ChatRepository({withTenantSession:scoped} as never);
 await store.listWorkspaceIssuesByIds('canonical-workspace',['outside-first-500','chat-ticket']);
 expect(scoped.mock.calls[0][0]).toBe('canonical-workspace');
 expect(query.mock.calls[0][0]).toContain('i.id = ANY($3::text[])');
 expect(query.mock.calls[0][1]).toEqual([null,true,['outside-first-500','chat-ticket']]);
 query.mockClear();
 for(const ids of [[],['x','x'],['../foreign'],Array.from({length:32},(_,i)=>String(i))])await expect(store.listWorkspaceIssuesByIds('canonical-workspace',ids)).rejects.toThrow();
 expect(query).not.toHaveBeenCalled();
});

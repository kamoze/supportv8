import { expect, it, vi } from 'vitest';
import { loadNativeRuntimeTickets, loadNativeRuntimeWorkdesk, runtimeTicketHref } from '@/lib/service-app/runtime-native-workdesk';
const ticket=(id:string)=>({id,ticketRef:id,customerRef:'customer',customerName:'Customer',summary:'Current request',status:'open',priority:'normal',source:'runtime_manual',createdAt:'2026-10-24T10:00:00Z',updatedAt:'2026-10-24T10:00:00Z'});
it('loads a precise ticket outside the current page without substituting the first ticket',async()=>{
 const request=vi.fn(async(input:RequestInfo|URL)=>Response.json(String(input).includes('/wanted')?ticket('wanted'):{tickets:[ticket('first')],nextCursor:'next'}));
 const result=await loadNativeRuntimeTickets({ticket:'wanted',cursor:'page'},request as typeof fetch);
 expect(result.selected?.id).toBe('wanted');expect(result.page.tickets[0].id).toBe('first');
 expect(request.mock.calls.map(c=>String(c[0]))).toEqual(['/api/runtime/tickets?limit=30&cursor=page','/api/runtime/tickets/wanted']);
});
it('keeps a foreign or missing ticket absent instead of selecting the first row',async()=>{
 const request=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/foreign')?Response.json({error:'not found'},{status:404}):Response.json({tickets:[ticket('first')]}));
 const result=await loadNativeRuntimeTickets({ticket:'foreign'},request as typeof fetch);
 expect(result.selectionRequested).toBe(true);expect(result.selected).toBeNull();
});
it.each([401,403,503])('fails closed on denied or unavailable owner response %s',async status=>{
 const request=vi.fn(async()=>Response.json({tickets:[ticket('must-not-display')]},{status}));
 await expect(loadNativeRuntimeTickets({},request)).rejects.toThrow();
 expect(request).toHaveBeenCalledTimes(1);
});
it('rejects mismatched detail receipts and malformed ticket links',async()=>{
 const request=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/wanted')?Response.json(ticket('another')):Response.json({tickets:[]}));
 await expect(loadNativeRuntimeTickets({ticket:'wanted'},request as typeof fetch)).rejects.toThrow();
 await expect(loadNativeRuntimeTickets({ticket:'../another'},request as typeof fetch)).rejects.toThrow();
});
it('continues paginated reads beyond500 through opaque owner cursors without tenant parameters',async()=>{
 const rows=Array.from({length:510},(_,i)=>ticket('ticket'+i));let cursor:string|undefined;const seen:string[]=[];
 const request=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=new URL(String(input),'https://fixture.invalid');const start=Number(url.searchParams.get('cursor')??0);
  expect(url.pathname).toBe('/api/runtime/tickets');expect(url.searchParams.has('tenant')).toBe(false);
  expect(init).toMatchObject({credentials:'same-origin',redirect:'error',cache:'no-store'});
  return Response.json({tickets:rows.slice(start,start+30),...(start+30<rows.length?{nextCursor:String(start+30)}:{})});
 });
 do{const result=await loadNativeRuntimeTickets({cursor},request as typeof fetch);seen.push(...result.page.tickets.map(t=>t.id));cursor=result.page.nextCursor;}while(cursor);
 expect(seen).toHaveLength(510);expect(new Set(seen).size).toBe(510);expect(request).toHaveBeenCalledTimes(17);
});
it('builds native cockpit links that preserve only exact selection and page',()=>{
 expect(runtimeTicketHref('wanted','opaque_cursor')).toBe('/?view=cockpit&tab=workspace&ticket=wanted&cursor=opaque_cursor');
});

it('composes with actual scoped list/detail handlers and never reads storage after revoked authority',async()=>{
 const { handleRuntimeTicketList,handleRuntimeTicketDetail }=await import('@/lib/service-app/runtime-http');
 const auth={session:{accountId:'a',tenantId:'registry-a',installationId:'install-a',workspaceId:'workspace-a',sub:'subject-a'},role:'support:read'};
 const authorize=vi.fn(async()=>auth as any);
 const list=vi.fn(async(scope:any)=>{expect(scope.workspaceId).toBe('workspace-a');return {tickets:[ticket('own')]};});
 const get=vi.fn(async(scope:any,id:string)=>{expect(scope.workspaceId).toBe('workspace-a');return id==='own'?ticket('own'):null;});
 const request=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const req=new Request('https://workspace.support.servicev8.com'+String(input),init);const path=new URL(req.url).pathname;
  return path==='/api/runtime/tickets'?handleRuntimeTicketList(req,{authorize,list}):handleRuntimeTicketDetail(req,path.split('/').at(-1)!,{authorize,get});
 };
 const missing=await loadNativeRuntimeTickets({ticket:'foreign'},request as typeof fetch);
 expect(missing.selected).toBeNull();expect(missing.selectionRequested).toBe(true);
 authorize.mockResolvedValue(null);list.mockClear();get.mockClear();
 await expect(loadNativeRuntimeTickets({ticket:'own'},request as typeof fetch)).rejects.toThrow();
 expect(list).not.toHaveBeenCalled();expect(get).not.toHaveBeenCalled();
});

it('hydrates only the exact scoped IDs and rejects extra, duplicate or mismatched owner rows',async()=>{
 const native=(id:string)=>({...ticket(id),externalId:id,sourceUrl:'/chat/session-'+id});
 let data=[native('first'),native('wanted')];
 const request=vi.fn(async(input:RequestInfo|URL)=>{
  const path=String(input);
  if(path.startsWith('/api/issues?')) {expect(new URL(path,'https://fixture.test').searchParams.getAll('workspaceIssueId')).toEqual(['first','wanted']);return Response.json({success:true,data});}
  return Response.json(path.endsWith('/wanted')?ticket('wanted'):{tickets:[ticket('first')]});
 });
 const result=await loadNativeRuntimeWorkdesk({ticket:'wanted'},request as typeof fetch);
 expect(result.issues[1].sourceUrl).toBe('/chat/session-wanted');
 for(const invalid of [[native('foreign')],[native('first'),native('first')]]) {
  data=invalid;await expect(loadNativeRuntimeWorkdesk({ticket:'wanted'},request as typeof fetch)).rejects.toThrow('Invalid native ticket response');
 }
 data=[native('first')];expect((await loadNativeRuntimeWorkdesk({ticket:'wanted'},request as typeof fetch)).selected).toBeNull();
});

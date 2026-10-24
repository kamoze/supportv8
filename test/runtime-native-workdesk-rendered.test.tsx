// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,expect,it,vi} from 'vitest';
import SupportV8Dashboard from '@/app/page';
import {AuthService} from '@/lib/auth-service';
import {RuntimeNativeWorkdesk} from '@/components/workspace/RuntimeNativeWorkdesk';
const roots:Root[]=[];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
afterEach(()=>{for(const root of roots.splice(0))act(()=>root.unmount());document.body.innerHTML='';vi.unstubAllGlobals();vi.restoreAllMocks();});
const ticket=(id:string)=>({id,ticketRef:id,customerRef:'customer',customerName:'Customer '+id,summary:'Current request '+id,status:'open',priority:'normal',source:'runtime_manual',createdAt:'2026-10-24T10:00:00Z',updatedAt:'2026-10-24T10:00:00Z'});
async function mount(canManage=true){const container=document.createElement('div');document.body.append(container);const root=createRoot(container);roots.push(root);await act(async()=>root.render(<RuntimeNativeWorkdesk canManage={canManage}/>));return container;}
async function click(element:Element|null){expect(element).not.toBeNull();await act(async()=>element!.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})));}
it('renders native navigation and paging through owner cursors without legacy simulated actions',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace');
 const calls:string[]=[];
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
  const path=String(input);calls.push(path);
  if(path.endsWith('/second'))return Response.json(ticket('second'));
  return Response.json(path.includes('cursor=next')?{tickets:[ticket('second')]}:{tickets:[ticket('first')],nextCursor:'next'});
 }));
 const view=await mount();expect(view.textContent).toContain('Current request first');
 expect(view.textContent).toContain('Create ticket');
 for(const unsupported of ['Generate reply','Refund','Deducted','Save to RAG','Upload attachment'])expect(view.textContent).not.toContain(unsupported);
 await click([...view.querySelectorAll('button')].find(b=>b.textContent==='Next page')!);
 expect(view.textContent).toContain('Current request second');expect(window.location.search).toContain('cursor=next');
 const link=view.querySelector('a[href*="ticket=second"]');expect(link?.getAttribute('href')).toContain('/?view=cockpit&tab=workspace');
 await click(link);expect(window.location.search).toContain('ticket=second');expect(calls).toContain('/api/runtime/tickets/second');
 expect(view.textContent).toContain('This is not the workspace total');
});
it('shows an exact missing selection without opening another ticket or write controls',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=foreign');
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/foreign')?Response.json({error:'missing'},{status:404}):Response.json({tickets:[ticket('first')]})));
 const view=await mount(false);expect(view.textContent).toContain('Ticket not found in this workspace.');
 expect(view.querySelector('aside')?.textContent).not.toContain('Current request first');
 expect(view.textContent).not.toContain('Create ticket');expect(view.textContent).not.toContain('Edit ticket');
});
it.each([401,403,503])('renders no ticket or mutation controls when owner access fails with%s',async status=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({tickets:[ticket('denied')]},{status})));
 const view=await mount();expect(view.querySelector('[role=alert]')).not.toBeNull();
 expect(view.textContent).not.toContain('Current request denied');expect(view.textContent).not.toContain('Create ticket');
});

it('mounts the current full native cockpit with the scoped workdesk and keeps navigation at the native root',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=wanted');
 const session={token:'workspace:100',tenantSlug:'acme',email:'person@example.test',name:'Workspace administrator',role:'cx_lead' as const,issuedAt:100,expiresAt:Date.now()+60000};
 vi.spyOn(AuthService,'getActiveSession').mockReturnValue(session);
 vi.spyOn(AuthService,'restoreRuntimeSession').mockResolvedValue(session);
 vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL)=>{
  const path=String(input);
  if(path.startsWith('/api/runtime/tickets?'))return Response.json({tickets:[ticket('first')],nextCursor:'next'});
  if(path==='/api/runtime/tickets/wanted')return Response.json(ticket('wanted'));
  return Response.json({success:false});
 }));
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);roots.push(root);
 await act(async()=>root.render(<SupportV8Dashboard/>));
 expect(container.querySelector('[aria-label="Application navigation"]')).not.toBeNull();
 const workdesk=container.querySelector('[aria-label="Runtime workspace tickets"]');expect(workdesk).not.toBeNull();
 expect(workdesk!.querySelector('aside')?.textContent).toContain('Current request wanted');
 expect(workdesk!.querySelector('a')?.getAttribute('href')).toMatch(/^\/\?view=cockpit&tab=workspace&ticket=/);
 expect(workdesk!.textContent).toContain('Next page');expect(workdesk!.textContent).not.toContain('Deducted');
});

it('never replaces an explicitly empty ticket link with a prior native selection',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=');
 const request=vi.fn();vi.stubGlobal('fetch',request);
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);roots.push(root);
 await act(async()=>root.render(<RuntimeNativeWorkdesk canManage initialTicketId="prior"/>));
 expect(container.querySelector('[role=alert]')).not.toBeNull();expect(request).not.toHaveBeenCalled();
});

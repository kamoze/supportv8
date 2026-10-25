// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/auth/request-tenant',async original=>({...await original<typeof import('@/lib/auth/request-tenant')>(),resolveRequestTenant:vi.fn()}));
import {resolveRequestTenant,RequestAuthError} from '@/lib/auth/request-tenant';
import {chatRepository} from '@/lib/db/chat-repository';
import {GET as getIssues,POST as updateIssue} from '@/app/api/issues/route';
import {GET as getChat} from '@/app/api/chat/session/route';
import {POST as sendChat} from '@/app/api/chat/message/route';
import {handleRuntimeTicketList,handleRuntimeTicketDetail} from '@/lib/service-app/runtime-http';
import SupportV8Dashboard from '@/app/page';
import {AuthService} from '@/lib/auth-service';
import {RuntimeNativeWorkdesk} from '@/components/workspace/RuntimeNativeWorkdesk';
const roots:Root[]=[];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const session={token:'workspace:100',tenantSlug:'acme',email:'person@example.test',name:'Workspace administrator',role:'cx_lead' as const,issuedAt:100,expiresAt:Date.now()+600000};
const ticket=(id:string)=>({id,ticketRef:id,customerRef:'customer',customerName:'Customer '+id,summary:'Current request '+id,status:'open',priority:'normal',source:'runtime_manual',createdAt:'2026-10-24T10:00:00Z',updatedAt:'2026-10-24T10:00:00Z'});
const issue=(id:string)=>({...ticket(id),externalId:id,tenantId:'workspace',category:'support',product:'Support',confidence:0,sentiment:'neutral',tags:[],messages:[],timeline:[]});
const props={issues:[],userRole:'cx_lead',onResolve:vi.fn(),onEscalate:vi.fn(),onExecuteInsight:vi.fn(),onNavigateToProblems:vi.fn(),onNotify:vi.fn()};
beforeEach(()=>{
 vi.spyOn(AuthService,'getActiveSession').mockReturnValue(session);
 vi.spyOn(AuthService,'restoreRuntimeSession').mockResolvedValue(session);
 vi.stubGlobal('ResizeObserver',class {observe(){} unobserve(){} disconnect(){}});
 vi.stubGlobal('matchMedia',vi.fn(()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})));
 Element.prototype.scrollTo=vi.fn();
 vi.stubGlobal('EventSource',class { addEventListener(){} removeEventListener(){} close(){} });
});
afterEach(()=>{for(const root of roots.splice(0))act(()=>root.unmount());document.body.innerHTML='';vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function mount(native=false,userRole='cx_lead') {const container=document.createElement('div');document.body.append(container);const root=createRoot(container);roots.push(root);await act(async()=>root.render(native?<SupportV8Dashboard/>:<RuntimeNativeWorkdesk {...props} userRole={userRole}/>));return container;}
async function click(element:Element|undefined|null){expect(element).toBeTruthy();await act(async()=>element!.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,button:0})));}
function button(view:ParentNode,label:string){return [...view.querySelectorAll('button')].find(b=>b.textContent?.trim()===label);}
function ownerFetch(extra?:(path:string,init?:RequestInit)=>Promise<Response>|Response|undefined){return vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
 const path=String(input);const response=extra?.(path,init);if(response)return response;
 const url=new URL(path,'https://fixture.test');
 if(url.searchParams.has('workspaceIssueId'))return Response.json({success:true,data:url.searchParams.getAll('workspaceIssueId').map(issue)});
 if(path.startsWith('/api/runtime/tickets?'))return Response.json(path.includes('cursor=next')?{tickets:[ticket('second')]}:{tickets:[ticket('first')],nextCursor:'next'});
 if(path.startsWith('/api/runtime/tickets/'))return Response.json(ticket(decodeURIComponent(path.split('/').at(-1)!)));
 return Response.json({success:false});
});}
it('keeps the full native workdesk, actual ticket controls and bounded native paging',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace');
 const request=ownerFetch();vi.stubGlobal('fetch',request);
 const view=await mount();expect(view.textContent).toContain('Current request first');
 expect(button(view,'New Ticket')?.disabled).toBe(false);
 await click(button(view,'New Ticket'));
 expect(view.querySelector('[role=dialog]')?.textContent).toContain('Customer email (optional)');
 expect(view.querySelector('[role=dialog]')?.textContent).toContain('Ingress Channel');
 await click(view.querySelector('[aria-label="Close create ticket"]'));
 expect(button(view,'Import CSV')?.disabled).toBe(true);
 expect(button(view,'Save Resolution to Knowledge Base (RAG)')?.disabled).toBe(true);
 expect(button(view,'Auto-Resolve')?.disabled).toBe(true);
 await click(button(view,'Next page'));
 expect(view.textContent).toContain('Current request second');expect(window.location.search).toContain('cursor=next');expect(window.location.search).toContain('ticket=second');
 expect(request.mock.calls.map(c=>String(c[0]))).toContain('/api/runtime/tickets/second');
 expect(view.textContent).toContain('This is not the workspace total');
});
it('shows an exact missing selection without substituting another ticket',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=foreign');
 vi.stubGlobal('fetch',ownerFetch(path=>path.endsWith('/foreign')?Response.json({error:'missing'},{status:404}):undefined));
 const view=await mount(false,'observer');expect(view.textContent).toContain('Ticket not found in this workspace.');
 expect(view.textContent).not.toContain('Current request first');expect(button(view,'New Ticket')?.disabled).toBe(true);
});
it.each([401,403,503])('renders no ticket or mutation controls when owner access fails with%s',async status=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace');
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({tickets:[ticket('denied')]},{status})));
 const view=await mount();expect(view.querySelector('[role=alert]')).not.toBeNull();
 expect(view.textContent).not.toContain('Current request denied');expect(button(view,'New Ticket')).toBeUndefined();
});
it('mounts the actual native root with an exact selected ticket outside the current page',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=wanted');vi.stubGlobal('fetch',ownerFetch());
 const view=await mount(true);expect(view.querySelector('[aria-label="Application navigation"]')).not.toBeNull();
 const desk=view.querySelector('[aria-label="Runtime workspace tickets"]')!;expect(desk.textContent).toContain('Current request wanted');
 expect(button(desk,'Next page')).toBeTruthy();expect(desk.textContent).not.toContain('Deducted');
});
it('never replaces an explicitly empty ticket link with prior native selection',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=');const request=vi.fn();vi.stubGlobal('fetch',request);
 const container=document.createElement('div');document.body.append(container);const root=createRoot(container);roots.push(root);
 await act(async()=>root.render(<RuntimeNativeWorkdesk {...props} initialSelectedIssueId="prior"/>));
 expect(container.querySelector('[role=alert]')).not.toBeNull();expect(request).not.toHaveBeenCalled();
});
it('refreshes arrivals without replacing an active reply draft, and hides stale data when authority is revoked',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=first');let arrived=false;let revoked=false;
 vi.stubGlobal('fetch',ownerFetch(path=>path.startsWith('/api/runtime/tickets?')?Response.json({tickets:[ticket('first'),...(arrived?[ticket('arrival')]:[])]},{status:revoked?403:200}):undefined));
 const view=await mount();const textarea=view.querySelector('textarea')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(textarea,'Unsaved operator draft');textarea.dispatchEvent(new Event('input',{bubbles:true}));});
 arrived=true;await act(async()=>window.dispatchEvent(new Event('sv8_ticket_created')));
 expect(view.textContent).toContain('Current request arrival');expect(view.querySelector('textarea')).toBe(textarea);expect(textarea.value).toBe('Unsaved operator draft');
 revoked=true;await act(async()=>window.dispatchEvent(new Event('sv8_ticket_created')));
 expect(view.querySelector('[role=alert]')).toBeTruthy();expect(view.querySelector('textarea')).toBeNull();
});
it('discards a late owner read after navigating to a different exact ticket',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=first');let release!:(r:Response)=>void;let slow=false;
 vi.stubGlobal('fetch',ownerFetch(path=>slow&&path==='/api/runtime/tickets/first'?new Promise<Response>(resolve=>{release=resolve;}):undefined));
 const view=await mount();slow=true;await act(async()=>window.dispatchEvent(new Event('sv8_ticket_created')));
 await act(async()=>{window.history.pushState({},'','/?view=cockpit&tab=workspace&ticket=second');window.dispatchEvent(new PopStateEvent('popstate'));});
 expect(view.textContent).toContain('Current request second');await act(async()=>release(Response.json(ticket('first'))));
 expect(window.location.search).toContain('ticket=second');expect(view.querySelector('[aria-label="Selected ticket details"]')?.textContent).toContain('Customer second');
});

it('opens B from Issues Explorer after a deep link to A, using B in both URL and workdesk',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=first');
 vi.stubGlobal('fetch',ownerFetch(path=>path.startsWith('/api/issues?tenant=')?Response.json({success:true,data:[issue('second')]}):undefined));
 const view=await mount(true);
 expect(view.querySelector('[aria-label="Runtime workspace tickets"]')?.textContent).toContain('Current request first');
 await click([...view.querySelectorAll('button')].find(b=>b.textContent?.includes('Issues Explorer')));
 await click([...view.querySelectorAll('tbody tr')].find(row=>row.textContent?.includes('second')));
 await click(button(view,'Open Desk'));
 expect(window.location.search).toContain('ticket=second');
 expect(view.querySelector('[aria-label="Selected ticket details"]')?.textContent).toContain('Customer second');
});

it('sends a native-root live chat reply and updates its ticket through the actual scoped routes',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=chat-ticket');
 vi.stubEnv('NODE_ENV','production');vi.stubEnv('DATABASE_URL','postgresql://test');
 const tenant={runtimeLinked:true,tenantId:'canonical-workspace',tenantSlug:'acme',accountId:'account',authenticated:true,userId:'operator-subject',displayName:'Operator',roles:['support_cx_lead']};
 vi.mocked(resolveRequestTenant).mockResolvedValue(tenant);
 const nativeIssue={...issue('chat-ticket'),source:'chat',sourceUrl:'/chat/chat-owner-session',tenantId:tenant.tenantId};
 let transcript={id:'chat-owner-session',tenantDomain:'acme',stream:'customers',customerName:'Customer chat-ticket',customerEmail:'customer@example.test',status:'active',priority:'normal',intakeData:{},messages:[],createdAt:'2026-10-24T10:00:00Z',updatedAt:'2026-10-24T10:00:00Z'} as any;
 const projection=vi.spyOn(chatRepository,'listWorkspaceIssuesByIds').mockImplementation(async(id,ids)=>{expect(id).toBe(tenant.tenantId);return ids.includes(nativeIssue.id)?[nativeIssue as any]:[];});
 vi.spyOn(chatRepository,'listWorkspaceIssues').mockResolvedValue([nativeIssue as any]);
 vi.spyOn(chatRepository,'getSessionPage').mockImplementation(async(id,sessionId)=>{expect(id).toBe(tenant.tenantId);return sessionId===transcript.id?{session:transcript,hasEarlierMessages:false,hasMoreMessages:false}:null;});
 vi.spyOn(chatRepository,'getEmailDeliveryContext').mockResolvedValue(null);
 let releaseMessage!:()=>void;
 const pendingMessage = new Promise<void>(resolve=>{releaseMessage=resolve;});
 const persisted=vi.spyOn(chatRepository,'sendMessage').mockImplementation(async input=>{
  await pendingMessage;
  expect(input).toMatchObject({tenantId:tenant.tenantId,sessionId:transcript.id,senderId:'operator-subject',sender:'agent'});
  transcript={...transcript,messages:[{id:input.clientMessageId,sender:'agent',content:input.content,createdAt:'2026-10-24T10:01:00Z'}]};
  return {session:transcript} as any;
 });
 const updated=vi.spyOn(chatRepository,'updateWorkspaceIssue').mockImplementation(async(id,issueId,input)=>{expect(id).toBe(tenant.tenantId);expect(issueId).toBe(nativeIssue.id);Object.assign(nativeIssue,input);return nativeIssue as any;});
 const authorize=async()=>({session:{accountId:'account',tenantId:'registry',installationId:'installation',workspaceId:tenant.tenantId,sub:'operator-subject'},role:'support:manage'} as any);
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const {signal:_browserSignal,...serverInit}=init??{};
  const request=new NextRequest(new URL(String(input),'https://acme.support.servicev8.com'),serverInit as any);const url=new URL(request.url);
  if(url.pathname==='/api/runtime/tickets')return handleRuntimeTicketList(request,{authorize,list:async()=>({tickets:[ticket(nativeIssue.id)]})});
  if(url.pathname.startsWith('/api/runtime/tickets/'))return handleRuntimeTicketDetail(request,nativeIssue.id,{authorize,get:async()=>ticket(nativeIssue.id)});
  if(url.pathname==='/api/issues')return init?.method==='POST'?updateIssue(request):getIssues(request);
  if(url.pathname==='/api/chat/session')return getChat(request);
  if(url.pathname==='/api/chat/message')return sendChat(request);
  return Response.json({success:false});
 }));
 const view=await mount(true);expect(projection).toHaveBeenCalled();
 const quickReply=[...view.querySelectorAll('button')].find(b=>b.textContent?.startsWith('Thank you for the details.'));
 await click(quickReply);await click(button(view,'Send via chat'));
 expect(button(view,'Resolve & Close')?.disabled).toBe(true);
 await click(button(view,'Resolve & Close'));
 expect(persisted).toHaveBeenCalledTimes(1);
 await act(async()=>releaseMessage());
 expect(persisted).toHaveBeenCalledTimes(1);expect(updated).toHaveBeenCalled();
 expect(view.textContent).toContain('Thank you for the details. I’ll confirm the next step here shortly.');
 await click(button(view,'In Progress'));
 expect(updated).toHaveBeenCalledWith(tenant.tenantId,nativeIssue.id,expect.objectContaining({status:'in_progress'}));
 // Revocation between the visible transcript and a send is enforced by the actual owner route.
 vi.mocked(resolveRequestTenant).mockRejectedValue(new RequestAuthError('Revoked',403));
 await click(quickReply);await click(button(view,'Send via chat'));
 expect(persisted).toHaveBeenCalledTimes(1);
});
it('creates from the rich native form with one history entry and returns to the prior ticket on Back',async()=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=first');
 let payload:any;
 vi.stubGlobal('fetch',ownerFetch((path,init)=>{
  if(path==='/api/issues'&&init?.method==='POST'){payload=JSON.parse(String(init.body));return Response.json({success:true,data:issue('created')},{status:201});}
 }));
 const view=await mount();const push=vi.spyOn(window.history,'pushState');
 await click(button(view,'New Ticket'));const dialog=view.querySelector('[role=dialog]')!;
 async function fill(selector:string,value:string){const element=dialog.querySelector(selector) as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;await act(async()=>{Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element),'value')!.set!.call(element,value);element.dispatchEvent(new Event(element instanceof HTMLSelectElement?'change':'input',{bubbles:true}));});}
 await fill('[aria-label="Customer or organization name"]','Casey');
 await fill('[aria-label="Summary and problem statement"]','Delivery question');
 await fill('input[type=email]','casey@example.test');
 await fill('[aria-label="Stream type"]','enquiries');
 await fill('[aria-label="Ingress channel"]','email');
 await act(async()=>dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(payload).toMatchObject({action:'create_manual',customerName:'Casey',customerEmail:'casey@example.test',summary:'Delivery question',stream:'enquiries',channel:'email'});
 expect(push).toHaveBeenCalledTimes(1);expect(window.location.search).toContain('ticket=created');
 await act(async()=>{const navigated=new Promise<void>(resolve=>window.addEventListener('popstate',()=>resolve(),{once:true}));window.history.back();await navigated;});
 expect(window.location.search).toContain('ticket=first');expect(view.querySelector('[aria-label="Selected ticket details"]')?.getAttribute('data-ticket-id')).toBe('first');
});
it.each(['navigate','unmount'])('does not let a delayed create receipt replace newer navigation after%s',async action=>{
 window.history.replaceState({},'','/?view=cockpit&tab=workspace&ticket=first');
 let release!:(r:Response)=>void;
 vi.stubGlobal('fetch',ownerFetch((path,init)=>path==='/api/issues'&&init?.method==='POST'?new Promise<Response>(resolve=>{release=resolve;}):undefined));
 const view=await mount();await click(button(view,'New Ticket'));const dialog=view.querySelector('[role=dialog]')!;
 await act(async()=>{
  for(const [selector,value] of [['[aria-label="Customer or organization name"]','Casey'],['[aria-label="Summary and problem statement"]','New request']]) {
   const element=dialog.querySelector(selector)!;Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element),'value')!.set!.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));
  }
 });
 await act(async()=>dialog.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(release).toBeTypeOf('function');
 await act(async()=>{window.history.pushState({},'','/?view=cockpit&tab=workspace&ticket=second');window.dispatchEvent(new PopStateEvent('popstate'));});
 if(action==='unmount')act(()=>roots.pop()!.unmount());
 await act(async()=>release(Response.json({success:true,data:issue('created')},{status:201})));
 expect(window.location.search).toContain('ticket=second');
 if(action==='navigate')expect(view.querySelector('[aria-label="Selected ticket details"]')?.getAttribute('data-ticket-id')).toBe('second');
});

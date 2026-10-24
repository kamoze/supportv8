"use client";
import React, { useEffect, useRef, useState } from 'react';
import { FocusedWorkspaceView } from '@/components/views/FocusedWorkspaceView';
import { loadNativeRuntimeTickets, runtimeTicketHref, type NativeRuntimeQuery } from '@/lib/service-app/runtime-native-workdesk';
import '@/app/runtime/runtime.css';

type Loaded = Awaited<ReturnType<typeof loadNativeRuntimeTickets>>;
function locationQuery(): NativeRuntimeQuery {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return { ...(params.has('ticket') ? {ticket:params.get('ticket')!} : {}), ...(params.has('cursor') ? {cursor:params.get('cursor')!} : {}) };
}
export function RuntimeNativeWorkdesk({ canManage, initialTicketId }: { canManage: boolean; initialTicketId?: string }) {
  const [query,setQuery] = useState<NativeRuntimeQuery>(() => {
    const query = locationQuery();
    return query.ticket || !initialTicketId ? query : {...query,ticket:initialTicketId};
  });
  const [loaded,setLoaded] = useState<Loaded|null>(null);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    const generation = ++sequence.current;
    const controller = new AbortController();
    setLoaded(null);setError('');
    void loadNativeRuntimeTickets(query,fetch,controller.signal).then(value => {
      if (generation === sequence.current && !controller.signal.aborted) setLoaded(value);
    }).catch(() => {
      if (generation === sequence.current && !controller.signal.aborted) setError('Workspace tickets are unavailable. Reopen Support from Runtime or try again.');
    });
    return () => { controller.abort(); ++sequence.current; };
  }, [query.ticket,query.cursor,revision]);
  useEffect(() => {
    const navigate = () => setQuery(locationQuery());
    window.addEventListener('popstate',navigate);
    return () => window.removeEventListener('popstate',navigate);
  }, []);
  function navigate(next: NativeRuntimeQuery) {
    window.history.pushState({},'',runtimeTicketHref(next.ticket,next.cursor));
    setQuery(next);
  }
  async function mutate(path:string,method:string,input:unknown) {
    const generation = sequence.current;
    const response = await fetch(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(input),credentials:'same-origin',redirect:'error'});
    if (!response.ok) throw Error('Ticket changes were not saved. Check your current workspace access and try again.');
    const value = await response.json();
    // Refresh through the same owner after the write; never manufacture a local receipt.
    if (generation !== sequence.current) throw Error('The workspace changed. Reload to see the saved ticket.');
    if (typeof value.id !== 'string' || !/^[A-Za-z0-9_:@.-]{1,192}$/.test(value.id)
        || (method === 'PATCH' && path !== `/api/runtime/tickets/${encodeURIComponent(value.id)}`)) throw Error('Ticket receipt is unavailable. Reload before retrying.');
    navigate({ticket:value.id,cursor:query.cursor});
    setRevision(current => current+1);
  }
  if (error) return <section role="alert"><p>{error}</p><button className="runtime-next" onClick={()=>setRevision(value=>value+1)}>Try again</button></section>;
  if (!loaded) return <p role="status">Loading workspace tickets…</p>;
  return <section className="runtime-ticket-scroll" aria-label="Runtime workspace tickets">
    <FocusedWorkspaceView runtimeTransport={{
      tickets:loaded.page.tickets,selected:loaded.selected,selectionRequested:loaded.selectionRequested,
      canManage,cursor:query.cursor,
      ticketHref:id=>runtimeTicketHref(id,query.cursor),
      onSelectTicket:id=>navigate({ticket:id,cursor:query.cursor}),
      onCreate:input=>mutate('/api/runtime/tickets','POST',input),
      onUpdate:(id,input)=>mutate(`/api/runtime/tickets/${encodeURIComponent(id)}`,'PATCH',input),
    }}/>
    <nav aria-label="Ticket pages" className="flex gap-3 py-3">
      {query.cursor && <button className="runtime-next" onClick={()=>navigate({})}>First page</button>}
      {loaded.page.nextCursor && <button className="runtime-next" onClick={()=>navigate({cursor:loaded.page.nextCursor})}>Next page</button>}
    </nav>
    <p className="text-sm">Showing {loaded.page.tickets.length} tickets on this page. This is not the workspace total.</p>
  </section>;
}

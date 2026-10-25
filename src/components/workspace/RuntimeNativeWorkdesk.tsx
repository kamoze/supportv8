"use client";
import React, { useEffect, useRef, useState } from 'react';
import { FocusedWorkspaceView, type FocusedWorkspaceViewProps } from '@/components/views/FocusedWorkspaceView';
import { loadNativeRuntimeWorkdesk, runtimeTicketHref, type NativeRuntimeQuery } from '@/lib/service-app/runtime-native-workdesk';

type Loaded = Awaited<ReturnType<typeof loadNativeRuntimeWorkdesk>>;
function locationQuery(): NativeRuntimeQuery {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return { ...(params.has('ticket') ? {ticket:params.get('ticket')!} : {}), ...(params.has('cursor') ? {cursor:params.get('cursor')!} : {}) };
}
export function RuntimeNativeWorkdesk(props: FocusedWorkspaceViewProps) {
  const [query,setQuery] = useState<NativeRuntimeQuery>(locationQuery);
  const [loaded,setLoaded] = useState<Loaded|null>(null);
  const [error,setError] = useState('');
  const [revision,setRevision] = useState(0);
  const sequence = useRef(0);
  const navigateSequence = useRef(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++navigateSequence.current; }; }, []);
  const currentQuery = useRef(query);
  function navigate(next: NativeRuntimeQuery) {
    if (next.ticket === query.ticket && next.cursor === query.cursor) {
      setRevision(value=>value+1);
      return;
    }
    ++navigateSequence.current;
    ++sequence.current;
    setLoaded(null);
    window.history.pushState({},'',runtimeTicketHref(next.ticket,next.cursor));
    setQuery(next);
  }
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let pending = false;
    if (currentQuery.current.ticket !== query.ticket || currentQuery.current.cursor !== query.cursor) setLoaded(null);
    currentQuery.current = query;
    async function refresh() {
      if (pending) return;
      pending = true;
      const generation = ++sequence.current;
      try {
        const value = await loadNativeRuntimeWorkdesk(query,fetch,controller.signal);
        if (!active || generation !== sequence.current) return;
        setError('');
        setLoaded(value);
        // Stabilize an implicit first selection before later arrivals reorder the page.
        if (query.ticket === undefined && value.selected) {
          const next = {...query,ticket:value.selected.id};
          window.history.replaceState({},'',runtimeTicketHref(next.ticket,next.cursor));
          setQuery(next);
        }
      } catch {
        if (active && generation === sequence.current) {
          setLoaded(null);
          setError('Workspace tickets are unavailable. Reopen Support from Runtime or try again.');
        }
      } finally { pending = false; }
    }
    void refresh();
    const timer = window.setInterval(()=>void refresh(),4000);
    const refreshNow = () => void refresh();
    window.addEventListener('sv8_ticket_created',refreshNow);
    return () => { active = false; controller.abort(); ++sequence.current; window.clearInterval(timer); window.removeEventListener('sv8_ticket_created',refreshNow); };
  }, [query.ticket,query.cursor,revision]);
  useEffect(() => {
    const onNavigate = () => { ++navigateSequence.current; ++sequence.current; setLoaded(null); setQuery(locationQuery()); };
    window.addEventListener('popstate',onNavigate);
    return () => window.removeEventListener('popstate',onNavigate);
  }, []);
  const renderedNavigation = navigateSequence.current;
  if (error) return <section role="alert"><p>{error}</p><button onClick={()=>setRevision(value=>value+1)}>Try again</button></section>;
  if (!loaded) return <p role="status">Loading workspace tickets…</p>;
  return <section aria-label="Runtime workspace tickets">
    <FocusedWorkspaceView {...props}
      issues={loaded.issues}
      initialSelectedIssueId={loaded.selected?.id}
      nativeRuntime={{selectionRequested:loaded.selectionRequested,canManage:props.userRole === 'cx_lead',onSelectTicket:id=>{if (mounted.current && renderedNavigation === navigateSequence.current) navigate({ticket:id,cursor:query.cursor});}}}
      onUpdateIssue={async issue=>{
        const generation = navigateSequence.current;
        if (!props.onUpdateIssue) throw Error('Ticket updates are unavailable.');
        const saved = await props.onUpdateIssue(issue);
        if (!saved || saved.id !== issue.id) throw Error('Ticket receipt is unavailable. Reload before retrying.');
        if (mounted.current && generation === navigateSequence.current) setRevision(value=>value+1);
        return saved;
      }}
      onCreateIssue={issue=>{if (mounted.current && renderedNavigation === navigateSequence.current) props.onCreateIssue?.(issue);}}
      onProcessRefund={undefined} onImportIssues={undefined} onSaveToKnowledgeBase={undefined}
      onDeductCredits={undefined} onTriggerTemporalActivity={undefined}
    />
    <nav aria-label="Ticket pages" className="flex gap-3 py-3">
      {query.cursor && <button onClick={()=>navigate({})}>First page</button>}
      {loaded.page.nextCursor && <button onClick={()=>navigate({cursor:loaded.page.nextCursor})}>Next page</button>}
      <button onClick={()=>setRevision(value=>value+1)}>Refresh tickets</button>
    </nav>
    <p className="text-sm">Showing {loaded.page.tickets.length} tickets on this page. This is not the workspace total.</p>
  </section>;
}

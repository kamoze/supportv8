import type { Issue } from '@/lib/types';
import type { SupportTicketPage, SupportTicketSummary } from './runtime-ticket-reader';

export type NativeRuntimeQuery = { ticket?: string; cursor?: string };
const idPattern = /^[A-Za-z0-9_:@.-]{1,192}$/;
const fields = ['id','ticketRef','customerRef','customerName','summary','status','priority','source','createdAt','updatedAt'] as const;
function ticket(value: unknown): SupportTicketSummary {
  if (!value || typeof value !== 'object' || fields.some(key => typeof (value as Record<string,unknown>)[key] !== 'string')
      || !idPattern.test((value as SupportTicketSummary).id)) throw Error('Invalid ticket response.');
  return value as SupportTicketSummary;
}
export function runtimeTicketHref(id?: string, cursor?: string): string {
  const params = new URLSearchParams({ view:'cockpit', tab:'workspace' });
  if (id) params.set('ticket', id);
  if (cursor) params.set('cursor', cursor);
  return `/?${params}`;
}
export async function loadNativeRuntimeTickets(query: NativeRuntimeQuery, request: typeof fetch = fetch, signal?: AbortSignal) {
  if (query.ticket !== undefined && !idPattern.test(query.ticket)) throw Error('Invalid ticket link.');
  if (query.cursor !== undefined && (!/^[A-Za-z0-9_-]{1,512}$/.test(query.cursor))) throw Error('Invalid ticket page.');
  const params = new URLSearchParams({ limit:'30' });
  if (query.cursor) params.set('cursor',query.cursor);
  const options: RequestInit = { credentials:'same-origin',redirect:'error',cache:'no-store',signal };
  const response = await request(`/api/runtime/tickets?${params}`, options);
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Workspace access is unavailable. Reopen Support from Runtime.' : 'Tickets are unavailable. Try again.');
  const value = await response.json();
  if (!Array.isArray(value.tickets) || value.tickets.length > 30 || (value.nextCursor !== undefined && !/^[A-Za-z0-9_-]{1,512}$/.test(value.nextCursor))) throw Error('Invalid ticket page.');
  const page: SupportTicketPage = { tickets: value.tickets.map(ticket), ...(value.nextCursor ? {nextCursor:value.nextCursor} : {}) };
  let selected: SupportTicketSummary|null = page.tickets[0] ?? null;
  if (query.ticket) {
    // Always resolve the precise resource through its owner, including on a loaded page.
    const detail = await request(`/api/runtime/tickets/${encodeURIComponent(query.ticket)}`, options);
    if (detail.status === 404) selected = null;
    else {
      if (!detail.ok) throw Error('The selected ticket is unavailable.');
      selected = ticket(await detail.json());
      if (selected.id !== query.ticket) throw Error('Invalid selected ticket response.');
    }
  }
  return { page, selected, selectionRequested: query.ticket !== undefined };
}

/** Hydrate only the owner-selected page/selection; never use the native 500-row list as a fallback. */
export async function loadNativeRuntimeWorkdesk(query: NativeRuntimeQuery, request: typeof fetch = fetch, signal?: AbortSignal) {
  const loaded = await loadNativeRuntimeTickets(query, request, signal);
  const ids = [...new Set([...loaded.page.tickets.map(row => row.id), ...(loaded.selected ? [loaded.selected.id] : [])])];
  if (!ids.length) return { ...loaded, issues: [] as Issue[] };
  const params = new URLSearchParams(ids.map(id => ['workspaceIssueId', id]));
  const response = await request(`/api/issues?${params}`, { credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal });
  if (!response.ok) throw Error('Workspace access is unavailable.');
  const result = await response.json();
  if (!result.success || !Array.isArray(result.data) || result.data.length > ids.length) throw Error('Invalid native ticket response.');
  const seen = new Set<string>();
  for (const issue of result.data) {
    if (!issue || !ids.includes(issue.id) || seen.has(issue.id) || ['externalId','customerName','summary','status','priority','source'].some(key => typeof issue[key] !== 'string')) throw Error('Invalid native ticket response.');
    seen.add(issue.id);
  }
  // Concurrent deletion remains an exact missing selection, never a replacement ticket.
  return { ...loaded, selected: loaded.selected && seen.has(loaded.selected.id) ? loaded.selected : null, issues: result.data as Issue[] };
}

import type { SupportRuntimeScope } from "./runtime-access";
import type {
  SupportTicketPage,
  SupportTicketSummary,
} from "./runtime-ticket-reader";

export const runtimeTicketViews = ["overview", "workspace", "issues"] as const;
export type RuntimeTicketView = (typeof runtimeTicketViews)[number];

const knownRuntimeViews = new Set([
  ...runtimeTicketViews,
  "problems",
  "cx_cockpit",
  "ask",
  "studio",
  "workforce",
  "voice",
  "trends",
  "knowledge",
  "portal_composer",
  "stale_work",
  "studio_marketplace",
  "market_workforce",
  "market_plans",
  "gov_settings",
  "gov_members",
  "gov_audit",
  "gov_reports",
  "policies",
]);

export function normalizeRuntimeWorkspaceView(value?: string): string {
  return value && knownRuntimeViews.has(value) ? value : "workspace";
}

export function runtimeViewUsesTickets(view: string): view is RuntimeTicketView {
  return (runtimeTicketViews as readonly string[]).includes(view);
}

type TicketReader = {
  list(
    scope: SupportRuntimeScope,
    input: { limit: number; cursor?: string },
  ): Promise<SupportTicketPage>;
  get(
    scope: SupportRuntimeScope,
    id: string,
  ): Promise<SupportTicketSummary | null>;
};

export async function loadRuntimeWorkspaceTickets(
  reader: TicketReader,
  scope: SupportRuntimeScope,
  query: { cursor?: string; ticket?: string; view?: string },
) {
  const view = normalizeRuntimeWorkspaceView(query.view);
  if (!runtimeViewUsesTickets(view)) return { view };
  const page = await reader.list(scope, {
    limit: 30,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
  const selected = query.ticket
    ? await reader.get(scope, query.ticket)
    : (page.tickets[0] ?? null);
  return { view, page, selected };
}

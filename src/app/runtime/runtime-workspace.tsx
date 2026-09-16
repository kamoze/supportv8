"use client";
import React, { useEffect, useState } from "react";
import { useFamilyDialog } from "@/components/FamilyControls";
import { LogOut } from "@/components/ui/FlatIcon";
import { FocusedWorkspaceView } from "@/components/views/FocusedWorkspaceView";
import {
  SupportWorkspaceHeader,
  SupportWorkspaceNavigation,
  SupportWorkspaceShell,
  WorkspaceUnavailable,
  fullSupportNavigation,
} from "@/components/workspace/SupportWorkspaceShell";
import type {
  SupportTicketPage,
  SupportTicketSummary,
} from "@/lib/service-app/runtime-ticket-reader";
type Props = {
  domain: string;
  page?: SupportTicketPage;
  selected?: SupportTicketSummary | null;
  state: "ready" | "empty" | "denied" | "unavailable";
  cursor?: string;
  role?: "support:read" | "support:manage";
  selectionRequested?: boolean;
  view?: string;
};
const enabled = new Set(["overview", "workspace", "issues"]);
export function RuntimeWorkspace({
  domain,
  page,
  selected,
  state,
  cursor,
  role = "support:read",
  selectionRequested = false,
  view = "workspace",
}: Props) {
  const [collapsed, setCollapsed] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false);
  const mobileRail = useFamilyDialog<HTMLElement>(mobileOpen, () =>
    setMobileOpen(false),
  );
  const active = fullSupportNavigation
      .flatMap((s) => s.items)
      .some((i) => i.id === view)
      ? view
      : "workspace",
    canManage = role === "support:manage",
    returnTo = `https://${domain}.runtime.servicev8.com/workspace/${domain}/applications`;
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (
      requested &&
      !fullSupportNavigation
        .flatMap((s) => s.items)
        .some((i) => i.id === requested)
    )
      window.history.replaceState({}, "", "/runtime?view=workspace");
  }, []);
  const hrefFor = (id: string) => {
    const q = new URLSearchParams();
    q.set("view", id);
    if (enabled.has(id) && selected?.id) q.set("ticket", selected.id);
    if (enabled.has(id) && cursor) q.set("cursor", cursor);
    return `/runtime?${q}`;
  };
  const sections = fullSupportNavigation.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        available: enabled.has(item.id),
        ...(item.id === "workspace" || item.id === "issues"
          ? { badge: page?.tickets.length }
          : {}),
      })),
    })),
    label =
      sections.flatMap((s) => s.items).find((i) => i.id === active)?.label ??
      "Work Desk";
  const navigation = (
    <SupportWorkspaceNavigation
      sections={sections}
      activeId={active}
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      navigationRef={mobileRail}
      onToggleCollapsed={() => setCollapsed((v) => !v)}
      onCloseMobile={() => setMobileOpen(false)}
      hrefFor={hrefFor}
      identity={domain}
      roleLabel={canManage ? "Administrator" : "Read only"}
      footerAction={
        <form action="/auth/runtime/logout" method="post">
          <button
            type="submit"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[#E5484D] hover:bg-[#E5484D]/10"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      }
    />
  );
  return (
    <SupportWorkspaceShell
      className="runtime-shell"
      navigation={navigation}
      mobileOpen={mobileOpen}
      onCloseMobile={() => setMobileOpen(false)}
    >
      <div
        id="support-workspace"
        tabIndex={-1}
        className={`flex-1 flex flex-col min-w-0 h-screen bg-[#0B1017] ${active === "workspace" || active === "issues" ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        <SupportWorkspaceHeader
          activeLabel={label}
          tenantSlug={domain}
          onOpenNavigation={() => setMobileOpen(true)}
        >
          <span className="runtime-readonly">
            {canManage ? "Administrator" : "Read only"}
          </span>
          <a className="runtime-return" href={returnTo}>
            Return to Runtime
          </a>
        </SupportWorkspaceHeader>
        <main
          className={
            active === "workspace" || active === "issues"
              ? "family-main flex-1 flex flex-col min-h-0 w-full overflow-hidden"
              : "family-main flex-1 p-4 sm:p-6 md:p-8 w-full space-y-6"
          }
        >
          {state === "denied" ? (
            <State
              title="Access denied"
              body="Your current workspace access no longer permits this view. Return to Runtime and open Support again."
              href={returnTo}
            />
          ) : state === "unavailable" ? (
            <State
              title="Tickets are unavailable"
              body="Support could not verify current access or read this workspace. Try again from Runtime."
              href={returnTo}
            />
          ) : active === "overview" ? (
            <RuntimeOverview
              count={page?.tickets.length ?? 0}
              onOpen={hrefFor("workspace")}
            />
          ) : active === "workspace" || active === "issues" ? (
            <>
              <FocusedWorkspaceView
                runtimeTransport={{
                  tickets: page?.tickets ?? [],
                  selected,
                  selectionRequested,
                  cursor,
                  canManage,
                  onCreate: (input) =>
                    mutation("/api/runtime/tickets", "POST", input),
                  onUpdate: (id, input) =>
                    mutation(
                      `/api/runtime/tickets/${encodeURIComponent(id)}`,
                      "PATCH",
                      input,
                    ),
                }}
              />
              {page?.nextCursor && (
                <a
                  className="runtime-next"
                  href={`/runtime?view=${active}&cursor=${encodeURIComponent(page.nextCursor)}`}
                >
                  Next page
                </a>
              )}
            </>
          ) : (
            <WorkspaceUnavailable title={label} />
          )}
        </main>
      </div>
    </SupportWorkspaceShell>
  );
}
function RuntimeOverview({ count, onOpen }: { count: number; onOpen: string }) {
  return (
    <section className="space-y-6">
      <div className="card p-6">
        <h1 className="text-2xl font-bold text-[#EAF1F8]">Support workspace</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#B4C2D0]">
          Current ticket activity from this verified Runtime workspace. Metrics
          that require other durable Support services appear only after those
          services are connected.
        </p>
      </div>
      <div className="card p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#EAF1F8]">
              Current ticket page
            </h2>
            <p className="mt-1 text-xs text-[#8E9AA8]">
              This is the number loaded on this page, not a workspace-wide
              total.
            </p>
          </div>
          <strong className="text-2xl tabular-nums text-[#2ED8B6]">
            {count} {count === 1 ? "ticket" : "tickets"} loaded
          </strong>
        </div>
        <a className="btn btn-primary mt-5 inline-flex" href={onOpen}>
          Open Work Desk
        </a>
      </div>
    </section>
  );
}
async function mutation(url: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok)
    throw new Error(
      payload.error || "Support could not save this change. Try again.",
    );
  window.location.reload();
}
function State({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href?: string;
}) {
  return (
    <section className="runtime-state">
      <h1>{title}</h1>
      <p>{body}</p>
      {href && <a href={href}>Return to Runtime</a>}
    </section>
  );
}

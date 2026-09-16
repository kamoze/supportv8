"use client";
import React from "react";
import { FocusedWorkspaceView } from "@/components/views/FocusedWorkspaceView";
import { SupportV8Logo } from "@/components/SupportV8Logo";
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
};
const date = (value: string) =>
  new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
export function RuntimeWorkspace({
  domain,
  page,
  selected,
  state,
  cursor,
  role = "support:read",
  selectionRequested = false,
}: Props) {
  const canManage = role === "support:manage";
  const returnTo = `https://${domain}.runtime.servicev8.com/workspace/${domain}/applications`;
  return (
    <div className="runtime-shell">
      <a className="runtime-skip" href="#runtime-main">
        Skip to ticket list
      </a>
      <header>
        <a
          className="runtime-brand"
          href="/runtime"
          aria-label="SupportV8 runtime ticket view"
        >
          <SupportV8Logo size={32} />
        </a>
        <div>
          <span className="runtime-scope">{domain}</span>
          <a href={returnTo}>Return to Runtime</a>
          <form action="/auth/runtime/logout" method="post">
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main id="runtime-main">
        <section className="runtime-heading">
          <div>
            <h1>Support tickets</h1>
            <p>Tenant-scoped support activity for this Runtime workspace.</p>
          </div>
          <span className="runtime-readonly">
            {canManage ? "Administrator" : "Read only"}
          </span>
        </section>
        {state === "denied" ? (
          <State
            title="Access denied"
            body="Your current workspace access no longer permits this view. Return to Runtime and open Support again."
            href={returnTo}
          />
        ) : state === "unavailable" ? (
          <State
            title="Tickets are unavailable"
            body="Support could not verify current access or read tickets. Try again from Runtime."
            href={returnTo}
          />
        ) : (
          <>
            <FocusedWorkspaceView
              runtimeTransport={{
                tickets: page?.tickets ?? [],
                selected,
                selectionRequested,
                cursor,
                canManage,
                onCreate: async (input) =>
                  mutation("/api/runtime/tickets", "POST", input),
                onUpdate: async (id, input) =>
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
                href={`/runtime?cursor=${encodeURIComponent(page.nextCursor)}`}
              >
                Next page
              </a>
            )}
          </>
        )}
      </main>
    </div>
  );
}
async function mutation(url: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    payload = await response.json().catch(() => ({}));
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
      <h2>{title}</h2>
      <p>{body}</p>
      {href && <a href={href}>Return to Runtime</a>}
    </section>
  );
}

import React from "react";
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
}: Props) {
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
          <span>support</span>
          <b>v8</b>
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
            <p>Read-only support activity for this Runtime workspace.</p>
          </div>
          <span className="runtime-readonly">Read only</span>
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
        ) : state === "empty" ? (
          <State
            title="No support tickets yet"
            body="Tickets created for this workspace will appear here. Return to Runtime to continue working."
            href={returnTo}
          />
        ) : (
          <div className="runtime-grid">
            <section aria-label="Ticket list" className="runtime-list">
              <div className="runtime-list-head">
                <h2>{page?.tickets.length ?? 0} recent tickets</h2>
                <span>Newest updates first</span>
              </div>
              <ul>
                {page?.tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <a
                      href={`/runtime?ticket=${encodeURIComponent(ticket.id)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`}
                      aria-current={
                        selected?.id === ticket.id ? "page" : undefined
                      }
                    >
                      <div>
                        <strong>{ticket.customerName}</strong>
                        <span>{ticket.ticketRef}</span>
                      </div>
                      <p>{ticket.summary}</p>
                      <footer>
                        <span
                          className={`runtime-status runtime-status-${ticket.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                        >
                          {ticket.status}
                        </span>
                        <time dateTime={ticket.updatedAt}>
                          {date(ticket.updatedAt)}
                        </time>
                      </footer>
                    </a>
                  </li>
                ))}
              </ul>
              {page?.nextCursor && (
                <a
                  className="runtime-next"
                  href={`/runtime?cursor=${encodeURIComponent(page.nextCursor)}`}
                >
                  Next page
                </a>
              )}
            </section>
            <aside aria-label="Ticket details">
              {selected ? (
                <>
                  <div className="runtime-detail-head">
                    <span className="runtime-status">{selected.status}</span>
                    <span>{selected.ticketRef}</span>
                  </div>
                  <h2>{selected.customerName}</h2>
                  <p>{selected.summary}</p>
                  <dl>
                    <div>
                      <dt>Priority</dt>
                      <dd>{selected.priority}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{selected.source}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{date(selected.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Last updated</dt>
                      <dd>{date(selected.updatedAt)}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <State
                  title="Select a ticket"
                  body="Choose a ticket to review its current support summary."
                />
              )}
            </aside>
          </div>
        )}
      </main>
    </div>
  );
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

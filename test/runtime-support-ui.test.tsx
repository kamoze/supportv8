import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RuntimeWorkspace } from "@/app/runtime/runtime-workspace";
const ticket = {
  id: "synthetic-1",
  ticketRef: "SYN-101",
  customerRef: "customer-1",
  customerName: "Synthetic Customer",
  status: "open",
  priority: "urgent",
  summary: "Synthetic dispatch needs review",
  source: "runtime",
  createdAt: "2026-09-16T10:00:00Z",
  updatedAt: "2026-09-16T11:00:00Z",
};
describe("Runtime role-aware workspace", () => {
  it("renders real ticket fields, safe return and POST logout without implementation identifiers", () => {
    const html = renderToStaticMarkup(
      <RuntimeWorkspace
        domain="synthetic-support"
        role="support:read"
        state="ready"
        page={{ tickets: [ticket] }}
        selected={ticket}
      />,
    );
    expect(html).toContain("Synthetic Customer");
    expect(html).toContain("Synthetic dispatch needs review");
    expect(html).toContain(
      'href="https://synthetic-support.runtime.servicev8.com/workspace/synthetic-support/applications"',
    );
    expect(html).toContain('method="post"');
    expect(html).not.toContain("customer-1");
    expect(html).not.toContain("tenant_rt_");
    expect(html).toContain("Read only");
    expect(html).not.toContain("Create ticket");
  });

  it("preserves the page cursor in ticket detail links", () => {
    const html = renderToStaticMarkup(
      <RuntimeWorkspace
        domain="synthetic-support"
        role="support:read"
        state="ready"
        page={{ tickets: [ticket] }}
        selected={ticket}
        cursor="page-two"
      />,
    );
    expect(html).toContain("/runtime?ticket=synthetic-1&amp;cursor=page-two");
  });
  it("shows durable workdesk mutations only to managers", () => {
    const html = renderToStaticMarkup(
      <RuntimeWorkspace
        domain="synthetic-support"
        role="support:manage"
        state="empty"
        page={{ tickets: [] }}
      />,
    );
    expect(html).toContain("Administrator");
    expect(html).toContain("Create ticket");
    expect(html).not.toContain("Acme");
    expect(html).not.toContain("Import CSV");
  });
  it.each([
    ["empty", "No support tickets yet"],
    ["denied", "Access denied"],
    ["unavailable", "Tickets are unavailable"],
  ] as const)("renders %s recovery", (state, label) =>
    expect(
      renderToStaticMarkup(
        <RuntimeWorkspace
          domain="synthetic-support"
          role="support:read"
          state={state}
        />,
      ),
    ).toContain(label),
  );
});

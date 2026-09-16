import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { RuntimeWorkspace } from "@/app/runtime/runtime-workspace";
import {
  SupportWorkspaceHeader,
  SupportWorkspaceNavigation,
} from "@/components/workspace/SupportWorkspaceShell";
import { loadRuntimeWorkspaceTickets } from "@/lib/service-app/runtime-workspace-view";

const ticket = {
  id: "runtime-1",
  ticketRef: "SV8-RUNTIME-1",
  customerRef: "customer-synthetic",
  customerName: "Synthetic Customer",
  summary: "Synthetic request",
  status: "open",
  priority: "normal",
  source: "runtime_manual",
  createdAt: "2026-09-16T10:00:00Z",
  updatedAt: "2026-09-16T11:00:00Z",
};

describe("Runtime native Support workspace", () => {
  it("uses the shared native shell with the full navigation and truthful unavailable modules", () => {
    const html = renderToStaticMarkup(
      <RuntimeWorkspace
        domain="synthetic-support"
        role="support:read"
        state="ready"
        page={{ tickets: [ticket] }}
        selected={ticket}
      />,
    );
    expect(html).toContain("family-admin");
    expect(html).toContain("Application navigation");
    for (const label of [
      "Overview",
      "Work Desk",
      "Issues Explorer",
      "CX Cockpit",
      "Knowledge Suite",
      "AI Workforce",
      "Settings",
    ])
      expect(html).toContain(label);
    expect(html).toContain("Soon");
    expect(html).not.toContain("total tickets");
    expect(html).not.toContain("Acme");
    expect(html).not.toContain("sessionStorage");
  });
  it("renders truthful page-scoped Overview and unavailable native destinations", () => {
    const overview = renderToStaticMarkup(
      <RuntimeWorkspace
        domain="synthetic-support"
        state="ready"
        view="overview"
        page={{ tickets: [ticket] }}
        selected={ticket}
      />,
    );
    expect(overview).toContain("1 ticket loaded");
    expect(overview).toContain("not a workspace-wide total");
    const unavailable = renderToStaticMarkup(
      <RuntimeWorkspace
        domain="synthetic-support"
        state="ready"
        view="knowledge"
        page={{ tickets: [ticket] }}
      />,
    );
    expect(unavailable).toContain(
      "This Support module is not connected for Runtime yet",
    );
  });
  it("shares header and navigation primitives with native callers", () => {
    expect(typeof SupportWorkspaceHeader).toBe("function");
    expect(typeof SupportWorkspaceNavigation).toBe("function");
    const nativePage = readFileSync(
      `${process.cwd()}/src/app/page.tsx`,
      "utf8",
    );
    expect(nativePage).toContain("<SupportWorkspaceShell");
    expect(nativePage).toContain("<SupportWorkspaceNavigation");
    expect(nativePage).toContain("<SupportWorkspaceHeaderFrame>");
  });
  it("keeps Runtime identity and data paths free of native browser and demo fallbacks", () => {
    const source = [
      "src/app/runtime/page.tsx",
      "src/app/runtime/runtime-workspace.tsx",
    ]
      .map((path) => readFileSync(`${process.cwd()}/${path}`, "utf8"))
      .join("\n");
    for (const forbidden of [
      "AuthService",
      "sessionStorage",
      "localStorage",
      "mock-data",
      "?tenant=",
      '|| "acme"',
    ])
      expect(source).not.toContain(forbidden);
  });
  it("normalizes an unknown view before reading its selected ticket", async () => {
    const list = vi.fn(async () => ({ tickets: [ticket] }));
    const get = vi.fn(async () => ticket);
    const scope = {
      accountId: "account",
      tenantId: "tenant",
      verticalId: "runtime" as const,
      installationId: "installation",
      workspaceId: "workspace",
      subject: "subject",
    };
    const loaded = await loadRuntimeWorkspaceTickets(
      { list, get },
      scope,
      { view: "unknown", ticket: ticket.id, cursor: "cursor" },
    );
    expect(loaded).toMatchObject({
      view: "workspace",
      selected: ticket,
      page: { tickets: [ticket] },
    });
    expect(list).toHaveBeenCalledWith(scope, { limit: 30, cursor: "cursor" });
    expect(get).toHaveBeenCalledWith(scope, ticket.id);
  });
  it("does not read ticket data for a known unavailable native module", async () => {
    const list = vi.fn();
    const get = vi.fn();
    const loaded = await loadRuntimeWorkspaceTickets(
      { list, get },
      {
        accountId: "account",
        tenantId: "tenant",
        verticalId: "runtime",
        installationId: "installation",
        workspaceId: "workspace",
        subject: "subject",
      },
      { view: "knowledge", ticket: ticket.id },
    );
    expect(loaded).toEqual({ view: "knowledge" });
    expect(list).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });
  it("preserves ticket deep links through native Work Desk navigation", () => {
    const html = renderToStaticMarkup(
      <RuntimeWorkspace
        domain="synthetic-support"
        role="support:manage"
        state="ready"
        page={{ tickets: [ticket] }}
        selected={ticket}
        selectionRequested
      />,
    );
    expect(html).toContain("/runtime?view=workspace&amp;ticket=runtime-1");
  });
  it("keeps shared chrome outside ticket CSS and gives the full queue a scroll surface", () => {
    const css = readFileSync(
      `${process.cwd()}/src/app/runtime/runtime.css`,
      "utf8",
    );
    expect(css).not.toMatch(/\.runtime-shell\s+button/);
    expect(css).not.toMatch(/\.runtime-shell\s+aside/);
    expect(css).toMatch(/\.runtime-ticket-scroll\s*{[^}]*overscroll-behavior:\s*contain/s);
  });
});

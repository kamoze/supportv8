// @vitest-environment jsdom
import React, { act } from "react";
import { readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SupportV8Dashboard from "@/app/page";
import { AuthService } from "@/lib/auth-service";

// The dashboard's tab views and modals are split out of page.tsx and loaded on demand.
// These checks keep the split honest: every tab still resolves to its real view, and
// page.tsx does not regrow the inline view bodies.

const roots: Root[] = [];
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const session = { token: "workspace:100", tenantSlug: "acme", email: "person@example.test", name: "Workspace administrator", role: "cx_lead" as const, issuedAt: 100, expiresAt: Date.now() + 600000 };

beforeEach(() => {
  vi.spyOn(AuthService, "getActiveSession").mockReturnValue(session);
  vi.spyOn(AuthService, "restoreRuntimeSession").mockResolvedValue(session);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  Element.prototype.scrollTo = vi.fn();
  vi.stubGlobal("EventSource", class { addEventListener() {} removeEventListener() {} close() {} });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ success: false })));
});
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// portal_composer and gov_members are left out: those two views rely on the automatic JSX
// runtime (no React import), which this vitest setup's classic transform cannot render.
const TABS = [
  "approvals", "workflows", "studio", "knowledge", "studio_marketplace",
  "customers", "ask", "market_workforce", "market_plans", "market_connectors",
  "gov_settings", "gov_audit", "gov_reports", "workforce", "voice", "problems", "trends",
];

it.each(TABS)("loads the %s tab view on demand", async (tab) => {
  window.history.replaceState({}, "", `/?view=cockpit&tab=${tab}`);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<SupportV8Dashboard />));
  await vi.waitFor(async () => {
    await act(async () => {});
    const placeholder = [...container.querySelectorAll('[role="status"]')].find((el) => el.textContent === "Loading…");
    expect(placeholder).toBeUndefined();
  }, { timeout: 10000 });
  expect(container.querySelector("main")?.textContent?.trim().length).toBeGreaterThan(0);
});

it("keeps page.tsx as the shell: views live in their own modules", () => {
  const page = readFileSync(`${process.cwd()}/src/app/page.tsx`, "utf8");
  expect(page.length).toBeLessThan(220_000);
  for (const view of ["OverviewAnalyticsView", "CxCockpitView", "VoiceOperationsView", "CopilotConsoleModal", "VoiceAgentEditModal"]) {
    expect(page).toContain(`import("@/components/views/dashboard/${view}")`);
  }
});

// @vitest-environment jsdom
import React, { act } from "react";
import { existsSync, readFileSync } from "node:fs";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { groupSupportNavigation } from "@/components/FamilyControls";
import { SUPPORT_NAV_ICONS, SUPPORT_SHELL_TOOLS, supportBadgeLabel, supportShellNav } from "@/components/shell/support-nav";
import { SupportFamilyShell } from "@/components/shell/SupportFamilyShell";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const source = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

// The incumbent sidebar's entries for a CX lead, in allNavSections order (ids and labels from page.tsx).
const CX_LEAD_SECTIONS = [
  { title: "AGENTIC RUNTIME", items: [["ask", "AgenticOS Chat"], ["workspace", "Workspace"], ["knowledge", "Learning Graph"], ["studio", "Studio"], ["overview", "Overview"], ["trends", "Trend Radar"]] },
  { title: "ECOSYSTEM", items: [["cx_cockpit", "Applications"], ["problems", "Problem Matrix"], ["issues", "Issues Explorer"], ["customers", "Customers"], ["workforce", "Workforce"], ["studio_marketplace", "Marketplace"], ["market_workforce", "Installed Products"], ["market_connectors", "Connectors"], ["portal_composer", "Support Portal"]] },
  { title: "GOVERNANCE", items: [["gov_audit", "Audit"], ["gov_reports", "Logs"], ["approvals", "Approvals"], ["workflows", "Workflows"], ["policies", "Policies"]] },
  { title: "SETTINGS", items: [["market_plans", "Plan"], ["gov_settings", "Credits"], ["gov_members", "Members"]] },
].map((s) => ({ title: s.title, items: s.items.map(([id, label]) => ({ id, label })) }));

// The family icon set (@kamoze/servicev8-family-ui src/icons.ts).
const KIT_ICONS = ["chat", "home", "workspace", "workforce", "objectives", "scenarios", "knowledge", "integrations", "activity", "applications", "marketplace", "audit", "logs", "api-keys", "users", "plan", "credits", "settings", "tasks", "calendar", "phone", "chart", "bolt", "folder", "sprint", "layers", "flag", "branch", "decision", "change", "package", "building", "user-plus", "search", "sparkle"];

describe("SupportV8 navigation data for the family shell", () => {
  it("keeps the rendered sidebar's entries, labels and order, and adds Voice as a core entry", () => {
    const nav = supportShellNav(groupSupportNavigation(CX_LEAD_SECTIONS, false), { contractor: false });
    expect(nav.map((g) => g.label)).toEqual(["AGENTIC RUNTIME", "ECOSYSTEM", "GOVERNANCE", "SETTINGS"]);
    const flat = nav.flatMap((g) => g.items.map((i) => `${i.id}:${i.label}`));
    expect(flat).toEqual([
      "ask:AgenticOS Chat", "workspace:Workspace", "knowledge:Learning Graph", "studio:Studio", "overview:Overview", "trends:Trend Radar", "voice:Voice",
      "cx_cockpit:Applications", "problems:Problem Matrix", "issues:Issues Explorer", "customers:Customers", "workforce:Workforce", "studio_marketplace:Marketplace", "market_workforce:Installed Products", "market_connectors:Connectors", "portal_composer:Support Portal",
      "gov_audit:Audit", "gov_reports:Logs", "approvals:Approvals", "workflows:Workflows", "policies:Policies",
      "market_plans:Plan", "gov_settings:Credits", "gov_members:Members",
    ]);
    for (const item of nav.flatMap((g) => g.items)) {
      expect(item.href).toBe(`/?tab=${item.id}`);
      expect(KIT_ICONS).toContain(item.icon);
    }
  });

  it("follows the embedded contract: Marketplace and Plan open in Runtime; Voice and settings stay", () => {
    const items = supportShellNav(groupSupportNavigation(CX_LEAD_SECTIONS, false), { contractor: false }).flatMap((g) => g.items);
    expect(items.find((i) => i.id === "studio_marketplace")).toMatchObject({ embedded: "runtime", runtimePath: "/auth/marketplace", runtimeFromOrigin: true });
    expect(items.find((i) => i.id === "market_plans")).toMatchObject({ embedded: "runtime", runtimePath: "/settings/plan" });
    for (const id of ["voice", "gov_settings", "gov_members"]) expect(items.find((i) => i.id === id)?.embedded).toBeUndefined();
  });

  it("keeps the contractor grouping and its role filtering", () => {
    const contractor = [{ title: "Field Operations", items: [{ id: "ask", label: "Field Assistant (AI)" }, { id: "workspace", label: "Field Work Desk" }, { id: "issues", label: "Work Orders Explorer" }] }];
    const nav = supportShellNav(groupSupportNavigation(contractor, true), { contractor: true });
    expect(nav.flatMap((g) => g.items.map((i) => i.id))).toEqual(["workspace", "issues", "ask"]);
    expect(nav.flatMap((g) => g.items).some((i) => i.id === "voice")).toBe(false);
  });

  it("carries badges and has an icon for every view id", () => {
    const nav = supportShellNav([{ title: "X", items: [{ id: "issues", label: "Issues Explorer", badge: 4 }, { id: "problems", label: "Problem Matrix", badge: 0 }] }], { contractor: true });
    expect(nav[0].items[0].badge).toBe(4);
    expect(nav[0].items[1].badge).toBeUndefined();
    for (const icon of Object.values(SUPPORT_NAV_ICONS)) expect(KIT_ICONS).toContain(icon);
  });
  it("gives every count badge an accurate accessible label with {n}", () => {
    const labels = (contractor: boolean) => Object.fromEntries(
      supportShellNav(groupSupportNavigation(CX_LEAD_SECTIONS, false), { contractor }).flatMap((g) => g.items).filter((i) => i.badgeLabel).map((i) => [i.id, i.badgeLabel]),
    );
    expect(labels(false)).toEqual({
      cx_cockpit: "{n} at risk of SLA breach",
      problems: "{n} problems",
      issues: "{n} issues",
      workforce: "{n} in the workforce",
      gov_audit: "{n} audit entries",
      gov_members: "{n} members",
    });
    expect(supportBadgeLabel("issues", true)).toBe("{n} work orders");
    // Every id page.tsx gives a count badge has a label (none falls back to "N pending").
    const counted = [...source("src/app/page.tsx").matchAll(/id: "([a-z_]+)",[^}]*?\n\s+badge: /g)].map((m) => m[1]);
    expect(counted.length).toBeGreaterThanOrEqual(6);
    for (const id of counted) expect(supportBadgeLabel(id, false), id).toBeDefined();
  });
});

describe("SupportFamilyShell", () => {
  it("renders one <sv8-shell> with the sidebar as a leaf element", () => {
    const html = renderToStaticMarkup(
      <SupportFamilyShell mode="embedded" active="workspace" nav={[]} tools={SUPPORT_SHELL_TOOLS} tenant="acme" onNavigate={vi.fn()} onSignOut={vi.fn()} onTool={vi.fn()}>
        <div id="support-workspace">content</div>
      </SupportFamilyShell>,
    );
    // family-ui 0.1.3+ makes app/mode writable, so React renders them directly.
    expect(html).toMatch(/<sv8-shell[^>]*id="support-shell"[^>]*app="support"[^>]*mode="embedded"/);
    expect(html).toMatch(/<sv8-sidebar[^>]*active="workspace"[^>]*sign-out=""[^>]*><\/sv8-sidebar>/);
    expect(html).not.toContain("runtime-url");
    expect(html).toContain('<div id="support-workspace">content</div>');
  });

  const roots: Root[] = [];
  beforeAll(async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    // Register the real vendored elements, exactly as the browser would load them.
    await import("../public/vendor/family-ui/family.js");
  });
  afterEach(() => {
    for (const root of roots.splice(0)) act(() => root.unmount());
    document.body.innerHTML = "";
    delete document.documentElement.dataset.familyTheme;
  });

  async function mount(mode: "standalone" | "embedded", handlers = { onNavigate: vi.fn(), onSignOut: vi.fn(), onTool: vi.fn() }) {
    const nav = supportShellNav(groupSupportNavigation(CX_LEAD_SECTIONS, false), { contractor: false });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    await act(async () => root.render(
      <SupportFamilyShell mode={mode} active="issues" nav={nav} tools={SUPPORT_SHELL_TOOLS} tenant="acme" tenantSub="acme.support.servicev8.com" userName="Ada · CX Lead" {...handlers}>
        <div id="support-workspace">content</div>
      </SupportFamilyShell>,
    ));
    await act(async () => { await customElements.whenDefined("sv8-sidebar"); });
    return { container, handlers };
  }
  const desktopLinks = (c: Element) => [...c.querySelectorAll(".sv8-sidebar-desktop a.sv8-nav-item")] as HTMLAnchorElement[];

  it("hands the navigation to the real sidebar and marks the current view", async () => {
    const { container } = await mount("standalone");
    const shell = container.querySelector("sv8-shell")!;
    expect(shell.getAttribute("app")).toBe("support");
    expect(shell.getAttribute("mode")).toBe("standalone");
    expect(document.documentElement.dataset.app).toBe("support");
    const links = desktopLinks(container);
    expect(links.map((a) => a.dataset.id)).toContain("voice");
    expect(links).toHaveLength(24);
    expect(links.find((a) => a.dataset.id === "issues")?.getAttribute("aria-current")).toBe("page");
    expect(links.find((a) => a.dataset.id === "studio_marketplace")?.getAttribute("href")).toBe("/?tab=studio_marketplace");
  });

  it("hides Runtime-run pages when embedded without a Runtime URL, and keeps Voice", async () => {
    const { container } = await mount("embedded");
    expect(container.querySelector("sv8-shell")!.getAttribute("mode")).toBe("embedded");
    const ids = desktopLinks(container).map((a) => a.dataset.id);
    expect(ids).not.toContain("studio_marketplace");
    expect(ids).not.toContain("market_plans");
    for (const id of ["voice", "gov_settings", "gov_members", "workspace"]) expect(ids).toContain(id);
  });

  it("keeps the theme the early script set on <html> when the shell connects", async () => {
    document.cookie = "sv8-ui=; Max-Age=0; Path=/";
    document.documentElement.dataset.theme = "light";
    document.documentElement.dataset.familyTheme = "light";
    const { container } = await mount("standalone");
    expect(container.querySelector("sv8-shell")!.getAttribute("theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.familyTheme).toBe("light");
    delete document.documentElement.dataset.theme;
  });

  it("follows a mode change from the session without re-mounting", async () => {
    const nav = supportShellNav(groupSupportNavigation(CX_LEAD_SECTIONS, false), { contractor: false });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);
    const render = (mode: "standalone" | "embedded") => root.render(
      <SupportFamilyShell mode={mode} active="issues" nav={nav} tools={SUPPORT_SHELL_TOOLS} tenant="acme" onNavigate={vi.fn()} onSignOut={vi.fn()} onTool={vi.fn()}><main /></SupportFamilyShell>,
    );
    await act(async () => render("standalone"));
    await act(async () => { await customElements.whenDefined("sv8-sidebar"); });
    const shell = container.querySelector("sv8-shell")!;
    expect(shell.getAttribute("mode")).toBe("standalone");
    await act(async () => render("embedded"));
    expect(container.querySelector("sv8-shell")).toBe(shell);
    expect(shell.getAttribute("mode")).toBe("embedded");
    expect(desktopLinks(container).map((a) => a.dataset.id)).not.toContain("market_plans");
  });

  it("lets links marked data-runtime or data-external navigate instead of routing them in the app", async () => {
    const { container, handlers } = await mount("embedded");
    const shell = container.querySelector("sv8-shell")!;
    await act(async () => { shell.setAttribute("runtime-url", "https://runtime.servicev8.com/workspace/acme"); });
    const marketplace = desktopLinks(container).find((a) => a.dataset.id === "studio_marketplace")!;
    expect(marketplace.hasAttribute("data-runtime")).toBe(true);
    const toRuntime = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    marketplace.dispatchEvent(toRuntime);
    expect(toRuntime.defaultPrevented).toBe(false);
    expect(handlers.onNavigate).not.toHaveBeenCalled();

    const sidebar = container.querySelector("sv8-sidebar") as HTMLElement & { nav: unknown };
    await act(async () => { sidebar.nav = [{ items: [{ id: "docs", label: "Docs", href: "https://docs.example.com/", external: true }, { id: "issues", label: "Issues Explorer", href: "/?tab=issues" }] }]; });
    const external = container.querySelector('.sv8-sidebar-desktop a[data-id="docs"]') as HTMLAnchorElement;
    expect(external.hasAttribute("data-external")).toBe(true);
    const toExternal = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    external.dispatchEvent(toExternal);
    expect(toExternal.defaultPrevented).toBe(false);
    expect(handlers.onNavigate).not.toHaveBeenCalled();

    // An ordinary in-app link is still routed through the app.
    const issues = container.querySelector('.sv8-sidebar-desktop a[data-id="issues"]') as HTMLAnchorElement;
    const inApp = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    issues.dispatchEvent(inApp);
    expect(inApp.defaultPrevented).toBe(true);
    expect(handlers.onNavigate).toHaveBeenCalledWith("issues");
  });

  it("routes plain clicks through the app, keeps modified clicks, and wires sign out, Ask and theme", async () => {
    const { container, handlers } = await mount("standalone");
    const voice = desktopLinks(container).find((a) => a.dataset.id === "voice")!;
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    voice.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(handlers.onNavigate).toHaveBeenCalledWith("voice");
    const newTab = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true });
    voice.dispatchEvent(newTab);
    expect(newTab.defaultPrevented).toBe(false);
    expect(handlers.onNavigate).toHaveBeenCalledTimes(1);

    (container.querySelector('.sv8-sidebar-desktop [data-sv8="sign-out"]') as HTMLButtonElement).click();
    expect(handlers.onSignOut).toHaveBeenCalledTimes(1);
    (container.querySelector('.sv8-sidebar-desktop [data-tool="ask"]') as HTMLButtonElement).click();
    expect(handlers.onTool).toHaveBeenCalledWith("ask");

    (container.querySelector('.sv8-sidebar-desktop [data-sv8="theme"]') as HTMLButtonElement).click();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.familyTheme).toBe("light");
  });
});

describe("SupportV8 page on the shell", () => {
  const page = source("src/app/page.tsx");
  it("renders one navigation through SupportFamilyShell and derives the mode from the session", () => {
    expect(page).toContain("<SupportFamilyShell");
    expect(page).not.toContain("<SupportWorkspaceNavigation");
    expect(page).toContain('const shellMode: "standalone" | "embedded" = runtimeHandoff ? "embedded" : "standalone";');
    expect(page).toContain("supportShellNav(groupSupportNavigation(navSections, isContractorRole)");
    expect(page).toMatch(/shellMode === "standalone" && <button[\s\S]{0,400}setIsForgeGwModalOpen\(true\)/);
  });

  it("vendors family-ui 0.1.5 and serves it from the app's own origin with system fonts", () => {
    expect(source("public/vendor/family-ui/VERSION").trim()).toBe("@kamoze/servicev8-family-ui 0.1.5");
    expect(existsSync(`${process.cwd()}/public/vendor/family-ui/family.css`)).toBe(true);
    const layout = source("src/app/layout.tsx");
    expect(layout).toContain('href="/vendor/family-ui/family.css"');
    expect(layout).toContain('import "./support-family-bridge.css"');
    expect(layout).not.toContain("fonts.googleapis.com");
    expect(source("src/components/shell/SupportFamilyShell.tsx")).toContain('"/vendor/family-ui/family.js"');
  });

  it("bridges the app palette onto the family tokens: lime primary, pink selected, charcoal base", () => {
    const bridge = source("src/app/support-family-bridge.css");
    expect(bridge).toMatch(/#support-shell \.btn-primary,[\s\S]*?background: var\(--sv8-lime\) !important/);
    expect(bridge).toMatch(/\[class~="text-\[#2ED8B6\]"\][^{]*\{ color: var\(--sv8-sec-text\); \}/);
    expect(bridge).toContain("--ground: var(--sv8-bg);");
    expect(bridge).toContain("font-family: var(--sv8-font-ui);");
  });
});

describe("SupportFamilyShell badges", () => {
  it("patches counts in place and clears them when they drop to zero", async () => {
    await import("../public/vendor/family-ui/family.js");
    const nav = supportShellNav([{ title: "X", items: [{ id: "issues", label: "Issues Explorer", badge: 2 }] }], { contractor: true });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = (count: number) => root.render(
      <SupportFamilyShell mode="standalone" active="issues" nav={nav} badges={{ issues: count }} tools={[]} tenant="acme" onNavigate={vi.fn()} onSignOut={vi.fn()} onTool={vi.fn()}><main /></SupportFamilyShell>,
    );
    await act(async () => render(3));
    await act(async () => { await customElements.whenDefined("sv8-sidebar"); });
    const badge = () => container.querySelector('.sv8-sidebar-desktop a[data-id="issues"] .sv8-badge')?.textContent;
    expect(badge()).toBe("3");
    const label = () => container.querySelector('.sv8-sidebar-desktop a[data-id="issues"] .sv8-badge')?.getAttribute("aria-label");
    expect(label()).toBe("3 work orders");
    await act(async () => render(5));
    expect(badge()).toBe("5");
    expect(label()).toBe("5 work orders");
    await act(async () => render(0));
    expect(badge()).toBeUndefined();
    act(() => root.unmount());
  });
});

describe("SupportFamilyShell badge labels", () => {
  it("reads Members, Workforce and Audit counts by what they are, not as pending", async () => {
    await import("../public/vendor/family-ui/family.js");
    const nav = supportShellNav(groupSupportNavigation(CX_LEAD_SECTIONS, false), { contractor: false });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const render = (badges: Record<string, number>) => root.render(
      <SupportFamilyShell mode="standalone" active="issues" nav={nav} badges={badges} tools={[]} tenant="acme" onNavigate={vi.fn()} onSignOut={vi.fn()} onTool={vi.fn()}><main /></SupportFamilyShell>,
    );
    await act(async () => render({ gov_members: 4, workforce: 2, gov_audit: 120, cx_cockpit: 1, problems: 3, issues: 7 }));
    await act(async () => { await customElements.whenDefined("sv8-sidebar"); });
    const label = (id: string) => container.querySelector(`.sv8-sidebar-desktop a[data-id="${id}"] .sv8-badge`)?.getAttribute("aria-label");
    expect(label("gov_members")).toBe("4 members");
    expect(label("workforce")).toBe("2 in the workforce");
    expect(label("gov_audit")).toBe("120 audit entries");
    expect(label("cx_cockpit")).toBe("1 at risk of SLA breach");
    expect(label("problems")).toBe("3 problems");
    expect(label("issues")).toBe("7 issues");
    // The drawer copy carries the same label.
    expect(container.querySelector('dialog a[data-id="gov_members"] .sv8-badge')?.getAttribute("aria-label")).toBe("4 members");
    await act(async () => render({ gov_members: 5, workforce: 2, gov_audit: 120, cx_cockpit: 1, problems: 3, issues: 7 }));
    expect(label("gov_members")).toBe("5 members");
    act(() => root.unmount());
  });
});

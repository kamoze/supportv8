"use client";

/**
 * SupportV8 on the shared ServiceV8 family shell (@kamoze/servicev8-family-ui).
 *
 * The sidebar, collapse, theme control and mobile drawer come from
 * /vendor/family-ui/family.js (vendored by scripts/sync-family-ui.mjs). This
 * adapter supplies SupportV8's navigation as data and connects the shell to
 * the app: plain nav clicks go through the app's view switch (links keep their
 * real hrefs), and sign out, the Ask tool, the active view and the theme flow
 * between the two.
 */
import React, { useEffect, useRef, type ReactNode } from "react";
import type { ShellNavGroup, ShellTool } from "./support-nav";

const FAMILY_JS = "/vendor/family-ui/family.js";
let loading: Promise<unknown> | null = null;

/**
 * Load the family elements once per page; they register themselves. A module
 * script tag keeps the vendored file out of the app bundle (served as-is from
 * /vendor/family-ui, no CDN).
 */
export function loadFamilyUi(): Promise<unknown> {
  if (typeof window === "undefined" || !window.customElements) return Promise.resolve();
  if (window.customElements.get("sv8-sidebar")) return Promise.resolve();
  if (!loading) {
    if (!document.querySelector(`script[src="${FAMILY_JS}"]`)) {
      const script = document.createElement("script");
      script.type = "module";
      script.src = FAMILY_JS;
      script.addEventListener("error", () => {
        loading = null;
        script.remove();
        console.error("SupportV8 could not load the family shell from", FAMILY_JS);
      });
      document.head.append(script);
    }
    loading = window.customElements.whenDefined("sv8-sidebar");
  }
  return loading;
}

type SidebarElement = HTMLElement & { nav: ShellNavGroup[]; tools: ShellTool[]; setBadge: (id: string, value: number | string | null) => void };
type Preferences = { theme?: "light" | "dark" };

/** Keep the app's incumbent light-theme bridge (data-family-theme) in step with the shell's theme. */
export function applyFamilyTheme(theme: string | undefined): void {
  if (theme !== "light" && theme !== "dark") return;
  document.documentElement.dataset.familyTheme = theme;
  try { localStorage.setItem("supportFamilyTheme", theme); } catch { /* Optional presentation preference. */ }
}

export function SupportFamilyShell({
  mode,
  runtimeUrl,
  active,
  nav,
  badges = {},
  tools,
  tenant,
  tenantSub,
  userName,
  onNavigate,
  onSignOut,
  onTool,
  children,
}: {
  mode: "standalone" | "embedded";
  /** The tenant's Runtime workspace (v2 hand-off). Used only when embedded. */
  runtimeUrl?: string;
  active: string;
  nav: ShellNavGroup[];
  /** Counts per nav id, patched in place (setBadge) rather than re-rendering the sidebar. */
  badges?: Record<string, number>;
  tools: readonly ShellTool[];
  tenant: string;
  tenantSub?: string;
  userName?: string;
  onNavigate: (id: string) => void;
  onSignOut: () => void;
  onTool: (id: string) => void;
  children: ReactNode;
}) {
  const shellRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<SidebarElement>(null);
  const handlers = useRef({ onNavigate, onSignOut, onTool });
  handlers.current = { onNavigate, onSignOut, onTool };
  const withBadges = (groups: ShellNavGroup[], counts: Record<string, number>) =>
    groups.map((g) => ({ ...g, items: g.items.map(({ badge: _stale, ...i }) => (counts[i.id] ? { ...i, badge: counts[i.id] } : i)) }));
  const data = useRef({ nav, tools, badges });
  data.current = { nav, tools, badges };

  // Load the elements once, then hand the sidebar its data.
  useEffect(() => {
    let live = true;
    void loadFamilyUi();
    void window.customElements?.whenDefined("sv8-sidebar").then(() => {
      const sidebar = sidebarRef.current;
      if (!live || !sidebar) return;
      sidebar.nav = withBadges(data.current.nav, data.current.badges);
      sidebar.tools = [...data.current.tools];
    });
    return () => { live = false; };
  }, []);

  // Navigation changes (role, labels) after the elements are defined.
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (sidebar && window.customElements?.get("sv8-sidebar")) sidebar.nav = withBadges(nav, data.current.badges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav]);
  // Counts change often: patch them in place.
  const badgeKey = JSON.stringify(badges);
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar || !window.customElements?.get("sv8-sidebar")) return;
    for (const group of data.current.nav) for (const item of group.items) sidebar.setBadge(item.id, data.current.badges[item.id] || null);
  }, [badgeKey]);
  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (sidebar && window.customElements?.get("sv8-sidebar")) sidebar.tools = [...tools];
  }, [tools]);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    const shell = shellRef.current;
    if (!sidebar || !shell) return;
    // Keep real links (open in new tab, copy link) but route plain clicks through the app.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a.sv8-nav-item, a.sv8-brand") as HTMLAnchorElement | null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // The shell marks links it sends to Runtime or opens in a new tab (family-ui 0.1.5); let those navigate.
      if (link.matches("[data-runtime], [data-external]")) return;
      event.preventDefault();
      handlers.current.onNavigate(link.classList.contains("sv8-brand") ? "workspace" : link.dataset.id || "workspace");
    };
    const onSignOutEvent = () => handlers.current.onSignOut();
    const onToolEvent = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id) handlers.current.onTool(id);
    };
    const onPreferences = (event: Event) => {
      const detail = (event as CustomEvent<(Preferences & { preferences?: Preferences }) | undefined>).detail;
      applyFamilyTheme(detail?.preferences?.theme ?? detail?.theme);
    };
    sidebar.addEventListener("click", onClick);
    sidebar.addEventListener("sv8-sign-out", onSignOutEvent);
    sidebar.addEventListener("sv8-tool", onToolEvent);
    shell.addEventListener("sv8-preferences", onPreferences);
    shell.addEventListener("sv8-shell-change", onPreferences);
    return () => {
      sidebar.removeEventListener("click", onClick);
      sidebar.removeEventListener("sv8-sign-out", onSignOutEvent);
      sidebar.removeEventListener("sv8-tool", onToolEvent);
      shell.removeEventListener("sv8-preferences", onPreferences);
      shell.removeEventListener("sv8-shell-change", onPreferences);
    };
  }, []);

  return (
    <sv8-shell
      ref={shellRef}
      id="support-shell"
      app="support"
      mode={mode}
      runtime-url={mode === "embedded" ? runtimeUrl : undefined}
      className="family-admin"
      data-testid="support-shell"
    >
      <sv8-sidebar
        ref={sidebarRef}
        id="support-sidebar"
        active={active}
        tenant={tenant}
        tenant-sub={tenantSub}
        user-name={userName}
        home-href="/?tab=workspace"
        nav-label="SupportV8 navigation"
        sign-out=""
      />
      <div className="support-shell-main">
        <a className="family-skip" href="#support-workspace">Skip to workspace</a>
        {children}
      </div>
    </sv8-shell>
  );
}

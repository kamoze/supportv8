/**
 * SupportV8's one navigation, as data for the family shell's <sv8-sidebar>.
 *
 * It is the navigation the app already rendered: the role-filtered entries of
 * `allNavSections` in page.tsx, grouped by `groupSupportNavigation`, with the
 * same ids (destinations), labels, order and badges. Two additions follow the
 * family decisions: Voice is a core entry in both modes (it was reachable only
 * from Overview links or ?tab=voice), and Marketplace and Plan follow the
 * embedded-mode contract (they open in Runtime when embedded).
 *
 * Navigation consolidation (about 30 entries to 14) is a later plan step.
 */

/** Mirrors @kamoze/servicev8-family-ui NavGroup/NavItem (the vendored build ships no types). */
export interface ShellNavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
  /** Accessible badge text; "{n}" is replaced by the count (family-ui 0.1.5). */
  badgeLabel?: string;
  embedded?: "show" | "hide" | "runtime";
  runtimePath?: string;
  runtimeFromOrigin?: boolean;
}
export interface ShellNavGroup {
  label?: string;
  items: ShellNavItem[];
}
export interface ShellTool {
  id: string;
  label: string;
  icon?: string;
}

/** Family icon per SupportV8 view id. */
export const SUPPORT_NAV_ICONS: Readonly<Record<string, string>> = Object.freeze({
  ask: "chat",
  workspace: "workspace",
  knowledge: "knowledge",
  studio: "sparkle",
  overview: "chart",
  trends: "activity",
  voice: "phone",
  cx_cockpit: "applications",
  problems: "bolt",
  issues: "tasks",
  customers: "users",
  workforce: "workforce",
  studio_marketplace: "marketplace",
  market_workforce: "package",
  market_connectors: "integrations",
  portal_composer: "building",
  gov_audit: "audit",
  gov_reports: "logs",
  approvals: "decision",
  workflows: "scenarios",
  policies: "flag",
  market_plans: "plan",
  gov_settings: "settings",
  gov_members: "user-plus",
});

/** Ecosystem pages Runtime runs: opened in Runtime when SupportV8 is embedded. */
const RUNTIME_PAGES: Readonly<Record<string, Pick<ShellNavItem, "embedded" | "runtimePath" | "runtimeFromOrigin">>> = Object.freeze({
  studio_marketplace: { embedded: "runtime", runtimePath: "/auth/marketplace", runtimeFromOrigin: true },
  market_plans: { embedded: "runtime", runtimePath: "/settings/plan" },
});

/** What each count badge means, for screen readers (the shell's default reads "N pending"). */
export function supportBadgeLabel(id: string, contractor: boolean): string | undefined {
  switch (id) {
    case "cx_cockpit": return "{n} at risk of SLA breach";
    case "problems": return "{n} problems";
    case "issues": return contractor ? "{n} work orders" : "{n} issues";
    case "workforce": return "{n} in the workforce";
    case "gov_audit": return "{n} audit entries";
    case "gov_members": return "{n} members";
    default: return undefined;
  }
}

export const SUPPORT_SHELL_TOOLS: readonly ShellTool[] = Object.freeze([{ id: "ask", label: "Ask supportV8", icon: "sparkle" }]);

/** The real address of a view, so links can be opened in a new tab or copied. */
export function supportViewHref(id: string): string {
  return `/?tab=${encodeURIComponent(id)}`;
}

export function supportShellNav(
  sections: { title: string; items: { id: string; label: string; badge?: number }[] }[],
  options: { contractor: boolean },
): ShellNavGroup[] {
  const groups: ShellNavGroup[] = sections.map((section) => ({
    label: section.title,
    items: section.items.map((item) => ({
      id: item.id,
      label: item.label,
      href: supportViewHref(item.id),
      icon: SUPPORT_NAV_ICONS[item.id] ?? "workspace",
      ...(item.badge ? { badge: item.badge } : {}),
      ...(supportBadgeLabel(item.id, options.contractor) ? { badgeLabel: supportBadgeLabel(item.id, options.contractor) } : {}),
      ...(RUNTIME_PAGES[item.id] ?? {}),
    })),
  }));
  // Voice is core in both modes for every role that may open it (the tab guard allows it for non-contractors).
  if (!options.contractor && groups.length && !groups.some((g) => g.items.some((i) => i.id === "voice"))) {
    groups[0] = { ...groups[0], items: [...groups[0].items, { id: "voice", label: "Voice", href: supportViewHref("voice"), icon: SUPPORT_NAV_ICONS.voice }] };
  }
  return groups;
}

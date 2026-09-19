"use client";
import React, { type ComponentType, type ReactNode } from "react";
import {
  Briefcase,
  LayoutDashboard,
  MessageSquare,
  Target,
  Cpu,
  Users,
  PhoneCall,
  TrendingUp,
  Brain,
  Clock,
  ShoppingBag,
  CreditCard,
  Settings,
  User,
  ShieldCheck,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Plug,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  LogOut,
} from "@/components/ui/FlatIcon";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { FamilyThemeToggle } from "@/components/FamilyControls";

export type WorkspaceNavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  available?: boolean;
  badge?: number;
};
export type WorkspaceNavSection = { title: string; items: WorkspaceNavItem[] };
export const fullSupportNavigation: WorkspaceNavSection[] = [
  {
    title: "Work Desk",
    items: [
      { id: "workspace", label: "Work Desk", icon: Briefcase, available: true },
      { id: "problems", label: "Problem Matrix", icon: AlertTriangle },
      {
        id: "issues",
        label: "Issues Explorer",
        icon: MessageSquare,
        available: true,
      },
      { id: "cx_cockpit", label: "CX Cockpit", icon: Target },
    ],
  },
  {
    title: "Core Intelligence",
    items: [
      {
        id: "overview",
        label: "Overview",
        icon: LayoutDashboard,
        available: true,
      },
      { id: "studio", label: "Autonomous Studio", icon: Cpu },
      { id: "trends", label: "Trend Radar", icon: TrendingUp },
      { id: "knowledge", label: "Knowledge Suite", icon: Brain },
      { id: "portal_composer", label: "Support Portal", icon: LayoutDashboard },
    ],
  },
  {
    title: "Workforce",
    items: [
      { id: "workforce", label: "Workforce", icon: Users },
      { id: "ask", label: "AgenticOS Chat", icon: MessageSquare },
      { id: "approvals", label: "Approvals", icon: CheckCircle2 },
      { id: "workflows", label: "Workflows", icon: Layers },
      { id: "gov_audit", label: "Audit & Logs", icon: ShieldCheck },
    ],
  },
  {
    title: "Marketplace",
    items: [
      {
        id: "studio_marketplace",
        label: "Browse Marketplace",
        icon: ShoppingBag,
      },
      { id: "market_workforce", label: "Installed Products", icon: Users },
      { id: "market_connectors", label: "Connectors", icon: Plug },
    ],
  },
  {
    title: "Settings",
    items: [
      { id: "gov_settings", label: "Settings", icon: Settings },
      { id: "gov_members", label: "Members", icon: User },
      { id: "market_plans", label: "Plans & Credits", icon: CreditCard },
      { id: "policies", label: "Policies & Rules", icon: Shield },
      { id: "gov_reports", label: "Reports", icon: FileText },
    ],
  },
];

export function SupportWorkspaceShell({
  navigation,
  children,
  mobileOpen = false,
  onCloseMobile,
  className = "",
}: {
  navigation: ReactNode;
  children: ReactNode;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`family-admin flex h-screen bg-[#0B1017] text-[#EAF1F8] font-sans overflow-hidden ${className}`}
    >
      <a className="family-skip" href="#support-workspace">
        Skip to workspace
      </a>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      {navigation}
      {children}
    </div>
  );
}

export function SupportWorkspaceNavigation({
  sections,
  activeId,
  collapsed = false,
  mobileOpen = false,
  onToggleCollapsed,
  onCloseMobile,
  onSelect,
  hrefFor,
  identity,
  roleLabel,
  footerAction,
  navigationRef,
}: {
  sections: WorkspaceNavSection[];
  activeId: string;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onToggleCollapsed?: () => void;
  onCloseMobile?: () => void;
  onSelect?: (id: string) => void;
  hrefFor?: (id: string) => string;
  identity: string;
  roleLabel: string;
  footerAction?: ReactNode;
  navigationRef?: React.Ref<HTMLElement>;
}) {
  return (
    <aside
      ref={navigationRef}
      id="support-navigation"
      aria-label="Application navigation"
      data-mobile-open={mobileOpen}
      className={`fixed inset-y-0 left-0 z-30 flex h-screen w-64 shrink-0 flex-col border-r border-[var(--line)] bg-[#0C121A] transition-[width,transform] duration-200 ease-in-out md:relative md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:w-[72px]" : "md:w-64"}`}
    >
      <div
        className={`p-4 border-b border-[var(--line)] flex items-center ${collapsed ? "justify-center flex-col gap-2" : "justify-between"}`}
      >
        <SupportV8Logo size={32} showText={!collapsed} />
        <button
          type="button"
          onClick={onCloseMobile}
          className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[#121A24] text-[#8E9AA8] md:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="btn btn-secondary hidden cursor-pointer p-1.5 text-[#8E9AA8] md:inline-flex"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-expanded={!collapsed}
            aria-controls="support-navigation"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {sections.map((section, index) => (
          <div key={section.title} className="space-y-1">
            {!collapsed ? (
              <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold text-[#6B7C8D] uppercase tracking-wider font-mono">
                {section.title}
              </div>
            ) : index ? (
              <div className="border-t border-[var(--line)] my-2" />
            ) : null}
            {section.items.map((item) => {
              const Icon = item.icon,
                active = item.id === activeId;
              const content = (
                <>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon aria-hidden className="w-4 h-4" />
                    <span className={collapsed ? "sr-only" : "truncate"}>
                      {item.label}
                    </span>
                  </span>
                  {item.available === false && !collapsed && (
                    <span className="text-[9px] text-[#8E9AA8]">Soon</span>
                  )}
                  {item.badge !== undefined && item.badge > 0 && !collapsed && (
                    <span className="pill text-[10px] py-0 px-1.5">
                      {item.badge}
                    </span>
                  )}
                  {item.badge !== undefined && item.badge > 0 && collapsed && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#F5A623] ring-2 ring-[#0C121A]" />
                  )}
                </>
              );
              const cls = `${collapsed ? "relative w-10 h-10 mx-auto justify-center" : "w-full justify-between px-3 py-2"} flex items-center rounded-lg text-xs font-medium transition-[color,background-color,border-color] ${active ? "bg-[#2ED8B6]/12 text-[#2ED8B6] border border-[#2ED8B6]/40" : "text-[#B4C2D0] hover:text-[#EAF1F8] hover:bg-[#18222E]/80 border border-transparent"}`;
              return hrefFor ? (
                <a
                  key={item.id}
                  href={hrefFor(item.id)}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={cls}
                >
                  {content}
                </a>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect?.(item.id)}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  className={cls}
                >
                  {content}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-[var(--line)] bg-[#0B1017]/50">
        <div
          className={`flex ${collapsed ? "flex-col" : "items-center justify-between"} gap-2`}
        >
          <span className="min-w-0">
            <strong className="block truncate text-xs text-[#EAF1F8]">
              {identity}
            </strong>
            {!collapsed && (
              <span className="text-[9px] text-[#2ED8B6] uppercase tracking-wider">
                {roleLabel}
              </span>
            )}
          </span>
          {footerAction}
        </div>
      </div>
    </aside>
  );
}

export function SupportWorkspaceHeader({
  activeLabel,
  tenantSlug,
  onOpenNavigation,
  children,
}: {
  activeLabel: string;
  tenantSlug: string;
  onOpenNavigation?: () => void;
  children?: ReactNode;
}) {
  return (
    <SupportWorkspaceHeaderFrame>
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onOpenNavigation}
          className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] bg-[#121A24] text-[#8E9AA8] md:hidden"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs">
          <span className="flex items-center tracking-[-0.035em] font-sans shrink-0">
            <span className="text-white font-extrabold text-sm">support</span>
            <span className="text-[#2ED8B6] font-mono font-extrabold text-sm ml-0.5">
              v8
            </span>
          </span>
          <span className="text-[#6B7C8D] font-mono">/</span>
          <span className="text-[#EAF1F8] font-bold font-mono text-xs truncate max-w-[130px] sm:max-w-[200px]">
            {activeLabel}
          </span>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#121A24] border border-[var(--line)] text-[10px] font-mono text-[#8E9AA8]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2ED8B6]" />
          <strong className="text-[#EAF1F8]">
            {tenantSlug}.support.servicev8.com
          </strong>
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <FamilyThemeToggle />
        {children}
      </div>
    </SupportWorkspaceHeaderFrame>
  );
}

export function SupportWorkspaceHeaderFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <header className="family-header sticky top-0 z-20 bg-[#0B1017]/95 backdrop-blur-md border-b border-[var(--line)] px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 select-none">
      {children}
    </header>
  );
}

export function WorkspaceUnavailable({ title }: { title: string }) {
  return (
    <section
      className="card min-h-[420px] px-6 py-12 flex items-center justify-center"
      aria-labelledby="module-unavailable-title"
    >
      <div className="max-w-xl text-center space-y-4">
        <Shield className="mx-auto h-6 w-6 text-[#8E9AA8]" aria-hidden />
        <h1
          id="module-unavailable-title"
          className="text-xl font-bold text-[#EAF1F8]"
        >
          {title}
        </h1>
        <p className="text-sm text-[#B4C2D0]">
          This Support module is not connected for Runtime yet. Your verified
          workspace remains active; choose Overview, Work Desk, or Issues
          Explorer to continue.
        </p>
      </div>
    </section>
  );
}

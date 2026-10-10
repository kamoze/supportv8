import { type ComponentType } from "react";
import {
  Briefcase,
  LayoutDashboard,
  MessageSquare,
  Target,
  Users,
  TrendingUp,
  Brain,
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
} from "@/components/ui/FlatIcon";

export interface WorkspaceNavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  available?: boolean;
  badge?: number;
  roles?: string[];
}

export interface WorkspaceNavSection {
  title: string;
  items: WorkspaceNavItem[];
}

export const canonicalSupportNavigation: WorkspaceNavSection[] = [
  {
    title: "Work Desk",
    items: [
      { id: "workspace", label: "Work Desk", icon: Briefcase, available: true },
      { id: "problems", label: "Problem Matrix", icon: AlertTriangle },
      { id: "issues", label: "Issues Explorer", icon: MessageSquare, available: true },
      { id: "cx_cockpit", label: "CX Cockpit", icon: Target },
    ],
  },
  {
    title: "Core Intelligence",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard, available: true },
      { id: "trends", label: "Trend Radar", icon: TrendingUp },
      { id: "knowledge", label: "Knowledge Suite", icon: Brain },
    ],
  },
  {
    title: "Workforce",
    items: [
      { id: "workforce", label: "Workforce", icon: Users },
      { id: "ask", label: "AgenticOS Chat", icon: MessageSquare },
      { id: "workflows", label: "Workflows", icon: Layers },
      { id: "approvals", label: "Approvals", icon: CheckCircle2 },
    ],
  },
  {
    title: "Governance",
    items: [
      { id: "gov_audits", label: "Audits", icon: ShieldCheck },
      { id: "gov_logs", label: "Logs", icon: FileText },
      { id: "policies", label: "Policies", icon: Shield },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { id: "studio_marketplace", label: "Browse Marketplace", icon: ShoppingBag },
      { id: "market_workforce", label: "Installed Products", icon: Users },
      { id: "market_connectors", label: "Connectors", icon: Plug },
    ],
  },
  {
    title: "Settings",
    items: [
      { id: "gov_settings", label: "Company Details", icon: Settings },
      { id: "gov_members", label: "User Management", icon: User },
      { id: "gov_api_keys", label: "API Keys", icon: ShieldAlert, roles: ["support:manage", "support_cx_lead"] },
      { id: "market_plans", label: "Plans and Credits", icon: CreditCard },
    ],
  },
];

export function filterNavigationForRole(
  sections: WorkspaceNavSection[],
  role?: string
): WorkspaceNavSection[] {
  const isManage = role === "support:manage" || role === "support_cx_lead";
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles || item.roles.length === 0) return true;
        if (isManage) return true;
        return item.roles.includes(role || "");
      }),
    }))
    .filter((section) => section.items.length > 0);
}

"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { groupSupportNavigation } from "@/components/FamilyControls";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  Bot,
  Box,
  Brain,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Flame,
  Gauge,
  Globe,
  HardHat,
  Headphones,
  HeartPulse,
  Key,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Lightbulb,
  List,
  Lock,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  PhoneCall,
  Play,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Server,
  Settings,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Sparkles,
  Star,
  CornerDownLeft,
  Target,
  Terminal,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Volume2,
  Wrench,
  X,
  Zap,
} from "@/components/ui/FlatIcon";
import { SupportWorkspaceHeaderFrame } from "@/components/workspace/SupportWorkspaceShell";
import { SupportFamilyShell } from "@/components/shell/SupportFamilyShell";
import { SUPPORT_SHELL_TOOLS, supportShellNav } from "@/components/shell/support-nav";
import { SoundAlertToggle } from "@/components/SoundAlertToggle";
import { soundAlertService } from "@/lib/services/sound-alert-service";
import type {
  Issue,
  Problem,
  Insight,
  KnowledgeArticle,
  KnowledgeGap,
  KnowledgeProposal,
  KnowledgeDocument,
  KnowledgeWebSource,
  StaleWorkCandidate,
  SourceConnector,
  SupportPolicy,
  OverviewMetrics,
  OperatingMode,
  PriorityLevel,
  SentimentClass,
  TicketTimelineEvent,
  TicketMessageItem,
  CustomerProfile,
} from "@/lib/types";
import { DEFAULT_RAG_ASSISTANT } from "@/lib/types";
import type {
  MarketplaceConnector,
  MarketplaceWorkforceItem,
  MarketplacePlan,
  TenantMember,
  TenantSettingConfig,
  ComplianceAuditReport,
  TenantAuditLog,
} from "@/lib/types/marketplace-types";
import {
  INITIAL_CONNECTORS,
  INITIAL_WORKFORCE_CATALOG,
  INITIAL_PLANS,
  INITIAL_SETTINGS,
} from "@/lib/services/marketplace-service";

import { FocusedWorkspaceView } from "@/components/views/FocusedWorkspaceView";
import { OperatorProfileEditor } from "@/components/OperatorProfileEditor";
import dynamic from "next/dynamic";
import { DashboardModalLoading, DashboardViewLoading } from "@/components/views/dashboard/DashboardViewLoading";
import { IssuesExplorerView } from "@/components/views/dashboard/IssuesExplorerView";
import { FloatingPageGuide } from "@/components/FloatingPageGuide";
import { GlobalLandingView } from "@/components/GlobalLandingView";
import { TenantLandingView } from "@/components/TenantLandingView";
import { SignupModal } from "@/components/SignupModal";
import { SignInModal } from "@/components/SignInModal";
import { DemoAccessModal } from "@/components/DemoAccessModal";
import { WorkforceAvatar } from "@/components/WorkforceAvatar";
import { runtimeTicketHref } from "@/lib/service-app/runtime-native-workdesk";
import { RuntimeNativeWorkdesk } from "@/components/workspace/RuntimeNativeWorkdesk";
import { AuthService, isRuntimeHandoffSession, runtimeShellUrl, type AuthSession } from "@/lib/auth-service";
import { useSupportDemoEnabled } from "@/components/demo/useSupportDemoEnabled";
import { demoPersonasFor } from "@/components/demo/demo-personas";
import { canChangeOperatingMode, operatingModeLabel, tenantOperatingMode, type TenantOperatingMode } from "@/lib/operating-mode";
import { supportRoleLabel } from "@/lib/auth/role-presentation";
import {
  browserTenantSlugFromHostname,
  resolveBrowserWorkspace,
} from "@/lib/tenant-host";
import { knowledgev8Connector } from "@/lib/connectors/knowledgev8-connector";
import { db } from "@/lib/db/mock-data";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  employeeId?: string;
  employeeName?: string;
  employeeRole?: string;
  employeeAvatar?: string;
  citations?: Array<{ type: string; id: string; title: string }>;
  suggestedActions?: Array<{ label: string; action: string; targetTab?: string; payload?: any }>;
  timestamp: string;
}

const EMPTY_CONNECTORS = INITIAL_CONNECTORS.map((connector) => ({
  ...connector,
  isSubscribed: false,
  status: "available" as const,
  eventsPerDay: 0,
  endpointUrl: undefined,
  configFields: connector.configFields.map(({ value: _value, ...field }) => field),
}));
const EMPTY_MARKETPLACE_WORKFORCE = INITIAL_WORKFORCE_CATALOG.map((employee) => ({
  ...employee,
  isHired: false,
}));
const EMPTY_PLANS = INITIAL_PLANS.map((plan) => ({
  ...plan,
  isCurrent: false,
  badge: plan.badge === "CURRENT PLAN" ? undefined : plan.badge,
  actionLabel: plan.id === "plan_starter" ? "CHOOSE PLAN" : plan.actionLabel,
  actionNote: plan.id === "plan_starter" ? undefined : plan.actionNote,
}));

function EmptyAnalyticsState({
  onOpenWorkDesk,
  onOpenChannels,
}: {
  onOpenWorkDesk: () => void;
  onOpenChannels: () => void;
}) {
  return (
    <section className="card min-h-[420px] px-6 py-12 flex items-center justify-center" aria-labelledby="empty-analytics-title">
      <div className="max-w-xl text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-xl border border-[var(--line-2)] bg-[#18222E] flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-[#2ED8B6]" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 id="empty-analytics-title" className="text-xl font-bold text-[#EAF1F8]">
            Analytics Pending
          </h1>
          <p className="text-xs text-[#B4C2D0] leading-relaxed">
            No conversation history or metrics recorded yet. Inbound customer chats route to the active queue.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <button type="button" onClick={onOpenWorkDesk} className="btn btn-primary justify-center">
            <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
            Open Work Desk
          </button>
          <button type="button" onClick={onOpenChannels} className="btn btn-secondary justify-center">
            <Plug className="w-3.5 h-3.5" aria-hidden="true" />
            Connect a channel
          </button>
        </div>
      </div>
    </section>
  );
}

// Tab views and modals are code-split: each loads only when first opened.
const CustomerProfilesView = dynamic(() => import("@/components/views/CustomerProfilesView").then((m) => m.CustomerProfilesView), { loading: DashboardViewLoading });
const AskWorkspaceView = dynamic(() => import("@/components/views/AskWorkspaceView").then((m) => m.AskWorkspaceView), { loading: DashboardViewLoading });
const MarketplaceConnectorsView = dynamic(() => import("@/components/views/MarketplaceConnectorsView").then((m) => m.MarketplaceConnectorsView), { loading: DashboardViewLoading });
const StudioMarketplaceHubView = dynamic(() => import("@/components/views/StudioMarketplaceHubView").then((m) => m.StudioMarketplaceHubView), { loading: DashboardViewLoading });
const MarketplaceWorkforceView = dynamic(() => import("@/components/views/MarketplaceWorkforceView").then((m) => m.MarketplaceWorkforceView), { loading: DashboardViewLoading });
const MarketplacePlansView = dynamic(() => import("@/components/views/MarketplacePlansView").then((m) => m.MarketplacePlansView), { loading: DashboardViewLoading });
const GovernanceSettingsView = dynamic(() => import("@/components/views/GovernanceSettingsView").then((m) => m.GovernanceSettingsView), { loading: DashboardViewLoading });
const GovernanceMembersView = dynamic(() => import("@/components/views/GovernanceMembersView").then((m) => m.GovernanceMembersView), { loading: DashboardViewLoading });
const GovernanceReportsView = dynamic(() => import("@/components/views/GovernanceReportsView").then((m) => m.GovernanceReportsView), { loading: DashboardViewLoading });
const GovernanceAuditLogsView = dynamic(() => import("@/components/views/GovernanceAuditLogsView").then((m) => m.GovernanceAuditLogsView), { loading: DashboardViewLoading });
const WorkforceApprovalsView = dynamic(() => import("@/components/views/WorkforceApprovalsView").then((m) => m.WorkforceApprovalsView), { loading: DashboardViewLoading });
const WorkforceWorkflowsView = dynamic(() => import("@/components/views/WorkforceWorkflowsView").then((m) => m.WorkforceWorkflowsView), { loading: DashboardViewLoading });
const AutonomousStudioView = dynamic(() => import("@/components/views/AutonomousStudioView").then((m) => m.AutonomousStudioView), { loading: DashboardViewLoading });
const KnowledgeSuiteView = dynamic(() => import("@/components/views/KnowledgeSuiteView").then((m) => m.KnowledgeSuiteView), { loading: DashboardViewLoading });
const PortalComposerView = dynamic(() => import("@/components/views/PortalComposerView").then((m) => m.PortalComposerView), { loading: DashboardViewLoading });
const PoliciesAndRulesView = dynamic(() => import("@/components/views/PoliciesAndRulesView").then((m) => m.PoliciesAndRulesView), { loading: DashboardViewLoading });
const OverviewAnalyticsView = dynamic(() => import("@/components/views/dashboard/OverviewAnalyticsView").then((m) => m.OverviewAnalyticsView), { loading: DashboardViewLoading });
const CxCockpitView = dynamic(() => import("@/components/views/dashboard/CxCockpitView").then((m) => m.CxCockpitView), { loading: DashboardViewLoading });
const WorkforceDirectoryView = dynamic(() => import("@/components/views/dashboard/WorkforceDirectoryView").then((m) => m.WorkforceDirectoryView), { loading: DashboardViewLoading });
const VoiceOperationsView = dynamic(() => import("@/components/views/dashboard/VoiceOperationsView").then((m) => m.VoiceOperationsView), { loading: DashboardViewLoading });
const ProblemsView = dynamic(() => import("@/components/views/dashboard/ProblemsView").then((m) => m.ProblemsView), { loading: DashboardViewLoading });
const TrendRadarView = dynamic(() => import("@/components/views/dashboard/TrendRadarView").then((m) => m.TrendRadarView), { loading: DashboardViewLoading });
const InviteMemberModal = dynamic(() => import("@/components/views/dashboard/InviteMemberModal").then((m) => m.InviteMemberModal), { loading: DashboardModalLoading });
const ConnectorConfigModal = dynamic(() => import("@/components/views/dashboard/ConnectorConfigModal").then((m) => m.ConnectorConfigModal), { loading: DashboardModalLoading });
const EscalationModal = dynamic(() => import("@/components/views/dashboard/EscalationModal").then((m) => m.EscalationModal), { loading: DashboardModalLoading });
const CopilotConsoleModal = dynamic(() => import("@/components/views/dashboard/CopilotConsoleModal").then((m) => m.CopilotConsoleModal), { loading: DashboardModalLoading });
const BroadcastModal = dynamic(() => import("@/components/views/dashboard/BroadcastModal").then((m) => m.BroadcastModal), { loading: DashboardModalLoading });
const WorkAssignModal = dynamic(() => import("@/components/views/dashboard/WorkAssignModal").then((m) => m.WorkAssignModal), { loading: DashboardModalLoading });
const VoiceProvisionModal = dynamic(() => import("@/components/views/dashboard/VoiceProvisionModal").then((m) => m.VoiceProvisionModal), { loading: DashboardModalLoading });
const PermissionScopesModal = dynamic(() => import("@/components/views/dashboard/PermissionScopesModal").then((m) => m.PermissionScopesModal), { loading: DashboardModalLoading });
const VoiceAgentEditModal = dynamic(() => import("@/components/views/dashboard/VoiceAgentEditModal").then((m) => m.VoiceAgentEditModal), { loading: DashboardModalLoading });
const ForgeGwModal = dynamic(() => import("@/components/views/dashboard/ForgeGwModal").then((m) => m.ForgeGwModal), { loading: DashboardModalLoading });

export default function SupportV8Dashboard() {
  // Global View Mode & Multi-Tenant Routing
  const [operatorSession, setOperatorSession] = useState<AuthSession | null>(() => AuthService.getActiveSession());
  // Demo sandbox (personas, demo access modal) only when the deployment enables it.
  const demoEnabled = useSupportDemoEnabled();
  const runtimeHandoff = isRuntimeHandoffSession(operatorSession);
  const [currentTenantSlug, setCurrentTenantSlug] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hostedTenant = browserTenantSlugFromHostname(window.location.hostname);
      if (hostedTenant) return hostedTenant;
      const active = AuthService.getActiveSession();
      if (active?.tenantSlug) return active.tenantSlug;
      const params = new URLSearchParams(window.location.search);
      const tenant = params.get("tenant") || params.get("slug");
      if (tenant) return tenant;
    }
    return "acme";
  });
  const [viewMode, setViewMode] = useState<"cockpit" | "global_landing" | "tenant_landing">("global_landing");
  const [isSignupModalOpen, setIsSignupModalOpen] = useState<boolean>(false);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState<boolean>(false);
  const [signInPrefillEmail, setSignInPrefillEmail] = useState<string>("");
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);
  const [targetDemoSlug, setTargetDemoSlug] = useState<string>("acme");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const loadedTenantSlugRef = useRef<string | null>(null);
  const tenantFetchGenerationRef = useRef(0);
  const pendingIssueUpdatesRef = useRef(new Set<string>());

  // Gated Demo Access Handler
  const handleRequestDemoAccess = (slug: string = "acme") => {
    const isUnlocked = typeof window !== "undefined" && sessionStorage.getItem("sv8_demo_unlocked") === "true";
    if (isUnlocked) {
      setCurrentTenantSlug(slug);
      setViewMode("tenant_landing");
    } else {
      setTargetDemoSlug(slug);
      setIsDemoModalOpen(true);
    }
  };

  // Secure Logout Handler
  const handleLogout = () => {
    AuthService.clearSession();
    setOperatorSession(null);

    // Clean URL search parameters (remove ?view=cockpit, ?admin=true, ?tab=...)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("view");
      url.searchParams.delete("admin");
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.pathname);
    }

    setViewMode("global_landing");
    notify("You have logged out of the SupportV8 Cockpit securely", "info");
  };

  // Navigation & Active View
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [studioSubTab, setStudioSubTab] = useState<"workflows" | "templates" | "simulator" | "sweeps" | "setup" | "fleet">("workflows");
  const [studioEmployeeId, setStudioEmployeeId] = useState<string>("emp_support_lead");
  // The tenant's stored AI mode from /api/policies; null means "Not set" (never a default).
  const [operatingMode, setOperatingMode] = useState<TenantOperatingMode | null>(null);
  const [isSavingOperatingMode, setIsSavingOperatingMode] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [rawSourceIssue, setRawSourceIssue] = useState<Issue | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  // Search & Multi-Turn Chat Modal with AI Employee selector
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [showModalPrompts, setShowModalPrompts] = useState<boolean>(true);
  const [chatQuery, setChatQuery] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatResponse, setChatResponse] = useState<any | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("emp_rag_intelligence");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Web Crawler Form State
  const [crawlUrl, setCrawlUrl] = useState<string>("https://docs.acme.com/identity/sso-saml");
  const [crawlCategory, setCrawlCategory] = useState<string>("auth_sso");
  const [crawlLoading, setCrawlLoading] = useState<boolean>(false);

  // Proactive Broadcast Modal
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState<boolean>(false);
  const [broadcastProblem, setBroadcastProblem] = useState<Problem | null>(null);
  const [broadcastDraft, setBroadcastDraft] = useState<any | null>(null);
  const [broadcastSuccessMsg, setBroadcastSuccessMsg] = useState<string | null>(null);


  // Data States
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [workforce, setWorkforce] = useState<any[]>([]);
  const [voiceData, setVoiceData] = useState<{
    phoneConfigs: any[];
    sessions: any[];
  }>({ phoneConfigs: [], sessions: [] });
  const [verticals, setVerticals] = useState<any[]>([]);
  const [selectedVertical, setSelectedVertical] = useState<string>("orderv8");
  const [selectedVerticalOp, setSelectedVerticalOp] = useState<string>("order.lookup");
  const [verticalPayloadText, setVerticalPayloadText] = useState<string>('{\n  "orderId": "ORD-99412",\n  "customerId": "CUST-8821"\n}');
  const [verticalDispatchResult, setVerticalDispatchResult] = useState<any | null>(null);
  const [verticalDispatchLoading, setVerticalDispatchLoading] = useState<boolean>(false);

  // AI Workforce Roster & Work Assignment States
  const [workforceFilter, setWorkforceFilter] = useState<"all" | "employees" | "interns" | "catalog">("all");
  const [isWorkAssignModalOpen, setIsWorkAssignModalOpen] = useState<boolean>(false);
  const [selectedEmployeeForAssign, setSelectedEmployeeForAssign] = useState<any | null>(null);
  const [assignTicketId, setAssignTicketId] = useState<string>("");
  const [assignDescription, setAssignDescription] = useState<string>("");
  const [isAssigningWork, setIsAssigningWork] = useState<boolean>(false);

  // CX Manager Cockpit States (6 Core Pillars + Performance Funnel)
  const [cxSubView, setCxSubView] = useState<"funnel" | "sla" | "health" | "qa" | "voc" | "queue" | "standup">("funnel");
  const [slaData, setSlaData] = useState<{
    attainmentRate: number;
    totalTracked: number;
    healthyCount: number;
    atRiskCount: number;
    breachedCount: number;
    tickets: any[];
  }>({ attainmentRate: 0, totalTracked: 0, healthyCount: 0, atRiskCount: 0, breachedCount: 0, tickets: [] });

  const [customerHealthData, setCustomerHealthData] = useState<{
    avgHealthScore: number;
    totalArrAtRisk: number;
    criticalCount: number;
    concerningCount: number;
    healthyCount: number;
    activeVipChurnAlerts: any[];
    accounts: any[];
  }>({ avgHealthScore: 0, totalArrAtRisk: 0, criticalCount: 0, concerningCount: 0, healthyCount: 0, activeVipChurnAlerts: [], accounts: [] });

  const [healthViewMode, setHealthViewMode] = useState<"card" | "list">("card");
  const [selectedAccountForForm, setSelectedAccountForForm] = useState<any | null>(null);
  const [accountRetentionNote, setAccountRetentionNote] = useState<string>("");

  const [qaData, setQaData] = useState<{
    overallQaAverage: number;
    aiEmployeeAverage: number;
    humanAgentAverage: number;
    hallucinationRate: number;
    fcrAverage: number;
    scorecards: any[];
  }>({ overallQaAverage: 0, aiEmployeeAverage: 0, humanAgentAverage: 0, hallucinationRate: 0, fcrAverage: 0, scorecards: [] });

  const [vocDigestData, setVocDigestData] = useState<{
    voc: {
      overallCsat: number;
      customerEffortScore: number;
      netPromoterScore: number;
      topDiscontentDriver: string;
      topDelightDriver: string;
      csatDistribution: any[];
      topDelightArticles: any[];
      clusters: any[];
    };
    digest: any;
  }>({
    voc: {
      overallCsat: 0,
      customerEffortScore: 0,
      netPromoterScore: 0,
      topDiscontentDriver: "",
      topDelightDriver: "",
      csatDistribution: [],
      topDelightArticles: [],
      clusters: [],
    },
    digest: null,
  });

  const [queueData, setQueueData] = useState<{
    overallCapacityPercentage: number;
    totalActiveConversations: number;
    channels: any[];
    rules: any[];
  }>({ overallCapacityPercentage: 0, totalActiveConversations: 0, channels: [], rules: [] });

  const [knowledge, setKnowledge] = useState<{
    articles: KnowledgeArticle[];
    gaps: KnowledgeGap[];
    proposals: KnowledgeProposal[];
    documents?: KnowledgeDocument[];
    webSources?: KnowledgeWebSource[];
  }>({ articles: [], gaps: [], proposals: [], documents: [], webSources: [] });
  const [staleWork, setStaleWork] = useState<{
    candidates: StaleWorkCandidate[];
    dryRun: any;
  }>({ candidates: [], dryRun: null });
  const [sources, setSources] = useState<SourceConnector[]>([]);
  const [policy, setPolicy] = useState<SupportPolicy | null>(null);
  const [trends, setTrends] = useState<{ series: any[]; anomalies: any[] }>({ series: [], anomalies: [] });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Voice Simulator States
  const [simVoiceNumber, setSimVoiceNumber] = useState<string>("+1 (415) 890-1234");
  const [simVoiceName, setSimVoiceName] = useState<string>("Marcus Vance");
  const [simVoiceTier, setSimVoiceTier] = useState<"standard" | "pro" | "enterprise">("enterprise");
  const [simVoiceProvider, setSimVoiceProvider] = useState<"vapi" | "twilio" | "retell">("vapi");
  const [simVoiceVerification, setSimVoiceVerification] = useState<"anonymous" | "phone_match" | "otp_verified" | "authenticated">("authenticated");
  const [simVoiceLoading, setSimVoiceLoading] = useState<boolean>(false);
  const [selectedVoiceSession, setSelectedVoiceSession] = useState<any | null>(null);

  // Voice Telephony & Bot Provisioning States (GrowthV8 Architecture)
  const [isVoiceProvisionModalOpen, setIsVoiceProvisionModalOpen] = useState<boolean>(false);
  const [provEmployeeId, setProvEmployeeId] = useState<string>("emp_voice_specialist");
  const [provProvider, setProvProvider] = useState<"vapi" | "twilio">("vapi");
  const [provPhoneNumber, setProvPhoneNumber] = useState<string>("+1 (800) 882-9900");
  const [provPhoneMode, setProvPhoneMode] = useState<string>("vapi_managed");
  const [provVoiceId, setProvVoiceId] = useState<string>("jennifer-neural-v2");
  const [provSystemPrompt, setProvSystemPrompt] = useState<string>("");
  const [provFirstMessage, setProvFirstMessage] = useState<string>("");
  const [provMinVerification, setProvMinVerification] = useState<string>("phone_match");
  const [provPermissionScopes, setProvPermissionScopes] = useState<string[]>([
    "support.problem.status",
    "support.ticket.lookup",
    "support.ticket.create",
    "knowledge.rag.search",
  ]);
  const [isProvisioningVoice, setIsProvisioningVoice] = useState<boolean>(false);
  const [selectedConfigForPermissions, setSelectedConfigForPermissions] = useState<any | null>(null);
  const [isEditPermissionsModalOpen, setIsEditPermissionsModalOpen] = useState<boolean>(false);
  const [editPermissionScopes, setEditPermissionScopes] = useState<string[]>([]);

  // Voice Edit Modal States
  const [isVoiceEditModalOpen, setIsVoiceEditModalOpen] = useState<boolean>(false);
  const [selectedConfigForEdit, setSelectedConfigForEdit] = useState<any | null>(null);
  const [editVoiceAgentName, setEditVoiceAgentName] = useState<string>("");
  const [editVoiceEmployeeId, setEditVoiceEmployeeId] = useState<string>("emp_voice_specialist");
  const [editVoiceProvider, setEditVoiceProvider] = useState<"vapi" | "twilio" | "retell" | "bland">("vapi");
  const [editVoicePhoneNumber, setEditVoicePhoneNumber] = useState<string>("");
  const [editVoiceServiceMode, setEditVoiceServiceMode] = useState<"customer" | "official">("customer");
  const [editVoiceVoiceId, setEditVoiceVoiceId] = useState<string>("jennifer-neural-v2");
  const [editVoiceSystemPrompt, setEditVoiceSystemPrompt] = useState<string>("");
  const [editVoiceFirstMessage, setEditVoiceFirstMessage] = useState<string>("");
  const [editVoiceMinVerification, setEditVoiceMinVerification] = useState<string>("phone_match");
  const [editVoiceScopes, setEditVoiceScopes] = useState<string[]>([]);
  const [editVoiceIsActive, setEditVoiceIsActive] = useState<boolean>(true);
  const [isSavingVoiceEdit, setIsSavingVoiceEdit] = useState<boolean>(false);

  // Simulator States
  const [simMessage, setSimMessage] = useState<string>("I demand an immediate refund for $49.00 double charge on checkout!");
  const [simTier, setSimTier] = useState<"standard" | "pro" | "enterprise">("enterprise");
  const [simMode, setSimMode] = useState<OperatingMode>("autonomous");
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  // Policy Sandbox States
  const [policySimMessage, setPolicySimMessage] = useState<string>("Payment failed on checkout step 3 with 504 error.");
  const [policySimTier, setPolicySimTier] = useState<"standard" | "pro" | "enterprise">("enterprise");
  const [policySimResult, setPolicySimResult] = useState<any | null>(null);

  // Issue Filter & Explorer Drawer States
  const [issueSearch, setIssueSearch] = useState<string>("");
  const [issueSentimentFilter, setIssueSentimentFilter] = useState<string>("all");
  const [issueSourceFilter, setIssueSourceFilter] = useState<string>("all");
  const [isExplorerEditMode, setIsExplorerEditMode] = useState<boolean>(false);
  const [explorerEditSummary, setExplorerEditSummary] = useState<string>("");
  const [explorerEditCategory, setExplorerEditCategory] = useState<string>("");
  const [explorerEditPriority, setExplorerEditPriority] = useState<PriorityLevel>("normal");
  const [explorerEditStatus, setExplorerEditStatus] = useState<string>("open");
  const [explorerEditSentiment, setExplorerEditSentiment] = useState<SentimentClass>("neutral");
  const [explorerEditAssignee, setExplorerEditAssignee] = useState<string>("");
  const [explorerEditRecommendedAction, setExplorerEditRecommendedAction] = useState<string>("");
  const [explorerNewNoteText, setExplorerNewNoteText] = useState<string>("");
  const [explorerReplyChannel, setExplorerReplyChannel] = useState<string>("internal_note");
  const [isExplorerSaving, setIsExplorerSaving] = useState<boolean>(false);

  // Marketplace & Governance States
  const [connectors, setConnectors] = useState<MarketplaceConnector[]>(EMPTY_CONNECTORS);
  const [marketplaceWorkforce, setMarketplaceWorkforce] = useState<MarketplaceWorkforceItem[]>(EMPTY_MARKETPLACE_WORKFORCE);
  const [plans, setPlans] = useState<MarketplacePlan[]>(EMPTY_PLANS);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettingConfig>(INITIAL_SETTINGS);
  const [complianceReports, setComplianceReports] = useState<ComplianceAuditReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<TenantAuditLog[]>([]);
  const [planBillingCycle, setPlanBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [connectorCategoryFilter, setConnectorCategoryFilter] = useState<string>("all");

  // Modals for Marketplace & Governance
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<TenantMember["role"]>("Tier 2 Escalation Agent");
  const [isConnectorConfigOpen, setIsConnectorConfigOpen] = useState<boolean>(false);
  const [selectedConnectorForConfig, setSelectedConnectorForConfig] = useState<MarketplaceConnector | null>(null);

  // Escalation Modal States (CX Cockpit -> SLA Engine)
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState<boolean>(false);
  const [selectedTicketForEscalation, setSelectedTicketForEscalation] = useState<any | null>(null);
  const [escalateAssignee, setEscalateAssignee] = useState<string>("");
  const [escalateAssigneeType, setEscalateAssigneeType] = useState<"ai" | "human">("human");
  const [escalatePriority, setEscalatePriority] = useState<string>("urgent");
  const [escalateReason, setEscalateReason] = useState<string>("SLA Pre-breach Hazard & Executive VIP Priority");
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState<boolean>(false);

  // Workspace States
  const [workspaceSelectedIssueId, setWorkspaceSelectedIssueId] = useState<string>("");
  const WorkspaceView = operatorSession?.token.startsWith("workspace:") ? RuntimeNativeWorkdesk : FocusedWorkspaceView;
  const openWorkspaceTicket = (id: string) => {
    if (operatorSession?.token.startsWith("workspace:")) {
      window.history.pushState({}, "", runtimeTicketHref(id));
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    setWorkspaceSelectedIssueId(id);
    setActiveTab("workspace");
  };
  const [workspaceReplyText, setWorkspaceReplyText] = useState<string>("Hello, I have reviewed your request. Our autonomous resolution engine has approved the mitigation.");
  const [workspaceRefundAmount, setWorkspaceRefundAmount] = useState<string>("49.00");
  const [workspaceTriageFilter, setWorkspaceTriageFilter] = useState<"all" | "enterprise" | "p1_p2" | "at_risk">("all");
  const [workspaceDrafting, setWorkspaceDrafting] = useState<boolean>(false);
  const [preselectedCustomerForTicket, setPreselectedCustomerForTicket] = useState<CustomerProfile | null>(null);

  // ForgeGW Managed vs BYOM Model Governance States (GrowthV8 Architecture)
  const [isForgeGwModalOpen, setIsForgeGwModalOpen] = useState<boolean>(false);
  const [modelProvider, setModelProvider] = useState<"forgegw" | "byom">("forgegw");
  const [forgeGwCredits, setForgeGwCredits] = useState<number>(0);
  const [byomApiKey, setByomApiKey] = useState<string>("");
  const [byomModel, setByomModel] = useState<string>("gpt-4o");

  useEffect(() => {
    if (!isEscalateModalOpen) return;
    setEscalateAssigneeType("human");
    setEscalateAssignee(operatorSession?.name || operatorSession?.email || "Authenticated operator");
  }, [isEscalateModalOpen, operatorSession?.email, operatorSession?.name]);

  // Persistent ForgeGW Credit Helpers (Server Sync & Local Cache)
  const handleDeductCredits = async (amount: number, reason: string) => {
    setForgeGwCredits((prev) => {
      const next = Math.max(0, prev - amount);
      return next;
    });
    notify(`Deducted ${amount} ForgeGW Credits: ${reason}`, "info");

    try {
      await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deduct_credits", amount, reason }),
      });
    } catch (err) {
      console.error("Failed to persist credit deduction to server:", err);
    }
  };

  const handleAddCredits = async (amount: number, packTitle: string, price: number) => {
    setForgeGwCredits((prev) => {
      const next = prev + amount;
      return next;
    });
    notify(`CHECKOUT successful! Added ${amount.toLocaleString()} ForgeGW Action Credits ($${price}).`, "success");

    try {
      await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_credits", amount, reason: `Purchased ${packTitle} ($${price})` }),
      });
    } catch (err) {
      console.error("Failed to persist credit addition to server:", err);
    }
  };

  // Load all initial data scoped to active tenant
  const fetchData = async (overrideTenant?: string) => {
    try {
      if (!AuthService.getActiveSession()) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const activeSlug = overrideTenant || currentTenantSlug || "acme";
      const fetchGeneration = ++tenantFetchGenerationRef.current;
      if (loadedTenantSlugRef.current !== activeSlug) {
        setOverview({
          csat: 0,
          csatChange: 0,
          issueVolume: 0,
          issueVolumeChange: 0,
          activeProblems: 0,
          varrRate: 0,
          businessExposure: 0,
          needsAttention: [],
          aiDiscovered: [],
          recentActivity: [],
          aiWorkforce: [],
        });
        setIssues([]);
        setProblems([]);
        setInsights([]);
        setKnowledge({ articles: [], gaps: [], proposals: [], documents: [], webSources: [] });
        setStaleWork({ candidates: [], dryRun: null });
        setSources([]);
        setPolicy(null);
        setTrends({ series: [], anomalies: [] });
        setWorkforce([]);
        setSelectedEmployeeId("");
        setVoiceData({ phoneConfigs: [], sessions: [] });
        setSelectedVoiceSession(null);
        setVerticals([]);
        setSlaData({ attainmentRate: 0, totalTracked: 0, healthyCount: 0, atRiskCount: 0, breachedCount: 0, tickets: [] });
        setCustomerHealthData({ avgHealthScore: 0, totalArrAtRisk: 0, criticalCount: 0, concerningCount: 0, healthyCount: 0, activeVipChurnAlerts: [], accounts: [] });
        setQaData({ overallQaAverage: 0, aiEmployeeAverage: 0, humanAgentAverage: 0, hallucinationRate: 0, fcrAverage: 0, scorecards: [] });
        setVocDigestData({
          voc: {
            overallCsat: 0,
            customerEffortScore: 0,
            netPromoterScore: 0,
            topDiscontentDriver: "",
            topDelightDriver: "",
            csatDistribution: [],
            topDelightArticles: [],
            clusters: [],
          },
          digest: null,
        });
        setQueueData({ overallCapacityPercentage: 0, totalActiveConversations: 0, channels: [], rules: [] });
        setConnectors(EMPTY_CONNECTORS);
        setMarketplaceWorkforce(EMPTY_MARKETPLACE_WORKFORCE);
        setPlans(EMPTY_PLANS);
        setMembers([]);
        setComplianceReports([]);
        setAuditLogs([]);
        setForgeGwCredits(0);
        setOperatingMode(null);
      }
      const tenantQuery = `?tenant=${encodeURIComponent(activeSlug)}`;
      const headers = { "x-tenant-slug": activeSlug };
      const [ovRes, issRes, prbRes, insRes, kbRes, swRes, srcRes, polRes, trRes, wfRes, vcRes, vertRes, slaRes, healthRes, qaRes, vocRes, qRes, marketRes] = await Promise.all([
        AuthService.authenticatedFetch(`/api/overview${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/issues${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/problems${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/insights${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/knowledge${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/stale-work${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/sources${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/policies${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/trends${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/workforce${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/voice/session${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/verticals${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/cx/sla${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/cx/customer-health${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/cx/qa-scorecards${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/cx/voc-digest${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/cx/queue${tenantQuery}`, { headers }).then((r) => r.json()),
        AuthService.authenticatedFetch(`/api/marketplace${tenantQuery}`, { headers }).then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (!AuthService.getActiveSession()) {
        setOperatorSession(null);
        setIsSignInModalOpen(true);
        throw new Error("Operator session expired");
      }

      if (fetchGeneration !== tenantFetchGenerationRef.current) return;
      loadedTenantSlugRef.current = activeSlug;

      if (ovRes.success) setOverview(ovRes.data);
      if (issRes.success) setIssues(issRes.data);
      if (prbRes.success) setProblems(prbRes.data);
      if (insRes.success) setInsights(insRes.data);
      if (kbRes.success) setKnowledge(kbRes.data);
      if (swRes.success) setStaleWork(swRes.data);
      if (srcRes.success) setSources(srcRes.data);
      if (wfRes.success) {
        const hiredWorkforce = Array.isArray(wfRes.data) ? wfRes.data.filter((member: any) => member.hired) : [];
        setWorkforce(hiredWorkforce);
        setSelectedEmployeeId((current) =>
          hiredWorkforce.some((member: any) => member.id === current) ? current : (hiredWorkforce[0]?.id || "")
        );
      }
      if (vertRes.success) setVerticals(vertRes.data);
      if (slaRes.success) setSlaData(slaRes.data);
      if (healthRes.success) setCustomerHealthData(healthRes.data);
      if (qaRes.success) setQaData(qaRes.data);
      if (vocRes.success) setVocDigestData(vocRes.data);
      if (qRes.success) setQueueData(qRes.data);
      if (marketRes?.success && marketRes.data) {
        if (typeof marketRes.data.credits === "number") {
          setForgeGwCredits(marketRes.data.credits);
          if (typeof window !== "undefined") {
          }
        }
        setConnectors(marketRes.data.connectors || EMPTY_CONNECTORS);
        setMarketplaceWorkforce(marketRes.data.workforce || EMPTY_MARKETPLACE_WORKFORCE);
        setPlans(marketRes.data.plans || EMPTY_PLANS);
        setMembers(marketRes.data.members || []);
        setTenantSettings(marketRes.data.settings || INITIAL_SETTINGS);
        setComplianceReports(marketRes.data.reports || []);
        if (marketRes.data.auditLogs) setAuditLogs(marketRes.data.auditLogs);
      }
      if (vcRes.success) {
        setVoiceData(vcRes.data);
        if (vcRes.data.sessions?.length > 0 && !selectedVoiceSession) {
          setSelectedVoiceSession(vcRes.data.sessions[0]);
        }
      }
      if (polRes.success) {
        setPolicy(polRes.data);
        setOperatingMode(tenantOperatingMode(polRes.data));
      } else {
        setOperatingMode(null);
      }
      if (trRes.success) setTrends(trRes.data);
    } catch (err) {
      console.error("Failed to load supportv8 data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Synchronize Explorer edit fields when selectedIssue changes
  useEffect(() => {
    if (selectedIssue) {
      setExplorerEditSummary(selectedIssue.summary || "");
      setExplorerEditCategory(selectedIssue.category || "General");
      setExplorerEditPriority(selectedIssue.priority || "normal");
      setExplorerEditStatus(selectedIssue.status || "open");
      setExplorerEditSentiment(selectedIssue.sentiment || "neutral");
      setExplorerEditAssignee(
        selectedIssue.assignedTo ||
          selectedIssue.assignedAgent ||
          operatorSession?.name ||
          operatorSession?.email ||
          "Authenticated operator",
      );
      setExplorerEditRecommendedAction(selectedIssue.recommendedAction || "");
      setIsExplorerEditMode(false);
      setExplorerNewNoteText("");
    }
  }, [selectedIssue]);

  const handleExplorerStatusChange = async (newStatus: string) => {
    if (!selectedIssue) return;
    setIsExplorerSaving(true);
    const now = new Date().toLocaleTimeString();
    const event: TicketTimelineEvent = {
      id: "tl_" + Date.now(),
      timestamp: now,
      actor: operatorSession?.name || operatorSession?.email || "Authenticated operator",
      actorType: "human_operator",
      action: `Status transitioned to ${newStatus.toUpperCase()}`,
      details: `Status updated via Issues Explorer Inspector`,
    };
    const updated: Issue = {
      ...selectedIssue,
      status: newStatus,
      priority: newStatus === "escalated" ? "urgent" : selectedIssue.priority,
      timeline: [event, ...(selectedIssue.timeline || [])],
    };
    try {
      await handleUpdateIssue(updated);
      setExplorerEditStatus(newStatus);
      notify(`Ticket ${selectedIssue.externalId} status changed to ${newStatus.toUpperCase()}`, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to update ticket status", "error");
    } finally {
      setIsExplorerSaving(false);
    }
  };

  const handleSaveExplorerEdits = async () => {
    if (!selectedIssue) return;
    setIsExplorerSaving(true);
    try {
      const now = new Date().toLocaleTimeString();
      const event: TicketTimelineEvent = {
        id: "tl_" + Date.now(),
        timestamp: now,
        actor: operatorSession?.name || operatorSession?.email || "Authenticated operator",
        actorType: "human_operator",
        action: `Ticket metadata edited`,
        details: `Summary, Category (${explorerEditCategory}), Priority (${explorerEditPriority}), Status (${explorerEditStatus}) updated.`,
      };
      const updated: Issue = {
        ...selectedIssue,
        summary: explorerEditSummary,
        category: explorerEditCategory,
        priority: explorerEditPriority,
        status: explorerEditStatus,
        sentiment: explorerEditSentiment,
        assignedTo: explorerEditAssignee,
        assignedAgent: explorerEditAssignee,
        recommendedAction: explorerEditRecommendedAction,
        timeline: [event, ...(selectedIssue.timeline || [])],
      };
      await handleUpdateIssue(updated);
      setIsExplorerEditMode(false);
      notify(`Ticket ${selectedIssue.externalId} details updated successfully!`, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to save ticket edits", "error");
    } finally {
      setIsExplorerSaving(false);
    }
  };

  const handleAddExplorerNote = async () => {
    if (!selectedIssue || !explorerNewNoteText.trim()) return;
    const now = new Date().toLocaleTimeString();
    const event: TicketTimelineEvent = {
      id: "tl_" + Date.now(),
      timestamp: now,
      actor: operatorSession?.name || operatorSession?.email || "Authenticated operator",
      actorType: "human_operator",
      action: `Internal Note Added`,
      details: explorerNewNoteText.trim(),
    };
    const newMsg: TicketMessageItem = {
      id: "msg_" + Date.now(),
      timestamp: now,
      sender: "operator",
      senderName: operatorSession?.name || operatorSession?.email || "Authenticated operator",
      content: explorerNewNoteText.trim(),
      channel: explorerReplyChannel || "internal_note",
    };
    const updated: Issue = {
      ...selectedIssue,
      timeline: [event, ...(selectedIssue.timeline || [])],
      messages: [...(selectedIssue.messages || []), newMsg],
    };
    try {
      await handleUpdateIssue(updated);
      setExplorerNewNoteText("");
      notify(`Added note to ticket ${selectedIssue.externalId}`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to add note", "error");
    }
  };

  const handleExplorerIndexToRag = async () => {
    if (!selectedIssue) return;
    try {
      const ticketPayload = {
        externalId: selectedIssue.externalId,
        summary: selectedIssue.summary,
        customerName: selectedIssue.customerName,
        product: selectedIssue.product,
        resolutionNotes: selectedIssue.recommendedAction || "Resolved via Issues Explorer triage.",
        category: selectedIssue.category,
        tags: selectedIssue.tags,
      };

      try {
        const res = await AuthService.authenticatedFetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-slug": currentTenantSlug },
          body: JSON.stringify({
            action: "ingest_ticket",
            ticket: ticketPayload,
          }),
        });
        const data = await res.json();
        if (data.success && data.data?.document) {
          setKnowledge((prev) => ({
            ...prev,
            documents: [data.data.document, ...(prev.documents || []).filter((d) => d.id !== data.data.document.id)],
          }));
        }
      } catch (err) {
        console.warn("[Explorer] Failed to persist ticket to RAG endpoint:", err);
      }

      await knowledgev8Connector.ingestResolvedTicket(ticketPayload);
      await handleDeductCredits(20, `Indexed ticket ${selectedIssue.externalId} into pgvector RAG corpus`);
      const now = new Date().toLocaleTimeString();
      const event: TicketTimelineEvent = {
        id: "tl_" + Date.now(),
        timestamp: now,
        actor: "Jordan (KB Refresh Specialist)",
        actorType: "ai_employee",
        action: `1-Click RAG Vector Corpus Ingestion`,
        details: `Resolution grounded into pgvector knowledge base.`,
      };
      const updated: Issue = {
        ...selectedIssue,
        ragIngested: true,
        ragIngestedAt: new Date().toISOString(),
        timeline: [event, ...(selectedIssue.timeline || [])],
      };
      await handleUpdateIssue(updated);
      notify(`Indexed ticket ${selectedIssue.externalId} into KnowledgeV8 RAG corpus (Deducted 20 Credits)`, "success");
    } catch (err) {
      notify("Failed to index ticket into RAG corpus", "error");
    }
  };

  const handleOpenRawSource = (issue: Issue) => {
    const rawUrl = issue.sourceUrl?.trim();
    if (rawUrl) {
      const target = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`;
      try {
        const opened = window.open(target, "_blank", "noopener,noreferrer");
        if (opened) {
          notify(`Opened raw source for ${issue.externalId}`, "info");
          return;
        }
      } catch {
        // Pop-up blocked fallback
      }
    }
    setRawSourceIssue(issue);
  };

  useEffect(() => {
    let initialTenant = currentTenantSlug;

    // Detect Subdomain & URL parameters for tenant vs global landing vs cockpit
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view");
      const adminParam = params.get("admin");
      const tenantParam = params.get("tenant") || params.get("slug");
      const landingParam = params.get("landing");
      const signInParam = params.get("signin");
      const emailParam = params.get("email");
      const active = AuthService.getActiveSession();
      const workspace = resolveBrowserWorkspace({
        hostname: window.location.hostname,
        tenantParam,
        activeTenant: active?.tenantSlug,
        forceCockpit: adminParam === "true" || params.has("tab"),
        viewParam,
        landingParam,
        fallbackTenant: initialTenant,
      });
      initialTenant = workspace.tenantSlug;

      if (initialTenant !== currentTenantSlug) {
        setCurrentTenantSlug(initialTenant);
      }

      if (signInParam === "1") {
        setSignInPrefillEmail(emailParam || "");
        setIsSignInModalOpen(true);
      }

      const tabParam = params.get("tab") || (params.has("ticket") ? "workspace" : null);
      if (tabParam) {
        setActiveTab(tabParam);
      }

      setViewMode(workspace.viewMode);
      if (workspace.viewMode === "cockpit") {
        if (!active) {
          setIsSignInModalOpen(true);
        }
      }
    }

    // Hydrate the existing native cockpit from the verified HttpOnly handoff session.
    // This display descriptor grants nothing; each API rechecks the server session.
    void AuthService.restoreRuntimeSession().then(session => {
      if (!session) return;
      setOperatorSession(session);
      setCurrentTenantSlug((session as any).tenantDomain || session.tenantSlug);
      if (typeof (session as any).credits === "number") {
        setForgeGwCredits((session as any).credits);
      }
      setViewMode("cockpit");
      setIsSignInModalOpen(false);
      void fetchData((session as any).tenantDomain || session.tenantSlug);
    });

    const activeSession = AuthService.getActiveSession();
    if (activeSession) {
      void fetchData(initialTenant);
    } else {
      setLoading(false);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    const handleTicketCreated = (e?: any) => {
      const tenantFromEvent = e?.detail?.tenantDomain;
      fetchData(tenantFromEvent || currentTenantSlug);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("sv8_ticket_created", handleTicketCreated);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("sv8_ticket_created", handleTicketCreated);
    };
  }, []);

  // Presence is an expiring server-side lease, never a seeded roster or browser toggle.
  useEffect(() => {
    if (viewMode !== "cockpit" || !operatorSession || operatorSession.role === "observer") return;
    let inFlight = false;
    const heartbeat = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try { await AuthService.authenticatedFetch("/api/presence", { method: "POST" }); }
      catch { /* No fabricated presence on network failure; the lease expires. */ }
      finally { inFlight = false; }
    };
    void heartbeat();
    const interval = setInterval(() => { void heartbeat(); }, 30_000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", heartbeat); };
  }, [viewMode, operatorSession?.token, currentTenantSlug, operatorSession?.role]);

  // Real-time polling for new tickets in Cockpit view
  useEffect(() => {
    if (viewMode !== "cockpit" || !operatorSession) return;
    const interval = setInterval(() => {
      const activeSlug = currentTenantSlug || "acme";
      AuthService.authenticatedFetch(`/api/issues?tenant=${encodeURIComponent(activeSlug)}`, {
        headers: { "x-tenant-slug": activeSlug },
      })
        .then((r) => r.json())
        .then((res) => {
          if (res?.success && Array.isArray(res.data)) {
            setIssues((current) => {
              const currentById = new Map(current.map((issue) => [issue.id, issue]));
              if (current.length > 0) {
                const hasNewIncoming = res.data.some((serverIssue: Issue) => !currentById.has(serverIssue.id));
                if (hasNewIncoming) {
                  void soundAlertService.playTicketAlert();
                }
              }
              return res.data.map((serverIssue: Issue) => {
                const existing = currentById.get(serverIssue.id);
                if (!existing) return serverIssue;
                if (pendingIssueUpdatesRef.current.has(serverIssue.id)) return existing;
                const existingUpdatedAt = new Date(existing.updatedAt || 0).getTime();
                const serverUpdatedAt = new Date(serverIssue.updatedAt || 0).getTime();
                return serverUpdatedAt < existingUpdatedAt ? existing : serverIssue;
              });
            });
          }
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [viewMode, currentTenantSlug, operatorSession?.token]);

  // Re-fetch data whenever active tenant changes & guard against cross-tenant session leaks
  useEffect(() => {
    if (!operatorSession) return;
    if (
      operatorSession.role !== "superadmin" &&
      operatorSession.tenantSlug.toLowerCase() !== currentTenantSlug.toLowerCase()
    ) {
      setCurrentTenantSlug(operatorSession.tenantSlug);
      notify(`This operator session is scoped to ${operatorSession.tenantSlug}.`, "info");
      return;
    }
    void fetchData(currentTenantSlug);
  }, [currentTenantSlug, operatorSession?.tenantSlug, operatorSession?.role]);

  const notify = (text: string, type: "success" | "error" | "info" = "success") => {
    setActionNotice({ text, type });
    setTimeout(() => setActionNotice(null), 4500);
  };

  const handleExecuteInsight = async (insightId: string) => {
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", insightId }),
      }).then((r) => r.json());

      if (res.success) {
        handleDeductCredits(15, "Automated Insight Execution & Mitigation");
        notify(res.message, "success");
        fetchData();
      } else {
        notify(res.message || "Failed to execute insight action", "error");
      }
    } catch (err) {
      notify("Network error executing action", "error");
    }
  };

  const handlePublishKnowledge = async (proposalId: string) => {
    try {
      const res = await AuthService.authenticatedFetch(
        `/api/knowledge?tenant=${encodeURIComponent(currentTenantSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-slug": currentTenantSlug },
          body: JSON.stringify({ action: "publish", proposalId }),
        }
      ).then((r) => r.json());

      if (res.success) {
        handleDeductCredits(20, "Published Knowledge Proposal to RAG Corpus");
        notify(res.message, "success");
        fetchData();
      } else {
        notify(res.message || "Failed to publish knowledge", "error");
      }
    } catch (err) {
      notify("Network error publishing article", "error");
    }
  };

  const handleExecuteStaleWorkSingle = async (candidateId: string) => {
    try {
      const res = await fetch("/api/stale-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute_single", candidateId }),
      }).then((r) => r.json());

      if (res.success) {
        handleDeductCredits(10, "Stale Ticket Automated Sweeper Execution");
        notify(res.message, "success");
        fetchData();
      } else {
        notify(res.message || "Execution failed", "error");
      }
    } catch (err) {
      notify("Network error on sweep execution", "error");
    }
  };

  const handleExecuteAllSafeStale = async () => {
    try {
      const res = await fetch("/api/stale-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute_all_safe" }),
      }).then((r) => r.json());

      if (res.success) {
        handleDeductCredits(25, "Batch Safe Stale Sweeper Auto-Close Execution");
        notify(res.message, "success");
        fetchData();
      } else {
        notify(res.message || "Batch execution failed", "error");
      }
    } catch (err) {
      notify("Network error on batch sweep", "error");
    }
  };

  const handleRunSimulator = async () => {
    try {
      setSimLoading(true);
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: simMode,
          message: simMessage,
          customer: { id: "C-1920", name: "Sarah Jenkins", tier: simTier },
        }),
      }).then((r) => r.json());

      if (res.success) {
        handleDeductCredits(30, "Agentic Triage Simulation (Multi-Action LLM Inference)");
        setSimResult(res.data);
        notify(`Agentic run completed in ${simMode.toUpperCase()} mode!`, "success");
      } else {
        notify(res.error || "Simulator run failed", "error");
      }
    } catch (err) {
      notify("Network error during simulator execution", "error");
    } finally {
      setSimLoading(false);
    }
  };

  // Persist the header mode switch to the tenant policy; the label changes only once the server confirms.
  const handleChangeOperatingMode = async (mode: TenantOperatingMode) => {
    if (!canChangeOperatingMode(operatorSession?.role) || isSavingOperatingMode || mode === operatingMode) return;
    setIsSavingOperatingMode(true);
    try {
      const response = await AuthService.authenticatedFetch(`/api/policies?tenant=${encodeURIComponent(currentTenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": currentTenantSlug },
        body: JSON.stringify({
          action: "update",
          // Send the stored retention too, so changing the mode never resets it.
          policyUpdates: { operatingMode: mode, ...(policy ? { retentionRawContextHours: policy.retentionRawContextHours } : {}) },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.error || "Policy update failed");
      setPolicy(payload.data);
      setOperatingMode(tenantOperatingMode(payload.data));
      notify(`Tenant operating mode set to ${operatingModeLabel(mode).toUpperCase()}`, "info");
    } catch {
      notify(`Could not change the operating mode; it is still ${operatingModeLabel(operatingMode)}.`, "error");
    } finally {
      setIsSavingOperatingMode(false);
    }
  };

  const handleRunPolicySim = async () => {
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          sampleMessage: policySimMessage,
          customerTier: policySimTier,
        }),
      }).then((r) => r.json());

      if (res.success) {
        handleDeductCredits(10, "Policy Rule Evaluation Inference");
        setPolicySimResult(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  /** Resolves true when a reply arrived; false keeps the draft (and drops the unanswered message) for a retry. */
  const handleAskChat = async (e?: React.FormEvent, overrideQuery?: string): Promise<boolean> => {
    if (e) e.preventDefault();
    const queryToSend = overrideQuery || chatQuery;
    if (!queryToSend.trim()) return false;
    const targetEmployeeId = selectedEmployeeId || DEFAULT_RAG_ASSISTANT.id;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: queryToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);
    let answered = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryToSend,
          employeeId: targetEmployeeId,
        }),
      }).then((r) => r.json());

      if (res.success) {
        handleDeductCredits(15, "AI Workforce Query & Citation Synthesis");
        const assistantMsg: ChatMessage = {
          id: `ast_${Date.now()}`,
          role: "assistant",
          content: res.data.answer,
          employeeId: res.data.employeeId,
          employeeName: res.data.employeeName,
          employeeRole: res.data.employeeRole,
          employeeAvatar: res.data.employeeAvatar,
          citations: res.data.citations,
          suggestedActions: res.data.suggestedActions,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        setChatResponse(res.data);
        void soundAlertService.playChatAlert();
        answered = true;
      } else {
        notify(res.error || "Chat query failed", "error");
      }
    } catch (err) {
      console.error(err);
      notify("Network error during chat query", "error");
    } finally {
      setChatLoading(false);
    }
    if (answered) {
      // The console's draft clears only after a reply was accepted.
      if (!overrideQuery) setChatQuery("");
    } else {
      setChatMessages((prev) => prev.filter((message) => message.id !== userMsg.id));
    }
    return answered;
  };

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId);
    const emp = workforce.find((w) => w.id === empId);
    if (emp) {
      const switchMsg: ChatMessage = {
        id: `sys_${Date.now()}`,
        role: "system",
        content: `Switched active AI Employee persona to **${emp.name}** (${emp.role} • Autonomy: ${emp.autonomyLevel.toUpperCase()}).`,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        employeeAvatar: emp.avatar,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setChatMessages((prev) => [...prev, switchMsg]);
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
  };

  const handleChatAction = (act: { label: string; action: string; targetTab?: string; payload?: any }) => {
    if (act.action === "navigate" && act.targetTab) {
      setActiveTab(act.targetTab);
      setIsChatOpen(false);
      notify(`Navigated to ${act.targetTab}`, "info");
    } else if (act.action === "broadcast" && act.payload?.problemId) {
      const prb = problems.find((p) => p.id === act.payload.problemId) || problems[0];
      if (prb) {
        setIsChatOpen(false);
        openBroadcastModal(prb);
      }
    } else if (act.action === "publish" && act.payload?.proposalId) {
      handlePublishKnowledge(act.payload.proposalId);
    } else if (act.action === "stale_sweep") {
      handleExecuteAllSafeStale();
    }
  };

  const openBroadcastModal = (problem: Problem) => {
    setBroadcastProblem(problem);
    setBroadcastDraft({
      subject: `Service Advisory: ${problem.title}`,
      body: `Dear Customer,\n\nsupportV8 automated intelligence has identified an ongoing issue (${problem.title}). Our engineering operations are actively deploying mitigations.\n\nEstimated resolution window: < 30 minutes.`,
      channels: ["email", "in_app"],
    });
    setBroadcastSuccessMsg(null);
    setIsBroadcastModalOpen(true);
  };

  const handleSendBroadcast = async () => {
    if (!broadcastProblem || !broadcastDraft) return;
    try {
      await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          problemId: broadcastProblem.id,
          status: "mitigating",
        }),
      }).then((r) => r.json());

      setBroadcastSuccessMsg(
        `Proactive broadcast dispatched to ${broadcastProblem.affectedCustomerCount} affected customers via Action Gateway.`
      );
      notify("Proactive broadcast dispatched!", "success");
      fetchData();
    } catch (err) {
      notify("Broadcast dispatch failed", "error");
    }
  };

  const handleSimulateProblems = async () => {
    try {
      const activeSlug = currentTenantSlug || "acme";
      const res = await AuthService.authenticatedFetch(`/api/problems?tenant=${encodeURIComponent(activeSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": activeSlug },
        body: JSON.stringify({ action: "simulate" }),
      }).then((r) => r.json());

      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setProblems(res.data);
        notify("Clusters Loaded", "success");
      } else {
        setProblems([]);
        notify("No Clusters", "info");
      }
    } catch {
      notify("Query Failed", "error");
    }
  };

  const handleToggleConnector = async (connectorId: string, isSubscribed: boolean) => {
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_connector", connectorId, isSubscribed }),
      }).then((r) => r.json());

      if (res.success) {
        setConnectors((prev) =>
          prev.map((c) =>
            c.id === connectorId
              ? { ...c, isSubscribed, status: isSubscribed ? "active" : "available" }
              : c
          )
        );
        notify(res.message, "success");
      }
    } catch (err) {
      notify("Failed to update connector subscription", "error");
    }
  };

  const handleHireAgent = async (agentId: string) => {
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hire_agent", agentId }),
      }).then((r) => r.json());

      if (res.success) {
        setMarketplaceWorkforce((prev) =>
          prev.map((w) =>
            w.id === agentId ? { ...w, isHired: true, hiredCount: w.hiredCount + 1 } : w
          )
        );
        notify(res.message, "success");
      }
    } catch (err) {
      notify("Failed to hire AI agent", "error");
    }
  };

  const handleHireWorkforceEmployee = async (empId: string) => {
    try {
      const res = await fetch("/api/workforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hire", employeeId: empId }),
      }).then((r) => r.json());

      if (res.success) {
        notify(res.message || "Employee hired successfully!", "success");
        fetchData();
      } else {
        notify(res.error || "Failed to hire employee", "error");
      }
    } catch (err) {
      notify("Failed to hire employee", "error");
    }
  };

  const handleOpenAssignWorkModal = (emp: any) => {
    if (!emp.hired && emp.hired !== undefined) {
      notify(`Architectural Rule: ${emp.name} must be HIRED first before receiving work assignments.`, "error");
      return;
    }
    if (emp.level === "ai_intern") {
      const supervisor = workforce.find((w) => w.id === emp.supervisorId);
      notify(`Architectural Rule: Interns are paired sub-agents and cannot receive direct work. Please assign work to supervising AI Employee (${supervisor?.name || "Alex"}), who will delegate sub-tasks.`, "error");
      return;
    }
    setSelectedEmployeeForAssign(emp);
    setAssignTicketId(issues[0]?.id || "TKT-8812");
    setAssignDescription(issues[0]?.title || "Triage and resolve customer inquiry with pgvector knowledge grounding.");
    setIsWorkAssignModalOpen(true);
  };

  const handleConfirmAssignWork = async () => {
    if (!selectedEmployeeForAssign) return;
    setIsAssigningWork(true);
    try {
      const res = await fetch("/api/workforce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_work",
          employeeId: selectedEmployeeForAssign.id,
          issueDescription: assignDescription,
        }),
      }).then((r) => r.json());

      if (res.success) {
        notify(res.message || `Work assigned to ${selectedEmployeeForAssign.name}!`, "success");
        setIsWorkAssignModalOpen(false);
        fetchData();
      } else {
        notify(res.message || res.error || "Failed to assign work", "error");
      }
    } catch (err) {
      notify("Failed to assign work", "error");
    } finally {
      setIsAssigningWork(false);
    }
  };

  const handleProvisionVoiceBot = async () => {
    if (!provPhoneNumber.trim()) {
      notify("Phone number is required for telephony binding", "error");
      return;
    }
    setIsProvisioningVoice(true);
    try {
      const res = await fetch("/api/voice/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "provision",
          employeeId: provEmployeeId,
          provider: provProvider,
          phoneNumber: provPhoneNumber,
          phoneMode: provPhoneMode,
          voiceId: provVoiceId,
          systemPrompt: provSystemPrompt,
          firstMessage: provFirstMessage,
          minVerificationLevel: provMinVerification,
          permissionScopes: provPermissionScopes,
        }),
      }).then((r) => r.json());

      if (res.success) {
        notify(res.message || "Voice bot provisioned successfully!", "success");
        setIsVoiceProvisionModalOpen(false);
        fetchData();
      } else {
        notify(res.error || "Failed to provision voice bot", "error");
      }
    } catch (err) {
      notify("Failed to provision voice bot", "error");
    } finally {
      setIsProvisioningVoice(false);
    }
  };

  const handleSyncVoiceBot = async (configId: string) => {
    try {
      const res = await fetch("/api/voice/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", configId }),
      }).then((r) => r.json());

      if (res.success) {
        notify(res.message || "Re-synchronized remote voice agent!", "success");
        fetchData();
      } else {
        notify(res.error || "Failed to sync voice agent", "error");
      }
    } catch (err) {
      notify("Failed to sync voice agent", "error");
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedConfigForPermissions) return;
    try {
      const res = await fetch("/api/voice/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_permissions",
          configId: selectedConfigForPermissions.id,
          permissionScopes: editPermissionScopes,
        }),
      }).then((r) => r.json());

      if (res.success) {
        notify(res.message || "Permissions updated successfully!", "success");
        setIsEditPermissionsModalOpen(false);
        fetchData();
      } else {
        notify(res.error || "Failed to update permissions", "error");
      }
    } catch (err) {
      notify("Failed to update permissions", "error");
    }
  };

  const handleOpenEditVoiceAgent = (cfg: any) => {
    setSelectedConfigForEdit(cfg);
    setEditVoiceAgentName(cfg.agentName || "");
    setEditVoiceEmployeeId(cfg.employeeId || "emp_voice_specialist");
    setEditVoiceProvider(cfg.provider || "vapi");
    setEditVoicePhoneNumber(cfg.phoneNumber || "");
    setEditVoiceServiceMode(cfg.serviceMode || "customer");
    setEditVoiceVoiceId(cfg.voiceId || "jennifer-neural-v2");
    setEditVoiceSystemPrompt(cfg.systemPrompt || "");
    setEditVoiceFirstMessage(cfg.firstMessage || "");
    setEditVoiceMinVerification(cfg.minVerificationLevel || "phone_match");
    setEditVoiceScopes(cfg.permissionScopes || [
      "support.problem.status",
      "support.ticket.lookup",
      "support.ticket.create",
      "knowledge.rag.search",
    ]);
    setEditVoiceIsActive(cfg.isActive !== false);
    setIsVoiceEditModalOpen(true);
  };

  const handleSaveEditVoiceAgent = async () => {
    if (!selectedConfigForEdit) return;
    setIsSavingVoiceEdit(true);
    try {
      const res = await fetch("/api/voice/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          configId: selectedConfigForEdit.id,
          updates: {
            agentName: editVoiceAgentName,
            employeeId: editVoiceEmployeeId,
            provider: editVoiceProvider,
            phoneNumber: editVoicePhoneNumber,
            serviceMode: editVoiceServiceMode,
            voiceId: editVoiceVoiceId,
            systemPrompt: editVoiceSystemPrompt,
            firstMessage: editVoiceFirstMessage,
            minVerificationLevel: editVoiceMinVerification,
            permissionScopes: editVoiceScopes,
            isActive: editVoiceIsActive,
          },
        }),
      }).then((r) => r.json());

      if (res.success) {
        notify(res.message || "Voice agent updated successfully!", "success");
        setIsVoiceEditModalOpen(false);
        fetchData();
      } else {
        notify(res.error || "Failed to update voice agent", "error");
      }
    } catch (err) {
      notify("Failed to update voice agent", "error");
    } finally {
      setIsSavingVoiceEdit(false);
    }
  };

  const handleDeleteVoiceAgent = async (configId: string, phone: string) => {
    if (!window.confirm(`Are you sure you want to delete and disconnect Voice Agent for ${phone}?`)) {
      return;
    }
    try {
      const res = await fetch("/api/voice/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", configId }),
      }).then((r) => r.json());

      if (res.success) {
        notify(res.message || `Deleted voice agent ${phone}`, "success");
        fetchData();
      } else {
        notify(res.error || "Failed to delete voice agent", "error");
      }
    } catch (err) {
      notify("Failed to delete voice agent", "error");
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select_plan", planId }),
      }).then((r) => r.json());

      if (res.success) {
        setPlans((prev) => prev.map((p) => ({ ...p, isCurrent: p.id === planId })));
        if (typeof res.data?.credits === "number") {
          setForgeGwCredits(res.data.credits);
        }
        notify(res.message, "success");
        fetchData();
      }
    } catch (err) {
      notify("Failed to switch plan", "error");
    }
  };

  const handleInviteMember = async () => {
    if (!inviteName || !inviteEmail) {
      notify("Please provide a valid name and email address", "error");
      return;
    }
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite_member",
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setMembers((prev) => [res.data, ...prev]);
        notify(`Invitation dispatched to ${inviteEmail}`, "success");
        setIsInviteModalOpen(false);
        setInviteName("");
        setInviteEmail("");
      }
    } catch (err) {
      notify("Failed to invite member", "error");
    }
  };

  const handleUpdateSettings = async (updates: Partial<TenantSettingConfig>) => {
    // The AI mode lives in the tenant policy; the settings copy is not the source of truth.
    if (updates.operatingMode && updates.operatingMode !== operatingMode) {
      void handleChangeOperatingMode(updates.operatingMode);
    }
    try {
      const updated = { ...tenantSettings, ...updates };
      const res = await AuthService.authenticatedFetch(
        `/api/marketplace?tenant=${encodeURIComponent(currentTenantSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tenant-slug": currentTenantSlug },
          body: JSON.stringify({ action: "update_settings", settings: updated }),
        }
      ).then((r) => r.json());

      if (res.success) {
        setTenantSettings(updated);
        notify("Tenant settings updated successfully", "success");
      }
    } catch (err) {
      notify("Failed to save settings", "error");
    }
  };

  const handleWorkspaceAutonomousResolve = async (issueId: string) => {
    const issue = issues.find((candidate) => candidate.id === issueId);
    if (!issue) throw new Error(`Issue ${issueId} not found`);
    await handleUpdateIssue({ ...issue, status: "resolved" });
  };

  const handleUpdateIssue = async (updated: Issue): Promise<Issue> => {
    const fetchGeneration = tenantFetchGenerationRef.current;
    pendingIssueUpdatesRef.current.add(updated.id);
    try {
      const response = await AuthService.authenticatedFetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", issueId: updated.id, updates: updated }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || result.data?.id !== updated.id) {
        throw new Error(result.error || "Ticket update failed");
      }
      const saved = { ...updated, ...result.data } as Issue;
      if (fetchGeneration === tenantFetchGenerationRef.current) {
        setIssues((prev) => prev.map((issue) => (issue.id === saved.id ? saved : issue)));
        setSelectedIssue((current) => current?.id === saved.id ? saved : current);
      }
      return saved;
    } finally {
      pendingIssueUpdatesRef.current.delete(updated.id);
    }
  };

  const completeAuthentication = (session: AuthSession, message: string) => {
    loadedTenantSlugRef.current = null;
    setOperatorSession(session);
    setCurrentTenantSlug(session.tenantSlug);
    setViewMode("cockpit");
    void fetchData(session.tenantSlug);
    notify(message, "success");
  };

  const handleCreateIssue = (newIssue: Issue) => {
    setIssues((prev) => [newIssue, ...prev]);
    void soundAlertService.playTicketAlert();
  };

  const handleImportIssues = (newIssues: Issue[]) => {
    setIssues((prev) => [...newIssues, ...prev]);
    if (newIssues.length > 0) {
      void soundAlertService.playTicketAlert();
    }
  };

  const handleWorkspaceProcessRefund = async (issueId: string, amount: string) => {
    try {
      const parsedAmount = parseFloat(amount) || 49.0;
      const res = await fetch("/api/connectors/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "process_refund",
          payload: {
            ticketId: issueId,
            amount: parsedAmount,
            reason: "Customer satisfaction refund issued from SupportV8 Action Gateway",
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        const refId = data.result?.refundId || "re_gateway";
        notify(`Refund of $${parsedAmount.toFixed(2)} processed via Stripe! (Ref: ${refId})`, "success");
        setIssues((prev) =>
          prev.map((iss) =>
            iss.id === issueId
              ? {
                  ...iss,
                  tags: Array.from(new Set([...iss.tags, "refund-processed", "stripe"])),
                  status: "resolved" as const,
                }
              : iss
          )
        );
      } else {
        notify(data.error || "Failed to process Stripe refund", "error");
      }
    } catch (err) {
      notify("Failed to process refund via Stripe connector", "error");
    }
  };

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch =
      !issueSearch ||
      issue.summary.toLowerCase().includes(issueSearch.toLowerCase()) ||
      issue.customerName.toLowerCase().includes(issueSearch.toLowerCase()) ||
      issue.externalId.toLowerCase().includes(issueSearch.toLowerCase());
    const matchesSentiment = issueSentimentFilter === "all" || issue.sentiment === issueSentimentFilter;
    const matchesSource = issueSourceFilter === "all" || issue.source === issueSourceFilter;
    return matchesSearch && matchesSentiment && matchesSource;
  });

  const hasOperationalAnalytics = Boolean(
    issues.length > 0 ||
      problems.length > 0 ||
      insights.length > 0 ||
      sources.length > 0 ||
      knowledge.articles.length > 0 ||
      knowledge.documents?.length ||
      overview?.recentActivity?.length,
  );

  const currentRole: AuthSession["role"] = operatorSession?.role || "cx_lead";
  const isContractorRole = currentRole === "contractor" || currentRole === "contractor_lead" || currentRole === "technician";
  const currentRoleLabel = supportRoleLabel(currentRole);

  const allNavSections = [
    {
      title: isContractorRole ? "Field Operations" : "AGENTIC RUNTIME",
      items: [
        {
          id: "ask",
          label: isContractorRole ? "Field Assistant (AI)" : "AgenticOS Chat",
          icon: MessageSquare,
          flaticon: "fi fi-rr-comment-alt",
          roles: ["contractor_lead", "contractor", "technician", "operator", "cx_lead", "superadmin"],
        },
        {
          id: "workspace",
          label: isContractorRole ? "Field Work Desk" : "Workspace",
          icon: LayoutDashboard,
          flaticon: "fi fi-rr-browser",
          roles: ["contractor_lead", "contractor", "technician", "operator", "cx_lead", "superadmin"],
        },
        {
          id: "knowledge",
          label: "Learning Graph",
          icon: Brain,
          flaticon: "fi fi-rr-brain",
          roles: ["operator", "cx_lead", "superadmin", "observer"],
        },
        {
          id: "studio",
          label: "Studio",
          icon: Cpu,
          flaticon: "fi fi-rr-microchip",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "overview",
          label: "Overview",
          icon: LayoutDashboard,
          flaticon: "fi fi-rr-dashboard",
          roles: ["operator", "cx_lead", "superadmin", "observer"],
        },
        {
          id: "trends",
          label: "Trend Radar",
          icon: TrendingUp,
          flaticon: "fi fi-rr-chart-line-up",
          roles: ["operator", "cx_lead", "superadmin"],
        },
      ],
    },
    {
      title: isContractorRole ? "Field Applications" : "ECOSYSTEM",
      items: [
        {
          id: "cx_cockpit",
          label: "Applications",
          icon: Target,
          flaticon: "fi fi-rr-target",
          badge: slaData.atRiskCount,
          badgeColor: "warn",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "problems",
          label: "Problem Matrix",
          icon: Flame,
          flaticon: "fi fi-rr-flame",
          badge: problems.length,
          badgeColor: "err",
          roles: ["operator", "cx_lead", "superadmin"],
        },
        {
          id: "issues",
          label: isContractorRole ? "Work Orders Explorer" : "Issues Explorer",
          icon: MessageSquare,
          flaticon: "fi fi-rr-comment-alt-middle",
          badge: isContractorRole
            ? issues.filter((i) => i.category === "contractor" || i.contractor).length || issues.length
            : issues.length,
          roles: ["contractor_lead", "contractor", "technician", "operator", "cx_lead", "superadmin"],
        },
        {
          id: "customers",
          label: "Customers",
          icon: Users,
          flaticon: "fi fi-rr-users",
          roles: ["contractor_lead", "contractor", "technician", "operator", "cx_lead", "superadmin"],
        },
        {
          id: "workforce",
          label: "Workforce",
          icon: Users,
          flaticon: "fi fi-rr-users",
          badge: workforce.length,
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "studio_marketplace",
          label: "Marketplace",
          icon: ShoppingBag,
          flaticon: "fi fi-rr-apps",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "market_workforce",
          label: "Installed Products",
          icon: Users,
          flaticon: "fi fi-rr-box",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "market_connectors",
          label: "Connectors",
          icon: Plug,
          flaticon: "fi fi-rr-plug",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "portal_composer",
          label: "Support Portal",
          icon: LayoutDashboard,
          flaticon: "fi fi-rr-browser",
          roles: ["cx_lead", "superadmin"],
        },
      ],
    },
    {
      title: "GOVERNANCE",
      items: [
        {
          id: "gov_audit",
          label: "Audit",
          icon: ShieldCheck,
          flaticon: "fi fi-rr-document",
          badge: auditLogs.length,
          roles: ["cx_lead", "superadmin", "observer"],
        },
        {
          id: "gov_reports",
          label: "Logs",
          icon: FileText,
          flaticon: "fi fi-rr-document",
          roles: ["cx_lead", "superadmin", "observer"],
        },
        {
          id: "approvals",
          label: "Approvals",
          icon: CheckCircle2,
          flaticon: "fi fi-rr-shield-check",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "workflows",
          label: "Workflows",
          icon: Layers,
          flaticon: "fi fi-rr-workflow",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "policies",
          label: "Policies",
          icon: Shield,
          flaticon: "fi fi-rr-shield-check",
          roles: ["cx_lead", "superadmin", "observer"],
        },
      ],
    },
    {
      title: "SETTINGS",
      items: [
        {
          id: "market_plans",
          label: "Plan",
          icon: CreditCard,
          flaticon: "fi fi-rr-credit-card",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "gov_settings",
          label: "Credits",
          icon: Settings,
          flaticon: "fi fi-rr-settings",
          roles: ["cx_lead", "superadmin"],
        },
        {
          id: "gov_members",
          label: "Members",
          icon: User,
          flaticon: "fi fi-rr-user",
          badge: members.length,
          roles: ["cx_lead", "superadmin"],
        },
      ],
    },
  ];

  // Dynamically filter sections and items according to authenticated user RBAC role
  const navSections = allNavSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(currentRole)),
    }))
    .filter((section) => section.items.length > 0);

  // Automatically enforce tab route guards for role-restricted personas
  useEffect(() => {
    // Normalization & alias routing
    if (activeTab === "sources" || activeTab === "connectors") {
      setActiveTab("market_connectors");
      return;
    }
    if (activeTab === "insights") {
      setActiveTab("trends");
      return;
    }
    if (activeTab === "stale_work") {
      setActiveTab("studio");
      return;
    }
    if (activeTab === "reports") {
      setActiveTab("gov_reports");
      return;
    }

    const allowedTabs = navSections.flatMap((s) => s.items).map((i) => i.id);
    if (!isContractorRole) {
      allowedTabs.push("voice");
    }
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      const fallback = allowedTabs.includes("workspace") ? "workspace" : allowedTabs[0];
      setActiveTab(fallback);
    }
  }, [currentRole, activeTab, navSections, isContractorRole]);

  // One navigation for the family shell: the rendered grouping of navSections, plus Voice.
  // The structure is rebuilt only when ids or labels change; counts go to the sidebar as badges.
  const shellNavKey = JSON.stringify(navSections.map((s) => [s.title, s.items.map((i) => [i.id, i.label])]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shellNav = useMemo(() => supportShellNav(groupSupportNavigation(navSections, isContractorRole), { contractor: isContractorRole }), [shellNavKey, isContractorRole]);
  const shellBadges = Object.fromEntries(navSections.flatMap((s) => s.items.map((i) => [i.id, (i as { badge?: number }).badge ?? 0])));
  // Embedded when the session came through the Runtime hand-off (/auth/runtime/handoff), standalone otherwise.
  const shellMode: "standalone" | "embedded" = runtimeHandoff ? "embedded" : "standalone";

  if (viewMode === "global_landing") {
    return (
      <>
        <GlobalLandingView
          onOpenSignIn={() => setIsSignInModalOpen(true)}
          onOpenTenantPortal={(slug) => {
            setCurrentTenantSlug(slug || "acme");
            setViewMode("tenant_landing");
          }}
          demoEnabled={demoEnabled}
          onOpenDemoGate={(slug = "acme") => {
            setTargetDemoSlug(slug);
            setIsDemoModalOpen(true);
          }}
          onOpenSignup={() => setIsSignupModalOpen(true)}
        />
        {demoEnabled && <DemoAccessModal
          isOpen={isDemoModalOpen}
          initialTenantSlug={targetDemoSlug}
          onClose={() => setIsDemoModalOpen(false)}
          onSuccess={(session, email) => {
            completeAuthentication(session, `Demo session unlocked for ${email || "Guest"}: Logged in as ${session.name} for ${session.tenantSlug}.support.servicev8.com`);
          }}
          onOpenSignIn={() => {
            setIsDemoModalOpen(false);
            setIsSignInModalOpen(true);
          }}
        />}
        <SignInModal
          isOpen={isSignInModalOpen}
          lockedTenantSlug={
            typeof window !== "undefined"
              ? browserTenantSlugFromHostname(window.location.hostname) || undefined
              : undefined
          }
          initialTenantSlug={currentTenantSlug}
          initialEmail={signInPrefillEmail}
          onClose={() => {
            setIsSignInModalOpen(false);
            setSignInPrefillEmail("");
          }}
          onSuccess={(session) => {
            completeAuthentication(session, `Authenticated as operator (${session.email}) for ${session.tenantSlug}.support.servicev8.com`);
          }}
          onOpenSignup={() => {
            setIsSignInModalOpen(false);
            setIsSignupModalOpen(true);
          }}
        />
        <SignupModal
          isOpen={isSignupModalOpen}
          onClose={() => setIsSignupModalOpen(false)}
          onSuccess={(slug, adminEmail) => {
            setCurrentTenantSlug(slug);
            setSignInPrefillEmail(adminEmail || "");
            setIsSignupModalOpen(false);
            setIsSignInModalOpen(true);
            notify(`Workspace '${slug}' provisioned! Please sign in with your administrator credentials.`, "success");
          }}
          onOpenSignIn={() => {
            setIsSignupModalOpen(false);
            setIsSignInModalOpen(true);
          }}
        />
      </>
    );
  }

  if (viewMode === "tenant_landing") {
    return (
      <>
        <TenantLandingView
          tenantSlug={currentTenantSlug}
          demoEnabled={demoEnabled}
          onOpenSignIn={() => setIsSignInModalOpen(true)}
          onOpenGlobalLanding={() => setViewMode("global_landing")}
          onOpenSignup={() => setIsSignupModalOpen(true)}
          onSwitchTenant={(slug) => {
            setCurrentTenantSlug(slug);
            notify(`Switched active tenant preview to ${slug}.support.servicev8.com`, "info");
          }}
        />
        {demoEnabled && <DemoAccessModal
          isOpen={isDemoModalOpen}
          initialTenantSlug={targetDemoSlug}
          onClose={() => setIsDemoModalOpen(false)}
          onSuccess={(session, email) => {
            completeAuthentication(session, `Demo session unlocked for ${email || "Guest"}: Logged in as ${session.name} for ${session.tenantSlug}.support.servicev8.com`);
          }}
          onOpenSignIn={() => {
            setIsDemoModalOpen(false);
            setIsSignInModalOpen(true);
          }}
        />}
        <SignInModal
          isOpen={isSignInModalOpen}
          lockedTenantSlug={currentTenantSlug}
          initialEmail={signInPrefillEmail}
          onClose={() => {
            setIsSignInModalOpen(false);
            setSignInPrefillEmail("");
          }}
          onSuccess={(session) => {
            completeAuthentication(session, `Authenticated as operator (${session.email}) for ${session.tenantSlug}.support.servicev8.com`);
          }}
          onOpenSignup={() => {
            setIsSignInModalOpen(false);
            setIsSignupModalOpen(true);
          }}
        />
        <SignupModal
          isOpen={isSignupModalOpen}
          onClose={() => setIsSignupModalOpen(false)}
          onSuccess={(slug, adminEmail) => {
            setCurrentTenantSlug(slug);
            setSignInPrefillEmail(adminEmail || "");
            setIsSignupModalOpen(false);
            setIsSignInModalOpen(true);
            notify(`Workspace '${slug}' provisioned! Please sign in with your administrator credentials.`, "success");
          }}
          onOpenSignIn={() => {
            setIsSignupModalOpen(false);
            setIsSignInModalOpen(true);
          }}
        />
      </>
    );
  }

  if (viewMode === "cockpit" && !operatorSession) {
    return (
      <>
        <div className="min-h-screen bg-[#0B1017] flex items-center justify-center p-6 text-[#EAF1F8]">
          <div className="max-w-md w-full p-8 rounded-3xl bg-[#141C26] border border-[#E5484D]/40 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-[#E5484D]/10 border border-[#E5484D]/30 flex items-center justify-center mx-auto text-[#E5484D]">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#EAF1F8]">Authentication Required</h2>
              <p className="text-xs text-[#8FA2B7] leading-relaxed">
                Access to the SupportV8 Operator Work Desk is strictly gated. Please sign in with your verified administrator or operator credentials for{" "}
                <span className="font-mono text-[#2ED8B6]">{currentTenantSlug}.support.servicev8.com</span>.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-3">
              <button
                onClick={() => setIsSignInModalOpen(true)}
                className="w-full btn btn-primary py-3 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20"
              >
                <span>Sign In to Work Desk</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("global_landing")}
                className="w-full btn btn-secondary py-2.5 text-xs font-mono cursor-pointer text-[#8FA2B7] flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return Overview</span>
              </button>
            </div>
          </div>
        </div>

        <SignInModal
          isOpen={isSignInModalOpen}
          lockedTenantSlug={
            typeof window !== "undefined"
              ? browserTenantSlugFromHostname(window.location.hostname) || undefined
              : undefined
          }
          initialTenantSlug={currentTenantSlug}
          initialEmail={signInPrefillEmail}
          onClose={() => {
            setIsSignInModalOpen(false);
            setSignInPrefillEmail("");
          }}
          onSuccess={(session) => {
            completeAuthentication(session, `Authenticated as operator (${session.email}) for ${session.tenantSlug}.support.servicev8.com`);
          }}
          onOpenSignup={() => {
            setIsSignInModalOpen(false);
            setIsSignupModalOpen(true);
          }}
        />

        <SignupModal
          isOpen={isSignupModalOpen}
          onClose={() => setIsSignupModalOpen(false)}
          onSuccess={(slug, adminEmail) => {
            setCurrentTenantSlug(slug);
            setSignInPrefillEmail(adminEmail || "");
            setIsSignupModalOpen(false);
            setIsSignInModalOpen(true);
            notify(`Workspace '${slug}' provisioned! Please sign in with your administrator credentials.`, "success");
          }}
          onOpenSignIn={() => {
            setIsSignupModalOpen(false);
            setIsSignInModalOpen(true);
          }}
        />
      </>
    );
  }

  return (
    <SupportFamilyShell
      mode={shellMode}
      runtimeUrl={runtimeShellUrl(operatorSession)}
      active={activeTab}
      nav={shellNav}
      badges={shellBadges}
      tools={SUPPORT_SHELL_TOOLS}
      tenant={currentTenantSlug}
      tenantSub={shellMode === "embedded" ? "Runtime workspace" : `${currentTenantSlug}.support.servicev8.com`}
      userName={`${operatorSession?.name || currentTenantSlug} · ${currentRoleLabel}`}
      onNavigate={setActiveTab}
      onSignOut={handleLogout}
      onTool={(id) => { if (id === "ask") setIsChatOpen(true); }}
    >
      {/* Toast Notification */}
      {actionNotice && (
        <div
          className={`fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg border px-4 py-3 shadow-xl sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-md sm:px-5 ${
            actionNotice.type === "success"
              ? "bg-[#121A24] border-[#2ED8B6]/50 text-[#2ED8B6]"
              : actionNotice.type === "error"
              ? "bg-[#121A24] border-[#E5484D]/50 text-[#E5484D]"
              : "bg-[#121A24] border-[#4D9FFF]/50 text-[#4D9FFF]"
          }`}
        >
          {actionNotice.type === "success" && <CheckCircle2 className="w-4 h-4 text-[#2ED8B6]" />}
          {actionNotice.type === "error" && <AlertCircle className="w-4 h-4 text-[#E5484D]" />}
          {actionNotice.type === "info" && <Sparkles className="w-4 h-4 text-[#2ED8B6]" />}
          <span className="text-xs font-medium">{actionNotice.text}</span>
          <button onClick={() => setActionNotice(null)} className="ml-2 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SIDEBAR NAVIGATION (COLLAPSIBLE MIN / MAX PANEL) */}
      {/* ========================================================================= */}


      {/* ========================================================================= */}
      {/* MAIN VIEWPORT (STICKY TOPBAR + SCROLLABLE DASHBOARD VIEW) */}
      {/* ========================================================================= */}
      <div id="support-workspace" tabIndex={-1}
        className={`flex-1 flex flex-col min-w-0 h-screen bg-[#0B1017] ${
          activeTab === "ask" || activeTab === "workspace" ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        {/* Optimized Sticky Topbar Header */}
        <SupportWorkspaceHeaderFrame>
          {/* Left: Breadcrumbs & Active Tenant Tag */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 text-xs min-w-0">
              <span className="flex items-center tracking-[-0.035em] font-sans select-none shrink-0">
                <span className="text-white font-extrabold text-sm">support</span>
                <span className="text-[var(--support-lime)] font-mono font-extrabold text-sm tracking-[-0.02em] ml-0.5">v8</span>
              </span>
              <span className="text-[#6B7C8D] font-mono shrink-0">/</span>
              <span className="text-[#EAF1F8] font-bold font-mono text-xs truncate max-w-[85px] xs:max-w-[120px] sm:max-w-[200px]">
                {navSections.flatMap((s) => s.items).find((i) => i.id === activeTab)?.label || activeTab}
              </span>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#121A24] border border-[var(--line)] text-[10px] font-mono text-[#8E9AA8] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2ED8B6] animate-pulse"></span>
              <span className="text-[#EAF1F8] font-bold">{currentTenantSlug}.support.servicev8.com</span>
            </span>
          </div>

          {/* Center: Autonomy Mode & ForgeGW Credits Capsule */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {/* Autonomy Mode Selector: shows the tenant's stored mode, or "Not set". */}
            <div className="flex items-center bg-[#101722] p-1 rounded-xl border border-[var(--line)]" role="group" aria-label={`AI operating mode: ${operatingModeLabel(operatingMode)}`} data-operating-mode={operatingMode ?? "unset"}>
              {!operatingMode && (
                <span className="px-2 text-xs font-mono text-[#8E9AA8]" data-testid="operating-mode-unset">AI mode: Not set</span>
              )}
              {(["observe", "copilot", "autonomous"] as TenantOperatingMode[]).map((mode) => {
                const isActive = operatingMode === mode;
                const canChange = canChangeOperatingMode(operatorSession?.role);
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={isActive}
                    disabled={!canChange || isSavingOperatingMode}
                    onClick={() => void handleChangeOperatingMode(mode)}
                    title={canChange ? `Set autonomy mode: ${mode.toUpperCase()}` : `Autonomy mode${isActive ? " (current)" : ""}: ${mode.toUpperCase()}. Only CX leads and administrators can change it.`}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-default ${
                      isActive
                        ? "bg-[#182635] text-[#2ED8B6] border border-[#2ED8B6]/40 font-bold shadow-sm"
                        : "text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#141C26]"
                    }`}
                  >
                    {mode === "observe" && <Eye className="w-3 h-3 text-[#8E9AA8]" />}
                    {mode === "copilot" && <Zap className="w-3 h-3 text-[#F5A623]" />}
                    {mode === "autonomous" && <Bot className="w-3 h-3 text-[#2ED8B6]" />}
                    <span className="capitalize">{mode}</span>
                  </button>
                );
              })}
            </div>

            {/* ForgeGW Credits Pill Button: standalone only; Runtime manages models and credits when embedded. */}
            {shellMode === "standalone" && <button
              type="button"
              onClick={() => setIsForgeGwModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#101722] hover:bg-[#141E2B] border border-[var(--line)] hover:border-[#2ED8B6]/40 text-xs font-mono transition-all cursor-pointer"
              title="Manage ForgeGW Credits & Compute Routing"
            >
              <Zap className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span className="text-[#EAF1F8] font-bold">
                {modelProvider === "forgegw" ? `${forgeGwCredits.toLocaleString()} Credits` : "BYOM Key"}
              </span>
            </button>}
          </div>

          {/* Right: Quick Search, Refresh, Audio & Unified User Profile Dropdown */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <SoundAlertToggle />

            {/* Quick Ask / Command Trigger */}
            <button
              onClick={() => setIsChatOpen(true)}
              className="btn btn-secondary px-2 sm:px-3 py-1.5 text-xs flex items-center gap-1.5 sm:gap-2 cursor-pointer text-[#8E9AA8] hover:text-[#EAF1F8]"
            >
              <Search className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span className="hidden sm:inline text-[11px] font-mono">Ask / Search</span>
              <kbd className="hidden lg:inline-block bg-[#121A24] px-1.5 py-0.5 rounded text-[10px] text-[#6B7C8D] font-mono border border-[var(--line)]">
                ⌘K
              </kbd>
            </button>

            {/* Refresh Live Data Icon */}
            <button
              onClick={() => fetchData()}
              title="Refresh Intelligence Data"
              className="p-1.5 sm:p-2 rounded-xl bg-[#101722] hover:bg-[#18222E] border border-[var(--line)] text-[#6B7C8D] hover:text-[#2ED8B6] cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#2ED8B6]" : ""}`} />
            </button>

            {/* Unified User & Persona Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className={`px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                  isUserMenuOpen
                    ? "bg-[#182635] border-[#2ED8B6] text-[#EAF1F8] shadow-md shadow-[#2ED8B6]/10"
                    : "bg-[#101722] hover:bg-[#141E2B] border-[var(--line)] text-[#B4C2D0] hover:text-[#EAF1F8]"
                }`}
              >
                <div className="w-6 h-6 rounded-lg bg-[#182635] border border-[var(--line-2)] flex items-center justify-center text-xs font-bold text-[#2ED8B6]">
                  {isContractorRole ? <HardHat className="w-3.5 h-3.5" /> : currentRole === "observer" ? <Eye className="w-3.5 h-3.5" /> : currentRole === "operator" ? <Headphones className="w-3.5 h-3.5" /> : <Award className="w-3.5 h-3.5" />}
                </div>
                <div className="hidden lg:flex flex-col text-left text-xs font-mono">
                  <span className="font-bold text-[#EAF1F8] leading-tight truncate max-w-[110px]">
                    {operatorSession?.name || "Admin"}
                  </span>
                  <span className="text-[9px] text-[#2ED8B6] uppercase tracking-wider">
                    {currentRoleLabel}
                  </span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#6B7C8D] transition-transform ${isUserMenuOpen ? "rotate-180 text-[#2ED8B6]" : ""}`} />
              </button>

              {/* Popover Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-[#0E1520] border border-[var(--line-2)] rounded-2xl shadow-2xl z-50 p-2 space-y-2 animate-in fade-in-50 zoom-in-95 duration-100 font-mono text-xs">
                    {/* Active Profile Header */}
                    <div className="p-2.5 rounded-xl bg-[#141C26] border border-[var(--line)]">
                      <div className="font-bold text-sm text-[#EAF1F8]">{operatorSession?.name || currentTenantSlug}</div>
                      <div className="text-[11px] text-[#6B7C8D] truncate">{operatorSession?.email || "admin@servicev8.com"}</div>
                      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#2ED8B6]/10 text-[#2ED8B6] text-[10px] font-bold uppercase">
                        <Shield className="w-3 h-3" />
                        <span>{currentRole.replace(/_/g, " ")}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsProfileEditorOpen(true)}
                      className="flex items-center justify-between gap-3 rounded-xl p-2.5 text-[#B4C2D0] transition-colors hover:bg-[#141C26] hover:text-[#EAF1F8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ED8B6]"
                    >
                      <span className="min-w-0">
                        <span className="block font-semibold">Edit operator name</span>
                        <span className="block truncate text-[10px] text-[#6B7C8D]">
                          Set your first name or nickname
                        </span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#2ED8B6]" />
                    </button>
                    {isProfileEditorOpen && operatorSession && <OperatorProfileEditor
                      session={operatorSession} onSaved={setOperatorSession} onClose={() => setIsProfileEditorOpen(false)} />}

                    {/* Persona switcher: demo sandbox only (explicit flag, fixture tenant, never a Runtime hand-off). */}
                    {demoPersonasFor({ demoEnabled, tenantSlug: currentTenantSlug, runtimeHandoff }).length > 0 && (
                      <div className="space-y-1">
                        <div className="px-2 pt-1 text-[10px] font-bold text-[#6B7C8D] uppercase tracking-wider">
                          Switch Demo Persona ({currentTenantSlug})
                        </div>
                        {demoPersonasFor({ demoEnabled, tenantSlug: currentTenantSlug, runtimeHandoff })
                          .map((p) => {
                            const isCurrent = currentRole === p.role;
                            const PersonaIcon = ({ contractor_lead: HardHat, operator: Headphones, cx_lead: Award, observer: Eye } as Partial<Record<string, typeof Award>>)[p.role] ?? Award;
                            return (
                              <button
                                key={p.role}
                                type="button"
                                onClick={() => {
                                  const session = AuthService.createSession(p.slug, p.email, p.role as any);
                                  setOperatorSession(session);
                                  setIsUserMenuOpen(false);
                                  notify(`Switched active persona to ${p.name} (${p.role.toUpperCase()})`, "info");
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                                  isCurrent
                                    ? "bg-[#182635] text-[#2ED8B6] border border-[#2ED8B6]/30 font-bold"
                                    : "text-[#B4C2D0] hover:bg-[#141C26] hover:text-[#EAF1F8]"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <PersonaIcon className="w-3.5 h-3.5 text-[#2ED8B6]" />
                                  <span className="truncate">{p.label}</span>
                                </span>
                                {isCurrent && <Check className="w-3.5 h-3.5 text-[#2ED8B6]" />}
                              </button>
                            );
                          })}
                      </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-[var(--line)] my-1" />

                    {/* Workspace Navigation Links */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setViewMode("tenant_landing");
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-[#B4C2D0] hover:text-[#EAF1F8] hover:bg-[#141C26] transition-colors cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5 text-[#4D9FFF]" />
                        <span>Tenant Portal ({currentTenantSlug})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setViewMode("global_landing");
                        }}
                        className="w-full flex items-center gap-2 p-2 rounded-xl text-[#B4C2D0] hover:text-[#EAF1F8] hover:bg-[#141C26] transition-colors cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#8E9AA8]" />
                        <span>Global Landing</span>
                      </button>
                    </div>

                    {/* Divider & Sign Out */}
                    <div className="border-t border-[var(--line)] my-1" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl text-[#E5484D] hover:bg-[#E5484D]/10 hover:text-[#FF7575] transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </SupportWorkspaceHeaderFrame>

        {/* Main Content View with GrowthV8 Layout */}
        <main
          className={
            activeTab === "ask" || activeTab === "workspace"
              ? "family-main flex-1 flex flex-col min-h-0 w-full overflow-hidden"
              : "family-main flex-1 p-4 sm:p-6 md:p-8 w-full space-y-6"
          }
        >
        {/* ========================================================================= */}
        {/* TAB: OVERVIEW (GROWTHV8 DASHBOARD REPLICATION) */}
        {/* ========================================================================= */}
        {activeTab === "overview" && overview && !hasOperationalAnalytics && (
          <EmptyAnalyticsState
            onOpenWorkDesk={() => setActiveTab("workspace")}
            onOpenChannels={() => setActiveTab("market_connectors")}
          />
        )}

        {activeTab === "overview" && overview && hasOperationalAnalytics && (
          <OverviewAnalyticsView {...{ customerHealthData, hasOperationalAnalytics, issues, notify, overview, problems, qaData, setActiveTab, slaData, sources, voiceData, workforce }} />
        )}

        {/* ========================================================================= */}
        {/* TAB: CX MANAGER COCKPIT (GROWTHV8 6 OPERATIONAL PILLARS) */}
        {/* ========================================================================= */}
        {activeTab === "cx_cockpit" && !hasOperationalAnalytics && (
          <EmptyAnalyticsState
            onOpenWorkDesk={() => setActiveTab("workspace")}
            onOpenChannels={() => setActiveTab("market_connectors")}
          />
        )}

        {activeTab === "cx_cockpit" && hasOperationalAnalytics && (
          <CxCockpitView {...{ customerHealthData, cxSubView, fetchData, healthViewMode, issues, notify, openWorkspaceTicket, overview, problems, qaData, queueData, selectedAccountForForm, setActiveTab, setCxSubView, setHealthViewMode, setIsEscalateModalOpen, setSelectedAccountForForm, setSelectedTicketForEscalation, slaData, sources, vocDigestData }} />
        )}

        {/* ========================================================================= */}
        {/* TAB: ISSUES EXPLORER (EXPANDED SINK & FULL-WIDTH REPOSITORY) */}
        {/* ========================================================================= */}
        {activeTab === "issues" && (
          <IssuesExplorerView {...{ currentTenantSlug, explorerEditAssignee, explorerEditCategory, explorerEditPriority, explorerEditRecommendedAction, explorerEditSentiment, explorerEditStatus, explorerEditSummary, explorerNewNoteText, filteredIssues, handleAddExplorerNote, handleExplorerIndexToRag, handleExplorerStatusChange, handleOpenRawSource, handleSaveExplorerEdits, isExplorerEditMode, isExplorerSaving, issueSearch, issueSentimentFilter, issueSourceFilter, notify, openWorkspaceTicket, rawSourceIssue, selectedIssue, setActiveTab, setExplorerEditAssignee, setExplorerEditCategory, setExplorerEditPriority, setExplorerEditRecommendedAction, setExplorerEditSentiment, setExplorerEditStatus, setExplorerEditSummary, setExplorerNewNoteText, setIsExplorerEditMode, setIssueSearch, setIssueSentimentFilter, setIssueSourceFilter, setRawSourceIssue, setSelectedIssue }} />
        )}

        {/* ========================================================================= */}
        {/* TAB: AI WORKFORCE (ORDERV8 CANONICAL WORKFORCE HIERARCHY) */}
        {/* ========================================================================= */}
        {activeTab === "workforce" && (
          <WorkforceDirectoryView {...{ handleOpenAssignWorkModal, setActiveTab, setIsChatOpen, setSelectedEmployeeId, setStudioEmployeeId, setStudioSubTab, setWorkforceFilter, workforce, workforceFilter }} />
        )}

        {/* ========================================================================= */}
        {/* TAB: WORKFORCE APPROVALS */}
        {/* ========================================================================= */}
        {activeTab === "approvals" && (
          <WorkforceApprovalsView onNotify={notify} />
        )}

        {/* ========================================================================= */}
        {/* TAB: WORKFORCE WORKFLOWS */}
        {/* ========================================================================= */}
        {activeTab === "workflows" && (
          <WorkforceWorkflowsView onNotify={notify} />
        )}

        {/* ========================================================================= */}
        {/* TAB: VOICE INTEGRATION (GROWTHV8 VOICE ARCHITECTURE) */}
        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* TAB: VOICE INTEGRATION (GROWTHV8 VOICE ARCHITECTURE) */}
        {/* ========================================================================= */}
        {activeTab === "voice" && (
          <VoiceOperationsView {...{ fetchData, handleDeductCredits, handleDeleteVoiceAgent, handleOpenEditVoiceAgent, handleSyncVoiceBot, notify, selectedVoiceSession, setEditPermissionScopes, setIsEditPermissionsModalOpen, setIsVoiceProvisionModalOpen, setSelectedConfigForPermissions, setSelectedVoiceSession, setSimVoiceLoading, setSimVoiceName, setSimVoiceNumber, setSimVoiceProvider, setSimVoiceTier, setSimVoiceVerification, simVoiceLoading, simVoiceName, simVoiceNumber, simVoiceProvider, simVoiceTier, simVoiceVerification, voiceData, workforce }} />
        )}
        {/* ========================================================================= */}
        {/* TAB: PROBLEMS (SYSTEMIC PROBLEM CORRELATION MATRIX - WORK DESK) */}
        {/* ========================================================================= */}
        {activeTab === "problems" && (
          <ProblemsView {...{ currentTenantSlug, fetchData, handleSimulateProblems, issues, notify, openBroadcastModal, openWorkspaceTicket, problems, setActiveTab, setIsEscalateModalOpen, setSelectedTicketForEscalation }} />
        )}

        {/* ========================================================================= */}
        {/* TAB: AUTONOMOUS STUDIO (WORKFLOWS, AUTOMATIONS, SCENARIO TEMPLATES & SIMULATOR) */}
        {/* ========================================================================= */}
        {activeTab === "studio" && (
          <AutonomousStudioView
            onNotify={notify}
            initialSubTab={studioSubTab}
            initialEmployeeId={studioEmployeeId}
            onNavigateToMarketplace={() => setActiveTab("studio_marketplace")}
            onNavigateToInstalled={() => setActiveTab("market_workforce")}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: TREND RADAR & PROACTIVE ANOMALY INTELLIGENCE (EP13 & EP14) */}
        {/* ========================================================================= */}
        {(activeTab === "trends" || activeTab === "insights") && (
          <TrendRadarView {...{ fetchData, handleExecuteInsight, insights, trends }} />
        )}

        {/* ========================================================================= */}
        {/* TAB: KNOWLEDGE SUITE (INGESTION, DEFICIT REVIEW MAPPER & SEMANTIC GRAPH) */}
        {/* ========================================================================= */}
        {activeTab === "knowledge" && (
          <KnowledgeSuiteView
            key={currentTenantSlug}
            tenantSlug={currentTenantSlug}
            knowledge={knowledge}
            onPublishProposal={handlePublishKnowledge}
            onSyncKv8={fetchData}
            onNotify={notify}
            routingMode={tenantSettings.routingMode || "forgegw"}
            embeddingProvider={tenantSettings.embeddingProvider || "forgegw"}
            embeddingModel={tenantSettings.embeddingModel || "forge-embed-text-1536"}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === "portal_composer" && (
          <PortalComposerView
            key={currentTenantSlug}
            tenantSlug={currentTenantSlug}
            onNotify={(message, type) => notify(message, type || "success")}
          />
        )}


        {/* ========================================================================= */}
        {/* TAB: BROWSE MARKETPLACE & CAPABILITY HUB */}
        {/* ========================================================================= */}
        {activeTab === "studio_marketplace" && (
          <StudioMarketplaceHubView
            tenantId={currentTenantSlug}
            tenantName={currentTenantSlug === "acme" ? "Acme Corp" : currentTenantSlug}
            onNotify={notify}
            onNavigateToStudio={(subTab) => {
              if (subTab) setStudioSubTab(subTab as any);
              setActiveTab("studio");
            }}
            onNavigateToInstalled={() => setActiveTab("market_workforce")}
            onNavigateToConnectors={() => setActiveTab("market_connectors")}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: MARKETPLACE CONNECTORS & VERTICAL DISPATCHER */}
        {/* ========================================================================= */}
        {(activeTab === "market_connectors" || activeTab === "connectors" || activeTab === "sources") && (
          <MarketplaceConnectorsView
            connectors={connectors}
            verticals={sources}
            onToggleConnector={handleToggleConnector}
            onOpenConfig={(connector) => notify(`Configuring ${connector.name} connector settings`, "info")}
            onNotify={notify}
            onNavigateToStudio={(subTab) => {
              if (subTab) setStudioSubTab(subTab as any);
              setActiveTab("studio");
            }}
            onNavigateToInstalled={() => setActiveTab("market_workforce")}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: POLICIES & RULES (EXPANSIVE GOVERNANCE MATRIX) */}
        {/* ========================================================================= */}
        {activeTab === "policies" && policy && (
          <PoliciesAndRulesView
            policy={policy}
            onUpdatePolicy={setPolicy}
            onNotify={notify}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: FOCUSED USER WORKSPACE (AGENTIC RESOLUTION WORK DESK) */}
        {/* ========================================================================= */}
        {activeTab === "workspace" && (
          <WorkspaceView key={operatorSession?.tenantSlug}
            issues={issues}
            initialSelectedIssueId={workspaceSelectedIssueId}
            problems={problems}
            insights={insights}
            userRole={operatorSession?.role || "operator"}
            operatorName={operatorSession?.name || operatorSession?.email || "Authenticated operator"}
            onResolve={handleWorkspaceAutonomousResolve}
            onProcessRefund={handleWorkspaceProcessRefund}
            onNavigateToProblems={() => setActiveTab("problems")}
            onExecuteInsight={handleExecuteInsight}
            onUpdateIssue={handleUpdateIssue}
            onCreateIssue={handleCreateIssue}
            onImportIssues={handleImportIssues}
            onSaveToKnowledgeBase={async (ticket) => {
              const ticketPayload = {
                externalId: ticket.externalId,
                summary: ticket.summary,
                customerName: ticket.customerName,
                product: ticket.product,
                resolutionNotes: ticket.recommendedAction || "Resolved via workdesk operations.",
                category: ticket.category,
                tags: ticket.tags,
              };
              try {
                const res = await AuthService.authenticatedFetch("/api/knowledge", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", "x-tenant-slug": currentTenantSlug },
                  body: JSON.stringify({
                    action: "ingest_ticket",
                    ticket: ticketPayload,
                  }),
                });
                const data = await res.json();
                if (data.success && data.data?.document) {
                  setKnowledge((prev) => ({
                    ...prev,
                    documents: [data.data.document, ...(prev.documents || []).filter((d) => d.id !== data.data.document.id)],
                  }));
                }
              } catch (e) {
                console.warn("[Workdesk] Failed to persist ticket to RAG:", e);
              }
              await knowledgev8Connector.ingestResolvedTicket(ticketPayload);
              await handleDeductCredits(20, `Indexed ticket ${ticket.externalId} into pgvector RAG corpus`);
            }}
            onDeductCredits={handleDeductCredits}
            onTriggerTemporalActivity={async (ticketId, activityType, payload) => {
              console.log(`[Temporal Orchestration Activity] Dispatched: ${activityType} for ${ticketId}`, payload);
              try {
                await fetch("/api/interservice", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    targetService: "dominion",
                    operation: "emitAlert",
                    payload: {
                      severity: activityType === "ticket_status_change" && payload?.status === "escalated" ? "high" : "low",
                      title: `[Temporal Activity] ${activityType} on ${ticketId}`,
                      description: JSON.stringify(payload || {}),
                    },
                  }),
                });
              } catch (e) {
                // Non-blocking telemetry
              }
            }}
            onEscalate={(issue) => {
              setSelectedTicketForEscalation({
                ticketId: issue.id,
                externalId: issue.externalId,
                customerName: issue.customerName,
                assignedAgent: issue.assignedTo || "Unassigned",
                remainingMinutes: 45,
                status: "at_risk",
              });
              setIsEscalateModalOpen(true);
            }}
            initialCustomerForTicket={preselectedCustomerForTicket}
            onClearInitialCustomer={() => setPreselectedCustomerForTicket(null)}
            onNotify={notify}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: CUSTOMER DIRECTORY & BIODATA */}
        {/* ========================================================================= */}
        {activeTab === "customers" && (
          <CustomerProfilesView
            onCreateTicketForCustomer={(customer) => {
              setPreselectedCustomerForTicket(customer);
              setActiveTab("workspace");
            }}
            onNotify={(msg, type) => notify(msg, type || "success")}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: ASK SUPPORTV8 AI WORKFORCE (DEDICATED CONVERSATIONAL WORKSPACE) */}
        {/* ========================================================================= */}
        {activeTab === "ask" && (
          <AskWorkspaceView
            workforce={workforce}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={handleSelectEmployee}
            messages={chatMessages}
            onSendMessage={(q) => handleAskChat(undefined, q)}
            onClearChat={handleClearChat}
            onChatAction={handleChatAction}
            loading={chatLoading}
            onNavigateToMarketplace={() => setActiveTab("market_workforce")}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: MARKETPLACE WORKFORCE / INSTALLED PRODUCTS */}
        {/* ========================================================================= */}
        {activeTab === "market_workforce" && (
          <MarketplaceWorkforceView
            workforce={marketplaceWorkforce}
            onHireAgent={handleHireAgent}
            onNavigateToStudio={(subTab) => {
              if (subTab) setStudioSubTab(subTab as any);
              setActiveTab("studio");
            }}
            onNavigateToMarketplace={() => setActiveTab("studio_marketplace")}
            onNavigateToWorkforce={() => setActiveTab("workforce")}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: MARKETPLACE PLANS */}
        {/* ========================================================================= */}
        {activeTab === "market_plans" && (
          <MarketplacePlansView
            plans={plans}
            billingCycle={planBillingCycle}
            onToggleBillingCycle={setPlanBillingCycle}
            onSelectPlan={handleSelectPlan}
            onNotify={(msg, type) => notify(msg, type || "success")}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: GOVERNANCE SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === "gov_settings" && (
          <GovernanceSettingsView
            settings={tenantSettings}
            tenantOperatingMode={operatingMode}
            onUpdateSettings={handleUpdateSettings}
            onNotify={notify}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: GOVERNANCE MEMBERS & RBAC */}
        {/* ========================================================================= */}
        {activeTab === "gov_members" && (
          <GovernanceMembersView
            key={currentTenantSlug}
            members={members}
            onOpenInviteModal={() => setIsInviteModalOpen(true)}
            onUpdateMember={(updated) => {
              setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
              setActionNotice({ text: `Updated account profile for ${updated.name}`, type: "success" });
            }}
            onUpdateMembers={(newList) => setMembers(newList)}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: GOVERNANCE AUDIT LOGS */}
        {/* ========================================================================= */}
        {activeTab === "gov_audit" && (
          <GovernanceAuditLogsView
            auditLogs={auditLogs}
            onNotify={notify}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: GOVERNANCE REPORTS & COMPLIANCE */}
        {/* ========================================================================= */}
        {activeTab === "gov_reports" && (
          <GovernanceReportsView
            reports={complianceReports}
            onDownloadCsv={(id) => notify(`Downloaded compliance audit CSV package for ${id}`, "success")}
          />
        )}
      </main>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
          <InviteMemberModal {...{ handleInviteMember, inviteEmail, inviteName, inviteRole, setInviteEmail, setInviteName, setInviteRole, setIsInviteModalOpen }} />
        )}

      {/* Connector Configuration Modal */}
      {isConnectorConfigOpen && selectedConnectorForConfig && (
          <ConnectorConfigModal {...{ notify, selectedConnectorForConfig, setIsConnectorConfigOpen }} />
        )}

      {/* Priority Escalation & Support Personnel Re-assignment Modal */}
      {isEscalateModalOpen && selectedTicketForEscalation && (
          <EscalationModal {...{ currentRole, escalateAssignee, escalateAssigneeType, escalatePriority, escalateReason, fetchData, isSubmittingEscalation, marketplaceWorkforce, notify, operatorSession, selectedTicketForEscalation, setEscalateAssignee, setEscalateAssigneeType, setEscalatePriority, setEscalateReason, setIsEscalateModalOpen, setIsSubmittingEscalation }} />
        )}

      {/* ========================================================================= */}
      {/* EXPANDED ASK SUPPORTV8 AI WORKFORCE MULTI-TURN COPILOT CONSOLE */}
      {/* ========================================================================= */}
      {isChatOpen && (
          <CopilotConsoleModal {...{ chatLoading, chatMessages, chatQuery, handleAskChat, handleChatAction, handleClearChat, handleSelectEmployee, selectedEmployeeId, setChatQuery, setIsChatOpen, setShowModalPrompts, showModalPrompts, workforce }} />
        )}


      {/* ========================================================================= */}
      {/* PROACTIVE BROADCAST MODAL */}
      {/* ========================================================================= */}
      {isBroadcastModalOpen && broadcastProblem && broadcastDraft && (
          <BroadcastModal {...{ broadcastDraft, broadcastProblem, broadcastSuccessMsg, handleSendBroadcast, setBroadcastDraft, setIsBroadcastModalOpen }} />
        )}

      {/* ========================================================================= */}
      {/* DIRECT WORK ASSIGNMENT MODAL (AI EMPLOYEE ONLY) */}
      {/* ========================================================================= */}
      {isWorkAssignModalOpen && selectedEmployeeForAssign && (
          <WorkAssignModal {...{ assignDescription, assignTicketId, handleConfirmAssignWork, isAssigningWork, issues, selectedEmployeeForAssign, setAssignDescription, setAssignTicketId, setIsWorkAssignModalOpen }} />
        )}
      </div>

      {/* ========================================================================= */}
      {/* VOICE BOT PROVISIONING MODAL (GROWTHV8 VAPI & TWILIO API) */}
      {/* ========================================================================= */}
      {isVoiceProvisionModalOpen && (
          <VoiceProvisionModal {...{ handleProvisionVoiceBot, isProvisioningVoice, provEmployeeId, provFirstMessage, provMinVerification, provPermissionScopes, provPhoneNumber, provProvider, provSystemPrompt, setIsVoiceProvisionModalOpen, setProvEmployeeId, setProvFirstMessage, setProvMinVerification, setProvPermissionScopes, setProvPhoneNumber, setProvProvider, setProvSystemPrompt, workforce }} />
        )}

      {/* ========================================================================= */}
      {/* EDIT PERMISSION SCOPES MODAL */}
      {/* ========================================================================= */}
      {isEditPermissionsModalOpen && selectedConfigForPermissions && (
          <PermissionScopesModal {...{ editPermissionScopes, handleSavePermissions, selectedConfigForPermissions, setEditPermissionScopes, setIsEditPermissionsModalOpen }} />
        )}

      {/* ========================================================================= */}
      {/* EDIT VOICE AGENT MODAL */}
      {/* ========================================================================= */}
      {isVoiceEditModalOpen && selectedConfigForEdit && (
          <VoiceAgentEditModal {...{ editVoiceAgentName, editVoiceEmployeeId, editVoiceFirstMessage, editVoiceIsActive, editVoiceMinVerification, editVoicePhoneNumber, editVoiceProvider, editVoiceScopes, editVoiceServiceMode, editVoiceSystemPrompt, handleDeleteVoiceAgent, handleSaveEditVoiceAgent, isSavingVoiceEdit, selectedConfigForEdit, setEditVoiceAgentName, setEditVoiceEmployeeId, setEditVoiceFirstMessage, setEditVoiceIsActive, setEditVoiceMinVerification, setEditVoicePhoneNumber, setEditVoiceProvider, setEditVoiceScopes, setEditVoiceServiceMode, setEditVoiceSystemPrompt, setIsVoiceEditModalOpen, workforce }} />
        )}

      {/* ForgeGW Managed vs BYOM Configuration Modal (GrowthV8 Architecture) */}
      {isForgeGwModalOpen && (
          <ForgeGwModal {...{ byomApiKey, byomModel, forgeGwCredits, handleAddCredits, modelProvider, notify, setByomApiKey, setByomModel, setIsForgeGwModalOpen, setModelProvider }} />
        )}

      {/* KnowledgeV8-Inspired Floating ? Page Guide Dock */}
      <FloatingPageGuide
        activeTab={activeTab}
        onNotify={(text, type) => setActionNotice({ text, type: type || "info" })}
      />

      {/* GrowthV8-Inspired Tenant Provisioning & Signup Modal */}
      <SignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        onSuccess={(slug, adminEmail) => {
          setCurrentTenantSlug(slug);
          setSignInPrefillEmail(adminEmail || "");
          setIsSignupModalOpen(false);
          setIsSignInModalOpen(true);
          notify(`Workspace '${slug}' provisioned! Please sign in with your administrator credentials.`, "success");
        }}
      />
    </SupportFamilyShell>
  );
}

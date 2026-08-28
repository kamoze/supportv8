"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Bot,
  Brain,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Flame,
  Gauge,
  Globe,
  HeartPulse,
  Key,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Lock,
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
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
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
} from "@/lib/types";
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
  INITIAL_MEMBERS,
  INITIAL_SETTINGS,
  INITIAL_REPORTS,
  INITIAL_AUDIT_LOGS,
} from "@/lib/services/marketplace-service";

import { FocusedWorkspaceView } from "@/components/views/FocusedWorkspaceView";
import { AskWorkspaceView } from "@/components/views/AskWorkspaceView";
import { MarketplaceConnectorsView } from "@/components/views/MarketplaceConnectorsView";
import { StudioMarketplaceHubView } from "@/components/views/StudioMarketplaceHubView";
import { MarketplaceWorkforceView } from "@/components/views/MarketplaceWorkforceView";
import { MarketplacePlansView } from "@/components/views/MarketplacePlansView";
import { GovernanceSettingsView } from "@/components/views/GovernanceSettingsView";
import { GovernanceMembersView } from "@/components/views/GovernanceMembersView";
import { GovernanceReportsView } from "@/components/views/GovernanceReportsView";
import { GovernanceAuditLogsView } from "@/components/views/GovernanceAuditLogsView";
import { AutonomousStudioView } from "@/components/views/AutonomousStudioView";
import { KnowledgeSuiteView } from "@/components/views/KnowledgeSuiteView";
import { PoliciesAndRulesView } from "@/components/views/PoliciesAndRulesView";
import { FloatingPageGuide } from "@/components/FloatingPageGuide";
import { GlobalLandingView } from "@/components/GlobalLandingView";
import { TenantLandingView } from "@/components/TenantLandingView";
import { SignupModal } from "@/components/SignupModal";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";
import { WorkforceAvatar } from "@/components/WorkforceAvatar";

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

export default function SupportV8Dashboard() {
  // Global View Mode & Multi-Tenant Routing
  const [viewMode, setViewMode] = useState<"cockpit" | "global_landing" | "tenant_landing">("cockpit");
  const [currentTenantSlug, setCurrentTenantSlug] = useState<string>("acme");
  const [isSignupModalOpen, setIsSignupModalOpen] = useState<boolean>(false);

  // Navigation & Active View
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [operatingMode, setOperatingMode] = useState<OperatingMode>("autonomous");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);

  // Search & Multi-Turn Chat Modal with AI Employee selector
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [showModalPrompts, setShowModalPrompts] = useState<boolean>(true);
  const [chatQuery, setChatQuery] = useState<string>("");
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatResponse, setChatResponse] = useState<any | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("emp_support_lead");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg_init",
      role: "assistant",
      content: "Hello! I am **Alex (Support Intelligence Lead)**. I'm connected to all real-time ingress lines, pgvector embeddings, and ServiceV8 verticals.\n\nSelect an enabled AI Employee above or ask me any question about active systemic problems, SLA risks, knowledge gaps, or telephony calls.",
      employeeId: "emp_support_lead",
      employeeName: "Alex — Support Intelligence Lead",
      employeeRole: "Senior Support Employee",
      employeeAvatar: "🤖",
      suggestedActions: [
        { label: "View Problem Correlation Matrix", action: "navigate", targetTab: "problems" },
        { label: "Inspect SLA Timers", action: "navigate", targetTab: "cx_cockpit" },
      ],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

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
  }>({ attainmentRate: 98.4, totalTracked: 5, healthyCount: 3, atRiskCount: 2, breachedCount: 1, tickets: [] });

  const [customerHealthData, setCustomerHealthData] = useState<{
    avgHealthScore: number;
    totalArrAtRisk: number;
    criticalCount: number;
    concerningCount: number;
    healthyCount: number;
    activeVipChurnAlerts: any[];
    accounts: any[];
  }>({ avgHealthScore: 78, totalArrAtRisk: 420000, criticalCount: 1, concerningCount: 1, healthyCount: 2, activeVipChurnAlerts: [], accounts: [] });

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
  }>({ overallQaAverage: 94, aiEmployeeAverage: 92, humanAgentAverage: 95, hallucinationRate: 2.1, fcrAverage: 88, scorecards: [] });

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
      overallCsat: 91.4,
      customerEffortScore: 4.6,
      netPromoterScore: 54,
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
  }>({ overallCapacityPercentage: 46, totalActiveConversations: 142, channels: [], rules: [] });

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

  // Issue Filter States
  const [issueSearch, setIssueSearch] = useState<string>("" );
  const [issueSentimentFilter, setIssueSentimentFilter] = useState<string>("all");
  const [issueSourceFilter, setIssueSourceFilter] = useState<string>("all");

  // Marketplace & Governance States
  const [connectors, setConnectors] = useState<MarketplaceConnector[]>(INITIAL_CONNECTORS);
  const [marketplaceWorkforce, setMarketplaceWorkforce] = useState<MarketplaceWorkforceItem[]>(INITIAL_WORKFORCE_CATALOG);
  const [plans, setPlans] = useState<MarketplacePlan[]>(INITIAL_PLANS);
  const [members, setMembers] = useState<TenantMember[]>(INITIAL_MEMBERS);
  const [tenantSettings, setTenantSettings] = useState<TenantSettingConfig>(INITIAL_SETTINGS);
  const [complianceReports, setComplianceReports] = useState<ComplianceAuditReport[]>(INITIAL_REPORTS);
  const [auditLogs, setAuditLogs] = useState<TenantAuditLog[]>(INITIAL_AUDIT_LOGS);
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
  const [escalateAssignee, setEscalateAssignee] = useState<string>("Alex — Support Intelligence Lead (AI)");
  const [escalateAssigneeType, setEscalateAssigneeType] = useState<"ai" | "human">("ai");
  const [escalatePriority, setEscalatePriority] = useState<string>("urgent");
  const [escalateReason, setEscalateReason] = useState<string>("SLA Pre-breach Hazard & Executive VIP Priority");
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState<boolean>(false);

  // Workspace States
  const [workspaceSelectedIssueId, setWorkspaceSelectedIssueId] = useState<string>("ISS-1001");
  const [workspaceReplyText, setWorkspaceReplyText] = useState<string>("Hello, I have reviewed your request. Our autonomous resolution engine has approved the mitigation.");
  const [workspaceRefundAmount, setWorkspaceRefundAmount] = useState<string>("49.00");
  const [workspaceTriageFilter, setWorkspaceTriageFilter] = useState<"all" | "enterprise" | "p1_p2" | "at_risk">("all");
  const [workspaceDrafting, setWorkspaceDrafting] = useState<boolean>(false);

  // Load all initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [ovRes, issRes, prbRes, insRes, kbRes, swRes, srcRes, polRes, trRes, wfRes, vcRes, vertRes, slaRes, healthRes, qaRes, vocRes, qRes, marketRes] = await Promise.all([
        fetch("/api/overview").then((r) => r.json()),
        fetch("/api/issues").then((r) => r.json()),
        fetch("/api/problems").then((r) => r.json()),
        fetch("/api/insights").then((r) => r.json()),
        fetch("/api/knowledge").then((r) => r.json()),
        fetch("/api/stale-work").then((r) => r.json()),
        fetch("/api/sources").then((r) => r.json()),
        fetch("/api/policies").then((r) => r.json()),
        fetch("/api/trends").then((r) => r.json()),
        fetch("/api/workforce").then((r) => r.json()),
        fetch("/api/voice/session").then((r) => r.json()),
        fetch("/api/verticals").then((r) => r.json()),
        fetch("/api/cx/sla").then((r) => r.json()),
        fetch("/api/cx/customer-health").then((r) => r.json()),
        fetch("/api/cx/qa-scorecards").then((r) => r.json()),
        fetch("/api/cx/voc-digest").then((r) => r.json()),
        fetch("/api/cx/queue").then((r) => r.json()),
        fetch("/api/marketplace").then((r) => r.json()).catch(() => ({ success: false })),
      ]);

      if (ovRes.success) setOverview(ovRes.data);
      if (issRes.success) setIssues(issRes.data);
      if (prbRes.success) setProblems(prbRes.data);
      if (insRes.success) setInsights(insRes.data);
      if (kbRes.success) setKnowledge(kbRes.data);
      if (swRes.success) setStaleWork(swRes.data);
      if (srcRes.success) setSources(srcRes.data);
      if (wfRes.success) setWorkforce(wfRes.data);
      if (vertRes.success) setVerticals(vertRes.data);
      if (slaRes.success) setSlaData(slaRes.data);
      if (healthRes.success) setCustomerHealthData(healthRes.data);
      if (qaRes.success) setQaData(qaRes.data);
      if (vocRes.success) setVocDigestData(vocRes.data);
      if (qRes.success) setQueueData(qRes.data);
      if (marketRes?.success && marketRes.data) {
        setConnectors(marketRes.data.connectors || INITIAL_CONNECTORS);
        setMarketplaceWorkforce(marketRes.data.workforce || INITIAL_WORKFORCE_CATALOG);
        setPlans(marketRes.data.plans || INITIAL_PLANS);
        setMembers(marketRes.data.members || INITIAL_MEMBERS);
        setTenantSettings(marketRes.data.settings || INITIAL_SETTINGS);
        setComplianceReports(marketRes.data.reports || INITIAL_REPORTS);
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
        setOperatingMode(polRes.data.operatingMode);
      }
      if (trRes.success) setTrends(trRes.data);
    } catch (err) {
      console.error("Failed to load supportv8 data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Detect Subdomain & URL parameters for tenant vs global landing
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tenantParam = params.get("tenant");
      const landingParam = params.get("landing");
      const host = window.location.hostname;

      if (landingParam === "global") {
        setViewMode("global_landing");
      } else if (tenantParam) {
        setCurrentTenantSlug(tenantParam);
        setViewMode("tenant_landing");
      } else if (
        host.includes(".support.") &&
        !host.startsWith("www.") &&
        !host.startsWith("support.")
      ) {
        const slug = host.split(".")[0];
        setCurrentTenantSlug(slug);
        setViewMode("tenant_landing");
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", proposalId }),
      }).then((r) => r.json());

      if (res.success) {
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
        setPolicySimResult(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAskChat = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const queryToSend = overrideQuery || chatQuery;
    if (!queryToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: queryToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatQuery("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryToSend,
          employeeId: selectedEmployeeId,
        }),
      }).then((r) => r.json());

      if (res.success) {
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
      } else {
        notify(res.error || "Chat query failed", "error");
      }
    } catch (err) {
      console.error(err);
      notify("Network error during chat query", "error");
    } finally {
      setChatLoading(false);
    }
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
    setChatMessages([
      {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "Chat history cleared. Select an enabled AI Employee or enter any support query to get started.",
        employeeId: selectedEmployeeId,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
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

  const handleSelectPlan = async (planId: string) => {
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select_plan", planId }),
      }).then((r) => r.json());

      if (res.success) {
        setPlans((prev) => prev.map((p) => ({ ...p, isCurrent: p.id === planId })));
        notify(res.message, "success");
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
    try {
      const updated = { ...tenantSettings, ...updates };
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_settings", settings: updated }),
      }).then((r) => r.json());

      if (res.success) {
        setTenantSettings(updated);
        notify("Tenant settings updated successfully", "success");
      }
    } catch (err) {
      notify("Failed to save settings", "error");
    }
  };

  const handleWorkspaceAutonomousResolve = async (issueId: string) => {
    try {
      await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", issueId }),
      });
      notify(`Issue ${issueId} resolved autonomously by Alex (Support Intelligence Lead)!`, "success");
      fetchData();
    } catch (err) {
      notify("Failed to resolve issue", "error");
    }
  };

  const handleWorkspaceProcessRefund = async (issueId: string, amount: string) => {
    try {
      await fetch("/api/verticals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verticalId: "orderv8",
          operation: "order.refund",
          payload: {
            orderId: "ORD-99412",
            amount: parseFloat(amount) || 49.0,
            reason: "Customer Satisfaction Refund",
          },
        }),
      });
      notify(`Refund of $${amount} issued via OrderV8 API!`, "success");
    } catch (err) {
      notify("Failed to process refund", "error");
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

  const navSections = [
    {
      title: "Work Desk",
      items: [
        { id: "workspace", label: "Work Desk", icon: Briefcase, flaticon: "fi fi-rr-briefcase", badge: issues.length },
        { id: "problems", label: "Problem Matrix", icon: AlertTriangle, flaticon: "fi fi-rr-triangle-warning", badge: problems.length, badgeColor: "err" },
        { id: "issues", label: "Derived Issues", icon: MessageSquare, flaticon: "fi fi-rr-comment-alt-middle", badge: issues.length },
        { id: "cx_cockpit", label: "CX Cockpit", icon: Target, flaticon: "fi fi-rr-target", badge: slaData.atRiskCount, badgeColor: "warn" },
      ],
    },
    {
      title: "Core Intelligence",
      items: [
        { id: "overview", label: "Overview", icon: LayoutDashboard, flaticon: "fi fi-rr-dashboard" },
        { id: "ask", label: "Ask supportV8", icon: MessageSquare, flaticon: "fi fi-rr-comment-alt-dots" },
        { id: "studio", label: "Autonomous Studio", icon: Cpu, flaticon: "fi fi-rr-microchip" },
        { id: "workforce", label: "AI Workforce", icon: Users, flaticon: "fi fi-rr-users-alt", badge: workforce.length },
        { id: "voice", label: "Voice Telephony", icon: PhoneCall, flaticon: "fi fi-rr-headset", badge: voiceData.sessions?.length },
      ],
    },
    {
      title: "Knowledge & Radar",
      items: [
        { id: "trends", label: "Trend Radar", icon: TrendingUp, flaticon: "fi fi-rr-chart-line-up" },
        { id: "knowledge", label: "Knowledge Suite", icon: Brain, flaticon: "fi fi-rr-brain" },
        { id: "stale_work", label: "Work Sweep", icon: Clock, flaticon: "fi fi-rr-time-past", badge: 43 },
      ],
    },
    {
      title: "Marketplace & Registry",
      items: [
        { id: "studio_marketplace", label: "Studio Marketplace", icon: ShoppingBag, flaticon: "fi fi-rr-shopping-bag" },
        { id: "market_workforce", label: "Active Capabilities", icon: Users, flaticon: "fi fi-rr-users-alt" },
        { id: "market_plans", label: "Plans & Credits", icon: CreditCard, flaticon: "fi fi-rr-credit-card" },
      ],
    },
    {
      title: "Governance",
      items: [
        { id: "gov_settings", label: "Settings", icon: Settings, flaticon: "fi fi-rr-settings" },
        { id: "gov_members", label: "Members", icon: User, flaticon: "fi fi-rr-user", badge: members.length },
        { id: "gov_audit", label: "Audit Logs", icon: ShieldCheck, flaticon: "fi fi-rr-shield-check", badge: auditLogs.length },
        { id: "gov_reports", label: "Reports", icon: FileText, flaticon: "fi fi-rr-document" },
        { id: "policies", label: "Policies & Rules", icon: Shield, flaticon: "fi fi-rr-shield-check" },
      ],
    },
  ];

  if (viewMode === "global_landing") {
    return (
      <>
        <GlobalLandingView
          onEnterCockpit={() => setViewMode("cockpit")}
          onOpenTenantPortal={(slug) => {
            if (slug) setCurrentTenantSlug(slug);
            setViewMode("tenant_landing");
          }}
          onOpenSignup={() => setIsSignupModalOpen(true)}
        />
        <SignupModal
          isOpen={isSignupModalOpen}
          onClose={() => setIsSignupModalOpen(false)}
          onSuccess={(slug) => {
            setCurrentTenantSlug(slug);
            setViewMode("tenant_landing");
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
          onEnterCockpit={() => setViewMode("cockpit")}
          onOpenGlobalLanding={() => setViewMode("global_landing")}
          onOpenSignup={() => setIsSignupModalOpen(true)}
        />
        <SignupModal
          isOpen={isSignupModalOpen}
          onClose={() => setIsSignupModalOpen(false)}
          onSuccess={(slug) => {
            setCurrentTenantSlug(slug);
            setViewMode("tenant_landing");
          }}
        />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-[#0B1017] text-[#EAF1F8] font-sans overflow-hidden">
      {/* Toast Notification */}
      {actionNotice && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg border shadow-xl flex items-center gap-3 ${
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
      <aside
        className={`relative flex flex-col shrink-0 bg-[#0C121A] border-r border-[var(--line)] transition-all duration-200 ease-in-out z-30 select-none h-screen ${
          isSidebarCollapsed ? "w-[72px]" : "w-64"
        }`}
      >
        {/* Sidebar Header with SupportV8 Logo & Min/Max Toggle */}
        <div className={`p-4 border-b border-[var(--line)] flex items-center ${isSidebarCollapsed ? "justify-center flex-col gap-2" : "justify-between"}`}>
          <SupportV8Logo size={32} showText={!isSidebarCollapsed} />
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="btn btn-secondary p-1.5 cursor-pointer text-[#6B7C8D] hover:text-[#EAF1F8] hover:border-[#2ED8B6]"
            title={isSidebarCollapsed ? "Maximize Sidebar (Expand)" : "Minimize Sidebar (Collapse)"}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-4">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!isSidebarCollapsed ? (
                <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold text-[#6B7C8D] uppercase tracking-wider font-mono">
                  {section.title}
                </div>
              ) : sIdx > 0 ? (
                <div className="border-t border-[var(--line)] my-2" />
              ) : null}

              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return !isSidebarCollapsed ? (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#2ED8B6]/12 text-[#2ED8B6] border border-[#2ED8B6]/40 shadow-sm font-semibold"
                        : "text-[#B4C2D0] hover:text-[#EAF1F8] hover:bg-[#18222E]/80 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <i className={`${item.flaticon} text-sm ${isActive ? "text-[#2ED8B6]" : "text-[#6B7C8D]"}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`pill text-[10px] py-0 px-1.5 ${item.badgeColor || (isActive ? "ok" : "")}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={item.label}
                    className={`relative w-10 h-10 mx-auto flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/50 shadow-sm"
                        : "text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] border border-transparent"
                    }`}
                  >
                    <i className={`${item.flaticon} text-base ${isActive ? "text-[#2ED8B6]" : "text-[#6B7C8D]"}`} />
                    {item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#F5A623] ring-2 ring-[#0C121A]" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--line)] bg-[#0B1017]/50 space-y-2">
          {!isSidebarCollapsed ? (
            <>
              <button
                onClick={() => setIsChatOpen(true)}
                className="btn btn-secondary w-full justify-start text-xs font-semibold cursor-pointer"
              >
                <i className="fi fi-rr-comment-alt-dots text-sm text-[#2ED8B6]" />
                <span className="flex-1 text-left">Ask supportV8</span>
                <kbd className="bg-[#121A24] px-1 py-0.5 rounded text-[9px] text-[#6B7C8D] font-mono border border-[var(--line)]">
                  ⌘K
                </kbd>
              </button>
              <div className="flex items-center justify-between px-2 pt-1 text-[11px] font-mono text-[#6B7C8D]">
                <span>tenant_default</span>
                <span className="pill ok text-[9px] py-0"><i className="dot"></i> LIVE</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setIsChatOpen(true)}
                title="Ask supportV8 (⌘K)"
                className="btn btn-secondary p-2 cursor-pointer text-[#2ED8B6]"
              >
                <i className="fi fi-rr-comment-alt-dots text-base text-[#2ED8B6]" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN VIEWPORT (STICKY TOPBAR + SCROLLABLE DASHBOARD VIEW) */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-screen bg-[#0B1017] ${
          activeTab === "ask" || activeTab === "workspace" ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        {/* Topbar Header */}
        <header className="sticky top-0 z-20 bg-[#0B1017]/90 backdrop-blur-md border-b border-[var(--line)] px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center tracking-[-0.035em] font-sans select-none">
                <span className="text-white font-extrabold">support</span>
                <span className="text-[#2ED8B6] font-mono font-extrabold tracking-[-0.02em] ml-0.5">V8</span>
              </span>
              <span className="text-[#6B7C8D] font-mono">/</span>
              <span className="text-[#EAF1F8] font-bold font-mono">
                {navSections.flatMap((s) => s.items).find((i) => i.id === activeTab)?.label || activeTab}
              </span>
            </div>
            <span className="pill ok hidden sm:inline-flex text-[10px]">
              <i className="dot"></i>
              AUTONOMOUS MESH
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Operating Mode Selector */}
            <div className="flex items-center gap-1 bg-[#18222E] p-1 rounded-lg border border-[var(--line)]">
              {(["observe", "copilot", "autonomous"] as OperatingMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setOperatingMode(mode);
                    notify(`Tenant operating mode set to ${mode.toUpperCase()}`, "info");
                  }}
                  className={`btn text-xs capitalize ${
                    operatingMode === mode
                      ? "btn-primary shadow-sm"
                      : "btn-secondary border-transparent bg-transparent text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  {mode === "observe" && <Eye className="w-3 h-3" />}
                  {mode === "copilot" && <Zap className="w-3 h-3" />}
                  {mode === "autonomous" && <Bot className="w-3 h-3" />}
                  <span className="hidden md:inline">{mode}</span>
                </button>
              ))}
            </div>

            {/* Surface Mode Switchers */}
            <div className="hidden xl:flex items-center gap-1.5 bg-[#141C26] p-1 rounded-xl border border-[var(--line)] text-xs font-mono">
              <button
                type="button"
                onClick={() => setViewMode("global_landing")}
                className="px-2.5 py-1 rounded-lg text-[#8E9AA8] hover:text-[#EAF1F8] hover:bg-[#1C2836] transition-colors cursor-pointer"
              >
                Global Landing
              </button>
              <button
                type="button"
                onClick={() => setViewMode("tenant_landing")}
                className="px-2.5 py-1 rounded-lg text-[#4D9FFF] hover:bg-[#1C2836] transition-colors cursor-pointer flex items-center gap-1"
              >
                <Globe className="w-3 h-3" />
                <span>Tenant ({currentTenantSlug})</span>
              </button>
            </div>

            {/* Quick Ask Chat Button */}
            <button
              onClick={() => setIsChatOpen(true)}
              className="btn btn-secondary text-xs cursor-pointer"
            >
              <i className="fi fi-rr-comment-alt-dots text-sm text-[#2ED8B6]" />
              <span className="hidden sm:inline">Ask supportV8...</span>
              <kbd className="hidden lg:inline-block bg-[#121A24] px-1.5 py-0.5 rounded text-[10px] text-[#6B7C8D] font-mono border border-[var(--line)]">
                ⌘K
              </kbd>
            </button>

            {/* Refresh Intelligence Data */}
            <button
              onClick={fetchData}
              title="Refresh Intelligence Data"
              className="btn btn-secondary p-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#2ED8B6]" : ""}`} />
            </button>
          </div>
        </header>

        {/* Main Content View with GrowthV8 Layout */}
        <main
          className={
            activeTab === "ask" || activeTab === "workspace"
              ? "flex-1 flex flex-col min-h-0 w-full overflow-hidden"
              : "flex-1 p-4 sm:p-6 md:p-8 max-w-[1680px] w-full mx-auto space-y-6"
          }
        >
        {/* ========================================================================= */}
        {/* TAB: OVERVIEW (GROWTHV8 DASHBOARD REPLICATION) */}
        {/* ========================================================================= */}
        {activeTab === "overview" && overview && (
          <div className="space-y-6">
            {/* GrowthV8 Hero Banner */}
            <div className="card p-6 relative overflow-hidden bg-gradient-to-r from-[#121A24] via-[#121A24] to-[#18222E]">
              <div className="max-w-2xl space-y-2 relative z-10">
                <span className="eyebrow">Continuous Support Intelligence &amp; Autonomous Resolution</span>
                <h1 className="text-2xl font-bold text-[#EAF1F8] tracking-tight">
                  Support Intelligence &amp; Autonomous Resolution
                </h1>
                <p className="text-xs text-[#B4C2D0] leading-relaxed">
                  Real-time problem correlation, SLA breach prediction, voice copilot telephony, and governed cross-vertical action dispatch for ServiceV8.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 relative z-10">
                <button
                  onClick={() => setActiveTab("cx_cockpit")}
                  className="btn btn-primary cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>Open CX Cockpit</span>
                </button>
                <button
                  onClick={() => setActiveTab("voice")}
                  className="btn btn-secondary cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Launch Voice Telephony</span>
                </button>
              </div>
            </div>

            {/* GrowthV8 Metric Strip */}
            <div className="metric-grid">
              <div className="metric">
                <div className="flex items-center justify-between">
                  <span>Customer CSAT</span>
                  <span className={`pill ${overview.csatChange >= 0 ? "ok" : "err"}`}>
                    <i className="dot"></i> {overview.csatChange >= 0 ? `+${overview.csatChange}%` : `${overview.csatChange}%`}
                  </span>
                </div>
                <strong>{overview.csat}%</strong>
                <small>Target 90% Attainment</small>
              </div>

              <div className="metric">
                <div className="flex items-center justify-between">
                  <span>Issue Volume</span>
                  <span className={`pill ${overview.issueVolumeChange >= 0 ? "ok" : "warn"}`}>
                    <i className="dot"></i> {overview.issueVolumeChange >= 0 ? `+${overview.issueVolumeChange}%` : `${overview.issueVolumeChange}%`}
                  </span>
                </div>
                <strong>{overview.issueVolume.toLocaleString()}</strong>
                <small>{sources.length} Ingress Lines Connected</small>
              </div>

              <div className="metric border-[#E5484D]/40 bg-[#E5484D]/5">
                <div className="flex items-center justify-between">
                  <span className="text-[#E5484D]">Active Problems</span>
                  <span className="pill err"><i className="dot"></i> Critical</span>
                </div>
                <strong className="text-[#E5484D]">{overview.activeProblems}</strong>
                <small className="text-[#E5484D]/80">
                  {problems.filter((p) => p.status !== "resolved").reduce((s, p) => s + (p.affectedCustomerCount || 0), 0)} Linked Exposure Cases
                </small>
              </div>

              <div className="metric">
                <div className="flex items-center justify-between">
                  <span>North Star VARR</span>
                  <Bot className="w-3.5 h-3.5 text-[#2ED8B6]" />
                </div>
                <strong className="text-[#2ED8B6]">{overview.varrRate}%</strong>
                <small>Verified Autonomous Resolution</small>
              </div>

              <div className="metric">
                <div className="flex items-center justify-between">
                  <span>Revenue Exposure</span>
                  <DollarSign className="w-3.5 h-3.5 text-[#F5A623]" />
                </div>
                <strong className="text-[#F5A623]">${(overview.businessExposure / 1000).toFixed(0)}k</strong>
                <small>At-Risk Contract ARR</small>
              </div>
            </div>

            {/* Needs Attention & AI Discovered Priority Row */}
            {overview.needsAttention && overview.needsAttention.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#F5A623]" />
                    <h3 className="text-sm font-bold text-[#EAF1F8]">Action Required: Operations &amp; Incidents</h3>
                  </div>
                  <span className="pill warn"><i className="dot"></i> {overview.needsAttention.length} High Priority</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {overview.needsAttention.map((item) => (
                    <div
                      key={item.id}
                      className={`card p-4 space-y-3 border ${
                        item.severity === "critical"
                          ? "border-[#E5484D]/40 bg-[#E5484D]/5"
                          : item.severity === "warning"
                          ? "border-[#F5A623]/40 bg-[#F5A623]/5"
                          : "border-[#0091FF]/40 bg-[#0091FF]/5"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`pill ${
                            item.severity === "critical" ? "err" : item.severity === "warning" ? "warn" : "route"
                          }`}
                        >
                          <i className="dot"></i>
                          {item.impactText}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#EAF1F8]">{item.title}</h4>
                        <p className="text-[11px] text-[#B4C2D0] mt-1 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (item.targetTab) {
                            setActiveTab(item.targetTab as any);
                          }
                        }}
                        className="btn btn-secondary w-full text-xs cursor-pointer justify-center"
                      >
                        <span>{item.actionText}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Operations & Insights Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Live Activity Stream */}
              <div className="lg:col-span-2 card p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#2ED8B6]" />
                    <h3 className="text-sm font-bold text-[#EAF1F8]">Live Support &amp; Incident Operations</h3>
                  </div>
                  <span className="pill ok"><i className="dot"></i> Real-time Feed</span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {overview.recentActivity?.map((evt, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-[#18222E] border border-[var(--line)] flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#EAF1F8]">{evt.id}</span>
                          <span className={`pill ${evt.type === "problem_detected" || evt.type === "sentiment_alert" ? "err" : evt.type === "action_executed" ? "ok" : "warn"}`}>
                            <i className="dot"></i>
                            {evt.type.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-[#B4C2D0] leading-relaxed">{evt.description}</p>
                      </div>
                      <span className="font-mono text-[10px] text-[#6B7C8D] whitespace-nowrap">{evt.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Service Health & Autonomy Summary */}
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#2ED8B6]" />
                    <h3 className="text-sm font-bold text-[#EAF1F8]">Cluster &amp; Mesh Health</h3>
                  </div>
                  <span className="pill ok">NOMINAL</span>
                </div>

                <div className="space-y-3 text-xs font-mono">
                  <div className="flex justify-between border-b border-[var(--line)] pb-2">
                    <span className="text-[#6B7C8D]">Action Gateway Mesh</span>
                    <span className="text-[#2ED8B6] font-bold">Connected ({sources.length} Verticals)</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--line)] pb-2">
                    <span className="text-[#6B7C8D]">pgvector RAG Store</span>
                    <span className="text-[#2ED8B6] font-bold">1,536-dim (32k Vectors)</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--line)] pb-2">
                    <span className="text-[#6B7C8D]">Temporal Orchestrator</span>
                    <span className="text-[#2ED8B6] font-bold">Active Polling ({problems.length * 4 + 14} Workflows)</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--line)] pb-2">
                    <span className="text-[#6B7C8D]">Redis Cache L1</span>
                    <span className="text-[#2ED8B6] font-bold">0.8ms Avg Latency</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-[#6B7C8D]">Keycloak SSO Gate</span>
                    <span className="text-[#2ED8B6] font-bold">Multi-tenant Active</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setActiveTab("sources")}
                    className="btn btn-secondary w-full text-xs"
                  >
                    <Server className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Inspect Vertical Connectors</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: CX MANAGER COCKPIT (GROWTHV8 6 OPERATIONAL PILLARS) */}
        {/* ========================================================================= */}
        {activeTab === "cx_cockpit" && (
          <div className="space-y-6">
            {/* Header & Sub-Navigation for the 6 Pillars */}
            <div className="card p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-[#2ED8B6]" />
                  <h2 className="text-lg font-bold text-[#EAF1F8]">CX Manager Executive Operations Cockpit</h2>
                </div>
                <p className="text-xs text-[#B4C2D0] mt-0.5">
                  Comprehensive 6-pillar operational intelligence suite for Customer Experience &amp; Support Operations Leads.
                </p>
              </div>

              {/* 7 Sub-View Selector Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 bg-[#18222E] p-1 rounded-lg border border-[var(--line)] text-xs">
                {[
                  { id: "funnel", label: "Performance Funnel & KPIs", icon: Target },
                  { id: "sla", label: "1. SLA Predictor", icon: Clock, badge: slaData.atRiskCount, badgeColor: "warn" },
                  { id: "health", label: "2. 360° Health & Churn", icon: HeartPulse, badge: customerHealthData.activeVipChurnAlerts?.length || customerHealthData.criticalCount, badgeColor: "err" },
                  { id: "qa", label: "3. QA & Compliance", icon: Award },
                  { id: "voc", label: "4. VoC & CSAT Drivers", icon: BarChart3 },
                  { id: "queue", label: "5. Queue Balancer", icon: Layers },
                  { id: "standup", label: "6. Shift Standup Digest", icon: FileText },
                ].map((sub) => {
                  const Icon = sub.icon;
                  const isActive = cxSubView === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setCxSubView(sub.id as any)}
                      className={`btn text-xs cursor-pointer ${
                        isActive
                          ? "btn-route shadow-sm"
                          : "btn-secondary border-transparent bg-transparent text-[#6B7C8D] hover:text-[#EAF1F8]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{sub.label}</span>
                      {sub.badge !== undefined && sub.badge > 0 && (
                        <span className={`pill ${sub.badgeColor || (isActive ? "ok" : "")}`}>
                          <i className="dot"></i>
                          {sub.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* ========================================================================= */}
            {/* PERFORMANCE FUNNEL & EXECUTIVE INVOLVEMENT SCORECARD */}
            {/* ========================================================================= */}
            {cxSubView === "funnel" && (() => {
              const totalFunnelVolume = issues.length || 16;
              const aiInvolvedFunnelCount = issues.filter((i) => (i.confidence && i.confidence > 0) || (i.assignedTo && i.assignedTo.includes("AI"))).length;
              const aiInvolvementFunnelRate = Number(((aiInvolvedFunnelCount / totalFunnelVolume) * 100).toFixed(1));

              const autonomousFunnelCount = issues.filter(
                (i) => i.status === "resolved" || i.tags?.includes("autonomous_resolved") || i.confidence >= 0.85
              ).length;
              const varrFunnelRate = overviewMetrics.varrRate || Number(((autonomousFunnelCount / totalFunnelVolume) * 100).toFixed(1));

              const aiTriagedFunnelCount = issues.filter((i) => i.confidence >= 0.65).length;
              const aiTriagedFunnelRate = Number(((aiTriagedFunnelCount / totalFunnelVolume) * 100).toFixed(1));

              const humanEscalatedFunnelCount = Math.max(0, totalFunnelVolume - autonomousFunnelCount);
              const humanEscalatedFunnelRate = Number(((humanEscalatedFunnelCount / totalFunnelVolume) * 100).toFixed(1));

              const csatVal = overviewMetrics.csat || 93.8;

              return (
                <div className="space-y-6">
                  {/* Executive KPI Scorecard */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="card p-5 bg-[#121A24] border-[var(--line)] space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-[#6B7C8D]">
                        <span>AI INVOLVEMENT RATE</span>
                        <span className="pill ok text-[9px]">ACTIVE</span>
                      </div>
                      <div className="text-2xl font-extrabold font-mono text-[#2ED8B6]">{aiInvolvementFunnelRate}%</div>
                      <div className="text-[11px] text-[#B4C2D0]">{aiInvolvedFunnelCount} of {totalFunnelVolume} tickets touched by AI</div>
                    </div>

                    <div className="card p-5 bg-[#121A24] border-[var(--line)] space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-[#6B7C8D]">
                        <span>RESOLUTION RATE (VARR)</span>
                        <span className="pill ok text-[9px]">+4.8% WOW</span>
                      </div>
                      <div className="text-2xl font-extrabold font-mono text-[#4CC38A]">{varrFunnelRate}%</div>
                      <div className="text-[11px] text-[#B4C2D0]">{autonomousFunnelCount} tickets resolved autonomously without human</div>
                    </div>

                    <div className="card p-5 bg-[#121A24] border-[var(--line)] space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-[#6B7C8D]">
                        <span>CX CSAT SCORE</span>
                        <span className="pill ok text-[9px]">EXCELLENT</span>
                      </div>
                      <div className="text-2xl font-extrabold font-mono text-[#EAF1F8]">{csatVal} <span className="text-xs text-[#6B7C8D]">/ 100</span></div>
                      <div className="text-[11px] text-[#B4C2D0]">Post-resolution customer feedback</div>
                    </div>

                    <div className="card p-5 bg-[#121A24] border-[var(--line)] space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-[#6B7C8D]">
                        <span>AVG FIRST RESPONSE TIME</span>
                        <span className="pill text-[9px]">P1/P2 SPEED</span>
                      </div>
                      <div className="text-2xl font-extrabold font-mono text-[#4D9FFF]">1.2 <span className="text-xs text-[#6B7C8D]">mins</span></div>
                      <div className="text-[11px] text-[#B4C2D0]">94.2% faster than human queue</div>
                    </div>
                  </div>

                  {/* Autonomous Resolution Funnel Card */}
                  <div className="card p-6 bg-[#121A24] border-[var(--line)] space-y-5 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
                      <div>
                        <h3 className="text-sm font-bold text-[#EAF1F8] flex items-center gap-2">
                          <Target className="w-4 h-4 text-[#2ED8B6]" />
                          <span>Autonomous Ingress-to-Resolution Conversion Funnel</span>
                        </h3>
                        <p className="text-xs text-[#B4C2D0] mt-0.5">
                          End-to-end telemetry conversion from omnichannel ingress lines down to autonomous resolution.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => notify("Generated Executive Performance & Audit Report package (PDF/CSV)", "success")}
                        className="btn btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Generate Performance Report</span>
                      </button>
                    </div>

                    {/* Visual 4-Stage Funnel Bars */}
                    <div className="space-y-4 font-mono text-xs">
                      {/* Stage 1: Total Ingress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#EAF1F8]">1. Total Ingress Volume</span>
                          <span className="text-[#B4C2D0]">{totalFunnelVolume} Tickets (100%)</span>
                        </div>
                        <div className="w-full h-8 bg-[#18222E] rounded-xl overflow-hidden p-1 border border-[var(--line-2)] flex items-center">
                          <div className="h-full bg-gradient-to-r from-[#2ED8B6] to-[#20C997] rounded-lg w-full flex items-center px-3 text-[11px] font-bold text-[#04201C]">
                            Omnichannel Ingress (Email, Live Chat, Voice, Slack, WhatsApp)
                          </div>
                        </div>
                      </div>

                      {/* Stage 2: AI Triage & Routing */}
                      <div className="space-y-1.5 pl-4 border-l-2 border-[#2ED8B6]/40">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#EAF1F8]">2. AI Triage &amp; Intent Categorization</span>
                          <span className="text-[#2ED8B6]">{aiTriagedFunnelCount} Tickets ({aiTriagedFunnelRate}%)</span>
                        </div>
                        <div className="w-full h-8 bg-[#18222E] rounded-xl overflow-hidden p-1 border border-[var(--line-2)] flex items-center">
                          <div className="h-full bg-[#2ED8B6]/80 rounded-lg flex items-center px-3 text-[11px] font-bold text-[#04201C]" style={{ width: `${Math.max(20, aiTriagedFunnelRate)}%` }}>
                            Sophia, Chip &amp; Alex Categorized, Root-Cause Tagged, SLA Gated
                          </div>
                        </div>
                      </div>

                      {/* Stage 3: Autonomous Resolution */}
                      <div className="space-y-1.5 pl-8 border-l-2 border-[#4CC38A]/40">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#4CC38A]">3. Autonomous Resolution (VARR)</span>
                          <span className="text-[#4CC38A] font-bold">{autonomousFunnelCount} Tickets ({varrFunnelRate}%)</span>
                        </div>
                        <div className="w-full h-8 bg-[#18222E] rounded-xl overflow-hidden p-1 border border-[var(--line-2)] flex items-center">
                          <div className="h-full bg-gradient-to-r from-[#4CC38A] to-[#10B981] rounded-lg flex items-center px-3 text-[11px] font-bold text-[#04201C]" style={{ width: `${Math.max(20, varrFunnelRate)}%` }}>
                            Zero Human Intervention (Reconciled, Refunded, Self-Served)
                          </div>
                        </div>
                      </div>

                      {/* Stage 4: Human Escalations */}
                      <div className="space-y-1.5 pl-12 border-l-2 border-[#F5A623]/40">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-[#F5A623]">4. Tier 2 Human Escalation &amp; Handoff</span>
                          <span className="text-[#F5A623]">{humanEscalatedFunnelCount} Tickets ({humanEscalatedFunnelRate}%)</span>
                        </div>
                        <div className="w-full h-8 bg-[#18222E] rounded-xl overflow-hidden p-1 border border-[var(--line-2)] flex items-center">
                          <div className="h-full bg-[#F5A623]/70 rounded-lg flex items-center px-3 text-[11px] font-bold text-[#04201C]" style={{ width: `${Math.max(15, humanEscalatedFunnelRate)}%` }}>
                            Transferred with Pre-drafted Handoff Tokens
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ========================================================================= */}
            {/* PILLAR 1: SLA ENGINE & REAL-TIME AT-RISK WARNING SYSTEM */}
            {/* ========================================================================= */}
            {cxSubView === "sla" && (
              <div className="space-y-6">
                {/* KPI Summary Row */}
                <div className="metric-grid">
                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>SLA Attainment Rate</span>
                      <span className="pill ok"><i className="dot"></i> Nominal</span>
                    </div>
                    <strong className="text-[#2ED8B6]">{slaData.attainmentRate}%</strong>
                    <small>Target: 98.4% Attainment</small>
                  </div>

                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>Tracked Active Tickets</span>
                      <span className="pill"><i className="dot"></i> Live</span>
                    </div>
                    <strong>{slaData.totalTracked}</strong>
                    <small>Across 4 Ingress Lines</small>
                  </div>

                  <div className="metric border-[#4CC38A]/30 bg-[#4CC38A]/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#4CC38A]">Healthy Queue</span>
                      <span className="pill ok"><i className="dot"></i> On Track</span>
                    </div>
                    <strong className="text-[#4CC38A]">{slaData.healthyCount}</strong>
                    <small className="text-[#4CC38A]/80">&gt; 50% Time Remaining</small>
                  </div>

                  <div className="metric border-[#F5A623]/30 bg-[#F5A623]/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#F5A623]">At-Risk Pre-Breach (&gt;= 75%)</span>
                      <span className="pill warn"><i className="dot"></i> Warning</span>
                    </div>
                    <strong className="text-[#F5A623]">{slaData.atRiskCount}</strong>
                    <small className="text-[#F5A623]/80">Early Warning Active</small>
                  </div>

                  <div className="metric border-[#E5484D]/40 bg-[#E5484D]/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#E5484D]">Breached Count</span>
                      <span className="pill err"><i className="dot"></i> Critical</span>
                    </div>
                    <strong className="text-[#E5484D]">{slaData.breachedCount}</strong>
                    <small className="text-[#E5484D]/80">Incident Escalated</small>
                  </div>
                </div>

                {/* SLA Tier Policy Rule Matrix */}
                <div className="card p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-[var(--line)] pb-3">
                    <h3 className="text-sm font-bold text-[#EAF1F8]">SLA Tier Policies &amp; Pre-Breach Gates</h3>
                    <span className="text-xs text-[#6B7C8D] font-mono">Early-Warning Threshold: 75% Duration</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] space-y-2">
                      <div className="flex justify-between items-center text-[#2ED8B6] font-bold">
                        <span>ENTERPRISE TIER</span>
                        <span className="pill ok">P1 SLA</span>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>First Response Time (FRT):</span>
                        <strong className="text-[#EAF1F8]">15 mins</strong>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>Next Response Time (NRT):</span>
                        <strong className="text-[#EAF1F8]">30 mins</strong>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>Full Resolution (MTTR):</span>
                        <strong className="text-[#EAF1F8]">2 hours</strong>
                      </div>
                    </div>

                    <div className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] space-y-2">
                      <div className="flex justify-between items-center text-[#B4C2D0] font-bold">
                        <span>PRO TIER</span>
                        <span className="pill">P2 SLA</span>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>First Response Time (FRT):</span>
                        <strong className="text-[#EAF1F8]">60 mins (1 hr)</strong>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>Next Response Time (NRT):</span>
                        <strong className="text-[#EAF1F8]">2 hours</strong>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>Full Resolution (MTTR):</span>
                        <strong className="text-[#EAF1F8]">8 hours</strong>
                      </div>
                    </div>

                    <div className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] space-y-2">
                      <div className="flex justify-between items-center text-[#6B7C8D] font-bold">
                        <span>STANDARD TIER</span>
                        <span className="pill">P3 SLA</span>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>First Response Time (FRT):</span>
                        <strong className="text-[#EAF1F8]">240 mins (4 hr)</strong>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>Next Response Time (NRT):</span>
                        <strong className="text-[#EAF1F8]">8 hours</strong>
                      </div>
                      <div className="text-[#6B7C8D] flex justify-between">
                        <span>Full Resolution (MTTR):</span>
                        <strong className="text-[#EAF1F8]">24 hours</strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-time At-Risk SLA Queue Table */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Real-Time SLA Live Timers &amp; Pre-Breach Queue</h3>
                  <div className="overflow-x-auto">
                    <table className="gv8-table">
                      <thead>
                        <tr>
                          <th>Ticket ID / Customer</th>
                          <th>Tier / Ingress</th>
                          <th>Assigned Handler</th>
                          <th>Elapsed / Target</th>
                          <th>Breach Countdown</th>
                          <th>Risk Level</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slaData.tickets.map((t: any) => (
                          <tr key={t.ticketId}>
                            <td>
                              <div className="font-mono font-bold text-[#EAF1F8]">{t.externalId}</div>
                              <div className="text-[#B4C2D0]">{t.customerName}</div>
                            </td>
                            <td>
                              <span className="pill">
                                {t.tier}
                              </span>
                              <div className="text-[11px] text-[#6B7C8D] font-mono mt-0.5">{t.channel}</div>
                            </td>
                            <td className="text-[#B4C2D0]">{t.assignedAgent}</td>
                            <td className="font-mono text-[#6B7C8D]">
                              {t.elapsedMinutes}m / {t.targetResponseMinutes}m
                            </td>
                            <td className="font-mono">
                              <span
                                className={`font-semibold ${
                                  t.remainingMinutes <= 0
                                    ? "text-[#E5484D] font-bold"
                                    : t.remainingMinutes <= 15
                                    ? "text-[#F5A623] font-bold"
                                    : "text-[#2ED8B6]"
                                }`}
                              >
                                {t.remainingMinutes <= 0
                                  ? `BREACHED (${Math.abs(t.remainingMinutes)}m overdue)`
                                  : `${t.remainingMinutes}m remaining`}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`pill ${
                                  t.riskLevel === "breached"
                                    ? "err"
                                    : t.riskLevel === "at_risk"
                                    ? "warn"
                                    : "ok"
                                }`}
                              >
                                <i className="dot"></i>
                                {t.riskLevel}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTicketForEscalation(t);
                                  setIsEscalateModalOpen(true);
                                }}
                                className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6]"
                              >
                                <Zap className="w-3 h-3 text-[#2ED8B6]" />
                                <span>Escalate Priority</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PILLAR 2: 360° CUSTOMER HEALTH SCORE & CHURN RISK RADAR */}
            {/* ========================================================================= */}
            {/* ========================================================================= */}
            {/* PILLAR 2: 360° CUSTOMER HEALTH SCORE & CHURN RISK RADAR */}
            {/* ========================================================================= */}
            {cxSubView === "health" && (
              <div className="space-y-6">
                {/* Real-time VIP Churn Alert Banner */}
                {customerHealthData.activeVipChurnAlerts && customerHealthData.activeVipChurnAlerts.length > 0 && (
                  <div className="card p-5 border-[#E5484D]/40 bg-[#E5484D]/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[#E5484D]">
                        <AlertTriangle className="w-5 h-5 text-[#E5484D]" />
                        <h4 className="font-bold text-sm">
                          VIP Churn Risk Alerts Detected ({customerHealthData.activeVipChurnAlerts.length} Enterprise Accounts)
                        </h4>
                      </div>
                      <span className="pill err">TRIGGER: &gt; 2 Frustrated Interactions in 48h</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {customerHealthData.activeVipChurnAlerts.map((alt: any) => (
                        <div key={alt.id} className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] flex justify-between items-center text-xs">
                          <div>
                            <span className="font-semibold text-[#EAF1F8] block">{alt.accountName}</span>
                            <span className="text-[#6B7C8D] text-[11px]">{alt.triggerReason}</span>
                          </div>
                          <span className="font-mono text-[#F5A623] font-bold">${alt.arrExposure.toLocaleString()} ARR</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Health Metrics Header */}
                <div className="metric-grid">
                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>Portfolio Health Score</span>
                      <span className="pill ok"><i className="dot"></i> Tracked</span>
                    </div>
                    <strong className="text-[#2ED8B6]">
                      {customerHealthData.avgHealthScore}/100
                    </strong>
                    <small>Across Monitored Accounts</small>
                  </div>

                  <div className="metric border-[#E5484D]/40 bg-[#E5484D]/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#E5484D]">Total ARR at Risk</span>
                      <span className="pill err"><i className="dot"></i> Churn Risk</span>
                    </div>
                    <strong className="text-[#E5484D]">
                      ${customerHealthData.totalArrAtRisk.toLocaleString()}
                    </strong>
                    <small className="text-[#E5484D]/80">2 Accounts Flagged</small>
                  </div>

                  <div className="metric border-[#F5A623]/30 bg-[#F5A623]/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#F5A623]">Critical &amp; Concerning</span>
                      <span className="pill warn"><i className="dot"></i> Action Needed</span>
                    </div>
                    <strong className="text-[#F5A623]">
                      {customerHealthData.criticalCount + customerHealthData.concerningCount}
                    </strong>
                    <small className="text-[#F5A623]/80">Requiring VIP Outreach</small>
                  </div>

                  <div className="metric border-[#4CC38A]/30 bg-[#4CC38A]/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#4CC38A]">Healthy Stable Accounts</span>
                      <span className="pill ok"><i className="dot"></i> Stable</span>
                    </div>
                    <strong className="text-[#4CC38A]">
                      {customerHealthData.healthyCount}
                    </strong>
                    <small className="text-[#4CC38A]/80">Low Churn Probability (&lt; 15%)</small>
                  </div>
                </div>

                {/* View Switcher & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#121A24] p-4 rounded-xl border border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-[#2ED8B6]" />
                    <span className="text-xs font-bold text-[#EAF1F8] font-mono">
                      {selectedAccountForForm ? `Embedded Account Dossier: ${selectedAccountForForm.accountName}` : "Customer 360° Portfolio Accounts"}
                    </span>
                    <span className="text-[10px] text-[#6B7C8D] font-mono">
                      ({customerHealthData.accounts.length} Accounts Monitored)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedAccountForForm ? (
                      <button
                        type="button"
                        onClick={() => setSelectedAccountForForm(null)}
                        className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back to Accounts Overview</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 bg-[#18222E] p-1 rounded-lg border border-[var(--line)] text-xs">
                        <button
                          type="button"
                          onClick={() => setHealthViewMode("card")}
                          className={`px-3 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            healthViewMode === "card"
                              ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                              : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>Card View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setHealthViewMode("list")}
                          className={`px-3 py-1 rounded font-mono text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            healthViewMode === "list"
                              ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                              : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                          }`}
                        >
                          <List className="w-3.5 h-3.5" />
                          <span>List View</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* 1. EMBEDDED ACCOUNT FORM & CASES DOSSIER VIEW */}
                {/* ========================================================================= */}
                {selectedAccountForForm ? (
                  <div className="space-y-6">
                    {/* Account Dossier Form Header */}
                    <div className="card p-6 bg-[#121A24] border-[var(--line)] space-y-5 rounded-2xl">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-base font-bold text-[#EAF1F8]">{selectedAccountForForm.accountName}</h3>
                            <span className="pill ok uppercase text-[10px] font-mono">{selectedAccountForForm.tier} TIER</span>
                            <span
                              className={`pill text-[10px] font-mono ${
                                selectedAccountForForm.riskLevel === "critical_at_risk"
                                  ? "err"
                                  : selectedAccountForForm.riskLevel === "concerning"
                                  ? "warn"
                                  : "ok"
                              }`}
                            >
                              <i className="dot"></i>
                              {selectedAccountForForm.riskLevel.replace("_", " ").toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-[#6B7C8D] font-mono mt-1">
                            Account ID: {selectedAccountForForm.accountId} • Assigned CSM: <strong className="text-[#EAF1F8]">{selectedAccountForForm.assignedCsm}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/cx/customer-health", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ accountId: selectedAccountForForm.accountId }),
                                }).then((r) => r.json());

                                if (res.success) {
                                  notify(res.message, "success");
                                }
                              } catch (err) {
                                notify("VIP Outreach failed", "error");
                              }
                            }}
                            className="btn btn-primary text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Trigger VIP CSM Outreach</span>
                          </button>
                        </div>
                      </div>

                      {/* Account Health Metrics Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono text-center">
                        <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                          <span className="text-[#6B7C8D] text-[10px]">HEALTH SCORE</span>
                          <div className={`text-lg font-bold ${selectedAccountForForm.healthScore < 60 ? "text-[#E5484D]" : selectedAccountForForm.healthScore < 80 ? "text-[#F5A623]" : "text-[#2ED8B6]"}`}>
                            {selectedAccountForForm.healthScore}/100
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                          <span className="text-[#6B7C8D] text-[10px]">ARR EXPOSURE</span>
                          <div className="text-lg font-bold text-[#F5A623]">
                            ${selectedAccountForForm.arrExposure.toLocaleString()}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                          <span className="text-[#6B7C8D] text-[10px]">CHURN RISK</span>
                          <div className="text-lg font-bold text-[#E5484D]">
                            {(selectedAccountForForm.churnProbability * 100).toFixed(0)}%
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                          <span className="text-[#6B7C8D] text-[10px]">AVG CSAT</span>
                          <div className="text-lg font-bold text-[#EAF1F8]">
                            {selectedAccountForForm.csatAverage}%
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                          <span className="text-[#6B7C8D] text-[10px]">48H FRUSTRATED</span>
                          <div className="text-lg font-bold text-[#F5A623]">
                            {selectedAccountForForm.recentFrustratedCount48h || 0}
                          </div>
                        </div>
                      </div>

                      {/* Primary Frustration Driver & Incident Context */}
                      {selectedAccountForForm.primaryFrustrationDriver && (
                        <div className="p-3.5 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1 text-xs">
                          <div className="text-[#F5A623] font-bold font-mono flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Primary Customer Frustration Driver</span>
                          </div>
                          <p className="text-[#B4C2D0] leading-relaxed">
                            {selectedAccountForForm.primaryFrustrationDriver}
                          </p>
                          {selectedAccountForForm.lastIncidentImpacted && (
                            <div className="text-[11px] text-[#6B7C8D] font-mono pt-1">
                              Impacted Incident: <strong className="text-[#2ED8B6]">{selectedAccountForForm.lastIncidentImpacted}</strong>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Embedded Account Retention Note Editor */}
                      <div className="space-y-2 pt-2 border-t border-[var(--line)] text-xs">
                        <label className="text-[#6B7C8D] font-mono uppercase text-[10px] font-bold block">
                          CSM Account Retention Strategy &amp; Notes
                        </label>
                        <textarea
                          rows={2}
                          defaultValue={selectedAccountForForm.primaryFrustrationDriver ? `Action plan: Deliver SLA credit rebate for ${selectedAccountForForm.accountName} and schedule emergency architecture review.` : "Account health is stable. Routine quarterly business review scheduled."}
                          className="w-full bg-[#18222E] p-3 rounded-xl border border-[var(--line-2)] text-xs text-[#EAF1F8] font-sans focus:outline-none focus:border-[#2ED8B6]"
                        />
                      </div>
                    </div>

                    {/* Embedded Live Cases & Ticket History Section */}
                    <div className="card p-6 bg-[#121A24] border-[var(--line)] space-y-4 rounded-2xl">
                      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#2ED8B6]" />
                          <h4 className="text-sm font-bold text-[#EAF1F8] font-mono">
                            Live Support Cases for {selectedAccountForForm.accountName}
                          </h4>
                        </div>
                        <span className="pill ok text-[10px] font-mono">
                          {issues.filter((i) => i.customerName.toLowerCase().includes(selectedAccountForForm.accountName.toLowerCase()) || selectedAccountForForm.accountName.toLowerCase().includes(i.customerName.toLowerCase())).length} CASES FOUND
                        </span>
                      </div>

                      {/* Cases Table */}
                      <div className="overflow-x-auto">
                        <table className="gv8-table font-mono text-xs">
                          <thead>
                            <tr>
                              <th>Case ID / Summary</th>
                              <th>Priority</th>
                              <th>Ingress Line</th>
                              <th>AI Confidence</th>
                              <th>Status</th>
                              <th>Assigned Agent</th>
                              <th className="text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {issues
                              .filter((i) =>
                                i.customerName.toLowerCase().includes(selectedAccountForForm.accountName.toLowerCase()) ||
                                selectedAccountForForm.accountName.toLowerCase().includes(i.customerName.toLowerCase())
                              )
                              .map((issue) => (
                                <tr key={issue.id} className="hover:bg-[#18222E]/50">
                                  <td>
                                    <div className="font-bold text-[#EAF1F8] font-sans">{issue.summary}</div>
                                    <div className="text-[10px] text-[#2ED8B6] font-mono">{issue.externalId} • {issue.category}</div>
                                  </td>
                                  <td>
                                    <span
                                      className={`pill uppercase text-[9px] ${
                                        issue.priority === "urgent" ? "err" : issue.priority === "high" ? "warn" : "ok"
                                      }`}
                                    >
                                      {issue.priority}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="pill text-[9px] uppercase">{issue.source}</span>
                                  </td>
                                  <td className="text-[#4CC38A]">
                                    {(issue.confidence * 100).toFixed(0)}%
                                  </td>
                                  <td>
                                    <span className={`pill ${issue.status === "resolved" ? "ok" : "warn"} text-[9px] uppercase`}>
                                      <i className="dot"></i>
                                      {issue.status}
                                    </span>
                                  </td>
                                  <td className="text-[#B4C2D0]">
                                    {issue.assignedTo || "Sophia (AI)"}
                                  </td>
                                  <td className="text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setWorkspaceSelectedIssueId(issue.id);
                                        setActiveTab("workspace");
                                        notify(`Opened ticket ${issue.externalId} in Workspace`, "info");
                                      }}
                                      className="btn btn-secondary text-xs py-1 px-2.5 font-mono cursor-pointer hover:text-[#2ED8B6]"
                                    >
                                      Open in Workspace →
                                    </button>
                                  </td>
                                </tr>
                              ))}

                            {issues.filter((i) =>
                              i.customerName.toLowerCase().includes(selectedAccountForForm.accountName.toLowerCase()) ||
                              selectedAccountForForm.accountName.toLowerCase().includes(i.customerName.toLowerCase())
                            ).length === 0 && (
                              <tr>
                                <td colSpan={7} className="py-6 text-center text-xs text-[#6B7C8D]">
                                  No active open cases for {selectedAccountForForm.accountName}. All previous issues resolved.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* ========================================================================= */}
                    {/* 2. CARD GRID VIEW */}
                    {/* ========================================================================= */}
                    {healthViewMode === "card" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customerHealthData.accounts.map((acc: any) => (
                          <div key={acc.accountId} className="card p-5 space-y-4 hover:border-[#2ED8B6]/50 transition-all">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-bold text-[#EAF1F8]">{acc.accountName}</h3>
                                  <span className="pill">
                                    {acc.tier}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs font-mono">
                                  <span className="text-[#F5A623] font-bold">${acc.arrExposure.toLocaleString()} ARR</span>
                                  <span className="text-[#6B7C8D]">•</span>
                                  <span className="text-[#6B7C8D]">{acc.lifetimeTicketVolume} Lifetime Tickets</span>
                                </div>
                              </div>

                              <span
                                className={`pill ${
                                  acc.riskLevel === "critical_at_risk"
                                    ? "err"
                                    : acc.riskLevel === "concerning"
                                    ? "warn"
                                    : "ok"
                                }`}
                              >
                                <i className="dot"></i>
                                {acc.riskLevel.replace("_", " ")}
                              </span>
                            </div>

                            {/* Health Score Bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="text-[#6B7C8D]">Account Health Score:</span>
                                <span
                                  className={`font-bold ${
                                    acc.healthScore < 60
                                      ? "text-[#E5484D]"
                                      : acc.healthScore < 80
                                      ? "text-[#F5A623]"
                                      : "text-[#2ED8B6]"
                                  }`}
                                >
                                  {acc.healthScore}/100
                                </span>
                              </div>
                              <div className="w-full bg-[#18222E] h-2 rounded-full overflow-hidden border border-[var(--line)]">
                                <div
                                  className={`h-full rounded-full ${
                                    acc.healthScore < 60
                                      ? "bg-[#E5484D]"
                                      : acc.healthScore < 80
                                      ? "bg-[#F5A623]"
                                      : "bg-[#2ED8B6]"
                                  }`}
                                  style={{ width: `${acc.healthScore}%` }}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 text-xs font-mono bg-[#18222E] p-3 rounded-lg border border-[var(--line)] text-center">
                              <div>
                                <span className="text-[#6B7C8D] block text-[10px]">CHURN RISK</span>
                                <span className="font-bold text-[#E5484D]">{(acc.churnProbability * 100).toFixed(0)}%</span>
                              </div>
                              <div>
                                <span className="text-[#6B7C8D] block text-[10px]">AVG CSAT</span>
                                <span className="font-bold text-[#EAF1F8]">{acc.csatAverage}%</span>
                              </div>
                              <div>
                                <span className="text-[#6B7C8D] block text-[10px]">OPEN CASES</span>
                                <span className="font-bold text-[#2ED8B6]">{acc.openIssuesCount}</span>
                              </div>
                              <div>
                                <span className="text-[#6B7C8D] block text-[10px]">48H FRUSTRATED</span>
                                <span className="font-bold text-[#F5A623]">{acc.recentFrustratedCount48h || 0}</span>
                              </div>
                            </div>

                            {acc.primaryFrustrationDriver && (
                              <p className="text-xs text-[#B4C2D0] bg-[#18222E] p-3 rounded-lg border border-[var(--line)] leading-relaxed">
                                <strong className="text-[#EAF1F8]">Frustration Driver:</strong> {acc.primaryFrustrationDriver}
                              </p>
                            )}

                            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <span className="text-[#6B7C8D] font-mono text-[11px]">
                                CSM: <strong className="text-[#EAF1F8]">{acc.assignedCsm}</strong>
                              </span>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAccountForForm(acc)}
                                  className="btn btn-secondary text-xs flex items-center gap-1 cursor-pointer hover:border-[#2ED8B6]"
                                >
                                  <FileText className="w-3 h-3 text-[#2ED8B6]" />
                                  <span>View Cases (Form)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const res = await fetch("/api/cx/customer-health", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ accountId: acc.accountId }),
                                      }).then((r) => r.json());

                                      if (res.success) {
                                        notify(res.message, "success");
                                      }
                                    } catch (err) {
                                      notify("VIP Outreach failed", "error");
                                    }
                                  }}
                                  className="btn btn-primary text-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Send className="w-3 h-3" />
                                  <span>VIP Outreach</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ========================================================================= */}
                    {/* 3. LIST / TABLE VIEW */}
                    {/* ========================================================================= */}
                    {healthViewMode === "list" && (
                      <div className="card p-5 space-y-4 rounded-2xl bg-[#121A24] border-[var(--line)]">
                        <div className="overflow-x-auto">
                          <table className="gv8-table font-mono text-xs">
                            <thead>
                              <tr>
                                <th>Account Name / Tier</th>
                                <th>Health Score</th>
                                <th>Risk Level</th>
                                <th>ARR Exposure</th>
                                <th>Open Cases</th>
                                <th>48h Frustrated</th>
                                <th>Churn Prob</th>
                                <th>Assigned CSM</th>
                                <th className="text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {customerHealthData.accounts.map((acc: any) => (
                                <tr key={acc.accountId} className="hover:bg-[#18222E]/50">
                                  <td>
                                    <div className="font-bold text-[#EAF1F8] font-sans">{acc.accountName}</div>
                                    <span className="pill text-[9px] uppercase">{acc.tier}</span>
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`font-bold ${
                                          acc.healthScore < 60
                                            ? "text-[#E5484D]"
                                            : acc.healthScore < 80
                                            ? "text-[#F5A623]"
                                            : "text-[#2ED8B6]"
                                        }`}
                                      >
                                        {acc.healthScore}%
                                      </span>
                                      <div className="w-16 bg-[#18222E] h-1.5 rounded-full overflow-hidden border border-[var(--line)]">
                                        <div
                                          className={`h-full rounded-full ${
                                            acc.healthScore < 60
                                              ? "bg-[#E5484D]"
                                              : acc.healthScore < 80
                                              ? "bg-[#F5A623]"
                                              : "bg-[#2ED8B6]"
                                          }`}
                                          style={{ width: `${acc.healthScore}%` }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      className={`pill text-[9px] ${
                                        acc.riskLevel === "critical_at_risk"
                                          ? "err"
                                          : acc.riskLevel === "concerning"
                                          ? "warn"
                                          : "ok"
                                      }`}
                                    >
                                      <i className="dot"></i>
                                      {acc.riskLevel.replace("_", " ")}
                                    </span>
                                  </td>
                                  <td className="text-[#F5A623] font-bold">
                                    ${acc.arrExposure.toLocaleString()}
                                  </td>
                                  <td className="text-[#2ED8B6] font-bold">
                                    {acc.openIssuesCount}
                                  </td>
                                  <td className="text-[#F5A623]">
                                    {acc.recentFrustratedCount48h || 0}
                                  </td>
                                  <td className="text-[#E5484D] font-bold">
                                    {(acc.churnProbability * 100).toFixed(0)}%
                                  </td>
                                  <td className="text-[#B4C2D0]">
                                    {acc.assignedCsm}
                                  </td>
                                  <td className="text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedAccountForForm(acc)}
                                        className="btn btn-secondary text-xs py-1 px-2.5 font-mono cursor-pointer hover:border-[#2ED8B6]"
                                      >
                                        Inspect (Form)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const res = await fetch("/api/cx/customer-health", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ accountId: acc.accountId }),
                                            }).then((r) => r.json());

                                            if (res.success) {
                                              notify(res.message, "success");
                                            }
                                          } catch (err) {
                                            notify("VIP Outreach failed", "error");
                                          }
                                        }}
                                        className="btn btn-primary text-xs py-1 px-2 font-mono"
                                      >
                                        Outreach
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* PILLAR 3: AUTOMATED QA & AI COMPLIANCE SCORECARDS */}
            {/* ========================================================================= */}
            {cxSubView === "qa" && (
              <div className="space-y-6">
                {/* QA KPIs */}
                <div className="metric-grid">
                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>Overall QA Average</span>
                      <span className="pill ok"><i className="dot"></i> Passing</span>
                    </div>
                    <strong className="text-[#2ED8B6]">
                      {qaData.overallQaAverage}%
                    </strong>
                    <small>Benchmark: 90% Target</small>
                  </div>

                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>AI Employees QA</span>
                      <Bot className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    </div>
                    <strong>
                      {qaData.aiEmployeeAverage}%
                    </strong>
                    <small>Alex, Maya, Chip (Autonomous)</small>
                  </div>

                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>Human Agents QA</span>
                      <Users className="w-3.5 h-3.5 text-[#4D9FFF]" />
                    </div>
                    <strong className="text-[#4D9FFF]">
                      {qaData.humanAgentAverage}%
                    </strong>
                    <small>Tier 2 Specialists</small>
                  </div>

                  <div className="metric border-[#4CC38A]/30 bg-[#4CC38A]/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#4CC38A]">First Contact Resolution</span>
                      <span className="pill ok"><i className="dot"></i> High</span>
                    </div>
                    <strong className="text-[#4CC38A]">
                      {qaData.fcrAverage}%
                    </strong>
                    <small className="text-[#4CC38A]/80">Single-Touch Closes</small>
                  </div>

                  <div className="metric border-[#F5A623]/30 bg-[#F5A623]/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#F5A623]">Hallucination / Drift</span>
                      <span className="pill warn"><i className="dot"></i> Monitored</span>
                    </div>
                    <strong className="text-[#F5A623]">
                      {qaData.hallucinationRate}%
                    </strong>
                    <small className="text-[#F5A623]/80">Zero Critical Deviations</small>
                  </div>
                </div>

                {/* Scorecards Rubric List */}
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#EAF1F8]">Automated Quality &amp; Compliance Rubric Audits</h3>
                      <p className="text-xs text-[#B4C2D0]">Multi-criteria evaluation covering Technical Accuracy, Tone, Policy Compliance, and FCR.</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/cx/qa-scorecards", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              conversationId: `conv_live_${Date.now().toString().slice(-4)}`,
                              notes: "Random sample audit: verified strict zero-bypass Action Gateway adherence.",
                            }),
                          }).then((r) => r.json());

                          if (res.success) {
                            notify(res.message, "success");
                            fetchData();
                          }
                        } catch (err) {
                          notify("QA Audit failed", "error");
                        }
                      }}
                      className="btn btn-primary text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Audit Real-Time Sample</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {qaData.scorecards.map((card: any) => (
                      <div key={card.id} className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#2ED8B6]">{card.id}</span>
                              <span className="font-medium text-[#EAF1F8] text-xs">
                                {card.evaluatedEntity.name}
                              </span>
                              <span className="pill">
                                {card.evaluatedEntity.type.replace("_", " ")}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#6B7C8D] font-mono">
                              Conversation: {card.conversationId} • {card.timestamp}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            {card.hallucinationDetected && (
                              <span className="pill err">
                                DRIFT DETECTED
                              </span>
                            )}
                            <div className="text-right">
                              <span className="text-xl font-bold font-mono text-[#2ED8B6]">
                                {card.overallScore}%
                              </span>
                              <span className="text-[10px] text-[#6B7C8D] block font-mono">OVERALL QA</span>
                            </div>
                          </div>
                        </div>

                        {/* Criteria Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-[#121A24] p-3 rounded-lg border border-[var(--line)]">
                          <div>
                            <span className="text-[#6B7C8D] block text-[10px]">ACCURACY</span>
                            <span className="font-bold text-[#EAF1F8]">{card.technicalAccuracyScore}%</span>
                          </div>
                          <div>
                            <span className="text-[#6B7C8D] block text-[10px]">TONE / EMPATHY</span>
                            <span className="font-bold text-[#EAF1F8]">{card.toneEmpathyScore}%</span>
                          </div>
                          <div>
                            <span className="text-[#6B7C8D] block text-[10px]">POLICY COMPLIANCE</span>
                            <span className="font-bold text-[#2ED8B6]">{card.policyComplianceScore}%</span>
                          </div>
                          <div>
                            <span className="text-[#6B7C8D] block text-[10px]">FCR COMPLETENESS</span>
                            <span className="font-bold text-[#4D9FFF]">{card.resolutionCompletenessScore}%</span>
                          </div>
                        </div>

                        <p className="text-xs text-[#B4C2D0] leading-relaxed">{card.evaluatorNotes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PILLAR 4: VOC / CSAT DRIVER ANALYTICS & CES BREAKDOWN */}
            {/* ========================================================================= */}
            {cxSubView === "voc" && (
              <div className="space-y-6">
                {/* CSAT / CES Score Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>Customer Satisfaction (CSAT)</span>
                      <span className="pill ok"><i className="dot"></i> High</span>
                    </div>
                    <strong className="text-[#2ED8B6]">
                      {vocDigestData.voc.overallCsat || 91.4}%
                    </strong>
                    <small>1,842 survey responses</small>
                  </div>

                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>Customer Effort Score (CES)</span>
                      <span className="pill ok"><i className="dot"></i> Top 5%</span>
                    </div>
                    <strong className="text-[#4CC38A]">
                      {vocDigestData.voc.customerEffortScore || 4.6} / 5.0
                    </strong>
                    <small>Low Friction Experience</small>
                  </div>

                  <div className="metric">
                    <div className="flex items-center justify-between">
                      <span>Net Promoter Score (NPS)</span>
                      <span className="pill"><i className="dot"></i> Benchmarked</span>
                    </div>
                    <strong className="text-[#EAF1F8]">
                      +{vocDigestData.voc.netPromoterScore || 54}
                    </strong>
                    <small>Enterprise Target: +45</small>
                  </div>
                </div>

                {/* CSAT Distribution (1-Star to 5-Star) & Top Delight Articles */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="card p-5 space-y-4">
                    <h3 className="text-sm font-bold text-[#EAF1F8]">CSAT Rating Distribution (1 to 5 Stars)</h3>
                    <div className="space-y-3 text-xs font-mono">
                      {(vocDigestData.voc.csatDistribution && vocDigestData.voc.csatDistribution.length > 0
                        ? vocDigestData.voc.csatDistribution
                        : [
                            { score: 5, count: 1248, percentage: 67.8 },
                            { score: 4, count: 435, percentage: 23.6 },
                            { score: 3, count: 72, percentage: 3.9 },
                            { score: 2, count: 51, percentage: 2.8 },
                            { score: 1, count: 36, percentage: 1.9 },
                          ]
                      ).map((dist: any) => (
                        <div key={dist.score} className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-[#EAF1F8]">{dist.score} Stars ★</span>
                            <span className="text-[#6B7C8D]">{dist.count} ratings ({dist.percentage}%)</span>
                          </div>
                          <div className="w-full bg-[#18222E] h-2 rounded-full overflow-hidden border border-[var(--line)]">
                            <div
                              className={`h-full rounded-full ${
                                dist.score >= 4 ? "bg-[#2ED8B6]" : dist.score === 3 ? "bg-[#F5A623]" : "bg-[#E5484D]"
                              }`}
                              style={{ width: `${dist.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card p-5 space-y-4">
                    <h3 className="text-sm font-bold text-[#EAF1F8]">Top-Performing Knowledge Articles (Delight Drivers)</h3>
                    <div className="space-y-3 text-xs font-mono">
                      {(vocDigestData.voc.topDelightArticles && vocDigestData.voc.topDelightArticles.length > 0
                        ? vocDigestData.voc.topDelightArticles
                        : [
                            { articleId: "KB-101", title: "Resolving Stripe 3DS Card Authentication Errors in Sandbox", category: "Billing", csatBoost: 98.4, resolutionCount: 284 },
                            { articleId: "KB-102", title: "Zero-Downtime Database Migration & Failover Runbook", category: "Infrastructure", csatBoost: 96.2, resolutionCount: 196 },
                            { articleId: "KB-103", title: "FIDO2 & Hardware Security Keys (YubiKey) Setup", category: "Auth", csatBoost: 95.8, resolutionCount: 142 },
                          ]
                      ).map((art: any) => (
                        <div key={art.articleId} className="bg-[#18222E] p-3.5 rounded-lg border border-[var(--line)] space-y-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-[#EAF1F8]">{art.title}</span>
                            <span className="text-[#2ED8B6] font-bold">{art.csatBoost}% CSAT</span>
                          </div>
                          <div className="flex justify-between text-[#6B7C8D] text-[11px]">
                            <span>Category: {art.category}</span>
                            <span>{art.resolutionCount} Resolutions</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Voice of Customer Feedback Clusters */}
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#EAF1F8]">Voice of the Customer (VoC) Keyphrase Sentiment Clusters</h3>
                      <p className="text-xs text-[#B4C2D0]">
                        AI-clustered feedback identifying primary discontent pain points and positive delight drivers.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vocDigestData.voc?.clusters?.map((c: any) => (
                      <div
                        key={c.id}
                        className={`p-4 rounded-lg border space-y-3 ${
                          c.category === "negative_discontent"
                            ? "bg-[#E5484D]/5 border-[#E5484D]/30"
                            : "bg-[#2ED8B6]/5 border-[#2ED8B6]/30"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <span
                              className={`pill ${
                                c.category === "negative_discontent"
                                  ? "err"
                                  : "ok"
                              }`}
                            >
                              <i className="dot"></i>
                              {c.category === "negative_discontent" ? "Discontent Driver" : "Delight Factor"}
                            </span>
                            <h4 className="text-sm font-bold text-[#EAF1F8] mt-2">{c.topic}</h4>
                          </div>
                          <span className="font-mono text-xs font-bold text-[#F5A623]">{c.percentageShare}% Share</span>
                        </div>

                        <blockquote className="text-xs text-[#B4C2D0] italic bg-[#18222E] p-3 rounded-lg border border-[var(--line)]">
                          &ldquo;{c.topQuote}&rdquo;
                        </blockquote>

                        <div className="text-[11px] text-[#6B7C8D] font-mono">
                          <strong className="text-[#EAF1F8]">Operational Fix:</strong> {c.suggestedOperationalFix}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PILLAR 5: OMNICHANNEL LIVE QUEUE LOAD BALANCER & SKILL ROUTING */}
            {/* ========================================================================= */}
            {cxSubView === "queue" && (
              <div className="space-y-6">
                {/* Channel Capacity Meters Row */}
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#EAF1F8]">Omnichannel Live Channel Load Meters</h3>
                      <p className="text-xs text-[#B4C2D0]">Real-time concurrency monitoring across all inbound customer support channels.</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/cx/queue", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                          }).then((r) => r.json());

                          if (res.success) {
                            notify(res.message, "success");
                            fetchData();
                          }
                        } catch (err) {
                          notify("Queue rebalance failed", "error");
                        }
                      }}
                      className="btn btn-primary text-xs cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Rebalance Concurrency</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(queueData.channels && queueData.channels.length > 0
                      ? queueData.channels
                      : [
                          { channel: "email", name: "Email & Web Forms", activeConversations: 38, maxCapacity: 100, loadPercentage: 38, status: "optimal", avgWaitTimeSeconds: 420 },
                          { channel: "live_chat", name: "In-App Live Chat", activeConversations: 72, maxCapacity: 100, loadPercentage: 72, status: "elevated", avgWaitTimeSeconds: 45 },
                          { channel: "voice", name: "Voice Telephony", activeConversations: 18, maxCapacity: 40, loadPercentage: 45, status: "optimal", avgWaitTimeSeconds: 12 },
                          { channel: "slack", name: "Slack Connect", activeConversations: 14, maxCapacity: 50, loadPercentage: 28, status: "optimal", avgWaitTimeSeconds: 90 },
                        ]
                    ).map((chan: any) => (
                      <div key={chan.channel} className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-sm font-bold text-[#EAF1F8]">{chan.name}</h4>
                            <span className="text-[#6B7C8D] text-[10px] font-mono">Avg Wait: {chan.avgWaitTimeSeconds}s</span>
                          </div>
                          <span
                            className={`pill ${
                              chan.status === "elevated"
                                ? "warn"
                                : "ok"
                            }`}
                          >
                            <i className="dot"></i>
                            {chan.status}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-[#6B7C8D]">Load:</span>
                            <span className="font-bold text-[#EAF1F8]">
                              {chan.activeConversations} / {chan.maxCapacity} ({chan.loadPercentage}%)
                            </span>
                          </div>
                          <div className="w-full bg-[#121A24] h-2 rounded-full overflow-hidden border border-[var(--line)]">
                            <div
                              className={`h-full rounded-full ${
                                chan.loadPercentage > 70 ? "bg-[#F5A623]" : "bg-[#2ED8B6]"
                              }`}
                              style={{ width: `${chan.loadPercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skill-Based Routing Engine Rules */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Active Skill-Based Routing Rules</h3>
                  <div className="overflow-x-auto">
                    <table className="gv8-table">
                      <thead>
                        <tr>
                          <th>Intent Category</th>
                          <th>Skill &amp; Capability Required</th>
                          <th>Primary Assigned Handler</th>
                          <th>Fallback Escalation Role</th>
                          <th>Priority Weight</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(queueData.rules && queueData.rules.length > 0
                          ? queueData.rules
                          : [
                              { id: "rule_billing", intentCategory: "billing_refunds", skillRequired: "Financial Reconciliation & Stripe", assignedAgentOrRole: "Maya — Finance Specialist (AI)", fallbackAgentOrRole: "Finance Operations Tier 2", priorityWeight: 90, active: true },
                              { id: "rule_infra_504", intentCategory: "api_504_gateway", skillRequired: "Distributed Systems & Telemetry", assignedAgentOrRole: "Jordan — Escalations Lead (AI)", fallbackAgentOrRole: "Dominion SRE On-Call", priorityWeight: 100, active: true },
                              { id: "rule_auth_sso", intentCategory: "auth_sso_saml", skillRequired: "Identity Provider Protocols", assignedAgentOrRole: "Alex — Lead Support Engineer (AI)", fallbackAgentOrRole: "Identity Solutions Architect", priorityWeight: 85, active: true },
                              { id: "rule_general", intentCategory: "general_inquiry", skillRequired: "Multi-Source KB RAG Search", assignedAgentOrRole: "Chip — Auto-Triage Intern (AI)", fallbackAgentOrRole: "Alex — Lead Support", priorityWeight: 50, active: true },
                            ]
                        ).map((rule: any) => (
                          <tr key={rule.id}>
                            <td className="font-mono font-bold text-[#2ED8B6]">{rule.intentCategory}</td>
                            <td className="text-[#B4C2D0]">{rule.skillRequired}</td>
                            <td className="text-[#EAF1F8] font-medium">{rule.assignedAgentOrRole}</td>
                            <td className="text-[#6B7C8D] font-mono">{rule.fallbackAgentOrRole}</td>
                            <td className="font-mono font-bold text-[#EAF1F8]">{rule.priorityWeight}</td>
                            <td>
                              <span className="pill ok">
                                <i className="dot"></i>
                                ACTIVE
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* PILLAR 6: AI SHIFT HANDOFF & MORNING STANDUP DIGEST */}
            {/* ========================================================================= */}
            {cxSubView === "standup" && (
              <div className="space-y-6">
                {vocDigestData.digest && (
                  <div className="card p-5 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-[#2ED8B6]" />
                        <div>
                          <h3 className="text-base font-bold text-[#EAF1F8]">{vocDigestData.digest.shiftName}</h3>
                          <span className="text-xs text-[#6B7C8D] font-mono">
                            Generated: {vocDigestData.digest.generatedAt}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/cx/voc-digest", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ action: "broadcast" }),
                            }).then((r) => r.json());

                            if (res.success) {
                              notify(res.message, "success");
                            }
                          } catch (err) {
                            notify("Broadcast failed", "error");
                          }
                        }}
                        className="btn btn-primary text-xs"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Broadcast Standup to Slack / Email</span>
                      </button>
                    </div>

                    <div className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] text-xs text-[#B4C2D0] leading-relaxed">
                      <p>{vocDigestData.digest.executiveSummary}</p>
                    </div>

                    {/* Overnight Top 3 Pain Points */}
                    {vocDigestData.digest.topOvernightPainPoints && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-[#EAF1F8] block">
                          Top 3 Recurring Customer Pain Points from Overnight Queue
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
                          {vocDigestData.digest.topOvernightPainPoints.map((pain: any) => (
                            <div key={pain.rank} className="bg-[#18222E] p-3.5 rounded-lg border border-[var(--line)] space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[#2ED8B6] font-bold">#{pain.rank} Pain Point</span>
                                <span className="text-[#E5484D] font-bold">{pain.count} cases</span>
                              </div>
                              <p className="text-[#EAF1F8] font-sans text-xs">{pain.topic}</p>
                              <span className="text-[10px] text-[#6B7C8D] block">Sentiment: {pain.sentiment}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono pt-2">
                      <div className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] space-y-2">
                        <span className="text-[#E5484D] font-bold block">Ongoing Outages &amp; Incidents</span>
                        {vocDigestData.digest.ongoingProblems?.map((p: any) => (
                          <div key={p.id} className="text-[#B4C2D0] border-b border-[var(--line)] pb-2">
                            <strong className="text-[#EAF1F8]">{p.id}: {p.title}</strong>
                            <div className="text-[#6B7C8D] text-[11px]">ETA: {p.eta} • Impact: {p.impact}</div>
                          </div>
                        ))}
                      </div>

                      <div className="bg-[#18222E] p-4 rounded-lg border border-[var(--line)] space-y-2">
                        <span className="text-[#2ED8B6] font-bold block">Shift Focus Areas</span>
                        <ul className="list-disc list-inside text-[#B4C2D0] space-y-1">
                          {vocDigestData.digest.recommendedFocusAreas?.map((area: string, idx: number) => (
                            <li key={idx} className="text-[11px] leading-relaxed font-sans">{area}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: DERIVED ISSUES EXPLORER (EXPANDED FULL-WIDTH TABLE WITH FLOATING PANEL) */}
        {/* ========================================================================= */}
        {activeTab === "issues" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 card p-5 rounded-2xl">
              <div>
                <h2 className="text-lg font-bold text-[#EAF1F8]">Derived Issues Explorer</h2>
                <p className="text-xs text-[#B4C2D0] mt-0.5">
                  External ticket intelligence with non-destructive linking and real-time triage reasoning.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6B7C8D]" />
                  <input
                    type="text"
                    value={issueSearch}
                    onChange={(e) => setIssueSearch(e.target.value)}
                    placeholder="Search issues, tags, customers..."
                    className="w-full bg-[#18222E] text-xs text-[#EAF1F8] pl-8 pr-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6] transition-colors"
                  />
                </div>

                <select
                  value={issueSentimentFilter}
                  onChange={(e) => setIssueSentimentFilter(e.target.value)}
                  className="bg-[#18222E] text-xs text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Sentiments</option>
                  <option value="urgent">Urgent</option>
                  <option value="angry">Angry</option>
                  <option value="frustrated">Frustrated</option>
                  <option value="neutral">Neutral</option>
                  <option value="positive">Positive</option>
                </select>
              </div>
            </div>

            {/* Full-Width Issues Table */}
            <div className="card p-5 overflow-hidden w-full rounded-2xl bg-[#121A24] border-[var(--line)]">
              <div className="overflow-x-auto">
                <table className="gv8-table w-full">
                  <thead>
                    <tr>
                      <th>Source / Issue ID</th>
                      <th>Customer &amp; Tier</th>
                      <th>Summary &amp; Category</th>
                      <th>Sentiment</th>
                      <th>AI Confidence</th>
                      <th>Problem Link</th>
                      <th>Assigned Agent</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.map((issue) => (
                      <tr
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        className={`cursor-pointer transition-colors hover:bg-[#18222E]/60 ${
                          selectedIssue?.id === issue.id ? "bg-[#18222E] border-l-2 border-[#2ED8B6]" : ""
                        }`}
                      >
                        <td className="font-mono">
                          <span className="font-bold text-[#EAF1F8] text-xs block">{issue.externalId}</span>
                          <span className="pill text-[9px] uppercase mt-0.5 inline-block">{issue.source}</span>
                        </td>
                        <td>
                          <div className="font-bold text-[#EAF1F8] text-xs">{issue.customerName}</div>
                          <span className="text-[10px] text-[#6B7C8D] font-mono">{issue.customerTier} Tier</span>
                        </td>
                        <td>
                          <div className="font-medium text-[#EAF1F8] text-xs leading-snug">{issue.summary}</div>
                          <div className="text-[10px] text-[#2ED8B6] font-mono mt-0.5">{issue.category}</div>
                        </td>
                        <td>
                          <span
                            className={`pill text-[10px] ${
                              issue.sentiment === "urgent" || issue.sentiment === "angry"
                                ? "err"
                                : issue.sentiment === "frustrated"
                                ? "warn"
                                : "ok"
                            }`}
                          >
                            <i className="dot"></i>
                            {issue.sentiment}
                          </span>
                        </td>
                        <td className="font-mono text-xs font-bold text-[#4CC38A]">
                          {(issue.confidence * 100).toFixed(0)}%
                        </td>
                        <td className="font-mono text-xs">
                          {issue.problemId ? (
                            <span className="pill ok text-[10px]">
                              <i className="dot"></i>
                              {issue.problemId}
                            </span>
                          ) : (
                            <span className="text-[#6B7C8D] text-xs">—</span>
                          )}
                        </td>
                        <td className="text-xs text-[#B4C2D0] font-mono">
                          {issue.assignedTo || "Sophia (AI)"}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedIssue(issue)}
                              className="btn btn-secondary text-xs py-1 px-2.5 font-mono cursor-pointer hover:text-[#2ED8B6] hover:border-[#2ED8B6]"
                            >
                              Inspect Details →
                            </button>
                            <a
                              href={issue.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary p-1.5 rounded-lg inline-flex items-center text-[#6B7C8D] hover:text-[#EAF1F8]"
                              title="Open Raw Source"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* FLOATING SLIDE-OVER SIDE PANEL FOR ISSUE DETAILS */}
            {/* ========================================================================= */}
            {selectedIssue && (
              <>
                {/* Backdrop Blur Overlay */}
                <div
                  className="fixed inset-0 z-40 bg-[#0B1017]/70 backdrop-blur-sm transition-opacity"
                  onClick={() => setSelectedIssue(null)}
                />

                {/* Floating Slide-over Drawer Panel */}
                <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-[#0C121A] border-l border-[var(--line)] shadow-2xl p-6 overflow-y-auto flex flex-col justify-between space-y-6 animate-in slide-in-from-right duration-200">
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#2ED8B6]">{selectedIssue.externalId}</span>
                          <span className="pill uppercase text-[10px] font-mono">{selectedIssue.category}</span>
                          <span className={`pill ${selectedIssue.status === "resolved" ? "ok" : "warn"} text-[10px] uppercase font-mono`}>
                            <i className="dot"></i>
                            {selectedIssue.status}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-[#EAF1F8] mt-1.5 leading-snug">
                          {selectedIssue.summary}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedIssue(null)}
                        className="p-1.5 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Customer 360 & Account Snapshot */}
                    <div className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#EAF1F8] text-sm">{selectedIssue.customerName}</span>
                        <span className="pill ok uppercase text-[10px]">{selectedIssue.customerTier} Tier</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6B7C8D] font-mono pt-1">
                        <div>
                          <span>Customer Ref:</span> <strong className="text-[#EAF1F8]">{selectedIssue.customerRef || "CUST-9921"}</strong>
                        </div>
                        <div>
                          <span>Risk Score:</span> <strong className="text-[#F5A623]">{selectedIssue.resolutionRiskScore || "Low Risk (0.18)"}</strong>
                        </div>
                        <div>
                          <span>Ingress Line:</span> <strong className="text-[#2ED8B6] uppercase">{selectedIssue.source}</strong>
                        </div>
                        <div>
                          <span>Assigned Agent:</span> <strong className="text-[#EAF1F8]">{selectedIssue.assignedTo || "Sophia (AI)"}</strong>
                        </div>
                      </div>
                    </div>

                    {/* AI Triage & Reasoning */}
                    <div className="space-y-2 text-xs">
                      <label className="text-[#6B7C8D] font-mono uppercase text-[10px] font-bold block">
                        AI Recommended Action &amp; Triage Rationale
                      </label>
                      <div className="p-3.5 rounded-xl bg-[#18222E] border border-[var(--line)] text-[#B4C2D0] leading-relaxed">
                        {selectedIssue.recommendedAction}
                      </div>
                    </div>

                    {/* AI Confidence Meter */}
                    <div className="space-y-1 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-[#6B7C8D]">Autonomous Confidence Score:</span>
                        <span className="text-[#4CC38A] font-bold">{(selectedIssue.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-[#18222E] h-2 rounded-full overflow-hidden border border-[var(--line)]">
                        <div
                          className="h-full rounded-full bg-[#4CC38A]"
                          style={{ width: `${selectedIssue.confidence * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Correlated Problem Incident */}
                    {selectedIssue.problemId && (
                      <div className="p-3.5 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#E5484D] font-bold font-mono">Correlated Systemic Problem</span>
                          <span className="pill err text-[9px]">{selectedIssue.problemId}</span>
                        </div>
                        <p className="text-[#B4C2D0] text-[11px]">
                          This ticket is correlated to active systemic incident <strong className="text-[#EAF1F8]">{selectedIssue.problemId}</strong>. Root-cause mitigations are in progress.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 border-t border-[var(--line)] flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceSelectedIssueId(selectedIssue.id);
                        setSelectedIssue(null);
                        setActiveTab("workspace");
                        notify(`Opened ${selectedIssue.externalId} in Workspace`, "info");
                      }}
                      className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Open in Workspace Desk →</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          selectedIssue.status = "resolved";
                          notify(`Marked ${selectedIssue.externalId} as Resolved`, "success");
                          setSelectedIssue({ ...selectedIssue });
                          fetchData();
                        }}
                        className="btn btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:text-[#4CC38A] hover:border-[#4CC38A]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Mark Resolved</span>
                      </button>

                      <a
                        href={selectedIssue.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary py-2 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Source Link</span>
                      </a>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: AI WORKFORCE (ORDERV8 CANONICAL WORKFORCE HIERARCHY) */}
        {/* ========================================================================= */}
        {activeTab === "workforce" && (
          <div className="space-y-6">
            {/* Top Overview & Roster Header */}
            <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
                    <Users className="w-5 h-5" />
                  </span>
                  <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">AI Workforce Hierarchy &amp; Roster</h1>
                </div>
                <p className="text-xs text-[#B4C2D0]">
                  OrderV8 canonical workforce architecture: AI Employees are hired first to receive work; Specialized Interns operate as paired sub-agents.
                </p>
              </div>

              {/* Roster Filter Strip */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#18222E] border border-[var(--line)]">
                {[
                  { id: "all", label: "All Workforce", count: workforce.length },
                  {
                    id: "employees",
                    label: "Hired AI Employees",
                    count: workforce.filter((w) => w.level === "ai_employee" && (w.hired === undefined || w.hired)).length,
                  },
                  {
                    id: "interns",
                    label: "Paired Sub-Agents",
                    count: workforce.filter((w) => w.level === "ai_intern").length,
                  },
                  {
                    id: "catalog",
                    label: "Available to Hire",
                    count: workforce.filter((w) => w.level === "ai_employee" && w.hired === false).length,
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setWorkforceFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      workforceFilter === f.id
                        ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                        : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      workforceFilter === f.id ? "bg-[#04201C]/20 text-[#04201C]" : "bg-[#121A24] text-[#8E9AA8]"
                    }`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Architectural Policy Banner */}
            <div className="card p-4 bg-[#121A24] border border-[#2ED8B6]/30 rounded-2xl flex items-start gap-3.5 shadow-sm">
              <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-[#EAF1F8] font-mono">
                    CANONICAL WORKFORCE HIERARCHY &amp; INTERN DISPATCH POLICY
                  </h4>
                  <span className="pill ok text-[9px] font-mono">ORDERV8 SPEC</span>
                </div>
                <p className="text-xs text-[#B4C2D0] leading-relaxed font-sans">
                  <strong>1. Hiring Precedence:</strong> AI Employees must first be <strong>hired / provisioned</strong> before they can be assigned customer tickets or execute workflows.
                  <br />
                  <strong>2. Intern Pairing Constraint:</strong> Specialized Interns are <strong>paired to AI Employees</strong> and execute delegated micro-tasks (auto-tagging, sweeps, transcriptions, OCR). <strong>Interns cannot work or be assigned work directly</strong> by users or external systems.
                </p>
              </div>
            </div>

            {/* SECTION 1: Hired AI Employees (Supervisors & Work Assignees) */}
            {(workforceFilter === "all" || workforceFilter === "employees") && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-[#2ED8B6]" />
                    <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                      Hired AI Employees (Supervisors &amp; Work Receivers)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#6B7C8D]">
                    Eligible for Direct Ticket &amp; Workflow Assignment
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {workforce
                    .filter((w) => w.level === "ai_employee" && (w.hired === undefined || w.hired))
                    .map((emp) => {
                      const pairedInterns = workforce.filter(
                        (i) => i.level === "ai_intern" && i.supervisorId === emp.id
                      );
                      return (
                        <div
                          key={emp.id}
                          className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all shadow-md flex flex-col justify-between"
                        >
                          <div className="space-y-3.5">
                            {/* Employee Header */}
                            <div className="flex items-start justify-between pb-3 border-b border-[var(--line)]">
                              <div className="flex items-center gap-3">
                                <img
                                  src={emp.avatarUrl || "/avatars/beaver-manager.jpg"}
                                  alt={emp.name}
                                  className="w-12 h-12 rounded-2xl object-cover border-2 border-[#2ED8B6]/50 shadow-md shrink-0"
                                />
                                <div>
                                  <h4 className="text-xs font-bold text-[#EAF1F8] leading-tight">
                                    {emp.name}
                                  </h4>
                                  <span className="text-[10px] text-[#6B7C8D] font-mono block mt-0.5">
                                    {emp.role}
                                  </span>
                                </div>
                              </div>
                              <span className="pill ok text-[9px] font-mono uppercase shrink-0">
                                <i className="dot"></i>
                                HIRED &amp; ACTIVE
                              </span>
                            </div>

                            <p className="text-xs text-[#B4C2D0] leading-relaxed font-sans">
                              {emp.description}
                            </p>

                            {/* Performance Grid */}
                            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-[#18222E] p-2.5 rounded-xl border border-[var(--line)]">
                              <div>
                                <span className="text-[9px] text-[#6B7C8D] block">VARR</span>
                                <span className="font-bold text-[#2ED8B6]">{emp.varr}%</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#6B7C8D] block">CSAT</span>
                                <span className="font-bold text-[#EAF1F8]">{emp.csat}%</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-[#6B7C8D] block">ASSIGNED</span>
                                <span className="font-bold text-[#4D9FFF]">{emp.assignedCount}</span>
                              </div>
                            </div>

                            {/* Nested Paired Interns Strip */}
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                                <span className="uppercase font-bold text-[#2ED8B6] flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>Paired Specialized Interns ({pairedInterns.length}):</span>
                                </span>
                                <span>Sub-Agents</span>
                              </div>

                              {pairedInterns.length > 0 ? (
                                <div className="space-y-1.5">
                                  {pairedInterns.map((intern) => (
                                    <div
                                      key={intern.id}
                                      className="p-2 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-between text-xs font-mono"
                                    >
                                      <div className="flex items-center gap-2">
                                        <img
                                          src={intern.avatarUrl || "/avatars/beaver-intern.jpg"}
                                          alt={intern.name}
                                          className="w-5 h-5 rounded-lg object-cover border border-[#2ED8B6]/30 shrink-0"
                                        />
                                        <span className="text-[#EAF1F8] text-[11px] font-bold">
                                          {intern.name.split(" — ")[0]}
                                        </span>
                                      </div>
                                      <span className="pill text-[8.5px] py-0 px-1.5 bg-[#121A24]">
                                        {intern.role.split(" ")[0]}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-2 rounded-xl bg-[#18222E]/50 border border-[var(--line)] text-[10px] font-mono text-[#6B7C8D] text-center">
                                  No specialized interns currently paired
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Footer */}
                          <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenAssignWorkModal(emp)}
                              className="btn btn-primary py-1.5 px-3 text-xs font-bold flex-1 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <Briefcase className="w-3.5 h-3.5" />
                              <span>Assign Work</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setIsChatOpen(true);
                              }}
                              className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-[#2ED8B6]" />
                              <span>Chat</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* SECTION 2: Specialized Interns Matrix (Paired Sub-Agents) */}
            {(workforceFilter === "all" || workforceFilter === "interns") && (
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#F5A623]" />
                    <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                      Specialized Interns (Paired Sub-Agents)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#E5484D] flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>Direct Assignment Disabled (Sub-Agent Only)</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {workforce
                    .filter((w) => w.level === "ai_intern")
                    .map((intern) => {
                      const supervisor = workforce.find((w) => w.id === intern.supervisorId);
                      return (
                        <div
                          key={intern.id}
                          className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[var(--line-2)] transition-all shadow-md flex flex-col justify-between"
                        >
                          <div className="space-y-3.5">
                            <div className="flex items-start justify-between pb-3 border-b border-[var(--line)]">
                              <div className="flex items-center gap-3">
                                <img
                                  src={intern.avatarUrl || "/avatars/beaver-intern.jpg"}
                                  alt={intern.name}
                                  className="w-12 h-12 rounded-2xl object-cover border-2 border-[#F5A623]/40 shadow-md shrink-0"
                                />
                                <div>
                                  <h4 className="text-xs font-bold text-[#EAF1F8] leading-tight">
                                    {intern.name}
                                  </h4>
                                  <span className="text-[10px] text-[#6B7C8D] font-mono block mt-0.5">
                                    {intern.role}
                                  </span>
                                </div>
                              </div>
                              <span className="pill warn text-[9px] font-mono uppercase shrink-0">
                                PAIRED SUB-AGENT
                              </span>
                            </div>

                            <p className="text-xs text-[#B4C2D0] leading-relaxed font-sans">
                              {intern.description}
                            </p>

                            {/* Supervisor Pairing Badge */}
                            <div className="p-2.5 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                              <span className="text-[9px] text-[#6B7C8D] uppercase font-mono block font-bold">
                                Supervising AI Employee:
                              </span>
                              <div className="flex items-center gap-2 text-xs font-mono text-[#2ED8B6] font-bold">
                                <Bot className="w-3.5 h-3.5" />
                                <span>{supervisor?.name || "Alex — Support Lead"}</span>
                              </div>
                            </div>

                            {/* Micro-Action Grants */}
                            <div className="space-y-1">
                              <span className="text-[9px] text-[#6B7C8D] uppercase font-mono block">
                                Sub-Task Grants:
                              </span>
                              <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                                {intern.grants?.length > 0 ? (
                                  intern.grants.map((g: string, i: number) => (
                                    <span key={i} className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line)] text-[#B4C2D0]">
                                      {g}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[#6B7C8D] text-[10px]">Read-only transcription stream</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Disabled Direct Work Badge */}
                          <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                            <span className="text-[#E5484D] flex items-center gap-1 font-bold">
                              <Lock className="w-3 h-3" />
                              <span>No Direct Assignment</span>
                            </span>
                            <span>Delegated Runs: <strong className="text-[#EAF1F8]">{intern.assignedCount}</strong></span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* SECTION 3: Marketplace & Available Roles to Hire */}
            {(workforceFilter === "all" || workforceFilter === "catalog") && (
              <div className="space-y-3.5 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-[#4CC38A]" />
                    <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                      Available AI Employees in Catalog (Hire to Assign Work)
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#6B7C8D]">
                    1-Click Provisioning to Active Roster
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {workforce
                    .filter((w) => w.level === "ai_employee" && w.hired === false)
                    .map((emp) => (
                      <div
                        key={emp.id}
                        className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#4CC38A]/40 transition-all shadow-md flex flex-col justify-between"
                      >
                        <div className="space-y-3.5">
                          <div className="flex items-start justify-between pb-3 border-b border-[var(--line)]">
                            <div className="flex items-center gap-3">
                              <img
                                src={emp.avatarUrl || "/avatars/beaver-sophia.jpg"}
                                alt={emp.name}
                                className="w-12 h-12 rounded-2xl object-cover border-2 border-[var(--line-2)] shadow-md shrink-0"
                              />
                              <div>
                                <h4 className="text-xs font-bold text-[#EAF1F8] leading-tight">
                                  {emp.name}
                                </h4>
                                <span className="text-[10px] text-[#6B7C8D] font-mono block mt-0.5">
                                  {emp.role}
                                </span>
                              </div>
                            </div>
                            <span className="pill text-[9px] font-mono uppercase shrink-0">
                              AVAILABLE TO HIRE
                            </span>
                          </div>

                          <p className="text-xs text-[#B4C2D0] leading-relaxed font-sans">
                            {emp.description}
                          </p>

                          <div className="p-2.5 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center justify-between text-xs font-mono text-[#6B7C8D]">
                            <span>Autonomy: <strong className="text-[#2ED8B6] uppercase">{emp.autonomyLevel}</strong></span>
                            <span>Target CSAT: <strong className="text-[#EAF1F8]">{emp.csat}%</strong></span>
                            <span>Est VARR: <strong className="text-[#4CC38A]">{emp.varr}%</strong></span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                          <span className="text-[10px] font-mono text-[#6B7C8D]">
                            Hiring assigns initial token budget &amp; unlocks task dispatch
                          </span>
                          <button
                            type="button"
                            onClick={() => handleHireWorkforceEmployee(emp.id)}
                            className="btn btn-primary py-1.5 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Hire AI Employee</span>
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: VOICE INTEGRATION (GROWTHV8 VOICE ARCHITECTURE) */}
        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* TAB: VOICE INTEGRATION (GROWTHV8 VOICE ARCHITECTURE) */}
        {/* ========================================================================= */}
        {activeTab === "voice" && (
          <div className="space-y-6">
            {/* Top Overview & Provisioning Header */}
            <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
                    <PhoneCall className="w-5 h-5" />
                  </span>
                  <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Voice Telephony &amp; AI Bot Operations</h1>
                </div>
                <p className="text-xs text-[#B4C2D0]">
                  GrowthV8 voice architecture: Provision remote voice bots (Vapi &amp; Twilio) matched to local AI Employees with granular permission scopes and HMAC authentication.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="pill ok text-xs font-mono">
                  <Radio className="w-3.5 h-3.5" />
                  <span>{voiceData.phoneConfigs.length} Active Lines Provisioned</span>
                </span>

                <button
                  type="button"
                  onClick={() => setIsVoiceProvisionModalOpen(true)}
                  className="btn btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Provision New Voice Bot</span>
                </button>
              </div>
            </div>

            {/* Inbound Voice Numbers & Remote-to-Local Agent Matching Grid */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#2ED8B6]" />
                  <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                    Provisioned Voice Connections (Remote ↔ Local Agent Matching)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#6B7C8D]">
                  HMAC Webhook Callback: /api/voice/webhook
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {voiceData.phoneConfigs.map((cfg: any) => {
                  const localEmp = workforce.find((w) => w.id === cfg.employeeId) || {
                    name: cfg.employeeName || cfg.agentName,
                    role: "Voice Lead",
                    avatarUrl: "/avatars/beaver-sophia.jpg",
                  };
                  return (
                    <div
                      key={cfg.id}
                      className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all shadow-md flex flex-col justify-between"
                    >
                      <div className="space-y-3.5">
                        {/* Header: Phone & Provider */}
                        <div className="flex items-start justify-between pb-3 border-b border-[var(--line)]">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-[#2ED8B6] tracking-wide">
                                {cfg.phoneNumber}
                              </span>
                              <span className="pill text-[9px] uppercase font-mono bg-[#18222E] border-[var(--line-2)] text-[#4D9FFF]">
                                {cfg.provider.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#6B7C8D] font-mono block mt-0.5">
                              Line: {cfg.serviceMode || "customer"} • Last Call: {cfg.lastCallAt || "Active"}
                            </span>
                          </div>
                          <span className="pill ok text-[9px] font-mono uppercase shrink-0">
                            <i className="dot"></i>
                            {cfg.syncStatus === "synced" ? "SYNCED & MATCHED" : "PROVISIONED"}
                          </span>
                        </div>

                        {/* Remote ↔ Local Agent Matching Box */}
                        <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2">
                          <div className="flex items-center justify-between text-[9px] font-mono text-[#6B7C8D] uppercase font-bold">
                            <span>Local AI Employee:</span>
                            <span className="text-[#2ED8B6]">Remote Provider ID</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <img
                                src={localEmp.avatarUrl || "/avatars/beaver-sophia.jpg"}
                                alt={localEmp.name}
                                className="w-6 h-6 rounded-lg object-cover border border-[#2ED8B6]/40 shrink-0"
                              />
                              <span className="font-bold text-[#EAF1F8] text-[11px] truncate max-w-[140px]">
                                {localEmp.name?.split("—")[0]?.trim() || "Sophia"}
                              </span>
                            </div>
                            <span className="font-mono text-[10px] text-[#2ED8B6] bg-[#121A24] px-2 py-0.5 rounded border border-[var(--line)] truncate max-w-[130px]" title={cfg.remoteAgentId}>
                              {cfg.remoteAgentId || `asst_${cfg.provider}_${cfg.id}`}
                            </span>
                          </div>
                        </div>

                        {/* System Prompt & First Message Greeting */}
                        <div className="space-y-1 text-xs">
                          {cfg.firstMessage && (
                            <div className="p-2 rounded-lg bg-[#0E1520] border border-[var(--line-2)] text-[11px] text-[#B4C2D0] italic">
                              &ldquo;{cfg.firstMessage}&rdquo;
                            </div>
                          )}
                          <p className="text-xs text-[#8E9AA8] leading-relaxed line-clamp-2">
                            {cfg.systemPrompt}
                          </p>
                        </div>

                        {/* Permission Scopes Badges */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                            <span className="uppercase font-bold text-[#EAF1F8] flex items-center gap-1">
                              <Shield className="w-3 h-3 text-[#2ED8B6]" />
                              <span>Granted Tool Permissions ({(cfg.permissionScopes || []).length}):</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 font-mono text-[9.5px]">
                            {(cfg.permissionScopes && cfg.permissionScopes.length > 0
                              ? cfg.permissionScopes
                              : ["support.problem.status", "support.ticket.lookup"]
                            ).map((scope: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line-2)] text-[#2ED8B6]"
                              >
                                {scope.replace("support.", "")}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Telephony Specs */}
                        <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] border-t border-[var(--line)]">
                          <span>
                            Voice Model: <strong className="text-[#EAF1F8]">{cfg.voiceId || "jennifer-neural-v2"}</strong>
                          </span>
                          <span>
                            Auth Gate: <strong className="text-[#2ED8B6] uppercase">{cfg.minVerificationLevel}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleSyncVoiceBot(cfg.id)}
                          className="btn btn-secondary py-1.5 px-2.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer flex-1 justify-center"
                          title="Re-synchronize remote provider assistant with local AI employee"
                        >
                          <RefreshCw className="w-3 h-3 text-[#2ED8B6]" />
                          <span>Re-Sync API</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedConfigForPermissions(cfg);
                            setEditPermissionScopes(cfg.permissionScopes || [
                              "support.problem.status",
                              "support.ticket.lookup",
                              "support.ticket.create",
                              "knowledge.rag.search",
                            ]);
                            setIsEditPermissionsModalOpen(true);
                          }}
                          className="btn btn-secondary py-1.5 px-2.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                          title="Edit granted capability scopes"
                        >
                          <Sliders className="w-3 h-3 text-[#4D9FFF]" />
                          <span>Permissions</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSimVoiceNumber(cfg.phoneNumber);
                            setSimVoiceProvider(cfg.provider);
                            setSimVoiceVerification(cfg.minVerificationLevel || "phone_match");
                            const simElement = document.getElementById("voice-call-simulator");
                            if (simElement) simElement.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="btn btn-primary py-1.5 px-2.5 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="Test simulate call with this bot"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span>Test</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Simulator & Live Session Inspector */}
            <div id="voice-call-simulator" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Voice Call Simulator */}
              <div className="card p-5 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-[var(--line)]">
                  <Mic className="w-4 h-4 text-[#2ED8B6]" />
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Simulate Inbound Voice Call</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[#6B7C8D] block mb-1">Caller Phone Number</label>
                    <input
                      type="text"
                      value={simVoiceNumber}
                      onChange={(e) => setSimVoiceNumber(e.target.value)}
                      className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-1.5 rounded-lg border border-[var(--line-2)] font-mono focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[#6B7C8D] block mb-1">Caller Name</label>
                    <input
                      type="text"
                      value={simVoiceName}
                      onChange={(e) => setSimVoiceName(e.target.value)}
                      className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-1.5 rounded-lg border border-[var(--line-2)] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[#6B7C8D] block mb-1">Voice Provider</label>
                      <select
                        value={simVoiceProvider}
                        onChange={(e) => setSimVoiceProvider(e.target.value as any)}
                        className="w-full bg-[#18222E] text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line-2)] font-mono focus:outline-none cursor-pointer"
                      >
                        <option value="vapi">Vapi.ai</option>
                        <option value="twilio">Twilio Voice</option>
                        <option value="retell">Retell AI</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[#6B7C8D] block mb-1">Customer Tier</label>
                      <select
                        value={simVoiceTier}
                        onChange={(e) => setSimVoiceTier(e.target.value as any)}
                        className="w-full bg-[#18222E] text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line-2)] font-mono focus:outline-none cursor-pointer"
                      >
                        <option value="enterprise">Enterprise</option>
                        <option value="pro">Pro</option>
                        <option value="standard">Standard</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[#6B7C8D] block mb-1">Identity Verification Level</label>
                    <select
                      value={simVoiceVerification}
                      onChange={(e) => setSimVoiceVerification(e.target.value as any)}
                      className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-1.5 rounded-lg border border-[var(--line-2)] font-mono focus:outline-none cursor-pointer"
                    >
                      <option value="authenticated">Authenticated (Full Tool Access)</option>
                      <option value="otp_verified">OTP Verified (Account Actions)</option>
                      <option value="phone_match">Phone Match (Ticket Lookup)</option>
                      <option value="anonymous">Anonymous (Public Status Only)</option>
                    </select>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        setSimVoiceLoading(true);
                        const res = await fetch("/api/voice/session", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            provider: simVoiceProvider,
                            callerNumber: simVoiceNumber,
                            callerName: simVoiceName,
                            customerTier: simVoiceTier,
                            verificationLevel: simVoiceVerification,
                          }),
                        }).then((r) => r.json());

                        if (res.success) {
                          notify(res.message, "success");
                          setSelectedVoiceSession(res.data.session);
                          fetchData();
                        } else {
                          notify(res.error || "Simulation failed", "error");
                        }
                      } catch (err) {
                        notify("Network error simulating voice session", "error");
                      } finally {
                        setSimVoiceLoading(false);
                      }
                    }}
                    disabled={simVoiceLoading}
                    className="btn btn-primary w-full py-2 text-xs font-semibold cursor-pointer mt-2"
                  >
                    <PhoneCall className={`w-3.5 h-3.5 ${simVoiceLoading ? "animate-spin" : ""}`} />
                    <span>{simVoiceLoading ? "Initiating Call..." : "Simulate Inbound Voice Call"}</span>
                  </button>
                </div>
              </div>

              {/* Live Audio Transcript & Tool Invocation Stream */}
              <div className="lg:col-span-2 card p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#2ED8B6]" />
                    <h3 className="text-sm font-bold text-[#EAF1F8]">
                      {selectedVoiceSession ? `Session: ${selectedVoiceSession.id}` : "Select Voice Call"}
                    </h3>
                  </div>
                  {selectedVoiceSession && (
                    <div className="flex items-center gap-2">
                      <span className="pill ok">
                        <i className="dot"></i>
                        {selectedVoiceSession.verificationLevel}
                      </span>
                      <span
                        className={`pill ${
                          selectedVoiceSession.sentiment === "frustrated"
                            ? "err"
                            : "ok"
                        }`}
                      >
                        <i className="dot"></i>
                        {selectedVoiceSession.sentiment}
                      </span>
                    </div>
                  )}
                </div>

                {selectedVoiceSession ? (
                  <div className="space-y-4">
                    {/* Transcript turns */}
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                      {selectedVoiceSession.transcript?.map((turn: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-xs leading-relaxed ${
                            turn.role === "assistant"
                              ? "bg-[#18222E] border border-[var(--line)] text-[#EAF1F8]"
                              : turn.role === "user"
                              ? "bg-[#121A24] border border-[var(--line-2)] text-[#B4C2D0]"
                              : "bg-[#2ED8B6]/5 border border-[#2ED8B6]/20 font-mono text-[#2ED8B6]"
                          }`}
                        >
                          <div className="flex justify-between text-[10px] text-[#6B7C8D] mb-1">
                            <span className="uppercase font-bold tracking-wider font-mono">{turn.role}</span>
                            <span className="font-mono">{turn.timestamp}</span>
                          </div>
                          <p>{turn.text}</p>
                        </div>
                      ))}
                    </div>

                    {/* Invoked Voice Tools */}
                    {selectedVoiceSession.toolsInvoked && selectedVoiceSession.toolsInvoked.length > 0 && (
                      <div className="pt-3 border-t border-[var(--line)] space-y-2">
                        <span className="text-xs font-semibold text-[#EAF1F8] block">Invoked Voice Capabilities</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedVoiceSession.toolsInvoked.map((t: any, idx: number) => (
                            <div key={idx} className="bg-[#18222E] p-3 rounded-lg border border-[var(--line)] font-mono text-[11px]">
                              <div className="flex justify-between text-[#2ED8B6] font-bold">
                                <span>{t.tool}</span>
                                <span className="text-[#4CC38A]">{t.latencyMs}ms</span>
                              </div>
                              <div className="text-[#6B7C8D] mt-1 truncate">
                                Output: {JSON.stringify(t.output)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-[#6B7C8D] text-xs">
                    No active voice session selected. Choose a call from the history or simulate a new inbound call.
                  </div>
                )}
              </div>
            </div>

            {/* Voice Sessions History Table */}
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-bold text-[#EAF1F8]">Recent Inbound Telephony Sessions</h3>
              <div className="overflow-x-auto">
                <table className="gv8-table">
                  <thead>
                    <tr>
                      <th>Session ID / Caller</th>
                      <th>Provider</th>
                      <th>Verification Tier</th>
                      <th>Duration</th>
                      <th>Sentiment</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {voiceData.sessions.map((sess: any) => (
                      <tr key={sess.id}>
                        <td>
                          <div className="font-medium text-[#EAF1F8]">{sess.callerName || sess.callerNumber}</div>
                          <div className="font-mono text-[11px] text-[#6B7C8D]">{sess.callerNumber}</div>
                        </td>
                        <td>
                          <span className="pill">
                            {sess.provider}
                          </span>
                        </td>
                        <td>
                          <span className="pill ok">
                            <i className="dot"></i>
                            {sess.verificationLevel}
                          </span>
                        </td>
                        <td className="font-mono text-[#B4C2D0]">
                          {sess.durationSeconds ? `${sess.durationSeconds}s` : "Active"}
                        </td>
                        <td>
                          <span
                            className={`pill ${
                              sess.sentiment === "frustrated"
                                ? "err"
                                : "ok"
                            }`}
                          >
                            <i className="dot"></i>
                            {sess.sentiment}
                          </span>
                        </td>
                        <td>
                          <span className="pill ok">
                            <i className="dot"></i>
                            {sess.status}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => setSelectedVoiceSession(sess)}
                            className="btn btn-secondary text-xs"
                          >
                            Inspect Audio
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* ========================================================================= */}
        {/* TAB: PROBLEMS (SYSTEMIC PROBLEM CORRELATION MATRIX - WORK DESK) */}
        {/* ========================================================================= */}
        {activeTab === "problems" && (
          <div className="space-y-6">
            <div className="card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#EAF1F8]">Problem Correlation Matrix</h2>
                  <span className="pill ok text-[9px] font-mono uppercase"><i className="dot"></i> WORK DESK HUB</span>
                </div>
                <p className="text-xs text-[#B4C2D0] mt-0.5">
                  SupportV8 is the terminal resolution hub. Root cause clusters end here with autonomous mitigation, proactive customer broadcasts, or direct human escalation.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveTab("workspace")}
                  className="btn btn-secondary text-xs cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Open Work Desk Stream</span>
                </button>
                <button
                  onClick={() => setActiveTab("cx_cockpit")}
                  className="btn btn-primary text-xs cursor-pointer"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>CX Cockpit</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {problems.map((prob) => (
                <div key={prob.id} className="card p-5 space-y-4 rounded-2xl bg-[#121A24] border-[var(--line)] shadow-lg">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#2ED8B6]">{prob.id}</span>
                        <span
                          className={`pill ${
                            prob.impact === "critical" || prob.severity === "critical" ? "err" : "warn"
                          }`}
                        >
                          <i className="dot"></i>
                          {prob.impact || prob.severity || "HIGH"} IMPACT
                        </span>
                        <span className="text-xs text-[#6B7C8D] font-mono">
                          {((prob.confidence || 0.94) * 100).toFixed(0)}% Confidence
                        </span>
                        {prob.status === "resolved" && (
                          <span className="pill ok text-[9px] font-mono uppercase">RESOLVED</span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-[#EAF1F8] mt-1">{prob.title}</h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <div className="bg-[#18222E] px-3.5 py-1.5 rounded-xl border border-[var(--line)] text-right">
                        <span className="text-[#6B7C8D] block text-[10px]">REVENUE EXPOSURE</span>
                        <span className="font-bold text-[#F5A623]">${(prob.estimatedRevenueExposure || 142000).toLocaleString()}</span>
                      </div>
                      <div className="bg-[#18222E] px-3.5 py-1.5 rounded-xl border border-[var(--line)] text-right">
                        <span className="text-[#6B7C8D] block text-[10px]">AFFECTED ACCOUNTS</span>
                        <span className="font-bold text-[#EAF1F8]">{prob.affectedCustomerCount || 12}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-[#B4C2D0] bg-[#18222E] p-3.5 rounded-xl border border-[var(--line)] leading-relaxed">
                    <strong className="text-[#EAF1F8] font-mono">Root Cause Diagnostic:</strong> {prob.suspectedCause}
                  </p>

                  <div className="flex flex-wrap items-center justify-between pt-2 gap-3 text-xs border-t border-[var(--line)]">
                    <span className="text-[#6B7C8D] font-mono text-xs">
                      Incident Lead: <strong className="text-[#EAF1F8]">{prob.owner || "Barnaby (SRE AI)"}</strong>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const linked = issues.find((i) => i.problemId === prob.id);
                          if (linked) setWorkspaceSelectedIssueId(linked.id);
                          setActiveTab("workspace");
                          notify(`Inspecting cases linked to ${prob.id} in Work Desk`, "info");
                        }}
                        className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-mono hover:text-[#2ED8B6] hover:border-[#2ED8B6]"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Inspect in Work Desk →</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTicketForEscalation({
                            ticketId: prob.id,
                            externalId: prob.id,
                            customerName: `${prob.title} (${prob.affectedCustomerCount || 12} Affected Accounts)`,
                            assignedAgent: prob.owner || "Barnaby (SRE AI)",
                            remainingMinutes: 30,
                            status: "at_risk",
                          });
                          setIsEscalateModalOpen(true);
                        }}
                        className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-mono hover:text-[#F5A623] hover:border-[#F5A623]"
                      >
                        <Zap className="w-3.5 h-3.5 text-[#F5A623]" />
                        <span>Escalate Incident</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openBroadcastModal(prob)}
                        className="btn btn-primary text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Proactive Broadcast</span>
                      </button>

                      {prob.status !== "resolved" && (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/problems", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ problemId: prob.id, status: "resolved" }),
                            });
                            notify(`Marked ${prob.id} as Root Cause Resolved!`, "success");
                            fetchData();
                          }}
                          className="btn btn-secondary text-xs flex items-center gap-1.5 cursor-pointer font-mono hover:text-[#4CC38A] hover:border-[#4CC38A]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#4CC38A]" />
                          <span>Mark Resolved</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: AUTONOMOUS STUDIO (WORKFLOWS, AUTOMATIONS, SCENARIO TEMPLATES & SIMULATOR) */}
        {/* ========================================================================= */}
        {activeTab === "studio" && (
          <AutonomousStudioView onNotify={notify} />
        )}

        {/* ========================================================================= */}
        {/* TAB: TRENDS & ANOMALIES (GROWTHV8 RADAR) */}
        {/* ========================================================================= */}
        {activeTab === "trends" && (
          <div className="space-y-6">
            <div className="card p-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#EAF1F8]">Trend Spotting &amp; Anomaly Radar</h2>
                <p className="text-xs text-[#B4C2D0] mt-0.5">Baseline comparison over volume, sentiment, and categories.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {trends.anomalies.map((anom) => (
                <div key={anom.id} className="card p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#EAF1F8]">{anom.category}</span>
                    <span className="font-mono font-bold text-[#E5484D]">+{anom.changePct}%</span>
                  </div>
                  <p className="text-xs text-[#B4C2D0] leading-relaxed">{anom.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: INSIGHTS (GROWTHV8 INSIGHTS FEED) */}
        {/* ========================================================================= */}
        {activeTab === "insights" && (
          <div className="space-y-4">
            {insights.map((ins) => (
              <div key={ins.id} className="card p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-[#EAF1F8]">{ins.title}</h3>
                  <span className="pill ok">
                    <i className="dot"></i>
                    {(ins.confidence * 100).toFixed(0)}% Confidence
                  </span>
                </div>
                <p className="text-xs text-[#B4C2D0] leading-relaxed">{ins.finding}</p>
                <div className="p-3.5 rounded-lg bg-[#18222E] border border-[var(--line)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                  <span className="text-[#EAF1F8] font-medium">{ins.recommendation}</span>
                  <button
                    onClick={() => handleExecuteInsight(ins.id)}
                    className="btn btn-primary text-xs whitespace-nowrap"
                  >
                    Execute via Action Gateway
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: KNOWLEDGE SUITE (INGESTION, DEFICIT REVIEW MAPPER & SEMANTIC GRAPH) */}
        {/* ========================================================================= */}
        {activeTab === "knowledge" && (
          <KnowledgeSuiteView
            knowledge={knowledge}
            onPublishProposal={handlePublishKnowledge}
            onSyncKv8={fetchData}
            onNotify={notify}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: STALE WORK SWEEPER (GROWTHV8 SWEEPER) */}
        {/* ========================================================================= */}
        {activeTab === "stale_work" && (
          <div className="space-y-4">
            <div className="card p-5 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#EAF1F8]">Stale External Tickets Sweep</h3>
                <p className="text-xs text-[#B4C2D0] mt-0.5">43 dormant tickets safe to close</p>
              </div>
              <button
                onClick={handleExecuteAllSafeStale}
                className="btn btn-primary text-xs font-semibold cursor-pointer"
              >
                Execute Batch Close (43)
              </button>
            </div>

            {staleWork.candidates.map((cand) => (
              <div key={cand.id} className="card p-4 flex justify-between items-center text-xs">
                <div>
                  <span className="font-mono font-bold text-[#EAF1F8]">{cand.externalId}</span>
                  <span className="text-[#6B7C8D] ml-2">({cand.daysInactive} days inactive)</span>
                  <p className="text-[#B4C2D0] text-[11px] mt-0.5">{cand.suggestedNote}</p>
                </div>
                <button
                  onClick={() => handleExecuteStaleWorkSingle(cand.id)}
                  className="btn btn-secondary text-xs cursor-pointer"
                >
                  Close
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: REPORTS & ECONOMICS (GROWTHV8 METRICS GRID) */}
        {/* ========================================================================= */}
        {activeTab === "reports" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#EAF1F8]">Resolution Distribution</h3>
              <div className="text-xs font-mono space-y-2.5 pt-1">
                <div className="flex justify-between border-b border-[var(--line)] pb-2">
                  <span className="text-[#6B7C8D]">Autonomous (VARR)</span>
                  <span className="text-[#2ED8B6] font-bold">74.8%</span>
                </div>
                <div className="flex justify-between border-b border-[var(--line)] pb-2">
                  <span className="text-[#6B7C8D]">Copilot Assisted</span>
                  <span className="text-[#EAF1F8] font-bold">16.9%</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-[#6B7C8D]">Human Escalated</span>
                  <span className="text-[#F5A623] font-bold">8.3%</span>
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#EAF1F8]">Support Economics</h3>
              <div className="text-xs space-y-2.5 pt-1">
                <div className="flex justify-between border-b border-[var(--line)] pb-2">
                  <span className="text-[#6B7C8D]">Manual Cost / Ticket</span>
                  <span className="font-mono font-bold text-[#EAF1F8]">$18.50</span>
                </div>
                <div className="flex justify-between border-b border-[var(--line)] pb-2">
                  <span className="text-[#6B7C8D]">AI Cost / Ticket</span>
                  <span className="font-mono font-bold text-[#2ED8B6]">$0.42</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-[#6B7C8D]">Total Savings</span>
                  <span className="font-mono font-bold text-[#4CC38A]">$38,400</span>
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#EAF1F8]">Quality Metrics</h3>
              <div className="text-xs space-y-2.5 pt-1">
                <div className="flex justify-between border-b border-[var(--line)] pb-2">
                  <span className="text-[#6B7C8D]">SLA Attainment</span>
                  <span className="font-mono font-bold text-[#2ED8B6]">98.2%</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-[#6B7C8D]">Avg Resolution</span>
                  <span className="font-mono font-bold text-[#EAF1F8]">3.4 mins</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: STUDIO MARKETPLACE & CAPABILITY HUB */}
        {/* ========================================================================= */}
        {(activeTab === "studio_marketplace" || activeTab === "sources" || activeTab === "market_connectors") && (
          <StudioMarketplaceHubView
            tenantId={currentTenantSlug}
            tenantName={currentTenantSlug === "acme" ? "Acme Corp" : currentTenantSlug}
            onNotify={notify}
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
          <FocusedWorkspaceView
            issues={issues}
            problems={problems}
            insights={insights}
            onResolve={handleWorkspaceAutonomousResolve}
            onProcessRefund={handleWorkspaceProcessRefund}
            onNavigateToProblems={() => setActiveTab("problems")}
            onExecuteInsight={handleExecuteInsight}
            onEscalate={(issue) => {
              setSelectedTicketForEscalation({
                ticketId: issue.id,
                externalId: issue.externalId,
                customerName: issue.customerName,
                assignedAgent: issue.assignedTo || "Sophia (AI)",
                remainingMinutes: 45,
                status: "at_risk",
              });
              setIsEscalateModalOpen(true);
            }}
            onNotify={notify}
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
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: MARKETPLACE WORKFORCE */}
        {/* ========================================================================= */}
        {activeTab === "market_workforce" && (
          <MarketplaceWorkforceView
            workforce={marketplaceWorkforce}
            onHireAgent={handleHireAgent}
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
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: GOVERNANCE SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === "gov_settings" && (
          <GovernanceSettingsView
            settings={tenantSettings}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {/* ========================================================================= */}
        {/* TAB: GOVERNANCE MEMBERS & RBAC */}
        {/* ========================================================================= */}
        {activeTab === "gov_members" && (
          <GovernanceMembersView
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
        <div className="fixed inset-0 z-50 bg-[#0B1017]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6 space-y-4 bg-[#121A24] border-[var(--line)] shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">Invite Team Member</h3>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#6B7C8D] block mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="e.g. Jordan Miller"
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="e.g. jordan@acme.com"
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Assigned RBAC Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] focus:outline-none cursor-pointer"
                >
                  <option value="Tier 2 Escalation Agent">Tier 2 Escalation Agent</option>
                  <option value="CX Operations Lead">CX Operations Lead</option>
                  <option value="Security & Compliance Auditor">Security & Compliance Auditor</option>
                  <option value="Owner / CX Director">Owner / CX Director</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInviteMember}
                className="btn btn-primary text-xs"
              >
                Dispatch Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connector Configuration Modal */}
      {isConnectorConfigOpen && selectedConnectorForConfig && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 bg-[#121A24] border-[var(--line)] shadow-2xl rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <i className={`${selectedConnectorForConfig.icon} text-lg text-[#2ED8B6]`} />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">{selectedConnectorForConfig.name}</h3>
                  <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">{selectedConnectorForConfig.category} Configuration</span>
                </div>
              </div>
              <button
                onClick={() => setIsConnectorConfigOpen(false)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-[#18222E]/80 border border-[var(--line-2)] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#EAF1F8] font-mono text-[11px]">Service App Connection Tokens</span>
                  <span className="pill ok text-[9px]"><i className="dot"></i> MUTUAL AUTH</span>
                </div>
                <p className="text-[10px] text-[#6B7C8D]">
                  Configure the outbound Bearer token and HMAC webhook secret required to authenticate and synchronize with this service app.
                </p>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Target Service Base Endpoint URL</label>
                <input
                  type="text"
                  defaultValue={selectedConnectorForConfig.endpointUrl || "https://api.ingress.servicev8.internal"}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-[11px] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Service Connection Bearer Token</label>
                <div className="relative">
                  <input
                    type="password"
                    defaultValue={`sec_tok_${selectedConnectorForConfig.id}_${selectedConnectorForConfig.category}_live_9921`}
                    className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs text-[#2ED8B6] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              {selectedConnectorForConfig.configFields.map((field) => (
                <div key={field.key}>
                  <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">{field.label}</label>
                  <input
                    type={field.type}
                    defaultValue={field.value || ""}
                    placeholder={field.placeholder || ""}
                    className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              ))}

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Inbound Webhook Verification Secret</label>
                <input
                  type="password"
                  defaultValue={`whsec_${selectedConnectorForConfig.id}_live_77a4b2c1`}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
              <span className="text-[10px] text-[#4CC38A] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                TLS 1.3 / AES-256 Token Vault
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsConnectorConfigOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsConnectorConfigOpen(false);
                    notify(`Verified token handshake & saved connection for ${selectedConnectorForConfig.name}`, "success");
                  }}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save &amp; Test Handshake</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Priority Escalation & Support Personnel Re-assignment Modal */}
      {isEscalateModalOpen && selectedTicketForEscalation && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-xl w-full p-6 space-y-5 bg-[#121A24] border-[var(--line)] shadow-2xl rounded-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Escalate Priority &amp; Re-assign Support Personnel</h3>
                  <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">
                    Ticket: {selectedTicketForEscalation.externalId} • {selectedTicketForEscalation.customerName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEscalateModalOpen(false)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Ticket SLA Health Snapshot */}
            <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-between text-xs font-mono">
              <div className="space-y-0.5">
                <span className="text-[#6B7C8D] text-[10px]">CURRENT ASSIGNEE</span>
                <div className="font-bold text-[#EAF1F8]">{selectedTicketForEscalation.assignedAgent}</div>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-[#6B7C8D] text-[10px]">TIME REMAINING</span>
                <div className={`font-bold ${selectedTicketForEscalation.remainingMinutes <= 0 ? "text-[#E5484D]" : "text-[#F5A623]"}`}>
                  {selectedTicketForEscalation.remainingMinutes <= 0 ? "BREACHED" : `${selectedTicketForEscalation.remainingMinutes}m buffer`}
                </div>
              </div>
            </div>

            {/* Support Personnel Category Switcher */}
            <div className="space-y-2">
              <label className="text-[#6B7C8D] block font-mono text-[10px] uppercase font-bold">
                Target Support Personnel Type
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[#18222E] p-1 rounded-xl border border-[var(--line)] text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEscalateAssigneeType("ai");
                    setEscalateAssignee("Alex — Support Intelligence Lead (AI)");
                  }}
                  className={`py-2 px-3 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    escalateAssigneeType === "ai"
                      ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span>AI Employee Workforce</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEscalateAssigneeType("human");
                    setEscalateAssignee("Elena Rostova — Lead CX Support Engineer (Human Tier 2)");
                  }}
                  className={`py-2 px-3 rounded-lg font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    escalateAssigneeType === "human"
                      ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Human Support Personnel</span>
                </button>
              </div>
            </div>

            {/* Personnel Selection Grid */}
            <div className="space-y-2">
              <label className="text-[#6B7C8D] block font-mono text-[10px] uppercase font-bold">
                Select Escalation Assignee
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(escalateAssigneeType === "ai"
                  ? [
                      { id: "Alex — Support Intelligence Lead (AI)", role: "L2 Autonomous Intelligence Lead", icon: Bot },
                      { id: "Sophia — L1 Frontline Voice & Chat (AI)", role: "Real-time Multi-channel Ingress", icon: Bot },
                      { id: "Barnaby — SRE Deep Incident Escalation (AI)", role: "Root-Cause Triage & Diagnostics", icon: Zap },
                      { id: "Maya — VIP Incident & Finance Specialist (AI)", role: "Outage Broadcasts & Reconciliations", icon: Shield },
                    ]
                  : [
                      { id: "Elena Rostova — Lead CX Support Engineer (Human Tier 2)", role: "Identity, SSO & API Specialist", icon: User },
                      { id: "Marcus Cole — Senior Technical Account Manager (TAM)", role: "Enterprise VIP Escalation", icon: User },
                      { id: "David Chen — Platform SRE On-Call Lead (Human L3)", role: "Infrastructure & Telemetry On-Call", icon: User },
                      { id: "Sarah Jenkins — VP Customer Success (Executive)", role: "Executive Churn & Risk Intervention", icon: Award },
                    ]
                ).map((person) => {
                  const isSelected = escalateAssignee === person.id;
                  const Icon = person.icon;
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => setEscalateAssignee(person.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                        isSelected
                          ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                          : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                      }`}
                    >
                      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-bold text-[11px] text-[#EAF1F8]">{person.id.split(" — ")[0]}</div>
                        <div className="text-[10px] opacity-75 font-mono">{person.role}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Escalation Urgency & Reason */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Escalation Urgency Level</label>
                <select
                  value={escalatePriority}
                  onChange={(e) => setEscalatePriority(e.target.value)}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] font-mono focus:outline-none focus:border-[#2ED8B6]"
                >
                  <option value="urgent">P1 Urgent (Executive Override)</option>
                  <option value="high">P2 High (Fast-Track Queue)</option>
                  <option value="critical">Critical (SLA Hazard Protection)</option>
                </select>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 font-mono uppercase text-[10px]">Escalation Trigger Reason</label>
                <select
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  className="w-full bg-[#18222E] p-2.5 rounded-xl border border-[var(--line-2)] text-[#EAF1F8] font-mono focus:outline-none focus:border-[#2ED8B6]"
                >
                  <option value="SLA Pre-breach Hazard & Executive VIP Priority">SLA Pre-breach Hazard (Imminent Timeout)</option>
                  <option value="High Sentiment Frustration & Churn Exposure">Frustrated Sentiment & Churn Exposure</option>
                  <option value="Complex Root Cause Investigation Required">Complex Root Cause Investigation Required</option>
                  <option value="Executive VIP Account Escalation">Executive VIP Account Escalation</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
              <span className="text-[10px] text-[#4CC38A] font-mono flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Auto-Extends SLA Target by 45 mins
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEscalateModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingEscalation}
                  onClick={async () => {
                    setIsSubmittingEscalation(true);
                    try {
                      const res = await fetch("/api/cx/sla", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ticketId: selectedTicketForEscalation.ticketId,
                          assignee: escalateAssignee,
                          assigneeType: escalateAssigneeType,
                          escalationReason: escalateReason,
                          priority: escalatePriority,
                        }),
                      }).then((r) => r.json());

                      if (res.success) {
                        notify(res.message, "success");
                        setIsEscalateModalOpen(false);
                        fetchData();
                      } else {
                        notify(res.error || "Failed to escalate ticket", "error");
                      }
                    } catch (err) {
                      notify("Failed to escalate ticket", "error");
                    } finally {
                      setIsSubmittingEscalation(false);
                    }
                  }}
                  className="btn btn-primary text-xs flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Confirm Escalation &amp; Re-Assign</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXPANDED ASK SUPPORTV8 AI WORKFORCE MULTI-TURN COPILOT CONSOLE */}
      {/* ========================================================================= */}
      {isChatOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-6 pb-12 sm:pb-8">
          <div className="w-full max-w-4xl h-[78vh] max-h-[720px] card shadow-2xl p-0 border-[var(--line)] flex flex-col overflow-hidden bg-[#0C121A] rounded-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between bg-[#121A24]/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#EAF1F8]">Ask supportV8 AI Workforce</h3>
                    <span className="pill ok text-[10px] py-0 px-2">
                      <i className="dot"></i> {workforce.length} AGENTS ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B7C8D]">
                    Grounded intelligence across pgvector embeddings, real-time ticket triage, and ServiceV8 verticals
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearChat}
                  title="Clear Chat History"
                  className="btn btn-secondary text-xs p-2 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* AI Employee & Intern Selector Strip */}
            <div className="p-3 border-b border-[var(--line)] bg-[#0E1520] shrink-0">
              <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-[#6B7C8D]">
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>SELECT ENABLED AI EMPLOYEE OR INTERN:</span>
                </div>
                <span className="text-[#B4C2D0]">
                  Active: <strong className="text-[#2ED8B6]">{workforce.find((w) => w.id === selectedEmployeeId)?.name || selectedEmployeeId}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {workforce.map((w) => {
                  const isSelected = selectedEmployeeId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSelectEmployee(w.id)}
                      className={`flex flex-col text-left p-2 rounded-xl transition-all border cursor-pointer ${
                        isSelected
                          ? "bg-[#2ED8B6]/12 border-[#2ED8B6] shadow-sm ring-1 ring-[#2ED8B6]/40"
                          : "bg-[#18222E]/80 border-[var(--line)] hover:border-[#2ED8B6]/50 hover:bg-[#18222E]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-lg">{w.avatar}</span>
                        <span
                          className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                            w.level === "ai_employee"
                              ? "bg-[#2ED8B6]/20 text-[#2ED8B6]"
                              : "bg-[#F5A623]/20 text-[#F5A623]"
                          }`}
                        >
                          {w.level === "ai_employee" ? "Employee" : "Intern"}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#EAF1F8] truncate">{w.name.split("—")[0].trim()}</div>
                      <div className="text-[10px] text-[#6B7C8D] truncate">{w.role}</div>
                      <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-[#6B7C8D]">
                        <span>{w.status}</span>
                        <span className="text-[#EAF1F8]">{w.autonomyLevel}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chat Message Stream (Multi-Turn) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-[#0B1017]">
              {chatMessages.map((msg) => {
                if (msg.role === "system") {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="text-[11px] text-[#6B7C8D] font-mono bg-[#121A24] px-3 py-1 rounded-full border border-[var(--line)] shadow-sm">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[70%] bg-[#18222E] border border-[var(--line-2)] text-[#EAF1F8] p-3.5 rounded-2xl rounded-tr-sm text-xs shadow-md">
                        <div className="flex items-center justify-between gap-3 pb-1 mb-1 border-b border-[var(--line)]/50 text-[10px] text-[#6B7C8D] font-mono">
                          <span className="font-semibold text-[#B4C2D0]">You (CX Lead)</span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      </div>
                    </div>
                  );
                }

                // Assistant message
                return (
                  <div key={msg.id} className="flex gap-3 max-w-[92%] sm:max-w-[85%]">
                    <WorkforceAvatar
                      name={msg.employeeName}
                      avatar={msg.employeeAvatar}
                      role={msg.employeeRole}
                      size="sm"
                    />
                    <div className="flex-1 bg-[#121A24] border border-[var(--line)] text-[#EAF1F8] p-4 rounded-2xl rounded-tl-sm text-xs space-y-3 shadow-md">
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--line)] text-[11px]">
                        <div className="flex items-center gap-2">
                          <strong className="text-[#2ED8B6] font-semibold">
                            {msg.employeeName || "Alex — Support Intelligence Lead"}
                          </strong>
                          <span className="text-[10px] text-[#6B7C8D]">({msg.employeeRole || "AI Employee"})</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#6B7C8D]">{msg.timestamp}</span>
                      </div>

                      <div className="whitespace-pre-wrap leading-relaxed text-[#EAF1F8]">
                        {msg.content}
                      </div>

                      {/* Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider block">
                            Grounded Knowledge Citations:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.citations.map((c, i) => (
                              <span key={i} className="pill text-[10px] py-0.5 px-2 bg-[#18222E] border-[var(--line-2)] text-[#B4C2D0]">
                                <i className="dot"></i>
                                <span className="font-mono">{c.id}:</span> {c.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Actions */}
                      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                        <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider block">
                            Suggested Autonomous Actions:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.suggestedActions.map((act, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleChatAction(act)}
                                className="btn btn-secondary text-xs py-1 px-2.5 hover:border-[#2ED8B6] hover:text-[#2ED8B6] cursor-pointer flex items-center gap-1.5 transition-all"
                              >
                                <ArrowRight className="w-3 h-3 text-[#2ED8B6]" />
                                <span>{act.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {chatLoading && (
                <div className="flex gap-3 max-w-[80%] animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-[#121A24] border border-[#2ED8B6]/40 flex items-center justify-center text-base shrink-0">
                    <Sparkles className="w-4 h-4 text-[#2ED8B6] animate-spin" />
                  </div>
                  <div className="bg-[#121A24] border border-[#2ED8B6]/30 text-[#2ED8B6] p-3.5 rounded-2xl rounded-tl-sm text-xs flex items-center gap-2 font-mono">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Querying pgvector embeddings &amp; synthesizing response...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Suggestion Chips */}
            {showModalPrompts ? (
              <div className="px-4 py-2.5 border-t border-[var(--line)] bg-[#0E1520] shrink-0 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <span className="text-[10px] font-mono text-[#2ED8B6] font-bold uppercase shrink-0 mr-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Prompts:</span>
                    </span>
                    {selectedEmployeeId === "emp_support_lead" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Why did billing CSAT drop?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Why did billing CSAT drop?&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "What active problems are threatening SLA?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;What active problems are threatening SLA?&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Summarize today's VARR performance")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Summarize today's VARR performance&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "emp_incident_analyst" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Calculate active revenue exposure")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Calculate active revenue exposure&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "What is active problem PRB-218?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;What is active problem PRB-218?&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Which Enterprise accounts are impacted?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Which Enterprise accounts are impacted?&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "emp_kb_refresh" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Show knowledge deficit gaps")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Show knowledge deficit gaps&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "What article proposals are ready to publish?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;What article proposals are ready?&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "intern_tagger" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Show intent classification breakdown")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Show intent classification breakdown&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "What triage tags were applied today?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;What tags were applied today?&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "intern_stale_sweeper" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Run work sweep analysis")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Run work sweep analysis&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "How many dormant tickets can be closed?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;How many dormant tickets can be closed?&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "intern_summarizer" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Show recent voice call transcript and sentiment")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Show recent voice call transcript&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Check IVR refund execution")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Check IVR refund execution&rdquo;
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModalPrompts(false)}
                    className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer shrink-0 mt-0.5"
                    title="Close prompt suggestions"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-1 border-t border-[var(--line)] bg-[#0E1520] shrink-0">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowModalPrompts(true)}
                    className="text-[10px] font-mono text-[#6B7C8D] hover:text-[#2ED8B6] flex items-center gap-1 cursor-pointer py-0.5"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Show Prompts</span>
                  </button>
                </div>
              </div>
            )}

            {/* Chat Input Bar with Drag-to-Resize Support */}
            <div className="p-4 border-t border-[var(--line)] bg-[#121A24] shrink-0">
              <form onSubmit={handleAskChat} className="space-y-2">
                <div className="relative">
                  <textarea
                    rows={2}
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAskChat(e);
                      }
                    }}
                    placeholder={`Message ${workforce.find((w) => w.id === selectedEmployeeId)?.name?.split("—")[0]?.trim() || "AI Assistant"} about problems, CSAT drops, customer trends, RAG...`}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-3 pr-12 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6] text-xs transition-colors shadow-inner resize-y min-h-[64px] max-h-[240px] leading-relaxed"
                  />
                  <div className="absolute right-3 top-3 text-[10px] font-mono text-[#6B7C8D] pointer-events-none">
                    ↵ ENTER
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px] font-mono text-[#6B7C8D]">
                  <span className="text-[10px] text-[#2ED8B6] flex items-center gap-1">
                    <span>Drag bottom-right ⤡ to resize</span>
                  </span>

                  <button
                    type="submit"
                    disabled={chatLoading || !chatQuery.trim()}
                    className="btn btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================= */}
      {/* PROACTIVE BROADCAST MODAL */}
      {/* ========================================================================= */}
      {isBroadcastModalOpen && broadcastProblem && broadcastDraft && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl card shadow-2xl p-5 space-y-4 border-[var(--line)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-[#2ED8B6]" />
                <h3 className="text-base font-bold text-[#EAF1F8]">Broadcast Proactive Incident Notice</h3>
              </div>
              <button onClick={() => setIsBroadcastModalOpen(false)} className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-[#18222E] border border-[var(--line)] text-[#EAF1F8] font-mono">
                Target Audience: {broadcastProblem.affectedCustomerCount} affected customers ({broadcastProblem.affectedEnterpriseCount} Enterprise)
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Subject</label>
                <input
                  type="text"
                  value={broadcastDraft.subject}
                  onChange={(e) => setBroadcastDraft({ ...broadcastDraft, subject: e.target.value })}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Notice Body</label>
                <textarea
                  value={broadcastDraft.body}
                  onChange={(e) => setBroadcastDraft({ ...broadcastDraft, body: e.target.value })}
                  rows={4}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-lg border border-[var(--line-2)] font-mono text-xs leading-relaxed focus:outline-none"
                />
              </div>

              {broadcastSuccessMsg && (
                <div className="p-3 rounded-lg bg-[#4CC38A]/10 border border-[#4CC38A]/30 text-[#4CC38A] text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-[#4CC38A]" />
                  <span>{broadcastSuccessMsg}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsBroadcastModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendBroadcast}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch Proactive Broadcast</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIRECT WORK ASSIGNMENT MODAL (AI EMPLOYEE ONLY) */}
      {/* ========================================================================= */}
      {isWorkAssignModalOpen && selectedEmployeeForAssign && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg card shadow-2xl p-5 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-5 h-5 text-[#2ED8B6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Assign Work to AI Employee</h3>
                  <span className="text-[10px] font-mono text-[#6B7C8D]">Hired Roster Dispatch</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkAssignModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Employee Info */}
            <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center gap-3">
              <img
                src={selectedEmployeeForAssign.avatarUrl || "/avatars/beaver-manager.jpg"}
                alt={selectedEmployeeForAssign.name}
                className="w-10 h-10 rounded-xl object-cover border border-[#2ED8B6]/40 shrink-0"
              />
              <div>
                <div className="text-xs font-bold text-[#EAF1F8]">{selectedEmployeeForAssign.name}</div>
                <div className="text-[10px] text-[#2ED8B6] font-mono uppercase">
                  {selectedEmployeeForAssign.role} • Autonomy: {selectedEmployeeForAssign.autonomyLevel}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  Select Customer Issue / Ticket Queue
                </label>
                <select
                  value={assignTicketId}
                  onChange={(e) => {
                    setAssignTicketId(e.target.value);
                    const iss = issues.find((i) => i.id === e.target.value);
                    if (iss) setAssignDescription(iss.title);
                  }}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                >
                  {issues.map((iss) => (
                    <option key={iss.id} value={iss.id}>
                      [{iss.id}] {iss.title} ({iss.customerTier || "Enterprise"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  Resolution Mission / Task Scope
                </label>
                <textarea
                  rows={3}
                  value={assignDescription}
                  onChange={(e) => setAssignDescription(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-[#121A24] border border-[var(--line)] text-[10px] text-[#4CC38A] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Supervising AI Employee will coordinate sub-tasks across paired specialized interns.</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsWorkAssignModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignWork}
                disabled={isAssigningWork || !assignDescription.trim()}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isAssigningWork ? "Dispatching..." : "Confirm & Assign Work"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ========================================================================= */}
      {/* VOICE BOT PROVISIONING MODAL (GROWTHV8 VAPI & TWILIO API) */}
      {/* ========================================================================= */}
      {isVoiceProvisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl card shadow-2xl p-6 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <PhoneCall className="w-5 h-5 text-[#2ED8B6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Provision Voice Bot via API</h3>
                  <span className="text-[10px] font-mono text-[#6B7C8D]">Vapi AI &amp; Twilio Voice Telephony Matching</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsVoiceProvisionModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              {/* Step 1: Match Local AI Employee */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  1. Match to Local AI Employee Persona
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {workforce
                    .filter((w) => w.level === "ai_employee")
                    .map((emp) => {
                      const isSelected = provEmployeeId === emp.id;
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => {
                            setProvEmployeeId(emp.id);
                            setProvSystemPrompt(
                              `You are ${emp.name}, enterprise support voice agent for Acme Cloud. Answer questions concisely, query pgvector knowledge base, and execute authorized tools.`
                            );
                            setProvFirstMessage(
                              `Thank you for calling Acme Support. I am ${emp.name.split("—")[0].trim()}. How can I assist you today?`
                            );
                          }}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${
                            isSelected
                              ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                              : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                          }`}
                        >
                          <img
                            src={emp.avatarUrl || "/avatars/beaver-sophia.jpg"}
                            alt={emp.name}
                            className="w-8 h-8 rounded-lg object-cover border border-[#2ED8B6]/40 shrink-0"
                          />
                          <div className="truncate">
                            <div className="font-bold text-[11px] text-[#EAF1F8] truncate">{emp.name}</div>
                            <div className="text-[9.5px] opacity-75 font-mono truncate">{emp.role}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Step 2: Telephony Provider & Number Binding */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    2. Telephony Provider
                  </label>
                  <select
                    value={provProvider}
                    onChange={(e) => setProvProvider(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                  >
                    <option value="vapi">Vapi.ai (Autonomous Voice)</option>
                    <option value="twilio">Twilio Voice (SIP Trunk / TwiML)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={provPhoneNumber}
                    onChange={(e) => setProvPhoneNumber(e.target.value)}
                    placeholder="+1 (800) 555-0199"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                    Min Auth Gate
                  </label>
                  <select
                    value={provMinVerification}
                    onChange={(e) => setProvMinVerification(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                  >
                    <option value="phone_match">Phone Match (Tier 1)</option>
                    <option value="otp_verified">OTP Verified (Tier 2)</option>
                    <option value="authenticated">Full Authenticated</option>
                    <option value="anonymous">Anonymous Ingress</option>
                  </select>
                </div>
              </div>

              {/* Step 3: Granular Permission Scopes Multi-Select */}
              <div>
                <label className="text-[#6B7C8D] block mb-1.5 uppercase text-[10px] font-bold">
                  3. Granted Tool Permission Scopes (Constrained Execution)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: "support.problem.status", label: "Outage & Problem Status" },
                    { id: "support.ticket.lookup", label: "Ticket Search & Lookup" },
                    { id: "support.ticket.create", label: "Create & Escalate Ticket" },
                    { id: "support.account.unlock_request", label: "Account MFA Unlock" },
                    { id: "knowledge.rag.search", label: "Knowledge RAG Retrieval" },
                    { id: "orderv8.refund", label: "Autonomous Refund (<$500)" },
                  ].map((scope) => {
                    const isChecked = provPermissionScopes.includes(scope.id);
                    return (
                      <button
                        key={scope.id}
                        type="button"
                        onClick={() => {
                          if (isChecked) {
                            setProvPermissionScopes(provPermissionScopes.filter((s) => s !== scope.id));
                          } else {
                            setProvPermissionScopes([...provPermissionScopes, scope.id]);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left flex items-center justify-between text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                            : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <span className="text-[10.5px] font-mono">{scope.label}</span>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 4: First Message Spoken Greeting */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  4. Initial Spoken Greeting (First Message)
                </label>
                <input
                  type="text"
                  value={provFirstMessage}
                  onChange={(e) => setProvFirstMessage(e.target.value)}
                  placeholder="Thank you for calling Acme Support. How can I assist you today?"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              {/* Step 5: System Prompt */}
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">
                  5. System Prompt &amp; Conversational Guardrails
                </label>
                <textarea
                  rows={2}
                  value={provSystemPrompt}
                  onChange={(e) => setProvSystemPrompt(e.target.value)}
                  placeholder="You are Sophia, frontline conversational support specialist. Triage inbound callers..."
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsVoiceProvisionModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProvisionVoiceBot}
                disabled={isProvisioningVoice}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{isProvisioningVoice ? "Provisioning via API..." : "Provision Voice Bot via API"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT PERMISSION SCOPES MODAL */}
      {/* ========================================================================= */}
      {isEditPermissionsModalOpen && selectedConfigForPermissions && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg card shadow-2xl p-5 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-5 h-5 text-[#2ED8B6]" />
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Edit Voice Bot Permission Scopes</h3>
                  <span className="text-[10px] font-mono text-[#6B7C8D]">
                    {selectedConfigForPermissions.phoneNumber} • {selectedConfigForPermissions.agentName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPermissionsModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <p className="text-xs text-[#B4C2D0]">
                Configure which tool functions the remote voice agent ({selectedConfigForPermissions.remoteAgentId}) can execute during live phone calls:
              </p>

              <div className="space-y-2">
                {[
                  { id: "support.problem.status", label: "Outage & Systemic Problem Status" },
                  { id: "support.ticket.lookup", label: "Customer Ticket Lookup" },
                  { id: "support.ticket.create", label: "Create & Route Support Ticket" },
                  { id: "support.account.unlock_request", label: "Account MFA Unlock & PIN Check" },
                  { id: "knowledge.rag.search", label: "Knowledge RAG Vector Search" },
                  { id: "orderv8.refund", label: "Autonomous Refund Execution (<$500)" },
                  { id: "comms.broadcast", label: "Incident Broadcast Communication" },
                ].map((scope) => {
                  const isChecked = editPermissionScopes.includes(scope.id);
                  return (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setEditPermissionScopes(editPermissionScopes.filter((s) => s !== scope.id));
                        } else {
                          setEditPermissionScopes([...editPermissionScopes, scope.id]);
                        }
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                        isChecked
                          ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6]"
                          : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                      }`}
                    >
                      <span className="text-[11px]">{scope.label}</span>
                      {isChecked ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-[var(--line-2)]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setIsEditPermissionsModalOpen(false)}
                className="btn btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="btn btn-primary text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Permissions</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KnowledgeV8-Inspired Floating ? Page Guide Dock */}
      <FloatingPageGuide
        activeTab={activeTab}
        onNotify={(text, type) => setActionNotice({ text, type: type || "info" })}
      />

      {/* Floating Support Chat Widget */}
      <SupportChatWidget
        tenantSlug={currentTenantSlug}
        tenantName={currentTenantSlug.charAt(0).toUpperCase() + currentTenantSlug.slice(1) + " Corp"}
      />

      {/* GrowthV8-Inspired Tenant Provisioning & Signup Modal */}
      <SignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        onSuccess={(slug) => {
          setCurrentTenantSlug(slug);
          setViewMode("tenant_landing");
        }}
      />
    </div>
  );
}

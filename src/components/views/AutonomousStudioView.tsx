"use client";

import React, { useState } from "react";
import {
  Cpu,
  Zap,
  Play,
  Bot,
  Sliders,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Shield,
  Clock,
  RefreshCw,
  Plus,
  Copy,
  Search,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  X,
  FileText,
  Flame,
  User,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import type { OperatingMode } from "@/lib/types";

interface AutonomousStudioViewProps {
  onNotify: (text: string, type: "success" | "error" | "info") => void;
}

export function AutonomousStudioView({ onNotify }: AutonomousStudioViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"workflows" | "templates" | "simulator">("workflows");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  const toggleCard = (id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedCardIds(new Set());
      setAllExpanded(false);
    } else {
      const allIds = new Set([
        ...workflows.map((w) => w.id),
        ...templates.map((t) => t.id),
        "sim_preset_1", "sim_preset_2", "sim_preset_3", "sim_prop_0", "sim_prop_1",
      ]);
      setExpandedCardIds(allIds);
      setAllExpanded(true);
    }
  };

  // Workflow Automations List
  const [workflows, setWorkflows] = useState([
    {
      id: "wf_001",
      name: "VIP Churn & Frustration Fast-Track",
      category: "Customer Retention",
      trigger: "Sentiment == Frustrated AND CustomerTier == Enterprise",
      action: "Auto-Escalate to Tier 2 Lead + Broadcast Slack #cx-oncall",
      status: "active",
      executionsToday: 24,
      varrImpact: "+14.2%",
      lastRun: "3 mins ago",
      description: "Monitors real-time NLP sentiment across omnichannel ingress. Immediately halts auto-resolution and alerts human TAM for Enterprise VIP accounts.",
    },
    {
      id: "wf_002",
      name: "E-Commerce Checkout Glitch Auto-Refund",
      category: "Billing & Commerce",
      trigger: "Intent == Refund AND Problem == PRB-401 AND Amount <= $50",
      action: "Execute OrderV8 Refund API + Send Confirmation Macro",
      status: "active",
      executionsToday: 68,
      varrImpact: "+22.5%",
      lastRun: "Just now",
      description: "Idempotent payment refund pipeline governed by Temporal workforce spine with automatic reconciliation in OrderV8.",
    },
    {
      id: "wf_003",
      name: "Dormant Ticket Backlog Sweeper",
      category: "Hygiene & Sweep",
      trigger: "LastCustomerMessageAge > 72h AND Status == Pending",
      action: "Send Polite Follow-Up Macro -> Auto-Close after 24h",
      status: "active",
      executionsToday: 142,
      varrImpact: "+9.8%",
      lastRun: "12 mins ago",
      description: "Automated work sweeper cleaning inactive queue backlog without human intervention, maintaining 99.4% database hygiene.",
    },
    {
      id: "wf_004",
      name: "Knowledge Deficit Resolution Mining",
      category: "RAG & Knowledge",
      trigger: "InteractionStatus == Resolved AND FCR == True AND UnlinkedKnowledge",
      action: "Jordan Authors Draft Knowledge Proposal in KV8",
      status: "active",
      executionsToday: 18,
      varrImpact: "+6.4%",
      lastRun: "45 mins ago",
      description: "Mines unassisted first-contact resolutions and drafts vector embeddings in KnowledgeV8 to close institutional knowledge gaps.",
    },
    {
      id: "wf_005",
      name: "Payment Gateway 504 SRE Broadcast",
      category: "Systemic Incident",
      trigger: "ProblemSeverity == Critical AND CorrelatedCases >= 5",
      action: "Trigger Proactive Customer In-App Banner + Dispatch SRE Page",
      status: "active",
      executionsToday: 12,
      varrImpact: "+18.0%",
      lastRun: "1 hour ago",
      description: "Detects systemic incident clustering and broadcasts proactive status updates to affected accounts before SLA breach.",
    },
    {
      id: "wf_006",
      name: "SLA Pre-Breach 45-Min Buffer Extension",
      category: "SLA Protection",
      trigger: "RemainingSLABuffer <= 15m AND Status == In_Triage",
      action: "Extend Target by 45 mins + Alert Support Personnel",
      status: "active",
      executionsToday: 31,
      varrImpact: "+11.3%",
      lastRun: "18 mins ago",
      description: "Dynamically grants automated safety grace periods on complex enterprise investigations to prevent false breach penalties.",
    },
  ]);

  // Scenario Templates (Default Deploy)
  const [templates] = useState([
    {
      id: "tmpl_ecom",
      name: "E-Commerce Order & Refund Auto-Resolution",
      category: "Commerce",
      description: "End-to-end pipeline connecting OrderV8 with Zendesk & Intercom to automatically verify order delivery status and execute instant refunds under $50.",
      icon: "fi fi-rr-shopping-cart",
      aiEmployee: "Alex (Support Lead)",
      triggers: ["Order Status Inquiry", "Duplicate Charge Claim", "Return Label Request"],
      executionModel: "Autonomous Zero-Human-Touch",
      isDeployed: true,
      slaTarget: "< 2 mins",
    },
    {
      id: "tmpl_saas",
      name: "SaaS Outage Blast Radius & Proactive Broadcast",
      category: "SRE & Incident",
      description: "Correlates telemetry spikes from Dominion AIOps, computes affected customer ARR blast radius, and auto-dispatches in-app banners and emails.",
      icon: "fi fi-rr-cloud",
      aiEmployee: "Maya (Incident Analyst)",
      triggers: ["504 Gateway Timeout Spike", "Database Degraded Event", "Webhook Delivery Failure"],
      executionModel: "Governed Copilot Action",
      isDeployed: true,
      slaTarget: "< 5 mins",
    },
    {
      id: "tmpl_voice",
      name: "Twilio IVR Voice Self-Service & Telephony Copilot",
      category: "Telephony",
      description: "Streamlined voice contact center flow with real-time transcription by Echo and automated voice biometrics validation.",
      icon: "fi fi-rr-headset",
      aiEmployee: "Echo (Voice Intern)",
      triggers: ["Inbound SIP Trunk Call", "PIN Phone Verification", "Emergency Voicemail Ingress"],
      executionModel: "Real-time Telephony Streaming",
      isDeployed: false,
      slaTarget: "Immediate Live Call",
    },
    {
      id: "tmpl_kb",
      name: "Autonomous Knowledge Base Deficit Mining",
      category: "Knowledge",
      description: "Continuously monitors unassisted resolution threads and generates vector embeddings to maintain zero knowledge deficit gaps.",
      icon: "fi fi-rr-brain",
      aiEmployee: "Jordan (Knowledge Specialist)",
      triggers: ["High Customer Effort Score", "New Undocumented Resolution", "Knowledge Deficit Spike"],
      executionModel: "Background Scheduled Cron",
      isDeployed: true,
      slaTarget: "Continuous RAG Sync",
    },
    {
      id: "tmpl_identity",
      name: "Enterprise SAML / SSO Auto-Provisioning",
      category: "Security & IAM",
      description: "Diagnoses identity handshake errors, verifies tenant domain TXT records, and re-provisions Okta/Azure AD configurations.",
      icon: "fi fi-rr-shield-check",
      aiEmployee: "Sophia (Frontline AI)",
      triggers: ["SAML Assertion Failed", "SCIM User Sync Timeout", "IdP Certificate Expiry"],
      executionModel: "Governed Policy Gate",
      isDeployed: false,
      slaTarget: "< 10 mins",
    },
    {
      id: "tmpl_churn",
      name: "VIP Account Health & Retention Interceptor",
      category: "Customer Success",
      description: "Calculates live churn risk probability and triggers high-touch intervention by Senior TAM when account sentiment drops.",
      icon: "fi fi-rr-chart-line-up",
      aiEmployee: "Elena Rostova (Lead TAM)",
      triggers: ["Repeated P1 Escalation", "CSAT Rating <= 2", "Renewal Within 60 Days"],
      executionModel: "Human-in-the-Loop Fast-Track",
      isDeployed: true,
      slaTarget: "< 30 mins",
    },
  ]);

  // Simulator State
  const [simMessage, setSimMessage] = useState<string>("I was double-charged $49.00 on checkout step 3 and need an immediate refund.");
  const [simTier, setSimTier] = useState<"standard" | "pro" | "enterprise">("enterprise");
  const [simMode, setSimMode] = useState<OperatingMode>("autonomous");
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);

  const SIMULATOR_PRESETS = [
    {
      id: "sim_preset_1",
      title: "Checkout Double-Charge ($49 Refund)",
      tier: "enterprise",
      mode: "autonomous",
      message: "I was double-charged $49.00 on checkout step 3 and need an immediate refund for order #ORD-9912.",
    },
    {
      id: "sim_preset_2",
      title: "SAML SSO Auth 500 Outage",
      tier: "enterprise",
      mode: "copilot",
      message: "Our entire engineering team is locked out with SAML SSO 500 internal server error. This is a critical blocker.",
    },
    {
      id: "sim_preset_3",
      title: "Twilio IVR Voice Billing Claim",
      tier: "pro",
      mode: "autonomous",
      message: "Twilio telephony ingress: caller states subscription renewed unexpectedly without prior notice.",
    },
  ];

  const handleRunSimulator = async (msg?: string, tier?: any, mode?: any) => {
    const queryMsg = msg || simMessage;
    const queryTier = tier || simTier;
    const queryMode = mode || simMode;

    setSimLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate_and_execute",
          message: queryMsg,
          customerTier: queryTier,
          operatingMode: queryMode,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSimResult(res.data);
        onNotify("Agentic loop evaluated successfully", "success");
      }
    } catch (err) {
      onNotify("Simulation failed", "error");
    } finally {
      setSimLoading(false);
    }
  };

  const handleDeployTemplate = (templateName: string) => {
    onNotify(`Scenario template "${templateName}" deployed to active workflows!`, "success");
  };

  // Filtered lists based on search
  const filteredWorkflows = workflows.filter((wf) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      wf.name.toLowerCase().includes(q) ||
      wf.id.toLowerCase().includes(q) ||
      wf.category.toLowerCase().includes(q) ||
      wf.trigger.toLowerCase().includes(q) ||
      wf.action.toLowerCase().includes(q)
    );
  });

  const filteredTemplates = templates.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.triggers.some((tr) => tr.toLowerCase().includes(q)) ||
      t.aiEmployee.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Studio Hero Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
              <Cpu className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Autonomous Studio &amp; Automations</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Unified engine consolidating DAG Workflows, Autonomy Safety Gating, and Default Deploy Industry Blueprints.
          </p>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#18222E] border border-[var(--line)]">
          {[
            { id: "workflows", label: "Active Workflows", badge: workflows.length },
            { id: "templates", label: "Scenario Templates", badge: templates.length },
            { id: "simulator", label: "Autonomy Simulator" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === tab.id
                  ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-bold"
                  : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeSubTab === tab.id ? "bg-[#04201C]/20 text-[#04201C]" : "bg-[#121A24] text-[#8E9AA8]"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Global Studio Filter & Search Toolbar */}
      <div className="card p-4 rounded-2xl bg-[#121A24] border-[var(--line)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#6B7C8D]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search automations, triggers, actions, categories..."
            className="w-full bg-[#18222E] text-xs text-[#EAF1F8] pl-9 pr-8 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-[#6B7C8D] hover:text-[#EAF1F8]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            type="button"
            onClick={toggleAll}
            className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer hover:text-[#2ED8B6]"
          >
            {allExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{allExpanded ? "Collapse All Cards" : "Expand All Cards"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: Active Workflows & Automations */}
      {/* ========================================================================= */}
      {activeSubTab === "workflows" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-mono text-[#EAF1F8] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Configured Triggers &amp; Action Pipelines ({filteredWorkflows.length})</span>
            </span>
            <button
              type="button"
              onClick={() => onNotify("New workflow builder opened", "info")}
              className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Automation</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredWorkflows.map((wf) => {
              const isExpanded = expandedCardIds.has(wf.id);
              return (
                <div
                  key={wf.id}
                  className="card p-4 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-3 hover:border-[var(--line-2)] transition-all shadow-md"
                >
                  {/* Compact Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-xs text-[#2ED8B6] bg-[#2ED8B6]/10 px-2 py-0.5 rounded-lg border border-[#2ED8B6]/20">
                        {wf.id}
                      </span>
                      <div>
                        <h3 className="text-xs font-bold text-[#EAF1F8]">{wf.name}</h3>
                        <span className="text-[10px] text-[#6B7C8D] font-mono">{wf.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="pill ok text-[9px] font-mono uppercase">
                        <i className="dot"></i>
                        {wf.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCard(wf.id)}
                        className="p-1 rounded-lg hover:bg-[#18222E] text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                        title={isExpanded ? "Collapse details" : "Expand details"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Compact Summary Preview */}
                  {!isExpanded && (
                    <div className="flex items-center justify-between text-[11px] font-mono bg-[#18222E] px-3 py-1.5 rounded-xl border border-[var(--line)] text-[#B4C2D0]">
                      <div className="truncate max-w-[280px]">
                        <span className="text-[#F5A623]">WHEN:</span> {wf.trigger}
                      </div>
                      <span className="text-[#2ED8B6] font-bold shrink-0">{wf.varrImpact} VARR</span>
                    </div>
                  )}

                  {/* Expanded Full Details */}
                  {isExpanded && (
                    <div className="space-y-2.5 pt-1 text-xs font-mono animate-in fade-in-50 duration-150">
                      <p className="text-[11px] text-[#B4C2D0] font-sans leading-relaxed">
                        {wf.description}
                      </p>

                      <div className="p-2.5 rounded-xl bg-[#18222E] border border-[var(--line-2)] space-y-1">
                        <span className="text-[10px] text-[#F5A623] block font-bold">WHEN (Trigger):</span>
                        <p className="text-[11px] text-[#EAF1F8]">{wf.trigger}</p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#18222E] border border-[var(--line-2)] space-y-1">
                        <span className="text-[10px] text-[#4CC38A] block font-bold">THEN (Action):</span>
                        <p className="text-[11px] text-[#EAF1F8]">{wf.action}</p>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-[var(--line)] text-[10px] text-[#6B7C8D]">
                        <span>Last Run: <strong className="text-[#EAF1F8]">{wf.lastRun}</strong></span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onNotify(`Triggered test run for ${wf.id}`, "success")}
                            className="btn btn-secondary py-1 px-2 text-[10px] flex items-center gap-1 cursor-pointer hover:text-[#2ED8B6]"
                          >
                            <Play className="w-2.5 h-2.5 text-[#2ED8B6]" />
                            <span>Test</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Compact Footer Strip */}
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--line)] text-[10px] font-mono text-[#6B7C8D]">
                    <span>Executions Today: <strong className="text-[#EAF1F8]">{wf.executionsToday}</strong></span>
                    <span className="text-[#2ED8B6] font-bold">VARR Impact: {wf.varrImpact}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: Default Deploy Scenario Templates */}
      {/* ========================================================================= */}
      {activeSubTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-[#EAF1F8] font-mono">Default Deploy Industry Blueprints ({filteredTemplates.length})</h3>
              <p className="text-[11px] text-[#6B7C8D]">
                Pre-configured autonomous workflows ready for 1-click deployment to your tenant workspace.
              </p>
            </div>
            <span className="pill ok text-[10px] font-mono">TEMPORAL ORCHESTRATED</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredTemplates.map((tmpl) => {
              const isExpanded = expandedCardIds.has(tmpl.id);
              return (
                <div
                  key={tmpl.id}
                  className="card p-4 rounded-2xl border-[var(--line)] bg-[#121A24] flex flex-col justify-between space-y-3 hover:border-[var(--line-2)] transition-all shadow-md"
                >
                  <div className="space-y-2.5">
                    {/* Compact Template Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-center text-base text-[#2ED8B6] shrink-0">
                          <i className={tmpl.icon} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-[#EAF1F8]">{tmpl.name}</h4>
                          <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">
                            {tmpl.category} • Lead: {tmpl.aiEmployee}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`pill text-[9px] font-mono ${tmpl.isDeployed ? "ok" : ""}`}>
                          {tmpl.isDeployed ? "DEPLOYED" : "READY"}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCard(tmpl.id)}
                          className="p-1 rounded-lg hover:bg-[#18222E] text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                          title={isExpanded ? "Collapse blueprint" : "Expand blueprint"}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Compact Triggers Preview */}
                    {!isExpanded && (
                      <div className="flex items-center justify-between text-[10px] font-mono bg-[#18222E] px-3 py-1.5 rounded-xl border border-[var(--line)] text-[#6B7C8D]">
                        <span className="truncate max-w-[260px]">
                          Triggers: <strong className="text-[#2ED8B6]">{tmpl.triggers[0]}</strong> + {tmpl.triggers.length - 1} more
                        </span>
                        <span className="text-[#4CC38A]">{tmpl.slaTarget}</span>
                      </div>
                    )}

                    {/* Expanded Blueprint Details */}
                    {isExpanded && (
                      <div className="space-y-3 pt-1 text-xs animate-in fade-in-50 duration-150">
                        <p className="text-[11px] text-[#B4C2D0] leading-relaxed font-sans">
                          {tmpl.description}
                        </p>

                        <div className="space-y-1 font-mono">
                          <span className="text-[10px] text-[#6B7C8D] uppercase block font-bold">
                            Active Ingress Triggers:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {tmpl.triggers.map((trig, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line)] text-[10px] text-[#2ED8B6] font-mono"
                              >
                                {trig}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                          <span>Execution Spine: <strong className="text-[#EAF1F8]">{tmpl.executionModel}</strong></span>
                          <span>SLA Guarantee: <strong className="text-[#4CC38A]">{tmpl.slaTarget}</strong></span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2.5 border-t border-[var(--line)] flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#4CC38A] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Production Ready
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDeployTemplate(tmpl.name)}
                      className="btn btn-primary py-1.5 px-3.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Zap className="w-3 h-3" />
                      <span>{tmpl.isDeployed ? "Re-Deploy" : "Deploy Blueprint"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: Autonomy Simulator & Safety Policy Gates */}
      {/* ========================================================================= */}
      {activeSubTab === "simulator" && (
        <div className="space-y-4">
          {/* Quick Simulation Presets Strip */}
          <div className="card p-4 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#EAF1F8] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>Quick Scenario Presets (1-Click Load)</span>
              </span>
              <span className="text-[10px] text-[#6B7C8D] font-mono">Interactive Edge Gateway Tests</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SIMULATOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSimMessage(preset.message);
                    setSimTier(preset.tier as any);
                    setSimMode(preset.mode as any);
                    handleRunSimulator(preset.message, preset.tier, preset.mode);
                  }}
                  className="p-2.5 rounded-xl bg-[#18222E] border border-[var(--line)] text-left hover:border-[#2ED8B6] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-bold text-xs text-[#EAF1F8] group-hover:text-[#2ED8B6] transition-colors">{preset.title}</span>
                    <span className="pill text-[8.5px] uppercase font-mono">{preset.tier}</span>
                  </div>
                  <p className="text-[10px] text-[#6B7C8D] line-clamp-1">{preset.message}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Simulator Form Configuration */}
            <div className="card p-4 space-y-3.5 bg-[#121A24] rounded-2xl border-[var(--line)]">
              <h3 className="text-xs font-bold text-[#EAF1F8] flex items-center gap-1.5 font-mono">
                <Sliders className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>Simulate Customer Interaction</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono text-[10px] uppercase">Customer Input Message</label>
                  <textarea
                    value={simMessage}
                    onChange={(e) => setSimMessage(e.target.value)}
                    rows={3}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6] resize-y min-h-[70px]"
                  />
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono text-[10px] uppercase">Customer Tier</label>
                  <select
                    value={simTier}
                    onChange={(e) => setSimTier(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer font-mono"
                  >
                    <option value="standard">Standard Tier ($1,200 ARR)</option>
                    <option value="pro">Pro Tier ($14,400 ARR)</option>
                    <option value="enterprise">Enterprise Tier ($120,000 ARR)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 font-mono text-[10px] uppercase">Autonomy Gate Mode</label>
                  <div className="grid grid-cols-3 gap-1.5 font-mono">
                    {(["observe", "copilot", "autonomous"] as OperatingMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSimMode(m)}
                        className={`btn text-xs font-semibold capitalize cursor-pointer transition-all ${
                          simMode === m ? "btn-primary shadow-sm" : "btn-secondary"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRunSimulator()}
                  disabled={simLoading}
                  className="btn btn-primary w-full py-2.5 text-xs font-bold cursor-pointer mt-1 flex items-center justify-center gap-2 shadow-md"
                >
                  <Bot className="w-4 h-4" />
                  <span>{simLoading ? "Evaluating Autonomy Loop..." : "Run Agentic Loop"}</span>
                </button>
              </div>
            </div>

            {/* Results Console */}
            <div className="lg:col-span-2 card p-4 space-y-3.5 bg-[#121A24] rounded-2xl border-[var(--line)]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#EAF1F8] flex items-center gap-1.5 font-mono">
                  <Shield className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>Gated Execution &amp; Reasoning Results</span>
                </h3>
                {simResult && (
                  <span className="pill ok text-[9px] font-mono uppercase">SAFETY PASS</span>
                )}
              </div>

              {simResult ? (
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3.5 rounded-xl bg-[#18222E] border border-[var(--line-2)] text-[#EAF1F8] leading-relaxed">
                    <div className="text-[10px] text-[#2ED8B6] font-bold uppercase mb-1">AI Recommendation &amp; Triage:</div>
                    {simResult.resolution?.recommendation || "Evaluated action proposals with safety compliance."}
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-[#6B7C8D] uppercase block font-bold">
                      Evaluated Action Gateway Proposals ({simResult.evaluatedProposals?.length || 0}):
                    </span>
                    {simResult.evaluatedProposals?.map((ep: any, i: number) => {
                      const propId = `sim_prop_${i}`;
                      const isExpanded = expandedCardIds.has(propId);
                      return (
                        <div key={i} className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#2ED8B6]">{ep.proposal.operationId}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="pill ok text-[9px] uppercase font-mono">{ep.risk} Risk</span>
                              <button
                                type="button"
                                onClick={() => toggleCard(propId)}
                                className="p-1 rounded-lg hover:bg-[#121A24] text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-[#B4C2D0] font-sans">{ep.proposal.reason}</p>

                          <div className="text-[10px] pt-1 text-[#4CC38A] font-bold uppercase flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Decision: {ep.decision.outcome} ({ep.decision.basis || "safety-pass"})
                          </div>

                          {isExpanded && ep.proposal.payload && (
                            <div className="pt-2 border-t border-[var(--line)]">
                              <span className="text-[9px] text-[#6B7C8D] block mb-1">Action Payload JSON:</span>
                              <pre className="p-2 rounded-lg bg-[#0C121A] text-[#2ED8B6] text-[10px] overflow-x-auto">
                                {JSON.stringify(ep.proposal.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-[#6B7C8D] text-xs font-mono space-y-2">
                  <Bot className="w-8 h-8 mx-auto text-[#6B7C8D]/40" />
                  <p>Click a quick preset above or hit &ldquo;Run Agentic Loop&rdquo; to test runtime reasoning and action gating.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

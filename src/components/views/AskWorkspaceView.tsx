"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Shield,
  Search,
  CheckCircle2,
  X,
  Users,
  Phone,
  Trash2,
  Zap,
  Clock,
  Lock,
  Key,
  AlertTriangle,
  Check,
} from "@/components/ui/FlatIcon";
import { SoundAlertToggle } from "@/components/SoundAlertToggle";
import type { ChatMessage } from "@/app/page";
import type { GovernedActionItem } from "@/lib/types/marketplace-types";

interface AskWorkspaceViewProps {
  workforce: any[];
  selectedEmployeeId: string;
  onSelectEmployee: (empId: string) => void;
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  onClearChat: () => void;
  onChatAction: (action: any) => void;
  loading: boolean;
}

const DEFAULT_FALLBACK_ASSISTANT = {
  id: "emp_rag_intelligence",
  name: "SupportV8 RAG Intelligence",
  role: "Knowledge Retrieval & Vector Copilot",
  level: "ai_employee",
  status: "active",
  autonomyLevel: "L2 Assisted",
  avatarUrl: "/avatars/beaver-curator.jpg",
  isHired: true,
};

// Sample AgenticOS Tiered Actions to showcase the 3 governance tiers
const SAMPLE_TIERED_ACTIONS: Record<string, GovernedActionItem> = {
  emp_support_lead: {
    id: "act_t2_restock",
    title: "Draft Restock Voucher & Customer Compensation",
    capability: "customer.voucher.issue",
    tier: "tier_2_moderate",
    status: "approval_required",
    employeeId: "emp_support_lead",
    employeeName: "Alex — Support Lead",
    amountCents: 2500,
    recipient: "marcus.vance@techcorp.io",
    approvers: [],
    requiredSigners: 1,
    createdAt: new Date().toISOString(),
  },
  emp_incident_analyst: {
    id: "act_t3_refund",
    title: "Execute Cross-Border Merchant Refund & Ledger Sync",
    capability: "stripe.refund.execute",
    tier: "tier_3_critical",
    status: "approval_required",
    employeeId: "emp_incident_analyst",
    employeeName: "Sophia — Escalations Specialist",
    amountCents: 85000,
    recipient: "acct_global_enterprise_991",
    timelockSecondsRemaining: 900,
    approvers: [{ name: "Automated Fraud Sentry", signedAt: new Date().toISOString() }],
    requiredSigners: 2,
    createdAt: new Date().toISOString(),
  },
  intern_tagger: {
    id: "act_t1_tag",
    title: "Autonomous Ticket Categorization & Intent Vector Tag",
    capability: "ticket.auto_tag",
    tier: "tier_1_autonomous",
    status: "executed",
    employeeId: "intern_tagger",
    employeeName: "Auto-Tagger Intern",
    approvers: [],
    requiredSigners: 0,
    createdAt: new Date().toISOString(),
  },
};

export function AskWorkspaceView({
  workforce,
  selectedEmployeeId,
  onSelectEmployee,
  messages,
  onSendMessage,
  onClearChat,
  onChatAction,
  loading,
}: AskWorkspaceViewProps) {
  const [inputQuery, setInputQuery] = useState<string>("");
  const [showPrompts, setShowPrompts] = useState<boolean>(true);
  const [targetMode, setTargetMode] = useState<"single" | "all">("single");

  // Voice Call Modal State (Daily.co WebCall Simulation)
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);
  const [voiceCallStatus, setVoiceCallStatus] = useState<"connecting" | "active">("connecting");
  const [voiceSeconds, setVoiceSeconds] = useState<number>(0);

  // Clear Chat Modal State
  const [showClearModal, setShowClearModal] = useState<boolean>(false);

  // Governed Actions State (Polymorphic Action Cards)
  const [actionStates, setActionStates] = useState<Record<string, "approval_required" | "approved" | "rejected">>(
    () => ({
      act_t2_restock: "approval_required",
      act_t3_refund: "approval_required",
      act_t1_tag: "executed" as any,
    })
  );

  // Step-Up Authorization Modal State (Dual TOTP for Tier 3)
  const [stepUpAction, setStepUpAction] = useState<GovernedActionItem | null>(null);
  const [stepUpTotpCode, setStepUpTotpCode] = useState<string>("");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showVoiceModal && voiceCallStatus === "active") {
      timer = setInterval(() => setVoiceSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [showVoiceModal, voiceCallStatus]);

  const activeEmployee =
    workforce.find((w) => w.id === selectedEmployeeId) ||
    workforce[0] ||
    DEFAULT_FALLBACK_ASSISTANT;
  const hasHiredEmployee = true;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;
    onSendMessage(inputQuery.trim());
    setInputQuery("");
  };

  const handleStartVoiceCall = () => {
    setShowVoiceModal(true);
    setVoiceCallStatus("connecting");
    setVoiceSeconds(0);
    setTimeout(() => {
      setVoiceCallStatus("active");
    }, 1200);
  };

  const handleEndVoiceCall = () => {
    setShowVoiceModal(false);
    setVoiceCallStatus("connecting");
    setVoiceSeconds(0);
  };

  const handleApproveAction = (act: GovernedActionItem) => {
    if (act.tier === "tier_3_critical") {
      setStepUpAction(act);
      return;
    }
    setActionStates((prev) => ({ ...prev, [act.id]: "approved" }));
  };

  const handleRejectAction = (act: GovernedActionItem) => {
    setActionStates((prev) => ({ ...prev, [act.id]: "rejected" }));
  };

  const handleConfirmStepUp = () => {
    if (stepUpAction) {
      setActionStates((prev) => ({ ...prev, [stepUpAction.id]: "approved" }));
      setStepUpAction(null);
      setStepUpTotpCode("");
    }
  };

  const PROMPT_SUGGESTIONS: Record<string, string[]> = {
    emp_rag_intelligence: [
      "Search knowledge base for: Want to check on your inventory",
      "How do I configure Okta SAML 2.0 Single Sign-On?",
      "Diagnose 504 Gateway Timeout and Stripe payment webhook failure",
    ],
    emp_support_lead: [
      "What is our active SLA attainment rate across all tiers?",
      "Summarize active systemic problems correlated by AI.",
      "Check VIP customer churn risks across Enterprise tier.",
    ],
    emp_incident_analyst: [
      "Compute total ARR financial exposure for PRB-401.",
      "Draft a proactive broadcast notification for affected checkout customers.",
      "What is the blast radius of current payment gateway latency?",
    ],
    emp_kb_refresh: [
      "What are the top 3 unresolved knowledge deficit gaps?",
      "Author a knowledge proposal based on recent checkout resolutions.",
      "Check vector embedding sync status with KnowledgeV8.",
    ],
    intern_tagger: [
      "Show sentiment breakdown for incoming Zendesk tickets.",
      "Run intent auto-tagger across the last 50 issues.",
    ],
    intern_stale_sweeper: [
      "How many dormant tickets are eligible for auto-close?",
      "Run a dry-run sweep across stale tickets.",
    ],
    intern_summarizer: [
      "Summarize the recent Twilio voice recording for caller Marcus Vance.",
      "Extract action items from latest voice support transcripts.",
    ],
  };

  const suggestions = hasHiredEmployee
    ? PROMPT_SUGGESTIONS[selectedEmployeeId] ||
      PROMPT_SUGGESTIONS[activeEmployee?.id] ||
      PROMPT_SUGGESTIONS.emp_rag_intelligence ||
      []
    : [];

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  const relevantSampleAction = SAMPLE_TIERED_ACTIONS[activeEmployee.id] || SAMPLE_TIERED_ACTIONS.emp_support_lead;

  return (
    <div className="p-3 sm:p-5 md:p-6 h-full min-h-0 w-full flex flex-col overflow-hidden bg-[#0B1017]">
      {/* Framed Console with Teal Border Frame */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border-2 border-[#2ED8B6] shadow-[0_0_30px_rgba(46,216,182,0.18)] ring-1 ring-[#2ED8B6]/40 overflow-hidden bg-[#0C121A]">
        {/* Top Banner with AI Employee Selector Strip & AgenticOS Controls */}
        <div className="bg-[#121A24] border-b border-[#2ED8B6]/30 p-4 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
                <i className="fi fi-rr-comment-alt-dots text-base"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[#EAF1F8]">AgenticOS Chat</h2>
                  <span className="pill ok text-[9px] font-mono">RUNTIME ACCEPTANCE</span>
                </div>
                <p className="text-[11px] text-[#6B7C8D]">
                  {targetMode === "all"
                    ? "Omnichannel Dispatch: Querying all hired AI employees concurrently."
                    : `Direct 1:1 Session with ${activeEmployee.name}.`}
                </p>
              </div>
            </div>

            {/* Quick Header Actions: Sound, WebCall, Clear Chat */}
            <div className="flex items-center gap-2">
              <SoundAlertToggle showDropdown={false} className="p-2 min-w-0 min-h-0 h-8 w-8 rounded-lg" />

              <button
                type="button"
                onClick={handleStartVoiceCall}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-mono text-[#2ED8B6] border-[#2ED8B6]/30 hover:bg-[#2ED8B6]/10 cursor-pointer shadow-sm"
                title={`Start real-time voice call with ${activeEmployee.name}`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Speak with</span>
                <span>{activeEmployee.name.split("—")[0].trim()}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-mono text-[#8E9AA8] hover:text-[#FF5252] cursor-pointer"
                title="Clear conversation transcript"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Clear Chat</span>
              </button>
            </div>
          </div>

          {/* AI Workforce Selector Carousel + All Team Collaboration Button */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {/* All Team Collaboration Pill */}
            <button
              type="button"
              onClick={() => setTargetMode("all")}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer shrink-0 ${
                targetMode === "all"
                  ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#EAF1F8] shadow-md ring-1 ring-[#2ED8B6]/40"
                  : "bg-[#18222E] border-[var(--line)] text-[#B4C2D0] hover:bg-[#1C2836]"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#2ED8B6]/20 text-[#2ED8B6] flex items-center justify-center shrink-0 border border-[#2ED8B6]/40">
                <Users className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold truncate max-w-[130px]">All Team</div>
                <div className="text-[10px] font-mono text-[#2ED8B6] uppercase tracking-wider">
                  Omnichannel
                </div>
              </div>
            </button>

            {/* Individual Employee Pills */}
            {workforce.map((emp) => {
              const isSelected = targetMode === "single" && emp.id === selectedEmployeeId;
              return (
                <button
                  key={emp.id}
                  onClick={() => {
                    setTargetMode("single");
                    onSelectEmployee(emp.id);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#EAF1F8] shadow-md ring-1 ring-[#2ED8B6]/40"
                      : "bg-[#18222E] border-[var(--line)] text-[#B4C2D0] hover:bg-[#1C2836]"
                  }`}
                >
                  <img
                    src={emp.avatarUrl || "/avatars/beaver-manager.jpg"}
                    alt={emp.name}
                    className="w-8 h-8 rounded-lg object-cover border border-[var(--line-2)] shrink-0"
                  />
                  <div className="text-left">
                    <div className="text-xs font-bold truncate max-w-[130px]">{emp.name.split("—")[0]}</div>
                    <div className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider">
                      {emp.level === "ai_employee" ? "AI Lead" : "Intern"} &bull; {emp.autonomyLevel}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl w-full mx-auto">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const isSystem = msg.role === "system";

            if (isSystem) {
              return (
                <div key={msg.id} className="text-center my-3">
                  <span className="inline-block px-3 py-1 rounded-full bg-[#18222E] border border-[var(--line)] text-[10px] font-mono text-[#6B7C8D]">
                    {msg.content}
                  </span>
                </div>
              );
            }

            const emp = workforce.find((w) => w.id === msg.employeeId) || activeEmployee;

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {isUser ? (
                  <div className="w-8 h-8 rounded-xl bg-[#2ED8B6]/20 text-[#2ED8B6] border border-[#2ED8B6]/40 flex items-center justify-center text-xs font-bold shrink-0">
                    U
                  </div>
                ) : (
                  <img
                    src={emp?.avatarUrl || "/avatars/beaver-manager.jpg"}
                    alt="Avatar"
                    className="w-8 h-8 rounded-xl object-cover border border-[var(--line)] shrink-0"
                  />
                )}

                <div className={`space-y-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7C8D]">
                    <span className="font-bold text-[#B4C2D0]">
                      {isUser ? "You (Operator Desk)" : emp?.name || "AI employee"}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? "bg-[#2ED8B6]/15 border border-[#2ED8B6]/30 text-[#EAF1F8] rounded-tr-none"
                        : "bg-[#18222E] border border-[var(--line-2)] text-[#EAF1F8] rounded-tl-none whitespace-pre-line"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Grounded Knowledge Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {msg.citations.map((cit, idx) => (
                        <span
                          key={idx}
                          className="pill text-[9px] font-mono flex items-center gap-1 bg-[#121A24] border border-[var(--line)]"
                        >
                          <Shield className="w-2.5 h-2.5 text-[#2ED8B6]" />
                          <span>{cit.title}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggested 1-Click Action Buttons */}
                  {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {msg.suggestedActions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => onChatAction(act)}
                          className="btn btn-secondary py-1 px-2.5 text-[11px] font-mono flex items-center gap-1.5 hover:border-[#2ED8B6] text-[#2ED8B6] cursor-pointer"
                        >
                          <span>{act.label}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Embedded AgenticOS Polymorphic Action Card (Illustrates Tier 1/2/3 Governance) */}
          {messages.length > 0 && (
            <div className="my-4 max-w-xl mx-auto">
              <div
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  relevantSampleAction.tier === "tier_3_critical"
                    ? "bg-[#1C1618] border-[#FF5252]/40"
                    : relevantSampleAction.tier === "tier_2_moderate"
                    ? "bg-[#151D2A] border-[#4D9FFF]/40"
                    : "bg-[#121E1E] border-[#2ED8B6]/40"
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#2ED8B6]/20 text-[#2ED8B6]">
                      <Zap className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#EAF1F8]">{relevantSampleAction.title}</h4>
                      <span className="text-[10px] font-mono text-[#6B7C8D]">
                        Capability: <code>{relevantSampleAction.capability}</code>
                      </span>
                    </div>
                  </div>

                  <span
                    className={`pill text-[9px] font-mono uppercase font-bold ${
                      relevantSampleAction.tier === "tier_3_critical"
                        ? "err"
                        : relevantSampleAction.tier === "tier_2_moderate"
                        ? "warn"
                        : "ok"
                    }`}
                  >
                    {relevantSampleAction.tier === "tier_3_critical"
                      ? "Critical (Tier 3)"
                      : relevantSampleAction.tier === "tier_2_moderate"
                      ? "Moderate (Tier 2)"
                      : "Safe (Tier 1)"}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  {relevantSampleAction.amountCents && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#8E9AA8]">Amount:</span>
                      <span className="font-bold text-[#2ED8B6]">
                        ${(relevantSampleAction.amountCents / 100).toFixed(2)} USD
                      </span>
                    </div>
                  )}
                  {relevantSampleAction.recipient && (
                    <div className="flex items-center justify-between">
                      <span className="text-[#8E9AA8]">Recipient:</span>
                      <span className="text-[#EAF1F8]">{relevantSampleAction.recipient}</span>
                    </div>
                  )}
                  {relevantSampleAction.tier === "tier_3_critical" && (
                    <div className="flex items-center justify-between text-[#FFB020]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Timelock In Effect:</span>
                      </span>
                      <span>15m Timelock &bull; 2 Signers Required</span>
                    </div>
                  )}
                </div>

                {/* State-Specific Action Controls */}
                <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
                  {actionStates[relevantSampleAction.id] === "approved" ? (
                    <span className="text-xs font-mono text-[#2ED8B6] flex items-center gap-1.5 font-bold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Approved by Operator &bull; Action Executed via Gateway</span>
                    </span>
                  ) : actionStates[relevantSampleAction.id] === "rejected" ? (
                    <span className="text-xs font-mono text-[#FF5252] flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" />
                      <span>Action Rejected by Operator</span>
                    </span>
                  ) : relevantSampleAction.tier === "tier_1_autonomous" ? (
                    <span className="text-xs font-mono text-[#2ED8B6] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Executed Autonomously &bull; Action Gateway Audit Logged</span>
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 w-full justify-end">
                      <button
                        type="button"
                        onClick={() => handleRejectAction(relevantSampleAction)}
                        className="btn btn-secondary text-xs py-1 px-3 cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveAction(relevantSampleAction)}
                        className="btn btn-primary text-xs py-1 px-3.5 font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        {relevantSampleAction.tier === "tier_3_critical" ? (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>Step-Up Authorize &rarr;</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Approve &amp; Execute &rarr;</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading && hasHiredEmployee && (
            <div className="flex items-center gap-3">
              <img
                src={activeEmployee?.avatarUrl || "/avatars/beaver-manager.jpg"}
                alt="Avatar"
                className="w-8 h-8 rounded-xl object-cover border border-[var(--line)] shrink-0 animate-pulse"
              />
              <div className="p-3.5 rounded-2xl bg-[#18222E] border border-[var(--line)] text-xs text-[#6B7C8D] font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#2ED8B6] animate-ping" />
                <span>
                  {targetMode === "all"
                    ? "Workforce hive is correlating cross-domain telemetry..."
                    : `${activeEmployee?.name.split("—")[0]} is analyzing telemetry & knowledge graph...`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Suggested Prompt Chips */}
        {hasHiredEmployee && showPrompts ? (
          <div className="bg-[#121A24] border-t border-[#2ED8B6]/20 px-4 sm:px-6 py-2.5 shrink-0 transition-all">
            <div className="max-w-4xl mx-auto flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <span className="text-[10px] font-mono text-[#2ED8B6] font-bold uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>Prompts:</span>
                </span>
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSendMessage(sug)}
                    className="px-3 py-1.5 rounded-full bg-[#18222E] hover:bg-[#2ED8B6]/20 hover:text-[#2ED8B6] border border-[var(--line)] hover:border-[#2ED8B6]/50 text-[11px] text-[#B4C2D0] transition-all cursor-pointer shadow-sm text-left leading-tight"
                  >
                    {sug}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowPrompts(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer shrink-0 mt-0.5"
                title="Close prompt suggestions"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : hasHiredEmployee ? (
          <div className="bg-[#121A24] border-t border-[#2ED8B6]/10 px-4 sm:px-6 py-1 shrink-0">
            <div className="max-w-4xl mx-auto flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrompts(true)}
                className="text-[10px] font-mono text-[#6B7C8D] hover:text-[#2ED8B6] flex items-center gap-1 cursor-pointer py-0.5"
              >
                <Sparkles className="w-3 h-3" />
                <span>Show Prompts</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Query Input Bar */}
        <form onSubmit={handleSend} className="p-3 sm:p-4 bg-[#0E1520] border-t border-[#2ED8B6]/30 shrink-0">
          <div className="max-w-4xl mx-auto space-y-2">
            <div className="relative">
              <textarea
                rows={3}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                placeholder={
                  targetMode === "all"
                    ? "Ask All Team about active incidents, customer trends, or cross-domain runbooks..."
                    : `Ask ${activeEmployee.name} about tickets, runbooks, or vector knowledge...`
                }
                disabled={loading}
                className="w-full bg-[#18222E] text-[#EAF1F8] p-3.5 pr-14 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] focus:ring-1 focus:ring-[#2ED8B6]/40 font-medium transition-all shadow-inner resize-y min-h-[80px] max-h-[360px] leading-relaxed"
              />
              <div className="absolute right-3.5 top-3.5 text-[#6B7C8D] text-[10px] font-mono pointer-events-none">
                ↵ ENTER
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-[11px] font-mono text-[#6B7C8D]">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline">Press <strong className="text-[#EAF1F8]">Enter ↵</strong> to send</span>
                <span className="hidden sm:inline">&bull;</span>
                <span className="hidden sm:inline"><strong className="text-[#EAF1F8]">Shift + Enter</strong> for new line</span>
              </div>

              <button
                type="submit"
                disabled={!inputQuery.trim() || loading}
                className="btn btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 cursor-pointer shadow-md shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Ask AI</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* REAL-TIME VOICE WEBCALL MODAL (Daily.co Simulation) */}
      {/* ========================================================================= */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0E1520] border-2 border-[#2ED8B6] rounded-3xl p-6 space-y-6 shadow-2xl text-center">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <span className="text-xs font-mono text-[#2ED8B6] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                <span>Managed Voice WebCall</span>
              </span>
              <span className="pill ok text-[9px] font-mono">TLS ENCRYPTED</span>
            </div>

            <div className="space-y-4">
              <div className="relative inline-block">
                <img
                  src={activeEmployee.avatarUrl || "/avatars/beaver-manager.jpg"}
                  alt={activeEmployee.name}
                  className="w-24 h-24 rounded-3xl object-cover border-4 border-[#2ED8B6] shadow-xl mx-auto"
                />
                <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#2ED8B6] text-[#04201C] flex items-center justify-center text-xs font-bold">
                  ✓
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#EAF1F8]">{activeEmployee.name}</h3>
                <p className="text-xs text-[#8E9AA8] font-mono">{activeEmployee.role}</p>
              </div>

              {/* Status and Audio Waveform */}
              <div className="p-4 rounded-2xl bg-[#141C26] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#8E9AA8]">Call Status:</span>
                  <span className="text-[#2ED8B6] font-bold">
                    {voiceCallStatus === "connecting" ? "Connecting to Carrier SIP..." : "Live Inbound Call"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#8E9AA8]">Duration:</span>
                  <span className="font-bold text-[#EAF1F8]">{formatSeconds(voiceSeconds)}</span>
                </div>

                {voiceCallStatus === "active" && (
                  <div className="flex items-center justify-center gap-1 h-8 pt-2">
                    {[12, 24, 38, 16, 42, 28, 50, 20, 34, 18, 45, 22].map((height, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-[#2ED8B6] rounded-full animate-pulse"
                        style={{
                          height: `${height}px`,
                          animationDelay: `${i * 90}ms`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleEndVoiceCall}
                className="btn py-2.5 px-6 rounded-xl bg-[#FF5252] hover:bg-[#FF5252]/90 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Phone className="w-4 h-4 rotate-[135deg]" />
                <span>End Call</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CLEAR CHAT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0E1520] border border-[var(--line-2)] rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#EAF1F8]">Clear conversation transcript</h3>
                <p className="text-[11px] text-[#6B7C8D]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-[#B4C2D0] leading-relaxed">
              Are you sure you want to clear your conversation transcript? This will remove all messages in this workspace chat for your account.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="btn btn-secondary text-xs py-2 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearChat();
                  setShowClearModal(false);
                }}
                className="btn py-2 px-4 text-xs font-bold bg-[#FF5252] text-white hover:bg-[#FF5252]/90 cursor-pointer shadow-md"
              >
                Clear Chat History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TIER 3 STEP-UP DUAL-TOTP AUTHORIZATION MODAL */}
      {/* ========================================================================= */}
      {stepUpAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0E1520] border-2 border-[#FF5252] rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#FF5252]/15 text-[#FF5252] border border-[#FF5252]/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#EAF1F8]">Dual TOTP Step-Up Authorization</h3>
                <p className="text-[11px] text-[#6B7C8D]">Tier 3 Critical Operation &bull; 15m Timelock</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#141C26] border border-[var(--line)] space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-[#8E9AA8]">Action:</span>
                <span className="text-[#EAF1F8] font-bold">{stepUpAction.title}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8E9AA8]">Amount:</span>
                <span className="text-[#2ED8B6] font-bold">
                  ${((stepUpAction.amountCents || 0) / 100).toFixed(2)} USD
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8E9AA8]">Signer 1:</span>
                <span className="text-[#2ED8B6]">Automated Fraud Sentry (Signed)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8E9AA8]">Signer 2:</span>
                <span className="text-[#FFB020]">CX Lead / Superadmin (Pending)</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-[#8E9AA8] block">
                Enter Supervisor TOTP Security Token (6 Digits):
              </label>
              <input
                type="text"
                maxLength={6}
                value={stepUpTotpCode}
                onChange={(e) => setStepUpTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000 000"
                className="w-full bg-[#18222E] border border-[var(--line)] rounded-xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest text-[#EAF1F8] focus:border-[#2ED8B6] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setStepUpAction(null)}
                className="btn btn-secondary text-xs py-2 px-4 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={stepUpTotpCode.length < 6}
                onClick={handleConfirmStepUp}
                className="btn btn-primary text-xs py-2 px-4 font-bold disabled:opacity-40 cursor-pointer shadow-md"
              >
                Authorize &amp; Sign Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

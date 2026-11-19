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
  ShoppingBag,
  ArrowRight,
  CornerDownLeft,
} from "@/components/ui/FlatIcon";
import { SoundAlertToggle } from "@/components/SoundAlertToggle";
import type { ChatMessage } from "@/app/page";
import type { GovernedActionItem } from "@/lib/types/marketplace-types";
import { ChatMessage as ChatMessageView, PlainChatText } from "@/components/chat-ui/ChatMessage";
import { ChatTranscript } from "@/components/chat-ui/ChatTranscript";
import { EmployeeAvatar } from "@/components/chat-ui/EmployeeAvatar";
import { FormattedChatMessage } from "@/components/chat-ui/FormattedChatMessage";
import { handleChatComposerKeyDown } from "@/components/chat-ui/composer-keys";
import { employeeDisplayName } from "@/lib/chat/employee-avatar";

interface AskWorkspaceViewProps {
  workforce: any[];
  selectedEmployeeId: string;
  onSelectEmployee: (empId: string) => void;
  messages: ChatMessage[];
  /** Resolves false when the question was not answered, so the draft is kept. */
  onSendMessage: (query: string) => void | boolean | Promise<void | boolean>;
  onClearChat: () => void;
  onChatAction: (action: any) => void;
  loading: boolean;
  onNavigateToMarketplace?: () => void;
}

const DEFAULT_FALLBACK_ASSISTANT = {
  id: "emp_rag_intelligence",
  name: "SupportV8 RAG Intelligence",
  role: "Knowledge Retrieval & Vector Copilot",
  level: "copilot",
  status: "active",
  autonomyLevel: "L2 Assisted",
  avatarUrl: "/avatars/beaver-curator.jpg",
  isHired: false,
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
  onNavigateToMarketplace,
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
  const hasHiredEmployee = workforce.length > 0;

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const pending = loading || sending;
  // Who the question really goes to: the page sends selectedEmployeeId (or the RAG assistant) in every mode.
  const recipient = workforce.find((w) => w.id === selectedEmployeeId) || DEFAULT_FALLBACK_ASSISTANT;
  const recipientName = employeeDisplayName(recipient.name);
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = inputQuery.trim();
    if (!query || pending) return;
    setSending(true);
    setSendError(null);
    try {
      // The draft stays (read-only) until the reply is accepted; on failure it is kept for a retry.
      const result = await onSendMessage(query);
      if (result === false) setSendError("No reply was received. Your draft is still here; try again.");
      else setInputQuery("");
    } catch {
      setSendError("No reply was received. Your draft is still here; try again.");
    } finally {
      setSending(false);
    }
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

  const suggestions =
    PROMPT_SUGGESTIONS[selectedEmployeeId] ||
    PROMPT_SUGGESTIONS[activeEmployee?.id] ||
    PROMPT_SUGGESTIONS.emp_rag_intelligence ||
    [];

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
        {/* Clean Empty Workforce Banner linking to Marketplace */}
        {!hasHiredEmployee && (
          <div className="bg-[#121A24] border-b border-[#2ED8B6]/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-[#EAF1F8] font-mono">Empty Workforce</h3>
                  <span className="pill warn text-[9px] font-mono">0 HIRED AGENTS</span>
                </div>
                <p className="text-[11px] text-[#8E9AA8] truncate">
                  No AI employees are provisioned. Hire specialists from Marketplace or query knowledge base below.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToMarketplace ? onNavigateToMarketplace() : window.open("https://marketplace.servicev8.com", "_blank", "noopener,noreferrer")}
              className="btn btn-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Open Marketplace</span>
            </button>
          </div>
        )}

        {/* Top Banner with AI Employee Selector Strip & AgenticOS Controls */}
        <div className="bg-[#121A24] border-b border-[#2ED8B6]/30 p-4 space-y-3 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm shrink-0">
                <i className="fi fi-rr-comment-alt-dots text-base"></i>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-[#EAF1F8] truncate" data-testid="chat-room-heading">
                    {recipientName ? `Speak with ${recipientName}` : "Team conversation"}
                  </h2>
                  <span className="pill ok text-[9px] font-mono shrink-0">
                    {hasHiredEmployee ? "RUNTIME ACCEPTANCE" : "VECTOR KNOWLEDGE"}
                  </span>
                </div>
                <p className="text-[11px] text-[#6B7C8D] truncate">
                  {!hasHiredEmployee
                    ? "Query tickets, runbooks, and pgvector knowledge directly."
                    : targetMode === "all"
                    ? "Omnichannel Dispatch: Querying all hired AI employees concurrently."
                    : `Direct 1:1 Session with ${activeEmployee.name}.`}
                </p>
              </div>
            </div>

            {/* Quick Header Actions: Sound, WebCall, Clear Chat */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <SoundAlertToggle showDropdown={false} className="p-2 min-w-0 min-h-0 h-8 w-8 rounded-lg" />

              {hasHiredEmployee && (
                <button
                  type="button"
                  onClick={handleStartVoiceCall}
                  className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-mono text-[#2ED8B6] border-[#2ED8B6]/30 hover:bg-[#2ED8B6]/10 cursor-pointer shadow-sm"
                  title={`Start real-time voice call with ${activeEmployee.name}`}
                >
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Speak with</span>
                  <span className="truncate max-w-[120px]">{activeEmployee.name.split("—")[0].trim()}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowClearModal(true)}
                className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-mono text-[#8E9AA8] hover:text-[#FF5252] cursor-pointer"
                title="Clear conversation transcript"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden md:inline">Clear Chat</span>
              </button>
            </div>
          </div>

          {/* AI Workforce Selector Carousel / Copilot Pill */}
          {hasHiredEmployee ? (
            <div className="chat-roster-list" role="group" aria-label="AI employees">
              {/* All Team Collaboration */}
              <button
                type="button"
                onClick={() => setTargetMode("all")}
                aria-pressed={targetMode === "all"}
                className="chat-person"
              >
                <span>
                  <strong>All Team</strong>
                  <small>Omnichannel</small>
                </span>
              </button>

              {/* Individual employees: 40px portrait, name, muted role (SupportV8 has no @handles). */}
              {workforce.map((emp) => {
                const isSelected = targetMode === "single" && emp.id === selectedEmployeeId;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setTargetMode("single");
                      onSelectEmployee(emp.id);
                    }}
                    aria-pressed={isSelected}
                    className="chat-person"
                  >
                    <EmployeeAvatar name={employeeDisplayName(emp.name)} role={emp.role} kind={emp.level === "ai_intern" ? "intern" : undefined} />
                    <span>
                      <strong>{employeeDisplayName(emp.name)}</strong>
                      <small>{emp.role}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#2ED8B6]/30 bg-[#2ED8B6]/10 text-[#EAF1F8]">
                <Sparkles className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span className="text-xs font-bold font-mono">Workspace Copilot</span>
                <span className="text-[10px] text-[#2ED8B6] font-mono">&bull; Vector Knowledge</span>
              </div>
            </div>
          )}
        </div>

        {/* Message Stream: Runtime's transcript and message anatomy */}
        <ChatTranscript className="flex-1 min-h-0">
          {messages.length === 0 && (
            <div className="chat-no-messages">
              <h3>No messages yet</h3>
              <p>Ask {recipientName} about tickets, runbooks or knowledge. Replies are advisory.</p>
            </div>
          )}
          {messages.map((msg) => {
            if (msg.role === "system") {
              return (
                <ChatMessageView key={msg.id} kind="system" author="SupportV8" time={msg.timestamp}>
                  <FormattedChatMessage content={msg.content} />
                </ChatMessageView>
              );
            }
            if (msg.role === "user") {
              return (
                <ChatMessageView key={msg.id} kind="user" author="You" time={msg.timestamp}>
                  <PlainChatText content={msg.content} />
                </ChatMessageView>
              );
            }
            const emp = workforce.find((w) => w.id === msg.employeeId);
            const name = employeeDisplayName(msg.employeeName || emp?.name || "AI employee");
            const role = msg.employeeRole || emp?.role;
            return (
              <ChatMessageView
                key={msg.id}
                kind="assistant"
                author={name}
                role={role}
                time={msg.timestamp}
                portrait={{ name, role, kind: emp?.level === "ai_intern" ? "intern" : undefined }}
                footer={(msg.citations?.length || msg.suggestedActions?.length) ? (
                  <div className="chat-message-footer">
                    {/* Grounded Knowledge Citations */}
                    {msg.citations?.map((cit, idx) => (
                      <span key={idx} className="pill text-[11px] flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>{cit.title}</span>
                      </span>
                    ))}
                    {/* Suggested 1-Click Action Buttons */}
                    {msg.suggestedActions?.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onChatAction(act)}
                        className="btn btn-secondary py-1 px-2.5 text-[12px] flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{act.label}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                ) : undefined}
              >
                <FormattedChatMessage content={msg.content} />
              </ChatMessageView>
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
                            <span>Authorize</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Approve</span>
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {pending && (
            <p className="chat-pending" role="status">Waiting for {recipientName}’s reply…</p>
          )}
        </ChatTranscript>

        {/* Suggested Prompt Chips */}
        {showPrompts ? (
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
        ) : (
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
        )}

        {/* Composer: Runtime's label, "To:", Enter/Shift+Enter, read-only while pending, draft kept on error */}
        <div className="chat-compose">
          <form onSubmit={handleSend}>
            <label htmlFor="ask-chat-message">Message your AI team</label>
            <p className="chat-recipient-summary" aria-live="polite">
              {pending ? `Sending to ${recipientName}…` : `To: ${recipientName}`}
            </p>
            <textarea
              id="ask-chat-message"
              rows={2}
              value={inputQuery}
              onChange={(e) => { setInputQuery(e.target.value); setSendError(null); }}
              onKeyDown={(e) => handleChatComposerKeyDown(e, () => void handleSend(), pending)}
              placeholder={`Ask ${activeEmployee.name} about tickets, runbooks, or vector knowledge...`}
              readOnly={pending}
              aria-invalid={sendError ? true : undefined}
              aria-describedby={sendError ? "ask-chat-error ask-chat-help" : "ask-chat-help"}
            />
            {sendError && <p id="ask-chat-error" className="chat-compose-error" role="alert">{sendError}</p>}
            <div className="chat-compose-actions">
              <span id="ask-chat-help" className="chat-compose-help">Enter to send; Shift+Enter for a new line.</span>
              <div className="chat-compose-buttons">
                <button
                  type="submit"
                  disabled={!inputQuery.trim() || pending}
                  className="btn btn-primary py-2.5 px-5 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{pending ? "Sending…" : "Ask AI"}</span>
                </button>
              </div>
            </div>
            {pending && <span className="sv8-sr-only" role="status">Sending to {recipientName}. Your draft clears when the reply arrives.</span>}
          </form>
        </div>
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
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
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
                <h3 className="text-sm font-bold text-[#EAF1F8]">Clear Transcript</h3>
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
                <h3 className="text-sm font-bold text-[#EAF1F8]">Dual Authorization</h3>
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

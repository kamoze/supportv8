"use client";

import React, { useState } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Zap,
  Send,
  Sparkles,
  Bot,
  User,
  ExternalLink,
  Shield,
  CreditCard,
  Share2,
  MessageSquare,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Flame,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import type { Issue } from "@/lib/types";

interface FocusedWorkspaceViewProps {
  issues: Issue[];
  onResolve: (issueId: string) => void;
  onProcessRefund: (issueId: string, amount: string) => void;
  onTriggerHandoff: (context: any) => void;
  onNotify: (text: string, type: "success" | "error" | "info") => void;
}

export function FocusedWorkspaceView({
  issues,
  onResolve,
  onProcessRefund,
  onTriggerHandoff,
  onNotify,
}: FocusedWorkspaceViewProps) {
  const [channelMode, setChannelMode] = useState<"chat" | "email" | "voice" | "screenshare">("chat");
  const [selectedIssueId, setSelectedIssueId] = useState<string>(issues[0]?.id || "ISS-1001");
  const [filterType, setFilterType] = useState<"all" | "enterprise" | "urgent" | "at_risk">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [replyText, setReplyText] = useState<string>(
    "Hello! I have thoroughly investigated your issue with our engineering backend. The pending transaction has been reconciled and the duplicate hold has been released immediately."
  );
  const [refundAmount, setRefundAmount] = useState<string>("49.00");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [screenShareActive, setScreenShareActive] = useState<boolean>(false);

  const selectedIssue = issues.find((i) => i.id === selectedIssueId) || issues[0];

  const filteredIssues = issues.filter((i) => {
    const matchesSearch =
      !searchQuery ||
      i.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.externalId.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === "enterprise") return i.customerTier === "enterprise";
    if (filterType === "urgent") return i.priority === "urgent" || i.priority === "high";
    if (filterType === "at_risk") return i.sentiment === "frustrated" || i.sentiment === "angry";
    return true;
  });

  const handleExecuteAutonomousResolution = async () => {
    if (!selectedIssue) return;
    setIsProcessing(true);
    try {
      await onResolve(selectedIssue.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefund = () => {
    if (!selectedIssue) return;
    onProcessRefund(selectedIssue.id, refundAmount);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Workspace Header Bar */}
      <div className="bg-[#121A24] border-b border-[var(--line)] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
            <i className="fi fi-rr-briefcase text-base"></i>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#EAF1F8]">Agentic Resolution Work Desk</h2>
              <span className="pill ok text-[10px]"><i className="dot"></i> LIVE TRIAGE</span>
            </div>
            <p className="text-[11px] text-[#6B7C8D]">
              Focused high-velocity workspace with autonomous copilot assistance and multi-vertical order operations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-[#6B7C8D]">Queue Velocity:</span>
          <span className="text-[#2ED8B6] font-bold">14.2 ms avg triage</span>
          <span className="text-[#6B7C8D] mx-1">•</span>
          <span className="text-[#4CC38A] font-bold">94.8% Copilot Confidence</span>
        </div>
      </div>

      {/* 3-Pane Body Grid */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* ========================================================================= */}
        {/* PANE 1: Ingress Queue Stream (Width: 3 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 border-r border-[var(--line)] bg-[#0C121A] flex flex-col overflow-hidden">
          {/* Search & Filter Strip */}
          <div className="p-3 border-b border-[var(--line)] space-y-2 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6B7C8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search active tickets..."
                className="w-full bg-[#18222E] pl-8 pr-3 py-1.5 rounded-lg border border-[var(--line)] text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "All" },
                { id: "enterprise", label: "VIP" },
                { id: "urgent", label: "P1/P2" },
                { id: "at_risk", label: "At-Risk" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`flex-1 py-1 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                    filterType === tab.id
                      ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40"
                      : "bg-[#18222E] text-[#6B7C8D] hover:text-[#EAF1F8] border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Queue List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
            {filteredIssues.map((issue) => {
              const isSelected = issue.id === selectedIssue?.id;
              const isFrustrated = issue.sentiment === "frustrated" || issue.sentiment === "angry";
              return (
                <button
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={`w-full p-3 text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? "bg-[#18222E] border-l-2 border-l-[#2ED8B6]"
                      : "hover:bg-[#141C27] border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[11px] text-[#2ED8B6]">{issue.externalId}</span>
                    <span className="text-[10px] text-[#6B7C8D] font-mono">{issue.createdAt || "4m ago"}</span>
                  </div>

                  <div className="text-xs font-semibold text-[#EAF1F8] line-clamp-1">{issue.summary}</div>

                  <div className="flex items-center justify-between text-[10px] pt-1">
                    <span className="text-[#B4C2D0] truncate max-w-[120px]">{issue.customerName}</span>
                    <div className="flex items-center gap-1">
                      {isFrustrated && (
                        <span className="pill err text-[9px] py-0 px-1 font-mono">
                          <Flame className="w-2.5 h-2.5" />
                          RISK
                        </span>
                      )}
                      <span
                        className={`pill text-[9px] py-0 px-1 uppercase font-mono ${
                          issue.priority === "urgent" ? "err" : issue.priority === "high" ? "warn" : "ok"
                        }`}
                      >
                        {issue.priority}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANE 2: Conversation Thread & Customer 360 (Width: 5 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-5 border-r border-[var(--line)] bg-[#0B1017] flex flex-col overflow-hidden">
          {selectedIssue ? (
            <>
              {/* Customer 360 Header Card */}
              <div className="p-4 bg-[#121A24] border-b border-[var(--line)] space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-center text-sm font-bold text-[#2ED8B6]">
                      {selectedIssue.customerName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-[#EAF1F8]">{selectedIssue.customerName}</span>
                        <span className="pill ok text-[9px] py-0 font-mono uppercase">{selectedIssue.customerTier}</span>
                      </div>
                      <span className="text-[10px] text-[#6B7C8D] font-mono">Customer ID: CUST-8821 • ARR: $420,000</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-[#4CC38A] font-mono">Health: 88/100</div>
                    <span className="text-[9px] text-[#6B7C8D] font-mono">142 Lifetime Tickets</span>
                  </div>
                </div>

                {/* Linked Order History Context (from OrderV8) */}
                <div className="p-2.5 rounded-lg bg-[#0C121A] border border-[var(--line)] flex items-center justify-between text-[11px] font-mono">
                  <div className="flex items-center gap-2 text-[#B4C2D0]">
                    <CreditCard className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Order: <strong>#ORD-99412</strong> ($240.00)</span>
                  </div>
                  <span className="text-[#F5A623] font-semibold">Hold: $49.00 (Pending Release)</span>
                </div>
              </div>

              {/* Omnichannel Channel Mode Bar */}
              <div className="flex items-center justify-between px-4 py-2 bg-[#0E1520] border-b border-[var(--line)] shrink-0">
                <div className="flex items-center gap-1">
                  {[
                    { id: "chat", label: "Live Chat Widget", icon: "fi fi-rr-comment-alt-dots" },
                    { id: "email", label: "Email Thread", icon: "fi fi-rr-envelope" },
                    { id: "voice", label: "Voice SIP Call", icon: "fi fi-rr-headset" },
                    { id: "screenshare", label: "Screen Share", icon: "fi fi-rr-computer" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setChannelMode(mode.id as any);
                        onNotify(`Switched active interaction stream to ${mode.label}`, "info");
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                        channelMode === mode.id
                          ? "bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40 font-bold"
                          : "text-[#6B7C8D] hover:text-[#EAF1F8] border border-transparent"
                      }`}
                    >
                      <i className={mode.icon} />
                      <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                  ))}
                </div>

                {channelMode === "screenshare" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setScreenShareActive(!screenShareActive);
                      onNotify(screenShareActive ? "Ended co-browsing session" : "Sent Co-Browsing invite link to customer", "success");
                    }}
                    className={`btn text-[10px] py-1 px-2.5 font-mono cursor-pointer ${screenShareActive ? "btn-primary" : "btn-secondary"}`}
                  >
                    {screenShareActive ? "● Co-Browsing Live" : "+ Send Screen Share Invite"}
                  </button>
                ) : (
                  <span className="text-[10px] text-[#4CC38A] font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4CC38A] animate-pulse" />
                    SOCKET STREAM CONNECTED
                  </span>
                )}
              </div>

              {/* Message Transcript Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="text-center text-[10px] text-[#6B7C8D] font-mono">
                  Session started via {channelMode.toUpperCase()} Ingress • Case {selectedIssue.externalId}
                </div>

                {/* Customer Message */}
                <div className="flex items-start gap-2.5 max-w-[85%]">
                  <div className="w-7 h-7 rounded-lg bg-[#18222E] border border-[var(--line)] flex items-center justify-center text-xs text-[#E5484D] shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7C8D]">
                      <span>{selectedIssue.customerName}</span>
                      <span>10:42 AM</span>
                    </div>
                    <div className="p-3 rounded-2xl rounded-tl-none bg-[#18222E] border border-[var(--line-2)] text-xs text-[#EAF1F8] leading-relaxed">
                      {selectedIssue.summary}
                      <p className="mt-2 text-[11px] text-[#B4C2D0]">
                        "I am noticing duplicate authorizations of $49.00 on my billing portal after yesterday's checkout glitch. Please refund the duplicate hold immediately."
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Employee Analysis Note */}
                <div className="p-3 rounded-xl bg-[#2ED8B6]/8 border border-[#2ED8B6]/25 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-[#2ED8B6] font-bold text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Alex (Support Intelligence Lead) Analysis</span>
                    </span>
                    <span className="text-[10px] text-[#4CC38A]">Correlation Confidence: 96.4%</span>
                  </div>
                  <p className="text-[11px] text-[#B4C2D0] leading-relaxed">
                    Identified correlation with Problem <strong>PRB-401</strong> (Payment Gateway 504 Timeouts). OrderV8 ledger confirms double authorization hold. Safe to release hold and dispatch satisfaction confirmation.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#6B7C8D]">
              Select a ticket from the queue to inspect transcript.
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PANE 3: AI Copilot & Action Dispatcher (Width: 4 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-4 bg-[#121A24] flex flex-col overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <span className="text-xs font-bold text-[#EAF1F8] flex items-center gap-1.5 font-mono">
              <Zap className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>AI Copilot &amp; Multi-Vertical Actions</span>
            </span>
            <span className="pill ok text-[10px]">AUTONOMOUS READY</span>
          </div>

          {/* AI Response Draft */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#B4C2D0]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>AI Proposed Response</span>
              </span>
              <span className="text-[10px] font-mono text-[#4CC38A]">94.8% Match</span>
            </div>

            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full bg-[#18222E] p-3 rounded-xl border border-[var(--line-2)] text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] font-sans leading-relaxed"
            />
          </div>

          {/* Quick Macro Buttons */}
          <div className="flex items-center gap-1.5">
            {[
              { label: "Add apology macro", text: "We sincerely apologize for the checkout disruption. " },
              { label: "Attach order ID", text: " Regarding order #ORD-99412: " },
            ].map((macro, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setReplyText((prev) => macro.text + prev)}
                className="btn btn-secondary py-1 px-2 text-[10px] font-mono"
              >
                + {macro.label}
              </button>
            ))}
          </div>

          {/* 1-Click Action Dispatchers */}
          <div className="space-y-2 pt-2 border-t border-[var(--line)]">
            <span className="text-[10px] font-bold text-[#6B7C8D] uppercase font-mono tracking-wider">
              Autonomous Execution Panel
            </span>

            {/* 1-Click Autonomous Resolve */}
            <button
              type="button"
              onClick={handleExecuteAutonomousResolution}
              disabled={isProcessing}
              className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Zap className="w-4 h-4" />
              <span>⚡ Execute 1-Click Autonomous Resolution</span>
            </button>

            {/* 1-Click Refund via OrderV8 */}
            <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#EAF1F8]">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>OrderV8 Instant Refund API</span>
                </span>
                <span className="text-[10px] font-mono text-[#2ED8B6]">$49.00</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-[#6B7C8D] font-mono text-xs">$</span>
                  <input
                    type="text"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full bg-[#121A24] pl-7 pr-3 py-1.5 rounded-lg border border-[var(--line-2)] text-xs font-mono text-[#EAF1F8] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRefund}
                  className="btn btn-secondary text-xs py-1.5 px-3 font-semibold"
                >
                  Disburse
                </button>
              </div>
            </div>

            {/* Cross-Vertical Handoff */}
            <button
              type="button"
              onClick={() => onTriggerHandoff(selectedIssue)}
              className="btn btn-secondary w-full py-2 text-xs flex items-center justify-center gap-2 font-mono"
            >
              <Share2 className="w-3.5 h-3.5 text-[#4D9FFF]" />
              <span>Issue Cross-Vertical Token</span>
            </button>
          </div>

          {/* Autonomy Safety Policy Guarantee */}
          <div className="p-3 rounded-xl bg-[#0B1017] border border-[var(--line)] flex items-center gap-2 text-[10px] text-[#6B7C8D] font-mono">
            <Shield className="w-4 h-4 text-[#4CC38A] shrink-0" />
            <span>Actions governed by Temporal SRE Orchestration with automatic idempotency check.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

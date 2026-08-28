"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Zap,
  Send,
  Sparkles,
  Bot,
  User,
  Shield,
  MessageSquare,
  ChevronRight,
  Flame,
  ArrowRight,
  Mail,
  Phone,
  FileText,
  Wand2,
  RefreshCw,
  HardHat,
  MapPin,
  Truck,
  Key,
  Smartphone,
  FileCheck,
} from "lucide-react";
import type { Issue } from "@/lib/types";

interface FocusedWorkspaceViewProps {
  issues: Issue[];
  problems?: any[];
  insights?: any[];
  onResolve: (issueId: string) => void;
  onProcessRefund?: (issueId: string, amount: string) => void;
  onEscalate?: (issue: Issue) => void;
  onNavigateToProblems?: () => void;
  onExecuteInsight?: (insightId: string) => void;
  onNotify: (text: string, type: "success" | "error" | "info") => void;
}

export function FocusedWorkspaceView({
  issues,
  problems = [],
  insights = [],
  onResolve,
  onProcessRefund,
  onEscalate,
  onNavigateToProblems,
  onExecuteInsight,
  onNotify,
}: FocusedWorkspaceViewProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string>(issues[0]?.id || "");
  const [filterType, setFilterType] = useState<"all" | "customers" | "contractors" | "urgent">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showInsightsDrawer, setShowInsightsDrawer] = useState<boolean>(false);
  const [executingInsightId, setExecutingInsightId] = useState<string | null>(null);

  // Communication & AI Mode State
  const [commChannel, setCommChannel] = useState<"chat" | "email" | "whatsapp" | "voice" | "internal_note" | "contractor_sms" | "work_order_push" | "site_pass">("chat");
  const [workWithAi, setWorkWithAi] = useState<boolean>(true);
  const [aiTone, setAiTone] = useState<"empathetic" | "technical" | "concise" | "executive" | "sow_instructions" | "safety_protocol" | "urgent_expedite">("empathetic");
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const selectedIssue = issues.find((i) => i.id === selectedIssueId) || issues[0];
  const isContractor = selectedIssue?.entityType === "contractor" || selectedIssue?.category?.includes("contractor") || Boolean(selectedIssue?.contractor);

  // Generate contextual AI response based on issue & parameters
  const generateContextualReply = (issue: Issue, tone: string, channel: string) => {
    if (!issue) return "";
    const isContractorTicket = issue.entityType === "contractor" || issue.category?.includes("contractor") || Boolean(issue.contractor);
    const contractor = issue.contractor;

    // Contractor / Field Work Order Context
    if (isContractorTicket && contractor) {
      if (channel === "site_pass" || tone === "safety_protocol") {
        return `[SITE ACCESS & SAFETY PASS]\nWork Order: ${contractor.workOrderId}\nTechnician: ${contractor.contactName} (${contractor.company})\nLocation: ${contractor.siteLocation}\nAccess PIN: ${contractor.accessCode || "LOCK-8841-PIN"}\nSafety: Level 2 Escort, ESD footwear required on raised floor.`;
      }
      if (channel === "contractor_sms" || tone === "concise") {
        return `Hi ${contractor.contactName.split(" ")[0]}, Work Order #${contractor.workOrderId} is confirmed for ${contractor.siteLocation}. Access PIN: ${contractor.accessCode || "LOCK-8841"}. ETA: ${contractor.eta || "15 mins"}. Please check in on arrival.`;
      }
      if (tone === "urgent_expedite") {
        return `[URGENT DISPATCH] Work Order ${contractor.workOrderId}: Critical service disruption on ${issue.product}. Security pre-notified at ${contractor.siteLocation} for priority access.`;
      }
      if (tone === "sow_instructions" || channel === "work_order_push") {
        return `[SCOPE OF WORK]\nJob: ${issue.summary}\nLocation: ${contractor.siteLocation}\n1. Verify power & optic indicators.\n2. Swap replacement unit (${issue.version}).\n3. Perform loopback test & confirm green telemetry with SRE Lead.`;
      }
      return `Hello ${contractor.contactName}, updating Work Order ${contractor.workOrderId} for ${contractor.company}. All site permits for ${contractor.siteLocation} are active.`;
    }

    // Customer Context
    const customer = issue.customerName;
    const isEnterprise = issue.customerTier === "enterprise";

    if (channel === "internal_note") {
      return `[SRE NOTE] ${issue.id} linked to problem ${issue.problemId || "PRB-218"}. Investigated with ${issue.product} v${issue.version}. Auto-verification confirmed safe. Recommend closing.`;
    }

    if (channel === "whatsapp" || channel === "chat") {
      if (tone === "concise") {
        return `Hi ${customer.split(" ")[0]}, we have investigated the ${issue.category.replace("_", " ")} on your account. The issue has been rectified and your access is fully restored.`;
      }
      if (tone === "technical") {
        return `Hello ${customer.split(" ")[0]}, telemetry confirmed a 504 timeout during gateway verification. The authorization hold was voided and transaction state is reconciled.`;
      }
      return `Hello ${customer.split(" ")[0]}, we apologize for the disruption with ${issue.category.replace("_", " ")}. We have verified your account and reconciled the transaction. Service is operating normally.`;
    }

    if (channel === "email") {
      if (tone === "executive" || isEnterprise) {
        return `Dear ${customer},\n\nThank you for contacting Enterprise Support regarding your recent inquiry (${issue.externalId}).\n\nOur engineering team has resolved the incident on our backend. System functionality and SLA monitoring are fully restored.\n\nSincerely,\nEnterprise Operations Team`;
      }
      return `Hi ${customer},\n\nThank you for reaching out. We have investigated the ${issue.summary.toLowerCase()} and applied an immediate fix.\n\nEverything is now resolved. Please reply if you have any questions.\n\nBest regards,\nCustomer Support Team`;
    }

    if (channel === "voice") {
      return `Hello ${customer.split(" ")[0]}, this is Sophia following up on your recent inquiry to confirm that your issue has been resolved.`;
    }

    return `Hello ${customer}, your issue regarding ${issue.summary} has been verified and resolved.`;
  };

  // Update default channel and reply when selected issue changes
  useEffect(() => {
    if (selectedIssue) {
      const isCtr = selectedIssue.entityType === "contractor" || selectedIssue.category?.includes("contractor") || Boolean(selectedIssue.contractor);
      const defaultChannel = isCtr ? "contractor_sms" : "chat";
      const defaultTone = isCtr ? "sow_instructions" : "empathetic";
      setCommChannel(defaultChannel);
      setAiTone(defaultTone as any);
      if (workWithAi) {
        setReplyText(generateContextualReply(selectedIssue, defaultTone, defaultChannel));
      }
    }
  }, [selectedIssueId]);

  // Update reply text on channel or tone change
  useEffect(() => {
    if (selectedIssue && workWithAi) {
      setReplyText(generateContextualReply(selectedIssue, aiTone, commChannel));
    }
  }, [commChannel, aiTone, workWithAi]);

  const handleTriggerGenerateAi = () => {
    if (!selectedIssue) return;
    setIsGeneratingAi(true);
    setTimeout(() => {
      setReplyText(generateContextualReply(selectedIssue, aiTone, commChannel));
      setIsGeneratingAi(false);
      onNotify(`Generated ${aiTone.toUpperCase()} response`, "success");
    }, 250);
  };

  const filteredIssues = issues.filter((i) => {
    const matchesSearch =
      !searchQuery ||
      i.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.externalId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.contractor && i.contractor.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (i.contractor && i.contractor.siteLocation.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    const isCtr = i.entityType === "contractor" || i.category?.includes("contractor") || Boolean(i.contractor);
    if (filterType === "customers") return !isCtr;
    if (filterType === "contractors") return isCtr;
    if (filterType === "urgent") return i.priority === "urgent" || i.priority === "high";
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

  const handleSendReply = () => {
    if (!selectedIssue || !replyText.trim()) return;
    const recipient = isContractor && selectedIssue.contractor
      ? `${selectedIssue.contractor.contactName} (${selectedIssue.contractor.company})`
      : selectedIssue.customerName;
    onNotify(`Dispatched update to ${recipient}`, "success");
  };

  const handleSendSitePass = () => {
    if (!selectedIssue?.contractor) return;
    onNotify(`Dispatched site PIN to ${selectedIssue.contractor.contactName}`, "success");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-[#0A0E14]">
      {/* Clean Workspace Header Bar */}
      <div className="bg-[#101620] border-b border-[var(--line)] px-5 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2ED8B6]/10 text-[#2ED8B6] flex items-center justify-center border border-[#2ED8B6]/20">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#EAF1F8]">Work Desk</h2>
              <span className="text-[11px] text-[#6B7C8D]">Customer &amp; Field Operations</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {insights.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInsightsDrawer(!showInsightsDrawer)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                showInsightsDrawer
                  ? "bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40"
                  : "bg-[#161F2C] text-[#8E9CAE] hover:text-[#EAF1F8] border border-[var(--line)]"
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 text-[#F5A623]" />
              <span>Insights</span>
              <span className="text-[10px] font-mono text-[#F5A623]">({insights.length})</span>
            </button>
          )}

          {/* Clean Segment Control for Copilot Mode */}
          <div className="flex items-center bg-[#161F2C] p-0.5 rounded-lg border border-[var(--line)] text-[11px]">
            <button
              type="button"
              onClick={() => setWorkWithAi(true)}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                workWithAi ? "bg-[#2ED8B6] text-[#04201C] font-semibold shadow-sm" : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Copilot</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkWithAi(false)}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                !workWithAi ? "bg-[#2ED8B6] text-[#04201C] font-semibold shadow-sm" : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Manual</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Pane Body Grid */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* ========================================================================= */}
        {/* PANE 1: Queue Stream (Width: 3 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 border-r border-[var(--line)] bg-[#0C121A] flex flex-col overflow-hidden">
          {/* Search & Filter Header */}
          <div className="p-2.5 border-b border-[var(--line)] space-y-2 shrink-0 bg-[#0E1520]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7C8D] absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search queue..."
                className="w-full bg-[#161F2C] text-[#EAF1F8] pl-7 pr-2.5 py-1 rounded-md border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            {/* Audience Tabs: All, Customers, Contractors, Urgent */}
            <div className="flex items-center gap-1 bg-[#161F2C] p-0.5 rounded-md border border-[var(--line)]">
              {[
                { id: "all", label: "All" },
                { id: "customers", label: "Customers" },
                { id: "contractors", label: "Contractors" },
                { id: "urgent", label: "Urgent" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterType(tab.id as any)}
                  className={`flex-1 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer text-center ${
                    filterType === tab.id
                      ? "bg-[#2ED8B6]/20 text-[#2ED8B6] font-semibold"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
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
              const isCtr = issue.entityType === "contractor" || issue.category?.includes("contractor") || Boolean(issue.contractor);

              return (
                <button
                  key={issue.id}
                  onClick={() => setSelectedIssueId(issue.id)}
                  className={`w-full p-2.5 text-left transition-colors cursor-pointer flex flex-col gap-1 ${
                    isSelected
                      ? "bg-[#16202D] border-l-2 border-l-[#2ED8B6]"
                      : "hover:bg-[#121924] border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className={`font-semibold ${isCtr ? "text-[#F5A623]" : "text-[#2ED8B6]"}`}>
                        {issue.externalId}
                      </span>
                      <span className="text-[10px] text-[#6B7C8D]">
                        {isCtr ? "• Dispatch" : `• ${issue.customerTier}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#6B7C8D]">{issue.createdAt ? "4m ago" : "Just now"}</span>
                  </div>

                  <div className="text-xs text-[#EAF1F8] line-clamp-1 font-medium">{issue.summary}</div>

                  <div className="flex items-center justify-between text-[11px] text-[#8E9CAE] pt-0.5">
                    <span className="truncate max-w-[150px]">
                      {isCtr && issue.contractor ? `${issue.contractor.contactName} (${issue.contractor.company})` : issue.customerName}
                    </span>
                    <span
                      className={`text-[9.5px] font-mono uppercase ${
                        issue.priority === "urgent" ? "text-[#E5484D]" : issue.priority === "high" ? "text-[#F5A623]" : "text-[#6B7C8D]"
                      }`}
                    >
                      {issue.priority}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANE 2: Context & Thread (Width: 4 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-4 border-r border-[var(--line)] bg-[#0B1017] flex flex-col overflow-hidden">
          {selectedIssue ? (
            <>
              {/* Context Header Card */}
              <div className="p-3.5 bg-[#101620] border-b border-[var(--line)] space-y-2 shrink-0">
                {isContractor && selectedIssue.contractor ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center">
                          <HardHat className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#EAF1F8]">{selectedIssue.contractor.contactName}</div>
                          <div className="text-[10.5px] text-[#8E9CAE]">{selectedIssue.contractor.company} &bull; {selectedIssue.contractor.trade}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-[#2ED8B6] font-mono">{selectedIssue.contractor.eta || "En Route"}</div>
                        <div className="text-[10px] text-[#6B7C8D] uppercase">{selectedIssue.contractor.dispatchStatus}</div>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-[#161F2C] flex items-center justify-between text-xs text-[#EAF1F8]">
                      <div className="flex items-center gap-1.5 text-[11px] truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#E5484D] shrink-0" />
                        <span className="truncate">{selectedIssue.contractor.siteLocation}</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#2ED8B6] shrink-0 ml-2">
                        {selectedIssue.contractor.accessCode || "PIN: 7729"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#2ED8B6]/15 text-[#2ED8B6] flex items-center justify-center font-semibold text-xs">
                          {selectedIssue.customerName[0]}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#EAF1F8]">{selectedIssue.customerName}</div>
                          <div className="text-[10.5px] text-[#8E9CAE]">Tier: {selectedIssue.customerTier.toUpperCase()} &bull; Channel: {selectedIssue.source.toUpperCase()}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-[#4CC38A]">Health 92%</div>
                        <div className="text-[10px] text-[#6B7C8D]">{selectedIssue.category}</div>
                      </div>
                    </div>

                    {selectedIssue.problemId && (
                      <button
                        type="button"
                        onClick={() => onNavigateToProblems?.()}
                        className="w-full p-1.5 rounded-lg bg-[#E5484D]/10 text-[#E5484D] flex items-center justify-between text-[10.5px] hover:bg-[#E5484D]/20 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span>Correlated: {selectedIssue.problemId}</span>
                        </div>
                        <span className="text-[9.5px] underline">Inspect</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Message Transcript Stream */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {/* Inbound Ticket / Dispatch Request */}
                <div className="flex items-start gap-2 max-w-[95%]">
                  <div className="w-6 h-6 rounded-md bg-[#161F2C] flex items-center justify-center text-xs text-[#8E9CAE] shrink-0 mt-0.5">
                    {isContractor ? <HardHat className="w-3 h-3 text-[#F5A623]" /> : <User className="w-3 h-3 text-[#2ED8B6]" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] text-[#6B7C8D]">
                      <span>{isContractor && selectedIssue.contractor ? selectedIssue.contractor.contactName : selectedIssue.customerName}</span>
                      <span>{selectedIssue.createdAt ? "4m ago" : "Just now"}</span>
                    </div>
                    <div className="p-2.5 rounded-xl rounded-tl-none bg-[#161F2C] border border-[var(--line-2)] text-xs text-[#EAF1F8] leading-relaxed">
                      <p className="font-semibold text-white mb-0.5">{selectedIssue.summary}</p>
                      <p className="text-[11px] text-[#B4C2D0]">
                        {isContractor && selectedIssue.contractor
                          ? `Field work order active for ${selectedIssue.contractor.siteLocation}. Tech: ${selectedIssue.contractor.contactName}.`
                          : `"We are experiencing disruption with ${selectedIssue.product} on version ${selectedIssue.version}. Please advise."`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Context Recommendation */}
                <div className="p-2.5 rounded-lg bg-[#14202B] border border-[#2ED8B6]/20 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[#2ED8B6] font-medium text-[11px]">
                    <span className="flex items-center gap-1">
                      <Bot className="w-3 h-3" />
                      <span>AI Copilot Suggestion</span>
                    </span>
                    <span className="text-[10px] text-[#4CC38A]">{(selectedIssue.confidence * 100).toFixed(0)}% confidence</span>
                  </div>
                  <p className="text-[11px] text-[#B4C2D0] leading-relaxed">
                    {selectedIssue.recommendedAction}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#6B7C8D]">
              Select an item to view details.
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PANE 3: Dispatch Station (Width: 5 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-5 bg-[#101620] flex flex-col overflow-y-auto p-4 space-y-3">
          {/* Channel Bar */}
          <div className="space-y-1.5 pb-2.5 border-b border-[var(--line)]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#EAF1F8] flex items-center gap-1.5">
                {isContractor ? <Truck className="w-3.5 h-3.5 text-[#F5A623]" /> : <Send className="w-3.5 h-3.5 text-[#2ED8B6]" />}
                <span>{isContractor ? "Contractor Dispatch Station" : "Customer Resolution Station"}</span>
              </span>
            </div>

            {/* Channels Segment */}
            <div className="grid grid-cols-5 gap-1 bg-[#161F2C] p-0.5 rounded-lg border border-[var(--line)] text-xs">
              {isContractor ? (
                <>
                  {[
                    { id: "contractor_sms", label: "SMS", icon: Smartphone },
                    { id: "work_order_push", label: "App", icon: FileCheck },
                    { id: "site_pass", label: "PIN", icon: Key },
                    { id: "voice", label: "Call", icon: Phone },
                    { id: "internal_note", label: "Note", icon: FileText },
                  ].map((ch) => {
                    const Icon = ch.icon;
                    const isActive = commChannel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setCommChannel(ch.id as any)}
                        className={`py-1 rounded-md text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#F5A623] text-[#04201C] font-semibold shadow-sm"
                            : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{ch.label}</span>
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  {[
                    { id: "chat", label: "Chat", icon: MessageSquare },
                    { id: "email", label: "Email", icon: Mail },
                    { id: "whatsapp", label: "WhatsApp", icon: Phone },
                    { id: "voice", label: "Voice", icon: Zap },
                    { id: "internal_note", label: "Note", icon: FileText },
                  ].map((ch) => {
                    const Icon = ch.icon;
                    const isActive = commChannel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setCommChannel(ch.id as any)}
                        className={`py-1 rounded-md text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#2ED8B6] text-[#04201C] font-semibold shadow-sm"
                            : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{ch.label}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* AI Response Tone */}
          {workWithAi && (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#8E9CAE] text-[11px] font-medium">Response Style</span>
                <button
                  type="button"
                  onClick={handleTriggerGenerateAi}
                  disabled={isGeneratingAi}
                  className="text-[10.5px] text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isGeneratingAi ? "animate-spin" : ""}`} />
                  <span>Regenerate</span>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1">
                {isContractor ? (
                  <>
                    {[
                      { id: "sow_instructions", label: "SOW Scope" },
                      { id: "safety_protocol", label: "Safety / PIN" },
                      { id: "urgent_expedite", label: "Expedite" },
                      { id: "concise", label: "Concise" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAiTone(t.id as any)}
                        className={`py-1 px-1 text-[10px] rounded-md transition-all cursor-pointer text-center truncate ${
                          aiTone === t.id
                            ? "bg-[#F5A623]/20 text-[#F5A623] font-semibold border border-[#F5A623]/40"
                            : "bg-[#161F2C] text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {[
                      { id: "empathetic", label: "Empathetic" },
                      { id: "technical", label: "Technical" },
                      { id: "concise", label: "Concise" },
                      { id: "executive", label: "Executive" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAiTone(t.id as any)}
                        className={`py-1 px-1 text-[10px] rounded-md transition-all cursor-pointer text-center truncate ${
                          aiTone === t.id
                            ? "bg-[#2ED8B6]/20 text-[#2ED8B6] font-semibold border border-[#2ED8B6]/40"
                            : "bg-[#161F2C] text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Reply Composition Box */}
          <div className="space-y-1 flex-1 flex flex-col">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={8}
              className="w-full flex-1 bg-[#161F2C] text-[#EAF1F8] p-3 rounded-lg border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
              placeholder={isContractor ? "Enter instructions for technician..." : "Compose message..."}
            />
          </div>

          {/* Action Dispatch Buttons */}
          <div className="space-y-2 pt-1.5 border-t border-[var(--line)]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSendReply}
                disabled={!replyText.trim()}
                className="btn btn-secondary py-2 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isContractor ? "Send to Tech" : "Send Reply"}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  handleSendReply();
                  await handleExecuteAutonomousResolution();
                }}
                disabled={isProcessing || !replyText.trim()}
                className="btn btn-primary py-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isContractor ? "Complete Order" : "Auto-Resolve"}</span>
              </button>
            </div>

            {/* Contractor-specific Quick Actions */}
            {isContractor && selectedIssue?.contractor && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendSitePass}
                  className="btn btn-secondary flex-1 py-1.5 text-xs flex items-center justify-center gap-1.5 text-[#2ED8B6] cursor-pointer"
                >
                  <Key className="w-3 h-3" />
                  <span>Send PIN &amp; GPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEscalate && selectedIssue && onEscalate(selectedIssue)}
                  className="btn btn-secondary flex-1 py-1.5 text-xs flex items-center justify-center gap-1.5 text-[#8E9CAE] hover:text-[#EAF1F8] cursor-pointer"
                >
                  <HardHat className="w-3 h-3" />
                  <span>Reassign Crew</span>
                </button>
              </div>
            )}

            {!isContractor && (
              <button
                type="button"
                onClick={() => onEscalate && selectedIssue && onEscalate(selectedIssue)}
                className="btn btn-secondary w-full py-1.5 text-xs flex items-center justify-center gap-1.5 text-[#8E9CAE] hover:text-[#EAF1F8] cursor-pointer"
              >
                <Zap className="w-3 h-3 text-[#F5A623]" />
                <span>Escalate to Lead</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTION INSIGHTS DRAWER */}
      {/* ========================================================================= */}
      {showInsightsDrawer && insights.length > 0 && (
        <div className="bg-[#0E1520] border-t border-[#F5A623]/40 p-3.5 shrink-0 space-y-2.5 transition-all max-h-[260px] overflow-y-auto z-20 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Wand2 className="w-3.5 h-3.5 text-[#F5A623]" />
              <span className="font-semibold text-[#EAF1F8]">Action Insights</span>
              <span className="text-[10px] text-[#6B7C8D]">(Trend Radar &amp; Telemetry)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowInsightsDrawer(false)}
              className="text-[11px] text-[#6B7C8D] hover:text-[#EAF1F8] px-2 py-0.5 rounded cursor-pointer"
            >
              Hide ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="p-3 rounded-lg bg-[#141C28] border border-[var(--line)] hover:border-[#F5A623]/50 space-y-1.5 text-xs transition-colors flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-[#EAF1F8] text-[11px] leading-snug">
                      {ins.title}
                    </h4>
                    <span className="text-[9px] text-[#4CC38A] font-mono shrink-0">
                      {(ins.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[10.5px] text-[#8E9CAE] leading-relaxed line-clamp-2">
                    {ins.finding}
                  </p>
                  <div className="p-1.5 rounded bg-[#1A2432] text-[10px] text-[#EAF1F8]">
                    <span className="text-[#F5A623] font-medium">Action: </span>
                    <span>{ins.recommendation}</span>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-[var(--line)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (ins.title.toLowerCase().includes("saml") || ins.finding.toLowerCase().includes("saml")) {
                        setSearchQuery("SAML");
                      } else if (ins.title.toLowerCase().includes("refund")) {
                        setSearchQuery("Refund");
                      } else {
                        setSearchQuery(ins.affectedSegment || "");
                      }
                      onNotify(`Filtered to: ${ins.title}`, "info");
                    }}
                    className="text-[10px] text-[#4D9FFF] hover:underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span>Filter</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    disabled={executingInsightId === ins.id}
                    onClick={async () => {
                      setExecutingInsightId(ins.id);
                      try {
                        if (onExecuteInsight) {
                          await onExecuteInsight(ins.id);
                        } else {
                          onNotify(`Executed '${ins.title}'`, "success");
                        }
                      } finally {
                        setExecutingInsightId(null);
                      }
                    }}
                    className="btn btn-primary py-0.5 px-2 text-[10.5px] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-2.5 h-2.5" />
                    <span>{executingInsightId === ins.id ? "..." : "Execute"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

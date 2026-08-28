"use client";

import React, { useState, useEffect } from "react";
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
  Mail,
  Phone,
  FileText,
  Sliders,
  Wand2,
  RefreshCw,
  Copy,
  Check,
  HardHat,
  MapPin,
  Truck,
  Key,
  Smartphone,
  Navigation,
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
  const [filterType, setFilterType] = useState<"all" | "customers" | "contractors" | "urgent" | "at_risk">("all");
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
  const [copiedNote, setCopiedNote] = useState<boolean>(false);

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
        return `[SITE ACCESS & SAFETY PASS]\nWork Order: ${contractor.workOrderId}\nTechnician: ${contractor.contactName} (${contractor.company})\nLocation: ${contractor.siteLocation}\nAccess Security PIN: ${contractor.accessCode || "LOCK-8841-PIN"}\nSafety Requirement: Level 2 Datacenter Escort, Closed-toe ESD footwear required on raised floor.`;
      }
      if (channel === "contractor_sms" || tone === "concise") {
        return `Hi ${contractor.contactName.split(" ")[0]}, Work Order #${contractor.workOrderId} is confirmed for ${contractor.siteLocation}. Access PIN: ${contractor.accessCode || "LOCK-8841"}. ETA recorded as ${contractor.eta || "15 mins"}. Please check in upon arrival.`;
      }
      if (tone === "urgent_expedite") {
        return `[URGENT DISPATCH EXPEDITE] Work Order ${contractor.workOrderId}: Active critical disruption on ${issue.product}. Priority ETA requested. Security has been pre-notified at ${contractor.siteLocation} for immediate rack access.`;
      }
      if (tone === "sow_instructions" || channel === "work_order_push") {
        return `[SCOPE OF WORK (SOW)]\nJob: ${issue.summary}\nTarget Asset: ${contractor.siteLocation}\n1. Verify power and optic status.\n2. Swap replacement hardware (${issue.version}).\n3. Execute link loopback test and confirm green telemetry with SRE Lead.\n4. Close work order with timestamp.`;
      }
      return `Hello ${contractor.contactName}, updating Work Order ${contractor.workOrderId} for ${contractor.company}. All site permits for ${contractor.siteLocation} are active.`;
    }

    // Customer Context
    const customer = issue.customerName;
    const isEnterprise = issue.customerTier === "enterprise";

    if (channel === "internal_note") {
      return `[INTERNAL SRE NOTE] ${issue.id} linked to problem ${issue.problemId || "PRB-218"}. Root cause investigated with ${issue.product} v${issue.version}. Autonomous verification confirmed safe. Recommend closing ticket.`;
    }

    if (channel === "whatsapp" || channel === "chat") {
      if (tone === "concise") {
        return `Hi ${customer.split(" ")[0]}, we have investigated the ${issue.category.replace("_", " ")} on your account. The issue has been rectified and your access is fully restored. Let us know if you need anything else!`;
      }
      if (tone === "technical") {
        return `Hello ${customer.split(" ")[0]}, our telemetry confirmed a 504 timeout during gateway verification. The authorization hold was voided via our payment service and the transaction state is reconciled.`;
      }
      return `Hello ${customer.split(" ")[0]}! We sincerely apologize for the inconvenience caused by the ${issue.category.replace("_", " ")}. We have verified your account and reconciled the transaction immediately. Your service is operating normally.`;
    }

    if (channel === "email") {
      if (tone === "executive" || isEnterprise) {
        return `Dear ${customer},\n\nThank you for contacting Acme Enterprise Support regarding your recent inquiry (${issue.externalId}).\n\nOur engineering team has thoroughly investigated the incident. A priority resolution has been executed on our backend to restore full system functionality without delay.\n\nWe have updated our continuous monitoring SLA. Please let us know if we can assist further.\n\nSincerely,\nAcme Enterprise Operations Team`;
      }
      return `Hi ${customer},\n\nThank you for reaching out to us. We have investigated the ${issue.summary.toLowerCase()} and applied an immediate fix to your account.\n\nEverything is now resolved and verified in our systems. Please reply to this email if you experience any further questions.\n\nBest regards,\nCustomer Support Team`;
    }

    if (channel === "voice") {
      return `Hello ${customer.split(" ")[0]}, this is Sophia from Acme Support following up on your recent inquiry. I'm calling to confirm that your issue has been resolved and your account is in good standing.`;
    }

    return `Hello ${customer}, we have addressed your issue regarding ${issue.summary}. Your resolution has been verified and confirmed.`;
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
      onNotify(`Generated ${aiTone.toUpperCase()} AI reply for ${commChannel.toUpperCase()} stream`, "success");
    }, 350);
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

  const handleSendReply = () => {
    if (!selectedIssue || !replyText.trim()) return;
    const recipient = isContractor && selectedIssue.contractor
      ? `${selectedIssue.contractor.contactName} (${selectedIssue.contractor.company})`
      : selectedIssue.customerName;
    onNotify(`Dispatched ${commChannel.toUpperCase()} update to ${recipient}`, "success");
  };

  const handleSendSitePass = () => {
    if (!selectedIssue?.contractor) return;
    onNotify(`Dispatched digital site access PIN (${selectedIssue.contractor.accessCode || "LOCK-7729"}) to ${selectedIssue.contractor.contactName}`, "success");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      {/* Workspace Header Bar */}
      <div className="bg-[#121A24] border-b border-[var(--line)] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#EAF1F8]">Agentic Resolution Work Desk</h2>
              <span className="pill ok text-[10px]"><i className="dot"></i> CUSTOMER &amp; CONTRACTOR OPERATIONS</span>
            </div>
            <p className="text-[11px] text-[#6B7C8D]">
              Stream tickets &amp; work orders on the left, inspect 360 telemetry in center, and dispatch omni-channel resolutions on the right.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          {insights.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInsightsDrawer(!showInsightsDrawer)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                showInsightsDrawer
                  ? "bg-[#F5A623]/20 border-[#F5A623] text-[#F5A623] shadow-sm"
                  : "bg-[#18222E] border-[var(--line)] text-[#B4C2D0] hover:text-[#EAF1F8]"
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 text-[#F5A623]" />
              <span>Action Insights</span>
              <span className="bg-[#F5A623] text-[#04201C] text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {insights.filter((i) => i.status === "new").length || insights.length}
              </span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-[#18222E] p-1 rounded-xl border border-[var(--line)] text-[11px]">
            <button
              type="button"
              onClick={() => setWorkWithAi(true)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                workWithAi ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-sm" : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Copilot Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setWorkWithAi(false)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                !workWithAi ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-sm" : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Direct Human Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3-Pane Body Grid (Full Height Customer & Contractor Workspace) */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* ========================================================================= */}
        {/* PANE 1: Ingress Queue Stream (Width: 3 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-3 border-r border-[var(--line)] bg-[#0C121A] flex flex-col overflow-hidden">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-[var(--line)] space-y-2 shrink-0 bg-[#0E1520]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7C8D] absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customers, contractors, sites..."
                className="w-full bg-[#18222E] text-[#EAF1F8] pl-8 pr-3 py-1.5 rounded-lg border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            {/* Audience Tabs: All, Customers, Contractors, Urgent */}
            <div className="flex items-center gap-1">
              {[
                { id: "all", label: "All" },
                { id: "customers", label: "👤 Customers" },
                { id: "contractors", label: "🛠️ Contractors" },
                { id: "urgent", label: "⚡ Urgent" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
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
              const isCtr = issue.entityType === "contractor" || issue.category?.includes("contractor") || Boolean(issue.contractor);

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
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className={`font-bold text-[11px] ${isCtr ? "text-[#F5A623]" : "text-[#2ED8B6]"}`}>
                        {issue.externalId}
                      </span>
                      {isCtr ? (
                        <span className="pill warn text-[8px] py-0 px-1 font-mono uppercase">FIELD DISPATCH</span>
                      ) : (
                        <span className="pill text-[8px] py-0 px-1 font-mono uppercase text-[#4D9FFF] border-[#4D9FFF]/30 bg-[#4D9FFF]/10">CUSTOMER</span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#6B7C8D] font-mono">{issue.createdAt || "4m ago"}</span>
                  </div>

                  <div className="text-xs font-semibold text-[#EAF1F8] line-clamp-1">{issue.summary}</div>

                  <div className="flex items-center justify-between text-[10px] pt-1">
                    <span className="text-[#B4C2D0] truncate max-w-[140px]">
                      {isCtr && issue.contractor ? `${issue.contractor.contactName} • ${issue.contractor.company}` : issue.customerName}
                    </span>
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
        {/* PANE 2: Conversation Thread & 360 Context Profile (Width: 4 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-4 border-r border-[var(--line)] bg-[#0B1017] flex flex-col overflow-hidden">
          {selectedIssue ? (
            <>
              {/* Context 360 Header Card */}
              <div className="p-4 bg-[#121A24] border-b border-[var(--line)] space-y-3 shrink-0">
                {isContractor && selectedIssue.contractor ? (
                  /* Contractor 360 Header */
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#F5A623]/20 border border-[#F5A623]/40 flex items-center justify-center text-sm font-bold text-[#F5A623]">
                          <HardHat className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[#EAF1F8]">{selectedIssue.contractor.contactName}</span>
                            <span className="pill warn text-[9px] py-0 font-mono uppercase">
                              {selectedIssue.contractor.dispatchStatus.replace(/_/g, " ")}
                            </span>
                          </div>
                          <span className="text-[10px] text-[#6B7C8D] font-mono">
                            {selectedIssue.contractor.company} &bull; {selectedIssue.contractor.trade}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-[#2ED8B6] font-mono">ETA: {selectedIssue.contractor.eta || "En Route"}</div>
                        <span className="text-[9px] text-[#6B7C8D] font-mono">{selectedIssue.contractor.workOrderId}</span>
                      </div>
                    </div>

                    {/* Site Location & Access Pin Banner */}
                    <div className="p-2.5 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 text-[#EAF1F8] text-[11px] truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#E5484D] shrink-0" />
                        <span className="truncate">{selectedIssue.contractor.siteLocation}</span>
                      </div>
                      <span className="pill text-[9.5px] font-mono text-[#2ED8B6] border-[#2ED8B6]/40 bg-[#2ED8B6]/10 shrink-0">
                        {selectedIssue.contractor.accessCode || "PIN: 7729"}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Customer 360 Header */
                  <div className="space-y-2.5">
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
                          <span className="text-[10px] text-[#6B7C8D] font-mono">Ref: {selectedIssue.customerRef} &bull; Channel: {selectedIssue.source.toUpperCase()}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold text-[#4CC38A] font-mono">Health: 92/100</div>
                        <span className="text-[9px] text-[#6B7C8D] font-mono">{selectedIssue.category}</span>
                      </div>
                    </div>

                    {/* Problem Correlation Badge */}
                    {selectedIssue.problemId && (
                      <button
                        type="button"
                        onClick={() => onNavigateToProblems?.()}
                        className="w-full p-2 rounded-lg bg-[#E5484D]/10 border border-[#E5484D]/30 flex items-center justify-between text-[10px] font-mono hover:bg-[#E5484D]/20 transition-all cursor-pointer text-left"
                        title="Inspect in Problem Matrix"
                      >
                        <div className="flex items-center gap-1.5 text-[#E5484D]">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Correlated Incident: <strong>{selectedIssue.problemId}</strong></span>
                        </div>
                        <span className="pill err text-[8.5px] flex items-center gap-1">
                          <span>VIEW MATRIX</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Message Transcript Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="text-center text-[10px] text-[#6B7C8D] font-mono">
                  {isContractor ? `Work Order #${selectedIssue.externalId} • Field Dispatch Stream` : `Ticket #${selectedIssue.externalId} • Ingress Stream from ${selectedIssue.source.toUpperCase()}`}
                </div>

                {/* Inbound Ticket / Dispatch Request */}
                <div className="flex items-start gap-2.5 max-w-[90%]">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                    isContractor ? "bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40" : "bg-[#18222E] border border-[var(--line)] text-[#E5484D]"
                  }`}>
                    {isContractor ? <HardHat className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7C8D]">
                      <span>{isContractor && selectedIssue.contractor ? selectedIssue.contractor.contactName : selectedIssue.customerName}</span>
                      <span>{selectedIssue.createdAt || "Just now"}</span>
                    </div>
                    <div className="p-3 rounded-2xl rounded-tl-none bg-[#18222E] border border-[var(--line-2)] text-xs text-[#EAF1F8] leading-relaxed">
                      <p className="font-semibold text-white mb-1">{selectedIssue.summary}</p>
                      <p className="text-[11px] text-[#B4C2D0]">
                        {isContractor && selectedIssue.contractor
                          ? `Field work order dispatched for ${selectedIssue.contractor.siteLocation}. Technician on record: ${selectedIssue.contractor.contactName} (${selectedIssue.contractor.trade}).`
                          : `"We are experiencing disruption with ${selectedIssue.product} on version ${selectedIssue.version}. Please advise on resolution."`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Workforce Spine Context Analysis */}
                <div className="p-3 rounded-xl bg-[#2ED8B6]/8 border border-[#2ED8B6]/25 space-y-1.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-[#2ED8B6] font-bold text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5" />
                      <span>AI Workforce Spine Analysis</span>
                    </span>
                    <span className="text-[10px] text-[#4CC38A]">{(selectedIssue.confidence * 100).toFixed(0)}% Confidence</span>
                  </div>
                  <p className="text-[11px] text-[#B4C2D0] leading-relaxed">
                    {selectedIssue.recommendedAction}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#6B7C8D]">
              Select a ticket or work order to inspect details.
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PANE 3: Omnichannel Communication & Dispatch Station (Width: 5 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-5 bg-[#121A24] flex flex-col overflow-y-auto p-5 space-y-4">
          {/* Channel Selector Header */}
          <div className="space-y-2 pb-3 border-b border-[var(--line)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#EAF1F8] flex items-center gap-1.5 font-mono">
                {isContractor ? <Truck className="w-3.5 h-3.5 text-[#F5A623]" /> : <Send className="w-3.5 h-3.5 text-[#2ED8B6]" />}
                <span>{isContractor ? "Contractor & Field Dispatch Station" : "Customer Reply & Dispatch Station"}</span>
              </span>
              <span className={`pill ${workWithAi ? "ok" : "route"} text-[10px] font-mono`}>
                {workWithAi ? "AI ASSISTED" : "MANUAL MODE"}
              </span>
            </div>

            {/* Omnichannel Channel Buttons (Customer vs Contractor Channels) */}
            <div className="grid grid-cols-5 gap-1 bg-[#18222E] p-1 rounded-xl border border-[var(--line)] text-xs">
              {isContractor ? (
                <>
                  {[
                    { id: "contractor_sms", label: "Field SMS", icon: Smartphone },
                    { id: "work_order_push", label: "Tech App", icon: FileCheck },
                    { id: "site_pass", label: "Site PIN", icon: Key },
                    { id: "voice", label: "Call Tech", icon: Phone },
                    { id: "internal_note", label: "SRE Note", icon: FileText },
                  ].map((ch) => {
                    const Icon = ch.icon;
                    const isActive = commChannel === ch.id;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          setCommChannel(ch.id as any);
                          onNotify(`Switched contractor communication to ${ch.label}`, "info");
                        }}
                        className={`py-1.5 px-1 rounded-lg font-mono text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#F5A623] text-[#04201C] shadow-sm font-extrabold"
                            : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate">{ch.label}</span>
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
                        onClick={() => {
                          setCommChannel(ch.id as any);
                          onNotify(`Switched customer response to ${ch.label}`, "info");
                        }}
                        className={`py-1.5 px-1 rounded-lg font-mono text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-extrabold"
                            : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate">{ch.label}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* AI Response Tone & Parameters */}
          {workWithAi && (
            <div className="space-y-2 p-3 bg-[#18222E] rounded-xl border border-[var(--line-2)] text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#EAF1F8] flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>AI Copilot Style</span>
                </span>
                <button
                  type="button"
                  onClick={handleTriggerGenerateAi}
                  disabled={isGeneratingAi}
                  className="text-[10px] font-mono text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isGeneratingAi ? "animate-spin" : ""}`} />
                  <span>Regenerate</span>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
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
                        className={`py-1 px-1 text-[10px] font-mono rounded-lg transition-all cursor-pointer text-center truncate ${
                          aiTone === t.id
                            ? "bg-[#F5A623]/20 border border-[#F5A623] text-[#F5A623] font-bold"
                            : "bg-[#121A24] text-[#6B7C8D] hover:text-[#EAF1F8] border border-transparent"
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
                        className={`py-1 px-1 text-[10px] font-mono rounded-lg transition-all cursor-pointer text-center truncate ${
                          aiTone === t.id
                            ? "bg-[#2ED8B6]/20 border border-[#2ED8B6] text-[#2ED8B6] font-bold"
                            : "bg-[#121A24] text-[#6B7C8D] hover:text-[#EAF1F8] border border-transparent"
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
          <div className="space-y-1.5 flex-1 flex flex-col">
            <div className="flex items-center justify-between text-xs">
              <label className="text-[#6B7C8D] font-mono text-[10.5px]">
                {isContractor ? "Contractor Dispatch Message / SOW Checklist" : "Customer Message Content"}
              </label>
              <span className="text-[10px] text-[#6B7C8D] font-mono">{replyText.length} chars</span>
            </div>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={9}
              className="w-full flex-1 bg-[#18222E] text-[#EAF1F8] p-3 rounded-xl border border-[var(--line-2)] text-xs font-mono leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
              placeholder={isContractor ? "Type instructions for on-site technician..." : "Compose customer reply..."}
            />
          </div>

          {/* Action Dispatch Buttons */}
          <div className="space-y-2.5 pt-2 border-t border-[var(--line)]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSendReply}
                disabled={!replyText.trim()}
                className="btn btn-secondary py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isContractor ? "Dispatch to Tech" : "Send Reply Only"}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  handleSendReply();
                  await handleExecuteAutonomousResolution();
                }}
                disabled={isProcessing || !replyText.trim()}
                className="btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{isContractor ? "⚡ Complete Work Order" : "⚡ Send & Auto-Resolve"}</span>
              </button>
            </div>

            {/* Contractor-specific Quick Actions */}
            {isContractor && selectedIssue?.contractor && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendSitePass}
                  className="btn btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 font-mono text-[#2ED8B6] hover:border-[#2ED8B6] cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Send Site PIN &amp; GPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => onEscalate && selectedIssue && onEscalate(selectedIssue)}
                  className="btn btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-1.5 font-mono hover:text-[#F5A623] hover:border-[#F5A623] cursor-pointer"
                >
                  <HardHat className="w-3.5 h-3.5 text-[#F5A623]" />
                  <span>Reassign Field Crew</span>
                </button>
              </div>
            )}

            {/* Direct Escalation Action for Customers */}
            {!isContractor && (
              <button
                type="button"
                onClick={() => onEscalate && selectedIssue && onEscalate(selectedIssue)}
                className="btn btn-secondary w-full py-2 text-xs flex items-center justify-center gap-2 font-mono hover:text-[#F5A623] hover:border-[#F5A623] cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>Escalate Priority &amp; Re-assign Personnel</span>
              </button>
            )}
          </div>

          {/* Autonomy Safety Policy Guarantee */}
          <div className="p-2.5 rounded-xl bg-[#0B1017] border border-[var(--line)] flex items-center gap-2 text-[10px] text-[#6B7C8D] font-mono">
            <Shield className="w-3.5 h-3.5 text-[#4CC38A] shrink-0" />
            <span>SupportV8 Terminal Resolution: Customer tickets &amp; field work orders unified under Temporal Workforce Spine.</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTION INSIGHTS & AI INTERVENTION QUEUE (BOTTOM COLLAPSIBLE DRAWER) */}
      {/* ========================================================================= */}
      {showInsightsDrawer && insights.length > 0 && (
        <div className="bg-[#0B1017] border-t-2 border-[#F5A623]/60 p-4 shrink-0 space-y-3 transition-all max-h-[300px] overflow-y-auto z-20 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="p-1.5 rounded-lg bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/30">
                <Wand2 className="w-4 h-4" />
              </span>
              <span className="font-bold text-[#EAF1F8] uppercase tracking-wider">
                Action Insights &amp; AI Intervention Queue
              </span>
              <span className="text-[10px] text-[#6B7C8D]">
                (Aggregated from Trend Radar &amp; Outage Telemetry)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowInsightsDrawer(false)}
              className="text-[11px] font-mono text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Hide Queue</span>
              <span>✕</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="p-3.5 rounded-xl bg-[#121A24] border border-[var(--line)] hover:border-[#F5A623]/60 space-y-2 text-xs transition-all shadow-md flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-[#EAF1F8] text-[11.5px] leading-snug">
                      {ins.title}
                    </h4>
                    <span className="pill ok text-[8.5px] font-mono shrink-0">
                      {(ins.confidence * 100).toFixed(0)}% AI Confidence
                    </span>
                  </div>
                  <p className="text-[11px] text-[#B4C2D0] leading-relaxed line-clamp-2">
                    {ins.finding}
                  </p>
                  <div className="p-2 rounded-lg bg-[#18222E] border border-[var(--line-2)] text-[10.5px] text-[#EAF1F8] font-mono">
                    <span className="text-[#F5A623] font-bold">Action: </span>
                    <span>{ins.recommendation}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-2">
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
                      onNotify(`Filtered Work Desk queue to tickets matching insight: ${ins.title}`, "info");
                    }}
                    className="text-[10px] font-mono text-[#4D9FFF] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <span>Filter Queue</span>
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
                          onNotify(`Executed insight '${ins.title}' via Action Gateway`, "success");
                        }
                      } finally {
                        setExecutingInsightId(null);
                      }
                    }}
                    className="btn btn-primary py-1 px-2.5 text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-sm disabled:opacity-50"
                  >
                    <Zap className="w-3 h-3" />
                    <span>{executingInsightId === ins.id ? "Executing..." : "Execute Action"}</span>
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

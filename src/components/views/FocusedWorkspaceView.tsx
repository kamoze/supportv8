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
  Layers,
  AlertTriangle,
  Users,
  Plus,
  Upload,
  Edit3,
  CheckCircle2,
  X,
  Sliders,
  Smile,
  Frown,
  Meh,
  AlertCircle,
  Radio,
  Check,
  Copy,
} from "lucide-react";
import type { Issue, SentimentClass, PriorityLevel } from "@/lib/types";
import { ChatWorkflowService } from "@/lib/services/chat-workflow-service";

interface FocusedWorkspaceViewProps {
  issues: Issue[];
  problems?: any[];
  insights?: any[];
  userRole?: string;
  onResolve: (issueId: string) => Promise<void> | void;
  onProcessRefund?: (issueId: string, amount: string) => Promise<void> | void;
  onEscalate: (issue: Issue) => void;
  onNavigateToProblems: () => void;
  onExecuteInsight: (insightId: string) => void;
  onUpdateIssue?: (issue: Issue) => void;
  onCreateIssue?: (issue: Issue) => void;
  onImportIssues?: (issues: Issue[]) => void;
  onNotify: (msg: string, type?: "success" | "error" | "info") => void;
}

export function FocusedWorkspaceView({
  issues,
  problems = [],
  insights = [],
  userRole = "operator",
  onResolve,
  onProcessRefund,
  onEscalate,
  onNavigateToProblems,
  onExecuteInsight,
  onUpdateIssue,
  onCreateIssue,
  onImportIssues,
  onNotify,
}: FocusedWorkspaceViewProps) {
  const isContractorUser = userRole === "contractor" || userRole === "technician" || userRole === "contractor_lead";
  const [selectedIssueId, setSelectedIssueId] = useState<string>(issues[0]?.id || "");
  const [filterType, setFilterType] = useState<"all" | "customers" | "contractors" | "urgent">(
    isContractorUser ? "contractors" : "all"
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showInsightsDrawer, setShowInsightsDrawer] = useState<boolean>(false);
  const [executingInsightId, setExecutingInsightId] = useState<string | null>(null);

  // Mobile Screen Pane Switcher State
  const [mobileActivePane, setMobileActivePane] = useState<"queue" | "details" | "actions">(
    isContractorUser ? "details" : "queue"
  );
  const [copiedPin, setCopiedPin] = useState(false);

  const handleCopyPin = (pin: string) => {
    try {
      navigator.clipboard.writeText(pin);
      setCopiedPin(true);
      onNotify(`Copied Lockbox PIN ${pin} to clipboard`, "success");
      setTimeout(() => setCopiedPin(false), 2000);
    } catch {
      onNotify(`Lockbox PIN: ${pin}`, "info");
    }
  };

  // Priority Fast-Track / Front of Line State
  const [frontOfLineIssueIds, setFrontOfLineIssueIds] = useState<string[]>([]);

  const handleToggleFrontOfLine = (issueId: string) => {
    setFrontOfLineIssueIds((prev) => {
      const isPinned = prev.includes(issueId);
      const target = issues.find((i) => i.id === issueId);
      const extId = target?.externalId || issueId;
      if (isPinned) {
        onNotify(`Removed ticket ${extId} from front of line`, "info");
        return prev.filter((id) => id !== issueId);
      } else {
        onNotify(`⚡ Ticket ${extId} moved to FRONT OF LINE triage queue`, "success");
        setSelectedIssueId(issueId);
        return [issueId, ...prev.filter((id) => id !== issueId)];
      }
    });
  };

  // Communication & AI Mode State
  const [commChannel, setCommChannel] = useState<"chat" | "email" | "whatsapp" | "voice" | "internal_note" | "contractor_sms" | "work_order_push" | "site_pass">("chat");
  const [workWithAi, setWorkWithAi] = useState<boolean>(true);
  const [aiTone, setAiTone] = useState<"empathetic" | "technical" | "concise" | "executive" | "sow_instructions" | "safety_protocol" | "urgent_expedite">("empathetic");
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState<boolean>(false);
  const [isCsvImportModalOpen, setIsCsvImportModalOpen] = useState<boolean>(false);

  // Edit State
  const [editSummary, setEditSummary] = useState("");
  const [editPriority, setEditPriority] = useState<PriorityLevel>("normal");
  const [editStatus, setEditStatus] = useState<Issue["status"]>("open");
  const [editSentiment, setEditSentiment] = useState<SentimentClass>("neutral");
  const [editAssignee, setEditAssignee] = useState("");
  const [editTags, setEditTags] = useState("");

  // New Ticket State
  const [newCustName, setNewCustName] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [newCategory, setNewCategory] = useState("customers");
  const [newPriority, setNewPriority] = useState<PriorityLevel>("normal");
  const [newChannel, setNewChannel] = useState<string>("web_chat");

  // CSV Import State
  const [csvText, setCsvText] = useState("");
  const [csvPreviewCount, setCsvPreviewCount] = useState(0);

  // Live Chat Operator Takeover State
  const [operatorReplyText, setOperatorReplyText] = useState("");
  const [isSendingOperatorReply, setIsSendingOperatorReply] = useState(false);
  const [liveChatSessionKey, setLiveChatSessionKey] = useState(0);
  const [forceStandardComposer, setForceStandardComposer] = useState(false);

  const selectedIssue = issues.find((i) => i.id === selectedIssueId) || issues[0];
  const isContractor = selectedIssue?.entityType === "contractor" || selectedIssue?.category?.includes("contractor") || Boolean(selectedIssue?.contractor);

  // Technician Workflow State Machine
  const [techStatus, setTechStatus] = useState<"assigned" | "accepted" | "en_route" | "in_progress" | "completed" | "released">("assigned");

  const isChatTicket = selectedIssue?.source === "chat" || selectedIssue?.externalId?.startsWith("SV8-CHAT-");
  const matchingChatSession = isChatTicket
    ? ChatWorkflowService.listSessions().find(
        (s) =>
          (selectedIssue?.externalId && s.id.includes(selectedIssue.externalId.replace("SV8-CHAT-", ""))) ||
          s.customerName === selectedIssue?.customerName
      )
    : null;

  // Initialize edit fields when selected issue changes
  useEffect(() => {
    if (selectedIssue) {
      setEditSummary(selectedIssue.summary);
      setEditPriority(selectedIssue.priority || "normal");
      setEditStatus(selectedIssue.status);
      setEditSentiment(selectedIssue.sentiment || "neutral");
      setEditAssignee(selectedIssue.assignedTo || "Unassigned");
      setEditTags(selectedIssue.tags?.join(", ") || "");
      setForceStandardComposer(false);
      if (selectedIssue.contractor) {
        setTechStatus("assigned");
      }
    }
  }, [selectedIssueId]);

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

  // Triage queue sorting: Front-of-line pinned tickets first, then urgent/high priority, then newest
  const sortedIssues = [...filteredIssues].sort((a, b) => {
    const aPinned = frontOfLineIssueIds.includes(a.id);
    const bPinned = frontOfLineIssueIds.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (aPinned && bPinned) {
      return frontOfLineIssueIds.indexOf(a.id) - frontOfLineIssueIds.indexOf(b.id);
    }

    const prioOrder: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };
    const aPrio = prioOrder[a.priority || "normal"] || 2;
    const bPrio = prioOrder[b.priority || "normal"] || 2;
    if (aPrio !== bPrio) return bPrio - aPrio;

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const handleExecuteAutonomousResolution = async () => {
    if (!selectedIssue) return;
    setIsProcessing(true);
    try {
      await onResolve(selectedIssue.id);
      onNotify(
        isContractor
          ? `Work order ${selectedIssue.externalId} completed. Work summary dispatched to contractor & logged in Issues Explorer.`
          : `Ticket ${selectedIssue.externalId} resolved. Confirmation email sent to ${selectedIssue.customerName} via Resend.`,
        "success"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendReply = () => {
    if (!selectedIssue || !replyText.trim()) return;
    onNotify(
      `Dispatched reply via ${commChannel.toUpperCase()} to ${
        isContractor && selectedIssue.contractor ? selectedIssue.contractor.contactName : selectedIssue.customerName
      }`,
      "success"
    );
  };

  const handleSendSitePass = () => {
    if (!selectedIssue?.contractor) return;
    onNotify(
      `Dispatched Electronic Lockbox PIN (${selectedIssue.contractor.accessCode || "LOCK-8841"}) & GPS to ${selectedIssue.contractor.contactName}`,
      "success"
    );
  };

  // Live Update Sentiment
  const handleUpdateSentiment = (sentiment: SentimentClass) => {
    if (!selectedIssue) return;
    const updated = { ...selectedIssue, sentiment };
    if (onUpdateIssue) {
      onUpdateIssue(updated);
    }
    setEditSentiment(sentiment);
    onNotify(`Updated sentiment for ${selectedIssue.externalId} to ${sentiment.toUpperCase()}`, "info");
  };

  // Save Edit Ticket Modal
  const handleSaveEditTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;

    const updated: Issue = {
      ...selectedIssue,
      summary: editSummary,
      priority: editPriority,
      status: editStatus,
      sentiment: editSentiment,
      tags: editTags ? editTags.split(",").map((t) => t.trim()) : selectedIssue.tags,
    };

    if (onUpdateIssue) {
      onUpdateIssue(updated);
    }
    setIsEditModalOpen(false);
    onNotify(`Saved changes for ticket ${selectedIssue.externalId}`, "success");
  };

  // Create Manual Ticket
  const handleCreateManualTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newSummary.trim()) {
      onNotify("Please provide both customer name and summary", "error");
      return;
    }

    const seqNumber = Math.floor(1000 + Math.random() * 9000);
    const newId = `iss_${Date.now()}`;
    const newExtId = `SV8-TK-${seqNumber}`;

    const newTicket: Issue = {
      id: newId,
      tenantId: "tenant_default",
      externalId: newExtId,
      source: "chat",
      sourceUrl: "https://support.servicev8.com/tickets/" + newExtId,
      customerRef: "cust_" + Math.random().toString(36).substring(2, 7),
      entityType: newCategory === "contractors" ? "contractor" : "customer",
      customerName: newCustName,
      customerTier: "standard",
      summary: newSummary,
      category: newCategory === "contractors" ? "contractor_dispatch" : "general_support",
      product: "Platform Support",
      version: "3.2.0",
      status: "open",
      sourceStatus: "open",
      priority: newPriority,
      sentiment: "neutral",
      sentimentScore: 0.1,
      sentimentTrajectory: "stable",
      confidence: 0.95,
      businessImpact: "medium",
      resolutionRiskScore: 0.2,
      recommendedAction: "Review customer request and assign appropriate support engineer.",
      tags: ["manual_ingest", newCategory],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (onCreateIssue) {
      onCreateIssue(newTicket);
    }
    setSelectedIssueId(newId);
    setIsNewTicketModalOpen(false);
    setNewCustName("");
    setNewSummary("");
    onNotify(`Created ticket ${newExtId} with unique sequence number`, "success");
  };

  // CSV Import Parse
  const handleCsvTextChange = (text: string) => {
    setCsvText(text);
    const lines = text.trim().split("\n").filter((l) => l.trim().length > 0);
    setCsvPreviewCount(Math.max(0, lines.length - 1)); // minus header
  };

  const handleProcessCsvImport = () => {
    const lines = csvText.trim().split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      onNotify("CSV must have a header row and at least one data row", "error");
      return;
    }

    const importedList: Issue[] = [];
    // Assume columns: Customer, Summary, Priority, Category (or fallback)
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      const cust = parts[0] || `Customer ${i}`;
      const summ = parts[1] || "Ingested issue from spreadsheet";
      const prio = (parts[2]?.toLowerCase() as PriorityLevel) || "normal";
      const cat = parts[3] || "csv_import";
      const seq = 1000 + i;

      importedList.push({
        id: `iss_csv_${Date.now()}_${i}`,
        tenantId: "tenant_default",
        externalId: `SV8-CSV-${seq}`,
        source: "email",
        sourceUrl: "https://support.servicev8.com/tickets/SV8-CSV-" + seq,
        customerRef: `cust_csv_${seq}`,
        customerName: cust,
        customerTier: "standard",
        summary: summ,
        category: cat,
        product: "Ingested Batch",
        version: "1.0",
        status: "open",
        sourceStatus: "open",
        priority: ["low", "normal", "high", "urgent"].includes(prio) ? prio : "normal",
        sentiment: "neutral",
        sentimentScore: 0.0,
        sentimentTrajectory: "stable",
        confidence: 0.9,
        businessImpact: "low",
        resolutionRiskScore: 0.1,
        recommendedAction: "Auto-assigned from bulk spreadsheet ingestion.",
        tags: ["csv_import", cat],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (onImportIssues) {
      onImportIssues(importedList);
    }
    setIsCsvImportModalOpen(false);
    setCsvText("");
    onNotify(`Successfully ingested ${importedList.length} tickets with unique sequence IDs`, "success");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B1017] text-[#EAF1F8] font-sans overflow-hidden">
      {/* ========================================================================= */}
      {/* TOP WORK DESK TOOLBAR */}
      {/* ========================================================================= */}
      <div className="px-6 py-3.5 bg-[#0E1520] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6]">
            <Sliders className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#EAF1F8] flex items-center gap-2">
              <span>Customer Care &amp; Field Resolution Work Desk</span>
              <span className="pill text-[9px] font-mono bg-[#141C26] text-[#2ED8B6] border border-[#2ED8B6]/30">
                {issues.length} Active Queue
              </span>
            </h2>
            <p className="text-[11px] font-mono text-[#6B7C8D]">
              Unified Human Operator Station • Direct Ingest &amp; Omnichannel Sync
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Create Ticket Button */}
          <button
            type="button"
            onClick={() => setIsNewTicketModalOpen(true)}
            className="btn btn-primary px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Ticket</span>
          </button>

          {/* CSV Import Button */}
          <button
            type="button"
            onClick={() => setIsCsvImportModalOpen(true)}
            className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#EAF1F8] px-3 py-2 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#4D9FFF]" />
            <span>Import CSV</span>
          </button>

          {/* Action Insights Trigger */}
          {insights.length > 0 && (
            <button
              type="button"
              onClick={() => setShowInsightsDrawer(!showInsightsDrawer)}
              className={`px-3 py-2 rounded-xl text-xs font-mono border flex items-center gap-1.5 transition-all cursor-pointer ${
                showInsightsDrawer
                  ? "bg-[#F5A623] text-[#04201C] font-bold border-[#F5A623]"
                  : "bg-[#141C26] text-[#F5A623] border-[#F5A623]/40 hover:bg-[#F5A623]/15"
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Insights ({insights.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Screen Segmented Tab Switcher (< lg) */}
      <div className="lg:hidden px-3 py-2 bg-[#121A24] border-b border-[var(--line)] flex items-center gap-1.5 shrink-0 font-mono text-xs">
        <button
          type="button"
          onClick={() => setMobileActivePane("queue")}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
            mobileActivePane === "queue"
              ? "bg-[#2ED8B6] text-[#04201C] shadow-md shadow-[#2ED8B6]/20"
              : "bg-[#18222E] text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Queue ({sortedIssues.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileActivePane("details")}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
            mobileActivePane === "details"
              ? "bg-[#2ED8B6] text-[#04201C] shadow-md shadow-[#2ED8B6]/20"
              : "bg-[#18222E] text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Details &amp; PIN</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileActivePane("actions")}
          className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer font-bold ${
            mobileActivePane === "actions"
              ? "bg-[#2ED8B6] text-[#04201C] shadow-md shadow-[#2ED8B6]/20"
              : "bg-[#18222E] text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Actions &amp; Comms</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3-COLUMN WORK DESK RESOLUTION GRID */}
      {/* ========================================================================= */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* ========================================================================= */}
        {/* PANE 1: Work Queue (Width: 3 cols on desktop, full on mobile) */}
        {/* ========================================================================= */}
        <div
          className={`col-span-12 lg:col-span-3 bg-[#0E1520] border-r border-[var(--line)] flex flex-col overflow-hidden ${
            mobileActivePane === "queue" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Filter Bar */}
          <div className="p-3 border-b border-[var(--line)] space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#6B7C8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, customer, tech..."
                className="w-full bg-[#141C26] text-xs text-[#EAF1F8] pl-8 pr-3 py-1.5 rounded-xl border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
              {[
                { id: "all", label: "All" },
                { id: "customers", label: "Customer" },
                { id: "contractors", label: "Field Ops" },
                { id: "urgent", label: "Urgent" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterType(f.id as any)}
                  className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
                    filterType === f.id
                      ? "bg-[#2ED8B6] text-[#04201C] font-bold"
                      : "bg-[#141C26] text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Queue Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sortedIssues.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-[#6B7C8D]">
                No active tickets in queue.
              </div>
            ) : (
              sortedIssues.map((issue) => {
                const isSelected = issue.id === selectedIssueId;
                const isCtr = issue.entityType === "contractor" || issue.category?.includes("contractor") || Boolean(issue.contractor);
                const isFrontOfLine = frontOfLineIssueIds.includes(issue.id);
                const isPriority = issue.priority === "urgent" || issue.priority === "high" || issue.sentiment === "urgent" || issue.sentiment === "angry";
                const isNew = issue.status === "open" || issue.tags?.includes("manual_ingest") || issue.tags?.includes("new");

                return (
                  <div
                    key={issue.id}
                    onClick={() => {
                      setSelectedIssueId(issue.id);
                      setMobileActivePane("details");
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-2 relative overflow-hidden group ${
                      isFrontOfLine
                        ? "bg-[#182333] border-[#F5A623] shadow-[0_0_16px_rgba(245,166,35,0.25)] ring-1 ring-[#F5A623]/70"
                        : isSelected
                        ? "bg-[#18222E] border-[#2ED8B6] shadow-lg shadow-[#2ED8B6]/15 ring-1 ring-[#2ED8B6]/50"
                        : isPriority
                        ? "bg-[#141C26] border-[#E5484D]/60 hover:border-[#E5484D] shadow-[0_0_10px_rgba(229,72,77,0.15)] ring-1 ring-[#E5484D]/30 animate-pulse"
                        : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40"
                    }`}
                  >
                    {/* Top Row: External ID, Pulse Tags, Priority, Front of Line button */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isCtr ? (
                          <HardHat className="w-3.5 h-3.5 text-[#F5A623] shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-[#2ED8B6] shrink-0" />
                        )}
                        <span className="font-mono font-extrabold text-[#EAF1F8]">{issue.externalId}</span>

                        {/* Front of Line Badge */}
                        {isFrontOfLine && (
                          <span className="pill text-[8.5px] font-mono bg-[#F5A623]/25 text-[#F5A623] border border-[#F5A623]/60 flex items-center gap-1 font-bold animate-pulse">
                            <Zap className="w-2.5 h-2.5 fill-[#F5A623]" />
                            <span>FRONT OF LINE</span>
                          </span>
                        )}

                        {/* Pulsing New Badge */}
                        {!isFrontOfLine && isNew && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 text-[8.5px] font-mono font-bold text-[#2ED8B6]">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2ED8B6] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2ED8B6]"></span>
                            </span>
                            <span>NEW</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Pulsing Urgent/High Priority Badge */}
                        {isPriority ? (
                          <span className="pill text-[9px] uppercase font-mono err font-bold animate-pulse flex items-center gap-1">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E5484D] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E5484D]"></span>
                            </span>
                            <Flame className="w-2.5 h-2.5 text-[#E5484D]" />
                            <span>{issue.priority}</span>
                          </span>
                        ) : (
                          <span className="pill text-[9px] uppercase font-mono ok">
                            {issue.priority}
                          </span>
                        )}

                        {/* Quick Action: Move to Front of Line */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFrontOfLine(issue.id);
                          }}
                          className={`p-1 rounded-lg text-[10px] font-mono flex items-center gap-0.5 transition-all cursor-pointer ${
                            isFrontOfLine
                              ? "bg-[#F5A623] text-[#04201C] font-bold shadow-sm"
                              : "bg-[#141C26] text-[#8E9AA8] hover:text-[#F5A623] hover:bg-[#1C2838] border border-[var(--line-2)]"
                          }`}
                          title={isFrontOfLine ? "Demote from front of line" : "⚡ Move to Front of Line"}
                        >
                          <Zap className={`w-3 h-3 ${isFrontOfLine ? "fill-[#04201C]" : ""}`} />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-xs font-semibold text-[#B4C2D0] line-clamp-1 group-hover:text-[#EAF1F8] transition-colors">
                      {issue.summary}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                      <span>{isCtr && issue.contractor ? issue.contractor.company : issue.customerName}</span>
                      <span className="text-[#2ED8B6] font-semibold">{issue.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANE 2: Ticket Details & Context (Width: 4 cols on desktop, full on mobile) */}
        {/* ========================================================================= */}
        <div
          className={`col-span-12 lg:col-span-4 bg-[#0B1017] border-r border-[var(--line)] flex flex-col overflow-y-auto p-3.5 sm:p-4 space-y-4 ${
            mobileActivePane === "details" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Mobile Back Button */}
          <div className="lg:hidden flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => setMobileActivePane("queue")}
              className="text-xs font-mono text-[#6B7C8D] hover:text-[#2ED8B6] flex items-center gap-1 cursor-pointer"
            >
              ← Back to Queue
            </button>
            <button
              type="button"
              onClick={() => setMobileActivePane("actions")}
              className="text-xs font-mono text-[#2ED8B6] flex items-center gap-1 cursor-pointer font-bold"
            >
              <span>Go to Actions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {selectedIssue ? (
            <>
              {/* Ticket Details Card */}
              <div className="card p-4 bg-[#121A24] border-[var(--line)] rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-[#EAF1F8]">
                      {selectedIssue.externalId}
                    </span>
                    <span className="pill text-[9px] font-mono bg-[#18222E] text-[#2ED8B6] uppercase">
                      {selectedIssue.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Front of Line Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleFrontOfLine(selectedIssue.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 cursor-pointer transition-all border ${
                        frontOfLineIssueIds.includes(selectedIssue.id)
                          ? "bg-[#F5A623] text-[#04201C] border-[#F5A623] font-bold shadow-md shadow-[#F5A623]/25"
                          : "bg-[#18222E] hover:bg-[#1E2B3A] text-[#F5A623] border-[#F5A623]/40"
                      }`}
                      title={frontOfLineIssueIds.includes(selectedIssue.id) ? "Remove from Front of Line" : "Move to Front of Line"}
                    >
                      <Zap className={`w-3.5 h-3.5 ${frontOfLineIssueIds.includes(selectedIssue.id) ? "fill-[#04201C]" : ""}`} />
                      <span>{frontOfLineIssueIds.includes(selectedIssue.id) ? "Front of Line" : "Move to Front"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="p-1.5 rounded-lg bg-[#18222E] hover:bg-[#1E2B3A] text-xs font-mono text-[#2ED8B6] flex items-center gap-1 cursor-pointer border border-[var(--line-2)]"
                      title="Edit Ticket Details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>

                {/* Priority Fast-Track Notification Banner */}
                {frontOfLineIssueIds.includes(selectedIssue.id) && (
                  <div className="p-2.5 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/50 text-xs font-mono text-[#F5A623] flex items-center justify-between animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 fill-[#F5A623] shrink-0" />
                      <span className="font-bold">PRIORITY FRONT OF LINE ACTIVE</span>
                    </div>
                    <span className="text-[10px] text-[#B4C2D0]">Elevated to top of triage queue</span>
                  </div>
                )}

                <h3 className="text-xs sm:text-sm font-bold text-[#EAF1F8]">
                  {selectedIssue.summary}
                </h3>

                {/* Sentiment & Priority Controls */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded-xl bg-[#141C26] border border-[var(--line)] space-y-1">
                    <span className="text-[10px] text-[#6B7C8D] block">Live Sentiment</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedIssue.sentiment || "neutral"}
                        onChange={(e) => handleUpdateSentiment(e.target.value as SentimentClass)}
                        className="bg-[#18222E] text-xs text-[#EAF1F8] rounded-lg px-2 py-1 border border-[var(--line-2)] focus:outline-none cursor-pointer w-full"
                      >
                        <option value="positive">Positive 😊</option>
                        <option value="neutral">Neutral 😐</option>
                        <option value="frustrated">Frustrated 😟</option>
                        <option value="angry">Angry 😡</option>
                        <option value="urgent">Urgent 🚨</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[#141C26] border border-[var(--line)] space-y-1">
                    <span className="text-[10px] text-[#6B7C8D] block">Priority Tier</span>
                    <span className="text-xs font-bold text-[#F5A623] uppercase">
                      {selectedIssue.priority}
                    </span>
                  </div>
                </div>

                {/* Mobile-Optimized Field Ops & Lockbox Command Card */}
                {isContractor && selectedIssue.contractor && (
                  <div className="space-y-2.5 pt-1">
                    {/* Electronic Lockbox PIN Card */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#182333] to-[#121A24] border border-[#F5A623]/50 space-y-2.5 shadow-lg shadow-black/40">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#F5A623]">
                          <Key className="w-4 h-4" />
                          <span>ELECTRONIC LOCKBOX PIN</span>
                        </span>
                        <span className="pill text-[9px] font-mono bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40 uppercase font-bold">
                          Active Pass
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-[#0C121A] border border-[var(--line-2)] flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-mono text-[#8E9AA8] uppercase">Security Access Code</span>
                          <div className="text-xl sm:text-2xl font-mono font-extrabold text-[#EAF1F8] tracking-widest">
                            {selectedIssue.contractor.accessCode || "LOCK-8841"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCopyPin(selectedIssue.contractor?.accessCode || "LOCK-8841")}
                          className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            copiedPin
                              ? "bg-[#2ED8B6] text-[#04201C] shadow-md shadow-[#2ED8B6]/30"
                              : "bg-[#18222E] hover:bg-[#1E2B3A] text-[#F5A623] border border-[#F5A623]/40"
                          }`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedPin ? "Copied!" : "Copy PIN"}</span>
                        </button>
                      </div>

                      {/* Site Address & 1-Touch GPS Navigation */}
                      <div className="space-y-1 text-xs">
                        <span className="text-[10px] font-mono text-[#8E9AA8] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#F5A623]" />
                          <span>Job Site Location</span>
                        </span>
                        <p className="font-semibold text-[#EAF1F8]">{selectedIssue.contractor.siteLocation}</p>
                      </div>

                      {/* Mobile Field Quick Action Buttons (Call, Maps, SMS) */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(selectedIssue.contractor.siteLocation)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-[#141C26] hover:bg-[#1A2534] border border-[var(--line-2)] text-xs font-mono font-bold text-[#4D9FFF] flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Open Maps</span>
                        </a>

                        <a
                          href="tel:+18005558880"
                          className="p-2.5 rounded-xl bg-[#141C26] hover:bg-[#1A2534] border border-[var(--line-2)] text-xs font-mono font-bold text-[#2ED8B6] flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Call Dispatch</span>
                        </a>
                      </div>
                    </div>

                    {/* Technician Dispatch State Machine Bar */}
                    <div className="p-3.5 rounded-2xl bg-[#141C26] border border-[var(--line)] space-y-2 text-xs font-mono">
                      <div className="flex items-center justify-between text-[#F5A623]">
                        <span className="flex items-center gap-1 font-bold">
                          <Truck className="w-4 h-4" />
                          <span>Technician Dispatch State</span>
                        </span>
                        <span className="pill text-[9px] uppercase bg-[#0C121A] text-[#F5A623] border border-[#F5A623]/30 font-bold">
                          {techStatus.replace("_", " ")}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setTechStatus("accepted");
                            onNotify(`Technician accepted Work Order ${selectedIssue.externalId}`, "info");
                          }}
                          className={`py-2 rounded-xl text-[11px] font-bold text-center cursor-pointer transition-all active:scale-95 ${
                            techStatus === "accepted" ? "bg-[#2ED8B6] text-[#04201C] shadow-md shadow-[#2ED8B6]/20" : "bg-[#18222E] text-[#B4C2D0] hover:bg-[#1E2B3A]"
                          }`}
                        >
                          Accept
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTechStatus("en_route");
                            onNotify(`Technician marked En Route for ${selectedIssue.contractor?.siteLocation}`, "info");
                          }}
                          className={`py-2 rounded-xl text-[11px] font-bold text-center cursor-pointer transition-all active:scale-95 ${
                            techStatus === "en_route" ? "bg-[#F5A623] text-[#04201C] shadow-md shadow-[#F5A623]/20" : "bg-[#18222E] text-[#B4C2D0] hover:bg-[#1E2B3A]"
                          }`}
                        >
                          En Route
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTechStatus("completed");
                            onNotify(`Work Order ${selectedIssue.externalId} completed & released`, "success");
                          }}
                          className={`py-2 rounded-xl text-[11px] font-bold text-center cursor-pointer transition-all active:scale-95 ${
                            techStatus === "completed" ? "bg-[#4CC38A] text-[#04201C] shadow-md shadow-[#4CC38A]/20" : "bg-[#18222E] text-[#B4C2D0] hover:bg-[#1E2B3A]"
                          }`}
                        >
                          Complete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Message / Issue Transcript Stream */}
              <div className="card p-4 bg-[#121A24] border-[var(--line)] rounded-2xl space-y-2 flex-1 flex flex-col">
                <div className="text-[11px] font-mono text-[#8E9AA8] border-b border-[var(--line)] pb-2 flex items-center justify-between">
                  <span>Inbound Request Transcript</span>
                  <span className="text-[#2ED8B6]">{selectedIssue.source}</span>
                </div>

                <div className="p-3 rounded-xl bg-[#0E1520] border border-[var(--line)] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                    <span className="font-bold text-[#EAF1F8]">{selectedIssue.customerName}</span>
                    <span>{selectedIssue.createdAt ? "Recent" : "Just now"}</span>
                  </div>
                  <p className="text-[#B4C2D0] leading-relaxed">{selectedIssue.summary}</p>
                </div>

                {/* Copilot Recommendation */}
                <div className="p-3 rounded-xl bg-[#14202B] border border-[#2ED8B6]/30 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[#2ED8B6] font-bold text-[11px]">
                    <span className="flex items-center gap-1">
                      <Bot className="w-3.5 h-3.5" />
                      <span>Copilot Suggested Action</span>
                    </span>
                    <span className="text-[#4CC38A]">{(selectedIssue.confidence * 100).toFixed(0)}% Match</span>
                  </div>
                  <p className="text-[11px] text-[#B4C2D0]">{selectedIssue.recommendedAction}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs font-mono text-[#6B7C8D]">
              Select a ticket to inspect details.
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PANE 3: Resolution & Dispatch Station (Width: 5 cols on desktop, full on mobile) */}
        {/* ========================================================================= */}
        <div
          className={`col-span-12 lg:col-span-5 bg-[#101620] flex flex-col overflow-y-auto p-3.5 sm:p-4 space-y-4 ${
            mobileActivePane === "actions" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Mobile Back Button to Details */}
          <div className="lg:hidden flex items-center justify-between pb-1">
            <button
              type="button"
              onClick={() => setMobileActivePane("details")}
              className="text-xs font-mono text-[#6B7C8D] hover:text-[#2ED8B6] flex items-center gap-1 cursor-pointer"
            >
              ← Back to Details &amp; PIN
            </button>
            <span className="text-[10px] font-mono text-[#2ED8B6]">Dispatch Station</span>
          </div>

          {/* ========================================================================= */}
          {/* LIVE CHAT OPERATOR TAKEOVER CONSOLE (If ticket is active chat session) */}
          {/* ========================================================================= */}
          {matchingChatSession && !forceStandardComposer ? (
            <div className="flex-1 flex flex-col space-y-3.5">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#2ED8B6]/15 text-[#2ED8B6]">
                    <MessageSquare className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-xs font-bold text-[#EAF1F8] flex items-center gap-1.5">
                      <span>Live Chat Session</span>
                      <span className="text-[10px] font-mono text-[#6B7C8D]">({selectedIssue.externalId})</span>
                    </h3>
                    <p className="text-[10px] font-mono text-[#2ED8B6]">
                      {matchingChatSession.status === "escalated" ? "🚨 Escalated to Human Lead" : "🤖 Co-pilot Active"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setForceStandardComposer(true)}
                  className="text-[10px] font-mono text-[#6B7C8D] hover:text-[#EAF1F8] underline cursor-pointer"
                >
                  Standard Composer
                </button>
              </div>

              {/* Live Chat Message Stream Box */}
              <div className="flex-1 bg-[#0B1017] border border-[var(--line)] rounded-2xl p-3 max-h-[260px] overflow-y-auto space-y-2.5 font-sans text-xs">
                {matchingChatSession.messages.map((msg, idx) => {
                  const isCustomer = msg.sender === "customer";
                  const isSystem = msg.sender === "system";
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isCustomer ? "items-end" : "items-start"} space-y-1`}
                    >
                      <div className="flex items-center gap-1 text-[10px] font-mono text-[#6B7C8D]">
                        <span>{msg.senderName}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>

                      {isSystem ? (
                        <div className="w-full p-2.5 rounded-xl bg-[#E5484D]/15 border border-[#E5484D]/40 text-[#FF7575] text-[11px] leading-relaxed">
                          {msg.content}
                        </div>
                      ) : (
                        <div
                          className={`max-w-[85%] p-2.5 rounded-2xl leading-relaxed ${
                            isCustomer
                              ? "bg-[#142622] text-[#2ED8B6] border border-[#2ED8B6]/30 rounded-tr-none"
                              : "bg-[#18222E] text-[#EAF1F8] border border-[var(--line)] rounded-tl-none"
                          }`}
                        >
                          <p>{msg.content}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick Canned Takeover Chips */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Operator Quick Actions:</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    "Hello! I am taking over this live chat to assist you directly.",
                    "I have verified your account and approved your instant credit voucher.",
                    "Your electronic lockbox security PIN LOCK-8841 is validated for site access.",
                  ].map((phrase, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setOperatorReplyText(phrase)}
                      className="px-2 py-1 rounded-lg bg-[#141C26] hover:bg-[#1A2534] border border-[var(--line)] text-[10.5px] text-[#B4C2D0] hover:text-[#2ED8B6] transition-colors cursor-pointer truncate max-w-full text-left"
                    >
                      {phrase.slice(0, 42)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Operator Reply Composer */}
              <div className="space-y-1.5 flex flex-col">
                <textarea
                  value={operatorReplyText}
                  onChange={(e) => setOperatorReplyText(e.target.value)}
                  rows={3}
                  className="w-full bg-[#161F2C] text-[#EAF1F8] p-3 rounded-2xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6] min-h-[75px]"
                  placeholder="Type message to send directly into customer's live chat widget..."
                />
              </div>

              {/* Operator Dispatch Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => {
                    if (!operatorReplyText.trim()) return;
                    setIsSendingOperatorReply(true);
                    ChatWorkflowService.replyFromOperator(
                      matchingChatSession.id,
                      "Ini Godwin (Escalated Lead)",
                      operatorReplyText.trim()
                    );
                    setOperatorReplyText("");
                    setIsSendingOperatorReply(false);
                    setLiveChatSessionKey((k) => k + 1);
                    onNotify("Live message sent to customer chat session!", "success");
                  }}
                  disabled={!operatorReplyText.trim() || isSendingOperatorReply}
                  className="btn btn-primary py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingOperatorReply ? "Sending..." : "⚡ Send as Operator"}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (operatorReplyText.trim()) {
                      ChatWorkflowService.replyFromOperator(
                        matchingChatSession.id,
                        "Ini Godwin (Escalated Lead)",
                        operatorReplyText.trim()
                      );
                    }
                    await handleExecuteAutonomousResolution();
                  }}
                  disabled={isProcessing}
                  className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#2ED8B6] py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Resolve &amp; Close</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Channel Bar */}
              <div className="space-y-2 pb-2 border-b border-[var(--line)]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#EAF1F8] flex items-center gap-1.5">
                    {isContractor ? <Truck className="w-4 h-4 text-[#F5A623]" /> : <Send className="w-4 h-4 text-[#2ED8B6]" />}
                    <span>{isContractor ? "Contractor Dispatch Station" : "Customer Resolution Station"}</span>
                  </span>
                  {matchingChatSession && (
                    <button
                      type="button"
                      onClick={() => setForceStandardComposer(false)}
                      className="text-[10px] font-mono text-[#2ED8B6] hover:underline cursor-pointer"
                    >
                      ← Back to Live Chat
                    </button>
                  )}
                </div>

                {/* Channels Segment */}
                <div className="grid grid-cols-5 gap-1 bg-[#161F2C] p-1 rounded-xl border border-[var(--line)] text-xs">
                  {[
                    { id: isContractor ? "contractor_sms" : "chat", label: isContractor ? "SMS" : "Chat", icon: isContractor ? Smartphone : MessageSquare },
                    { id: isContractor ? "work_order_push" : "email", label: isContractor ? "Push" : "Email", icon: isContractor ? FileCheck : Mail },
                    { id: isContractor ? "site_pass" : "whatsapp", label: isContractor ? "PIN" : "WhatsApp", icon: isContractor ? Key : Phone },
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
                        className={`py-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
                          isActive
                            ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-sm"
                            : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{ch.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI Response Tone / Mode */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#8E9CAE] text-[11px] font-medium">Response Generation Style</span>
                  <button
                    type="button"
                    onClick={handleTriggerGenerateAi}
                    disabled={isGeneratingAi}
                    className="text-[10.5px] text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 font-mono"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGeneratingAi ? "animate-spin" : ""}`} />
                    <span>Regenerate Response</span>
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1">
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
                      className={`py-1 px-1 text-[10px] rounded-lg transition-all cursor-pointer text-center truncate ${
                        aiTone === t.id
                          ? "bg-[#2ED8B6]/20 text-[#2ED8B6] font-bold border border-[#2ED8B6]/40"
                          : "bg-[#161F2C] text-[#6B7C8D] hover:text-[#EAF1F8]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply Composition Box */}
              <div className="space-y-1.5 flex-1 flex flex-col">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                  className="w-full bg-[#161F2C] text-[#EAF1F8] p-3 rounded-2xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6] min-h-[90px]"
                  placeholder={isContractor ? "Enter instructions or dispatch notice for technician..." : "Compose resolution message to customer..."}
                />
              </div>

              {/* Action Dispatch Buttons */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--line)]">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={!replyText.trim()}
                    className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#EAF1F8] py-3 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4 text-[#2ED8B6]" />
                    <span>{isContractor ? "Send to Tech" : "Send Reply"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      handleSendReply();
                      await handleExecuteAutonomousResolution();
                    }}
                    disabled={isProcessing || !replyText.trim()}
                    className="btn btn-primary py-3 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{isContractor ? "Complete Order" : "Auto-Resolve"}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onEscalate && selectedIssue && onEscalate(selectedIssue)}
                  className="btn btn-secondary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 text-[#8E9CAE] hover:text-[#EAF1F8] cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5 text-[#F5A623]" />
                  <span>Escalate to Tier 2 Lead</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTION INSIGHTS DRAWER (Increased floating height & prominence) */}
      {/* ========================================================================= */}
      {showInsightsDrawer && insights.length > 0 && (
        <div className="bg-[#0E1520] border-t border-[#F5A623]/50 p-4 shrink-0 space-y-3 transition-all max-h-[360px] overflow-y-auto z-40 shadow-2xl animate-in slide-in-from-bottom-6 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Wand2 className="w-4 h-4 text-[#F5A623]" />
              <span className="font-bold text-[#EAF1F8]">Action Insights &amp; Real-Time Telemetry</span>
              <span className="pill text-[9px] font-mono bg-[#18222E] text-[#F5A623]">
                {insights.length} Discovered
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowInsightsDrawer(false)}
              className="text-xs text-[#6B7C8D] hover:text-[#EAF1F8] px-2.5 py-1 rounded-lg bg-[#141C26] cursor-pointer"
            >
              Hide ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="p-3.5 rounded-2xl bg-[#141C28] border border-[var(--line)] hover:border-[#F5A623]/50 space-y-2 text-xs transition-colors flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-[#EAF1F8] text-xs leading-snug">
                      {ins.title}
                    </h4>
                    <span className="text-[10px] text-[#4CC38A] font-mono shrink-0">
                      {(ins.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8E9AA8] line-clamp-2">
                    {ins.finding}
                  </p>
                  <div className="p-2 rounded-xl bg-[#1A2432] text-[10px] text-[#EAF1F8]">
                    <span className="text-[#F5A623] font-bold">Recommended: </span>
                    <span>{ins.recommendation}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(ins.affectedSegment || ins.title.split(" ")[0]);
                      onNotify(`Filtered queue to: ${ins.title}`, "info");
                    }}
                    className="text-[10px] text-[#4D9FFF] hover:underline cursor-pointer flex items-center gap-0.5 font-mono"
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
                          onNotify(`Executed '${ins.title}'`, "success");
                        }
                      } finally {
                        setExecutingInsightId(null);
                      }
                    }}
                    className="btn btn-primary py-1 px-3 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 shadow-md shadow-[#2ED8B6]/20"
                  >
                    <Zap className="w-3 h-3" />
                    <span>{executingInsightId === ins.id ? "Executing..." : "Execute"}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT TICKET DETAILS */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedIssue && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
            <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-4 h-4 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">
                  Edit Ticket Details — {selectedIssue.externalId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTicket} className="p-6 space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[#B4C2D0] block">Ticket Summary</label>
                <input
                  type="text"
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#B4C2D0] block">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as PriorityLevel)}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[#B4C2D0] block">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Issue["status"])}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="escalated">Escalated</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#B4C2D0] block">Sentiment</label>
                  <select
                    value={editSentiment}
                    onChange={(e) => setEditSentiment(e.target.value as SentimentClass)}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                  >
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="frustrated">Frustrated</option>
                    <option value="angry">Angry</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[#B4C2D0] block">Assigned Staff / Tech</label>
                  <input
                    type="text"
                    value={editAssignee}
                    onChange={(e) => setEditAssignee(e.target.value)}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#B4C2D0] block">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  placeholder="checkout, billing, vip"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE MANUAL TICKET */}
      {/* ========================================================================= */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-lg bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
            <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Plus className="w-4 h-4 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">
                  Create New Direct Ingest Ticket
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTicketModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualTicket} className="p-6 space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[#B4C2D0] block">Customer / Organization Name</label>
                <input
                  type="text"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="e.g. Apex Global Logistics"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#B4C2D0] block">Summary &amp; Problem Statement</label>
                <textarea
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Describe the client issue or work order requirements..."
                  rows={3}
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#B4C2D0] block">Stream Type</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                  >
                    <option value="customers">Customer Support</option>
                    <option value="contractors">Field Ops / Contractor</option>
                    <option value="enquiries">General Inquiry</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[#B4C2D0] block">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#B4C2D0] block">Ingress Channel</label>
                <select
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none"
                >
                  <option value="web_chat">Direct Web Chat</option>
                  <option value="email">Inbound Email</option>
                  <option value="manual_entry">Operator Desk Manual</option>
                  <option value="field_dispatch">Contractor Dispatch Call</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-6 py-2 text-xs font-bold cursor-pointer"
                >
                  Create &amp; Assign Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CSV BULK IMPORT */}
      {/* ========================================================================= */}
      {isCsvImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
            <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-[#4D9FFF]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">
                  Bulk Ingest Tickets via CSV / Spreadsheet
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCsvImportModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <p className="text-[#8E9AA8]">
                Paste comma-separated ticket rows (Header: <code className="text-[#2ED8B6]">Customer, Summary, Priority, Category</code>). Unique sequence IDs will be automatically assigned.
              </p>

              <textarea
                value={csvText}
                onChange={(e) => handleCsvTextChange(e.target.value)}
                placeholder={`Customer, Summary, Priority, Category\n"Acme Corp", "Checkout timeout on gateway v2", "urgent", "billing"\n"Meridian Logistics", "HVAC telecom door access required", "high", "contractor"`}
                rows={6}
                className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl p-3 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] font-mono leading-relaxed"
              />

              {csvPreviewCount > 0 && (
                <div className="p-2.5 rounded-xl bg-[#2ED8B6]/10 border border-[#2ED8B6]/30 text-xs text-[#2ED8B6] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Detected {csvPreviewCount} ticket records ready for ingestion.</span>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsCsvImportModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessCsvImport}
                  disabled={csvPreviewCount === 0}
                  className="btn btn-primary px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Ingest {csvPreviewCount > 0 ? `(${csvPreviewCount}) Tickets` : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

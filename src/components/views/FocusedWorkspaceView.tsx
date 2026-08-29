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
} from "lucide-react";
import type { Issue, SentimentClass, PriorityLevel } from "@/lib/types";

interface FocusedWorkspaceViewProps {
  issues: Issue[];
  problems?: any[];
  insights?: any[];
  userRole?: string;
  onResolve: (issueId: string) => void;
  onProcessRefund?: (issueId: string, amount: string) => void;
  onEscalate?: (issue: Issue) => void;
  onNavigateToProblems?: () => void;
  onExecuteInsight?: (insightId: string) => void;
  onUpdateIssue?: (updatedIssue: Issue) => void;
  onCreateIssue?: (newIssue: Issue) => void;
  onImportIssues?: (newIssues: Issue[]) => void;
  onNotify: (text: string, type: "success" | "error" | "info") => void;
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

  const selectedIssue = issues.find((i) => i.id === selectedIssueId) || issues[0];
  const isContractor = selectedIssue?.entityType === "contractor" || selectedIssue?.category?.includes("contractor") || Boolean(selectedIssue?.contractor);

  // Technician Workflow State Machine
  const [techStatus, setTechStatus] = useState<"assigned" | "accepted" | "en_route" | "in_progress" | "completed" | "released">("assigned");

  // Initialize edit fields when selected issue changes
  useEffect(() => {
    if (selectedIssue) {
      setEditSummary(selectedIssue.summary);
      setEditPriority(selectedIssue.priority || "normal");
      setEditStatus(selectedIssue.status);
      setEditSentiment(selectedIssue.sentiment || "neutral");
      setEditAssignee(selectedIssue.assignedTo || "Unassigned");
      setEditTags(selectedIssue.tags?.join(", ") || "");
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

      {/* ========================================================================= */}
      {/* 3-COLUMN WORK DESK RESOLUTION GRID */}
      {/* ========================================================================= */}
      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* ========================================================================= */}
        {/* PANE 1: Work Queue (Width: 3.5 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-[#0E1520] border-r border-[var(--line)] flex flex-col overflow-hidden">
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
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredIssues.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-[#6B7C8D]">
                No active tickets in queue.
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const isSelected = issue.id === selectedIssueId;
                const isCtr = issue.entityType === "contractor" || issue.category?.includes("contractor") || Boolean(issue.contractor);

                return (
                  <div
                    key={issue.id}
                    onClick={() => setSelectedIssueId(issue.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? "bg-[#18222E] border-[#2ED8B6] shadow-lg shadow-[#2ED8B6]/10"
                        : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        {isCtr ? <HardHat className="w-3.5 h-3.5 text-[#F5A623]" /> : <User className="w-3.5 h-3.5 text-[#2ED8B6]" />}
                        <span className="font-mono font-bold text-[#EAF1F8]">{issue.externalId}</span>
                      </div>
                      <span
                        className={`pill text-[9px] uppercase font-mono ${
                          issue.priority === "urgent" || issue.priority === "high"
                            ? "err"
                            : "ok"
                        }`}
                      >
                        {issue.priority}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-[#B4C2D0] line-clamp-1">
                      {issue.summary}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                      <span>{isCtr && issue.contractor ? issue.contractor.company : issue.customerName}</span>
                      <span className="text-[#2ED8B6]">{issue.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PANE 2: Ticket Details & Context (Width: 4 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 md:col-span-8 lg:col-span-4 bg-[#0B1017] border-r border-[var(--line)] flex flex-col overflow-y-auto p-4 space-y-4">
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

                {/* Field Ops / Contractor State Machine */}
                {isContractor && selectedIssue.contractor && (
                  <div className="p-3 rounded-xl bg-[#18222E] border border-[#F5A623]/30 space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between text-[#F5A623]">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Technician Dispatch State</span>
                      </span>
                      <span className="pill text-[9px] uppercase bg-[#121A24] text-[#F5A623]">
                        {techStatus.replace("_", " ")}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTechStatus("accepted");
                          onNotify(`Technician accepted Work Order ${selectedIssue.externalId}`, "info");
                        }}
                        className={`p-1.5 rounded-lg text-[10px] text-center cursor-pointer transition-colors ${
                          techStatus === "accepted" ? "bg-[#2ED8B6] text-[#04201C] font-bold" : "bg-[#121A24] text-[#B4C2D0] hover:bg-[#1E2B3A]"
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
                        className={`p-1.5 rounded-lg text-[10px] text-center cursor-pointer transition-colors ${
                          techStatus === "en_route" ? "bg-[#F5A623] text-[#04201C] font-bold" : "bg-[#121A24] text-[#B4C2D0] hover:bg-[#1E2B3A]"
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
                        className={`p-1.5 rounded-lg text-[10px] text-center cursor-pointer transition-colors ${
                          techStatus === "completed" ? "bg-[#4CC38A] text-[#04201C] font-bold" : "bg-[#121A24] text-[#B4C2D0] hover:bg-[#1E2B3A]"
                        }`}
                      >
                        Complete
                      </button>
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
        {/* PANE 3: Resolution & Dispatch Station (Width: 5 cols) */}
        {/* ========================================================================= */}
        <div className="col-span-12 lg:col-span-5 bg-[#101620] flex flex-col overflow-y-auto p-4 space-y-4">
          {/* Channel Bar */}
          <div className="space-y-2 pb-2 border-b border-[var(--line)]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#EAF1F8] flex items-center gap-1.5">
                {isContractor ? <Truck className="w-4 h-4 text-[#F5A623]" /> : <Send className="w-4 h-4 text-[#2ED8B6]" />}
                <span>{isContractor ? "Contractor Dispatch Station" : "Customer Resolution Station"}</span>
              </span>
              <span className="text-[10px] font-mono text-[#6B7C8D]">Instant Omni-Dispatch</span>
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

          {/* Reply Composition Box (Reduced Height per requirement) */}
          <div className="space-y-1.5 flex-1 flex flex-col">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={3}
              className="w-full bg-[#161F2C] text-[#EAF1F8] p-3 rounded-2xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6] min-h-[90px]"
              placeholder={isContractor ? "Enter instructions or dispatch notice for technician..." : "Compose resolution message to customer..."}
            />
          </div>

          {/* Action Dispatch Buttons (Increased Size per requirement) */}
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

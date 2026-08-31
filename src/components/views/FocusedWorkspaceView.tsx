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
  ChevronDown,
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
  UserCheck,
  Paperclip,
  Code,
  BookOpen,
  Tag,
  Activity,
  CheckSquare,
  CornerDownRight,
  Download,
  ExternalLink,
} from "lucide-react";
import type {
  Issue,
  SentimentClass,
  PriorityLevel,
  TicketTimelineEvent,
  TicketMessageItem,
  TicketAttachment,
} from "@/lib/types";
import { ChatWorkflowService } from "@/lib/services/chat-workflow-service";
import { knowledgev8Connector } from "@/lib/connectors/knowledgev8-connector";

const TEAM_MEMBERS = [
  { id: "david_kim", name: "David Kim", role: "Frontline Operator", avatar: "👤" },
  { id: "sarah_chen", name: "Sarah Chen", role: "CX Lead", avatar: "👑" },
  { id: "alex_ai", name: "Alex (AI Lead)", role: "AI Support Intelligence", avatar: "🤖" },
  { id: "eleanor_ai", name: "Eleanor (AI Lead)", role: "AI Governance & Policy", avatar: "🛡️" },
  { id: "jordan_ai", name: "Jordan (AI Lead)", role: "AI Knowledge Base Specialist", avatar: "📚" },
  { id: "marcus_ai", name: "Marcus (AI Lead)", role: "AI Integrations Engineer", avatar: "⚡" },
  { id: "meridian_dispatch", name: "Meridian Field Dispatch", role: "Contractor Lead", avatar: "🛠️" },
];

const STATUS_OPTIONS: Array<{
  id: string;
  label: string;
  color: string;
}> = [
  { id: "open", label: "Open", color: "text-[#2ED8B6] border-[#2ED8B6]/40 bg-[#2ED8B6]/10" },
  { id: "in_progress", label: "In Progress", color: "text-[#4D9FFF] border-[#4D9FFF]/40 bg-[#4D9FFF]/10" },
  { id: "escalated", label: "Escalated", color: "text-[#E5484D] border-[#E5484D]/40 bg-[#E5484D]/10 font-bold" },
  { id: "resolved", label: "Resolved", color: "text-[#4CC38A] border-[#4CC38A]/40 bg-[#4CC38A]/10 font-bold" },
  { id: "closed", label: "Closed", color: "text-[#6B7C8D] border-[var(--line)] bg-[#18222E]" },
];

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
  onSaveToKnowledgeBase?: (ticket: Issue) => Promise<void> | void;
  onDeductCredits?: (amount: number, reason: string) => void;
  onTriggerTemporalActivity?: (ticketId: string, activityType: string, payload?: any) => void;
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
  onSaveToKnowledgeBase,
  onDeductCredits,
  onTriggerTemporalActivity,
  onNotify,
}: FocusedWorkspaceViewProps) {
  const isContractorUser = userRole === "contractor" || userRole === "technician" || userRole === "contractor_lead";
  const [selectedIssueId, setSelectedIssueId] = useState<string>(issues[0]?.id || "");
  const [queueStatusFilter, setQueueStatusFilter] = useState<"active" | "all" | "resolved">("active");
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

  // Re-Assignment & Context Attachments State
  const [isReassignDropdownOpen, setIsReassignDropdownOpen] = useState(false);
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [newSnippetTitle, setNewSnippetTitle] = useState("");
  const [newSnippetContent, setNewSnippetContent] = useState("");
  const [isSavingRag, setIsSavingRag] = useState(false);
  const [selectedAttachmentPreview, setSelectedAttachmentPreview] = useState<TicketAttachment | null>(null);

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
      setEditAssignee(selectedIssue.assignedTo || selectedIssue.assignedAgent || "David Kim (Operator)");
      setEditTags(selectedIssue.tags?.join(", ") || "");
      setForceStandardComposer(false);
      setIsReassignDropdownOpen(false);
      if (selectedIssue.contractor) {
        setTechStatus("assigned");
      }
    }
  }, [selectedIssueId]);

  // Aligned Generative AI response based on ticket inquiry, customer sentiment, product & context
  const generateContextualReply = (issue: Issue, tone: string, channel: string) => {
    if (!issue) return "";
    const isContractorTicket =
      issue.entityType === "contractor" ||
      issue.category?.includes("contractor") ||
      Boolean(issue.contractor);
    const contractor = issue.contractor;
    const customer = issue.customerName || "Customer";
    const firstName = customer.split(" ")[0];
    const rawSummary = issue.summary || "";
    const cleanSummary = rawSummary.trim();
    const isEnterprise = issue.customerTier === "enterprise";
    const sentiment = issue.sentiment || "neutral";
    const snippets = issue.contextSnippets || [];
    const snippetNote = snippets.length > 0 ? ` (Referencing context snippet: "${snippets[0].slice(0, 45)}...")` : "";

    // Field Contractor / Work Order Dispatches
    if (isContractorTicket && contractor) {
      if (channel === "site_pass" || tone === "safety_protocol") {
        return `[SITE ACCESS & SAFETY PASS]\nWork Order: ${contractor.workOrderId || issue.externalId}\nTechnician: ${contractor.contactName} (${contractor.company})\nLocation: ${contractor.siteLocation}\nAccess PIN: ${contractor.accessCode || "LOCK-8841-PIN"}\nSafety Protocol: Level 2 Escort, ESD footwear required on raised floor.`;
      }
      if (channel === "contractor_sms" || tone === "concise") {
        return `Hi ${contractor.contactName.split(" ")[0]}, Work Order #${contractor.workOrderId || issue.externalId} for "${cleanSummary}" is confirmed for ${contractor.siteLocation}. Access PIN: ${contractor.accessCode || "LOCK-8841"}. ETA: ${contractor.eta || "15 mins"}. Please check in on arrival.`;
      }
      if (tone === "urgent_expedite") {
        return `[URGENT EXPEDITE DISPATCH] Work Order ${contractor.workOrderId || issue.externalId}: Critical alert on "${cleanSummary}" (${issue.product}). Facility security pre-notified at ${contractor.siteLocation} for immediate site access.`;
      }
      if (tone === "sow_instructions" || channel === "work_order_push") {
        return `[SCOPE OF WORK]\nJob: ${cleanSummary}\nLocation: ${contractor.siteLocation}\n1. Inspect equipment indicators & verify telemetry on ${issue.product}.\n2. Apply corrective remediation (v${issue.version || "latest"}).\n3. Execute loopback verification & confirm green telemetry with Dispatch Lead.`;
      }
      return `Hello ${contractor.contactName}, updating Work Order ${contractor.workOrderId || issue.externalId} (${contractor.company}) regarding "${cleanSummary}". All permits for ${contractor.siteLocation} are active.`;
    }

    // Internal Team Note
    if (channel === "internal_note") {
      return `[OPERATOR & SRE NOTE] Ticket ${issue.externalId}: Investigated "${cleanSummary}" on ${issue.product} v${issue.version || "2.4"}. Customer sentiment is ${sentiment.toUpperCase()}. Telemetry verified and corrective actions applied.${snippetNote} Recommend marking resolved.`;
    }

    // Chat / WhatsApp / Messaging Ingress
    if (channel === "whatsapp" || channel === "chat") {
      if (sentiment === "angry" || sentiment === "frustrated") {
        if (tone === "concise") {
          return `Hi ${firstName}, I sincerely apologize for the frustration with "${cleanSummary}". I have personally investigated your account, applied an immediate correction, and verified full restoration.`;
        }
        if (tone === "technical") {
          return `Hello ${firstName}, we apologize for the disruption regarding "${cleanSummary}". Root cause telemetry indicated an upstream service timeout on ${issue.product}. We applied hotfix mitigation, flushed stale session caches, and verified that your service is operating normally.`;
        }
        return `Hello ${firstName}, I understand how frustrating it is to experience issues with "${cleanSummary}". Our team has prioritized your ticket (${issue.externalId}), resolved the underlying issue on ${issue.product}, and confirmed that everything is functioning properly. Please let me know if you need any additional assistance!`;
      }

      if (tone === "technical") {
        return `Hello ${firstName}, regarding your inquiry on "${cleanSummary}": Diagnostics on ${issue.product} (v${issue.version || "2.4"}) show all systems nominal. We reconciled the transaction state and verified zero error spikes.`;
      }
      if (tone === "concise") {
        return `Hi ${firstName}, we have investigated "${cleanSummary}". The issue has been resolved and your service is operating normally.`;
      }
      return `Hello ${firstName}, thank you for reaching out regarding "${cleanSummary}". We have reviewed your account telemetry on ${issue.product} and completed the required update. Everything is now working smoothly!`;
    }

    // Email Responses
    if (channel === "email") {
      if (tone === "executive" || isEnterprise) {
        return `Dear ${customer},\n\nThank you for contacting Enterprise Customer Support regarding your inquiry (${issue.externalId}): "${cleanSummary}".\n\nOur engineering and operations team has thoroughly investigated the issue affecting ${issue.product}. We have applied the necessary resolutions, verified our telemetry streams, and confirmed that SLA performance is fully restored.\n\nPlease feel free to reply directly to this email if you require any further technical details.\n\nSincerely,\nEnterprise Customer Success Team\nsupport.servicev8.com`;
      }
      if (sentiment === "angry" || sentiment === "frustrated") {
        return `Hi ${customer},\n\nThank you for bringing this to our attention. We sincerely apologize for the inconvenience caused by "${cleanSummary}".\n\nWe have escalated and resolved this incident with our engineering team. All systems for ${issue.product} are now functioning normally, and we have applied account safeguards to prevent recurrence.\n\nPlease let us know if you need any further help.\n\nBest regards,\nCustomer Support Team`;
      }
      return `Hi ${customer},\n\nThank you for contacting us regarding "${cleanSummary}".\n\nWe have investigated your request on ${issue.product} and applied the resolution. Everything is now confirmed resolved on our end.\n\nIf you have any further questions, please let us know.\n\nBest regards,\nCustomer Support Team`;
    }

    // Voice Follow-up
    if (channel === "voice") {
      return `Hello ${firstName}, this is Sophia from Customer Support following up on ticket ${issue.externalId} regarding "${cleanSummary}" to confirm that your issue has been resolved.`;
    }

    return `Hello ${customer}, your ticket regarding "${cleanSummary}" on ${issue.product} has been verified and resolved.`;
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
      if (onDeductCredits) {
        onDeductCredits(15, `AI Copilot contextual reply generation (${aiTone})`);
      }
      if (onTriggerTemporalActivity) {
        onTriggerTemporalActivity(selectedIssue.id, "llm_generate_reply", { model: "forge-reasoning-v2", tone: aiTone });
      }
      onNotify(`Generated ${aiTone.toUpperCase()} response (Deducted 15 ForgeGW Credits)`, "success");
    }, 250);
  };

  // Action: Status Change
  const handleStatusChange = (newStatus: string) => {
    if (!selectedIssue) return;
    const now = new Date().toLocaleTimeString();
    const event: TicketTimelineEvent = {
      id: "tl_" + Date.now(),
      timestamp: now,
      actor: userRole === "operator" ? "David Kim (Operator)" : "Ini Godwin (Lead)",
      actorType: "human_operator",
      action: `Status transitioned to ${newStatus.toUpperCase()}`,
      details: newStatus === "escalated" ? "Escalated to Tier 2 engineering with high priority" : undefined,
    };
    const currentTimeline = selectedIssue.timeline || [];
    const updated: Issue = {
      ...selectedIssue,
      status: newStatus,
      priority: newStatus === "escalated" ? "urgent" : selectedIssue.priority,
      timeline: [event, ...currentTimeline],
    };
    if (onUpdateIssue) {
      onUpdateIssue(updated);
    }
    setEditStatus(newStatus as any);

    if (newStatus === "resolved" || newStatus === "closed") {
      onNotify(`Ticket ${selectedIssue.externalId} marked ${newStatus.toUpperCase()} & left active queue`, "success");
      // Auto-advance to the next active open ticket in queue
      const remainingActive = issues.filter(
        (i) => i.id !== selectedIssue.id && i.status !== "resolved" && i.status !== "closed"
      );
      if (remainingActive.length > 0) {
        setTimeout(() => {
          setSelectedIssueId(remainingActive[0].id);
        }, 300);
      }
    } else {
      onNotify(`Ticket ${selectedIssue.externalId} status changed to ${newStatus.toUpperCase()}`, "success");
    }

    if (onTriggerTemporalActivity) {
      onTriggerTemporalActivity(selectedIssue.id, "ticket_status_change", { status: newStatus });
    }
  };

  // Action: Re-Assign Operator
  const handleReassign = (assigneeName: string) => {
    if (!selectedIssue) return;
    const now = new Date().toLocaleTimeString();
    const event: TicketTimelineEvent = {
      id: "tl_" + Date.now(),
      timestamp: now,
      actor: "Operator Lead",
      actorType: "human_operator",
      action: `Reassigned ticket to ${assigneeName}`,
    };
    const currentTimeline = selectedIssue.timeline || [];
    const updated: Issue = {
      ...selectedIssue,
      assignedTo: assigneeName,
      assignedAgent: assigneeName,
      timeline: [event, ...currentTimeline],
    };
    if (onUpdateIssue) {
      onUpdateIssue(updated);
    }
    setEditAssignee(assigneeName);
    setIsReassignDropdownOpen(false);
    onNotify(`Reassigned ticket ${selectedIssue.externalId} to ${assigneeName}`, "success");
    if (onTriggerTemporalActivity) {
      onTriggerTemporalActivity(selectedIssue.id, "ticket_reassign", { assignee: assigneeName });
    }
  };

  // Action: Save Resolution to RAG Knowledge Base
  const handleSaveToRAG = async () => {
    if (!selectedIssue) return;
    setIsSavingRag(true);
    try {
      if (onSaveToKnowledgeBase) {
        await onSaveToKnowledgeBase(selectedIssue);
      } else {
        await knowledgev8Connector.ingestResolvedTicket({
          externalId: selectedIssue.externalId,
          summary: selectedIssue.summary,
          customerName: selectedIssue.customerName,
          product: selectedIssue.product,
          resolutionNotes: replyText || selectedIssue.recommendedAction || "Resolved via workdesk operations.",
          category: selectedIssue.category,
          tags: selectedIssue.tags,
        });
      }
      const now = new Date().toLocaleTimeString();
      const event: TicketTimelineEvent = {
        id: "tl_" + Date.now(),
        timestamp: now,
        actor: "Jordan (AI KB Specialist)",
        actorType: "ai_employee",
        action: "Indexed resolution into pgvector Knowledge Base corpus",
      };
      const currentTimeline = selectedIssue.timeline || [];
      const updated: Issue = {
        ...selectedIssue,
        ragIngested: true,
        ragIngestedAt: new Date().toISOString(),
        timeline: [event, ...currentTimeline],
      };
      if (onUpdateIssue) {
        onUpdateIssue(updated);
      }
      if (onDeductCredits) {
        onDeductCredits(20, "pgvector RAG vector embedding indexing");
      }
      onNotify(`🧠 Ingested ticket ${selectedIssue.externalId} into Knowledge Base RAG corpus!`, "success");
    } finally {
      setIsSavingRag(false);
    }
  };

  // Action: Attach Context Snippet
  const handleSaveSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || !newSnippetContent.trim()) return;
    const now = new Date().toLocaleTimeString();
    const newAtt: TicketAttachment = {
      id: "att_" + Date.now(),
      name: newSnippetTitle.trim() || "Debug Trace / Snippet",
      sizeBytes: newSnippetContent.length,
      type: "snippet",
      url: "#",
      uploadedAt: now,
      snippetContent: newSnippetContent.trim(),
    };
    const event: TicketTimelineEvent = {
      id: "tl_" + Date.now(),
      timestamp: now,
      actor: "Operator",
      actorType: "human_operator",
      action: `Attached context snippet: ${newAtt.name}`,
    };
    const updated: Issue = {
      ...selectedIssue,
      attachments: [...(selectedIssue.attachments || []), newAtt],
      contextSnippets: [...(selectedIssue.contextSnippets || []), newSnippetContent.trim()],
      timeline: [event, ...(selectedIssue.timeline || [])],
    };
    if (onUpdateIssue) {
      onUpdateIssue(updated);
    }
    setNewSnippetTitle("");
    setNewSnippetContent("");
    setIsSnippetModalOpen(false);
    onNotify(`Attached context snippet to ticket!`, "success");
  };

  // Action: File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedIssue) return;
    const now = new Date().toLocaleTimeString();
    const isImg = file.type.startsWith("image/");
    const newAtt: TicketAttachment = {
      id: "att_" + Date.now(),
      name: file.name,
      sizeBytes: file.size,
      type: isImg ? "image" : "document",
      url: URL.createObjectURL(file),
      uploadedAt: now,
    };
    const event: TicketTimelineEvent = {
      id: "tl_" + Date.now(),
      timestamp: now,
      actor: "Operator",
      actorType: "human_operator",
      action: `Uploaded ${isImg ? "image" : "document"} attachment: ${file.name}`,
    };
    const updated: Issue = {
      ...selectedIssue,
      attachments: [...(selectedIssue.attachments || []), newAtt],
      timeline: [event, ...(selectedIssue.timeline || [])],
    };
    if (onUpdateIssue) {
      onUpdateIssue(updated);
    }
    onNotify(`Attached ${file.name} to ticket context!`, "success");
  };

  const activeCount = issues.filter((i) => i.status !== "resolved" && i.status !== "closed").length;
  const resolvedCount = issues.filter((i) => i.status === "resolved" || i.status === "closed").length;

  const filteredIssues = issues.filter((i) => {
    // 1. Queue Status Filter: Resolved and closed tickets leave the active work desk queue by default
    const isClosedOrResolved = i.status === "resolved" || i.status === "closed";
    if (queueStatusFilter === "active" && isClosedOrResolved) {
      return false;
    }
    if (queueStatusFilter === "resolved" && !isClosedOrResolved) {
      return false;
    }

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
      const now = new Date().toLocaleTimeString();
      const event: TicketTimelineEvent = {
        id: "tl_" + Date.now(),
        timestamp: now,
        actor: "Alex (AI Support Lead)",
        actorType: "ai_employee",
        action: isContractor ? "Autonomous contractor work order completed & telemetry verified" : "Autonomous resolution executed & confirmation dispatched",
      };
      const updated: Issue = {
        ...selectedIssue,
        status: "resolved",
        timeline: [event, ...(selectedIssue.timeline || [])],
      };
      if (onUpdateIssue) {
        onUpdateIssue(updated);
      }
      if (onDeductCredits) {
        onDeductCredits(35, "Autonomous AI Agent Resolution (ForgeGW Multi-Action)");
      }
      if (onTriggerTemporalActivity) {
        onTriggerTemporalActivity(selectedIssue.id, "autonomous_ticket_resolution", { resolvedBy: "Alex (AI Lead)" });
      }
      onNotify(
        isContractor
          ? `Work order ${selectedIssue.externalId} completed & removed from active queue.`
          : `Ticket ${selectedIssue.externalId} resolved & removed from active queue. (Deducted 35 ForgeGW Credits)`,
        "success"
      );

      // Auto-advance to the next active open ticket in queue
      const remainingActive = issues.filter(
        (i) => i.id !== selectedIssue.id && i.status !== "resolved" && i.status !== "closed"
      );
      if (remainingActive.length > 0) {
        setTimeout(() => {
          setSelectedIssueId(remainingActive[0].id);
        }, 300);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendReply = () => {
    if (!selectedIssue || !replyText.trim()) return;
    const now = new Date().toLocaleTimeString();
    const newMsg: TicketMessageItem = {
      id: "msg_" + Date.now(),
      timestamp: now,
      sender: "operator",
      senderName: userRole === "operator" ? "David Kim (Operator)" : "Ini Godwin (Lead)",
      content: replyText.trim(),
      channel: commChannel,
    };
    const event: TicketTimelineEvent = {
      id: "tl_" + Date.now(),
      timestamp: now,
      actor: userRole === "operator" ? "David Kim (Operator)" : "Ini Godwin (Lead)",
      actorType: "human_operator",
      action: `Dispatched reply via ${commChannel.toUpperCase()}`,
      details: replyText.slice(0, 80) + (replyText.length > 80 ? "..." : ""),
    };
    const updated: Issue = {
      ...selectedIssue,
      messages: [...(selectedIssue.messages || []), newMsg],
      timeline: [event, ...(selectedIssue.timeline || [])],
    };
    if (onUpdateIssue) {
      onUpdateIssue(updated);
    }
    if (onDeductCredits) {
      onDeductCredits(10, `Dispatched reply via ${commChannel.toUpperCase()}`);
    }
    if (onTriggerTemporalActivity) {
      onTriggerTemporalActivity(selectedIssue.id, "ticket_reply_dispatched", { channel: commChannel });
    }
    onNotify(
      `Dispatched reply via ${commChannel.toUpperCase()} to ${
        isContractor && selectedIssue.contractor ? selectedIssue.contractor.contactName : selectedIssue.customerName
      }`,
      "success"
    );
    setReplyText("");
  };

  const handleSendSitePass = () => {
    if (!selectedIssue?.contractor) return;
    const now = new Date().toLocaleTimeString();
    const event: TicketTimelineEvent = {
      id: "tl_" + Date.now(),
      timestamp: now,
      actor: "Operator",
      actorType: "human_operator",
      action: `Dispatched Electronic Lockbox PIN (${selectedIssue.contractor.accessCode || "LOCK-8841"}) to ${selectedIssue.contractor.contactName}`,
    };
    const updated: Issue = {
      ...selectedIssue,
      timeline: [event, ...(selectedIssue.timeline || [])],
    };
    if (onUpdateIssue) {
      onUpdateIssue(updated);
    }
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
          <div className="p-3 border-b border-[var(--line)] space-y-2 select-none">
            {/* Status Queue Mode: Active Queue vs Resolved Archive */}
            <div className="flex items-center bg-[#101722] p-1 rounded-xl border border-[var(--line)] text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setQueueStatusFilter("active")}
                className={`flex-1 py-1 rounded-lg text-center transition-all cursor-pointer font-bold ${
                  queueStatusFilter === "active"
                    ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                    : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                }`}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setQueueStatusFilter("resolved")}
                className={`flex-1 py-1 rounded-lg text-center transition-all cursor-pointer font-bold ${
                  queueStatusFilter === "resolved"
                    ? "bg-[#4CC38A] text-[#04201C] shadow-sm"
                    : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                }`}
              >
                Resolved ({resolvedCount})
              </button>
              <button
                type="button"
                onClick={() => setQueueStatusFilter("all")}
                className={`flex-1 py-1 rounded-lg text-center transition-all cursor-pointer font-bold ${
                  queueStatusFilter === "all"
                    ? "bg-[#182635] text-[#2ED8B6] border border-[#2ED8B6]/40"
                    : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                }`}
              >
                All ({issues.length})
              </button>
            </div>

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
              <div className="p-8 text-center space-y-3 font-mono">
                <div className="w-10 h-10 rounded-2xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6] mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#EAF1F8]">
                    {queueStatusFilter === "active" ? "✨ Active Queue Clear" : "No Tickets Found"}
                  </h4>
                  <p className="text-[10px] text-[#6B7C8D] mt-1 leading-relaxed">
                    {queueStatusFilter === "active"
                      ? "All customer tickets & field orders have been resolved or closed."
                      : "No tickets match the selected filters."}
                  </p>
                </div>
                {queueStatusFilter === "active" && resolvedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setQueueStatusFilter("resolved")}
                    className="px-3 py-1.5 rounded-xl bg-[#141C26] hover:bg-[#18222E] border border-[var(--line-2)] text-[11px] text-[#2ED8B6] cursor-pointer"
                  >
                    View Resolved Archive ({resolvedCount}) &rarr;
                  </button>
                )}
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
              {/* Ticket Details & Action Card */}
              <div className="card p-4 bg-[#121A24] border-[var(--line)] rounded-2xl space-y-3.5 shadow-md">
                {/* Header Row */}
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-extrabold text-sm text-[#EAF1F8]">
                      {selectedIssue.externalId}
                    </span>
                    <span
                      className={`pill text-[9px] font-mono uppercase font-bold ${
                        selectedIssue.status === "escalated"
                          ? "bg-[#E5484D]/20 text-[#FF7575] border border-[#E5484D]/40"
                          : selectedIssue.status === "resolved"
                          ? "bg-[#4CC38A]/20 text-[#4CC38A] border border-[#4CC38A]/40"
                          : selectedIssue.status === "in_progress"
                          ? "bg-[#4D9FFF]/20 text-[#4D9FFF] border border-[#4D9FFF]/40"
                          : "bg-[#18222E] text-[#2ED8B6] border border-[#2ED8B6]/30"
                      }`}
                    >
                      {selectedIssue.status || "open"}
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

                {/* Ticket Summary */}
                <h3 className="text-xs sm:text-sm font-bold text-[#EAF1F8] leading-snug">
                  {selectedIssue.summary}
                </h3>

                {/* ========================================================================= */}
                {/* 1. TICKET STATUS CHANGE ACTION BUTTONS */}
                {/* ========================================================================= */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-mono text-[#8E9AA8] uppercase block font-semibold">
                    Ticket Lifecycle Status Actions
                  </span>
                  <div className="grid grid-cols-5 gap-1">
                    {STATUS_OPTIONS.map((st) => {
                      const isActive = (selectedIssue.status || "open") === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => handleStatusChange(st.id)}
                          className={`py-1.5 px-1 rounded-xl text-[10px] font-mono font-bold text-center border transition-all cursor-pointer ${
                            isActive
                              ? `${st.color} shadow-sm ring-1 ring-white/20`
                              : "bg-[#0E1520] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8] hover:border-[#2ED8B6]/30"
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* 2. RE-ASSIGN OPERATOR / AGENT CONTROL */}
                {/* ========================================================================= */}
                <div className="p-3 rounded-xl bg-[#141C26] border border-[var(--line)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#8E9AA8] uppercase font-semibold flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      <span>Assigned Operator / Lead</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#2ED8B6]">
                      {selectedIssue.assignedTo || selectedIssue.assignedAgent || "David Kim (Operator)"}
                    </span>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsReassignDropdownOpen(!isReassignDropdownOpen)}
                      className="w-full p-2 rounded-xl bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-xs font-mono text-[#EAF1F8] flex items-center justify-between transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#2ED8B6]" />
                        <span>Re-assign to Team Member...</span>
                      </div>
                      <ChevronDown className={`w-3.5 h-3.5 text-[#8E9AA8] transition-transform ${isReassignDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isReassignDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[#0E1520] border border-[var(--line-2)] rounded-2xl shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                        {TEAM_MEMBERS.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => handleReassign(`${member.name} (${member.role})`)}
                            className="w-full p-2 rounded-xl hover:bg-[#18222E] text-left text-xs font-mono text-[#EAF1F8] flex items-center justify-between cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span>{member.avatar}</span>
                              <div>
                                <div className="font-bold text-[#EAF1F8]">{member.name}</div>
                                <div className="text-[10px] text-[#6B7C8D]">{member.role}</div>
                              </div>
                            </div>
                            {(selectedIssue.assignedTo || "").includes(member.name) && (
                              <Check className="w-3.5 h-3.5 text-[#2ED8B6]" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* 3. 1-CLICK SAVE RESOLUTION TO KNOWLEDGE BASE (RAG) */}
                {/* ========================================================================= */}
                <div className="pt-1">
                  {selectedIssue.ragIngested ? (
                    <div className="p-2.5 rounded-xl bg-[#4CC38A]/10 border border-[#4CC38A]/30 text-xs font-mono text-[#4CC38A] flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>INDEXED IN KNOWLEDGE BASE (pgvector)</span>
                      </span>
                      <span className="text-[10px] text-[#B4C2D0]">Vector Ready</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveToRAG}
                      disabled={isSavingRag}
                      className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-[#2ED8B6]/20 via-[#4D9FFF]/15 to-[#2ED8B6]/20 hover:from-[#2ED8B6]/30 hover:to-[#4D9FFF]/30 border border-[#2ED8B6]/40 text-xs font-mono font-bold text-[#EAF1F8] flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.98]"
                    >
                      <Sparkles className={`w-4 h-4 text-[#2ED8B6] ${isSavingRag ? "animate-spin" : ""}`} />
                      <span>{isSavingRag ? "Vectorizing into pgvector..." : "🧠 Save Resolution to Knowledge Base (RAG)"}</span>
                    </button>
                  )}
                </div>

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

              {/* ========================================================================= */}
              {/* 4. CONTEXT ATTACHMENTS & DEBUG SNIPPETS CARD */}
              {/* ========================================================================= */}
              <div className="card p-4 bg-[#121A24] border-[var(--line)] rounded-2xl space-y-3 shadow-md">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                  <span className="text-xs font-bold text-[#EAF1F8] font-mono flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Context Attachments &amp; Snippets ({selectedIssue.attachments?.length || 0})</span>
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* Hidden file input */}
                    <label className="p-1.5 rounded-lg bg-[#18222E] hover:bg-[#1E2B3A] text-xs font-mono text-[#2ED8B6] flex items-center gap-1 cursor-pointer border border-[var(--line-2)] transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload</span>
                      <input type="file" onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx,.txt,.json,.log" />
                    </label>

                    {/* Add Snippet Button */}
                    <button
                      type="button"
                      onClick={() => setIsSnippetModalOpen(true)}
                      className="p-1.5 rounded-lg bg-[#18222E] hover:bg-[#1E2B3A] text-xs font-mono text-[#4D9FFF] flex items-center gap-1 cursor-pointer border border-[var(--line-2)] transition-colors"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Snippet</span>
                    </button>
                  </div>
                </div>

                {/* Attachments List */}
                {(selectedIssue.attachments || []).length > 0 ? (
                  <div className="space-y-1.5">
                    {(selectedIssue.attachments || []).map((att) => (
                      <div
                        key={att.id}
                        className="p-2.5 rounded-xl bg-[#0E1520] border border-[var(--line)] flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {att.type === "image" ? (
                            <FileText className="w-4 h-4 text-[#2ED8B6] shrink-0" />
                          ) : att.type === "snippet" ? (
                            <Code className="w-4 h-4 text-[#4D9FFF] shrink-0" />
                          ) : (
                            <Paperclip className="w-4 h-4 text-[#F5A623] shrink-0" />
                          )}
                          <div className="min-w-0 truncate">
                            <span className="font-bold text-[#EAF1F8] block truncate">{att.name}</span>
                            <span className="text-[10px] text-[#6B7C8D]">{att.uploadedAt} • {att.type.toUpperCase()}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedAttachmentPreview(att)}
                          className="px-2 py-1 rounded-lg bg-[#18222E] hover:bg-[#1E2B3A] text-[11px] text-[#2ED8B6] cursor-pointer shrink-0"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#6B7C8D] font-mono">
                    No attachments or logs tagged yet. Upload stack traces or screenshots to enrich AI context.
                  </p>
                )}
              </div>

              {/* ========================================================================= */}
              {/* 5. TICKET JOURNEY & CHRONOLOGICAL MESSAGE HISTORY */}
              {/* ========================================================================= */}
              <div className="card p-4 bg-[#121A24] border-[var(--line)] rounded-2xl space-y-3 flex-1 flex flex-col">
                <div className="text-[11px] font-mono text-[#8E9AA8] border-b border-[var(--line)] pb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-[#EAF1F8]">
                    <Activity className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Ticket Journey &amp; Conversation History</span>
                  </span>
                  <span className="pill ok text-[9px] font-mono">{selectedIssue.source}</span>
                </div>

                <div className="space-y-2.5 overflow-y-auto max-h-96 pr-1">
                  {/* Inbound Customer Request */}
                  <div className="p-3 rounded-xl bg-[#0E1520] border border-[var(--line)] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                      <span className="font-bold text-[#EAF1F8] flex items-center gap-1">
                        <User className="w-3 h-3 text-[#4D9FFF]" />
                        <span>{selectedIssue.customerName}</span>
                      </span>
                      <span>{selectedIssue.createdAt ? "Inbound" : "Just now"}</span>
                    </div>
                    <p className="text-[#B4C2D0] leading-relaxed">{selectedIssue.summary}</p>
                  </div>

                  {/* Conversation Journey Messages */}
                  {(selectedIssue.messages || []).map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        msg.sender === "operator"
                          ? "bg-[#182333] border-[#4D9FFF]/30 ml-3"
                          : "bg-[#14202B] border-[#2ED8B6]/30 mr-3"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-bold text-[#EAF1F8] flex items-center gap-1">
                          {msg.sender === "operator" ? <User className="w-3 h-3 text-[#4D9FFF]" /> : <Bot className="w-3 h-3 text-[#2ED8B6]" />}
                          <span>{msg.senderName}</span>
                        </span>
                        <span className="text-[#6B7C8D]">{msg.timestamp}</span>
                      </div>
                      <p className="text-[#B4C2D0] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}

                  {/* Chronological Lifecycle Timeline Events */}
                  {(selectedIssue.timeline || []).map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2 rounded-lg bg-[#0C121A] border border-[var(--line-2)] text-[11px] font-mono text-[#8E9AA8] flex items-center justify-between"
                    >
                      <span className="flex items-center gap-1.5">
                        <CornerDownRight className="w-3 h-3 text-[#2ED8B6] shrink-0" />
                        <span><strong>{ev.actor}:</strong> {ev.action}</span>
                      </span>
                      <span className="text-[9px] text-[#6B7C8D] shrink-0 ml-2">{ev.timestamp}</span>
                    </div>
                  ))}

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

              {/* Quick Canned Takeover Chips & AI Draft */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Operator Quick Actions:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const lastMsg = [...matchingChatSession.messages].reverse().find(m => m.sender === "customer")?.content || selectedIssue.summary;
                      const draft = `Hello ${selectedIssue.customerName}! I am reviewing your request regarding "${lastMsg.slice(0, 42)}...". I have verified your account telemetry and am taking action directly from the Work Desk.`;
                      setOperatorReplyText(draft);
                    }}
                    className="text-[10.5px] font-mono text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#2ED8B6]" />
                    <span>AI Co-Pilot Auto-Draft</span>
                  </button>
                </div>
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

      {/* ========================================================================= */}
      {/* MODAL: ATTACH CODE / LOG TRACE SNIPPET */}
      {/* ========================================================================= */}
      {isSnippetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
            <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Code className="w-4 h-4 text-[#4D9FFF]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">
                  Attach Code / Trace Snippet to Ticket Context
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSnippetModalOpen(false)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSnippet} className="p-6 space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <label className="text-[#B4C2D0] block font-bold">Snippet Label / Title</label>
                <input
                  type="text"
                  value={newSnippetTitle}
                  onChange={(e) => setNewSnippetTitle(e.target.value)}
                  placeholder="e.g., Envoy 504 Gateway Timeout Trace or OAuth Config"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#4D9FFF]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#B4C2D0] block font-bold">Log Snippet / JSON / Stack Trace Content</label>
                <textarea
                  value={newSnippetContent}
                  onChange={(e) => setNewSnippetContent(e.target.value)}
                  rows={8}
                  placeholder={`HTTP/2 504 Gateway Timeout\n{"error": "upstream_connect_timeout", "service": "billing_v2", "latency_ms": 5012}`}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl p-3 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#4D9FFF] font-mono leading-relaxed"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsSnippetModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newSnippetContent.trim()}
                  className="btn btn-primary px-6 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  Attach to Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ATTACHMENT PREVIEW */}
      {/* ========================================================================= */}
      {selectedAttachmentPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Paperclip className="w-4 h-4 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8] truncate max-w-md">
                  {selectedAttachmentPreview.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttachmentPreview(null)}
                className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              {selectedAttachmentPreview.type === "image" ? (
                <div className="flex justify-center p-2 rounded-2xl bg-[#080D14] border border-[var(--line)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedAttachmentPreview.url}
                    alt={selectedAttachmentPreview.name}
                    className="max-h-96 rounded-xl object-contain"
                  />
                </div>
              ) : selectedAttachmentPreview.snippetContent ? (
                <div className="p-4 rounded-2xl bg-[#080D14] border border-[var(--line)] text-[#B4C2D0] whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
                  {selectedAttachmentPreview.snippetContent}
                </div>
              ) : (
                <div className="p-6 text-center space-y-2">
                  <FileText className="w-12 h-12 text-[#2ED8B6] mx-auto" />
                  <p className="text-sm text-[#EAF1F8] font-bold">{selectedAttachmentPreview.name}</p>
                  <p className="text-xs text-[#6B7C8D]">Size: {(selectedAttachmentPreview.sizeBytes / 1024).toFixed(1)} KB</p>
                </div>
              )}

              <div className="pt-3 flex items-center justify-between border-t border-[var(--line)]">
                <span className="text-[10px] text-[#6B7C8D]">
                  Uploaded {selectedAttachmentPreview.uploadedAt}
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedAttachmentPreview(null)}
                  className="btn btn-secondary px-5 py-2 text-xs cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

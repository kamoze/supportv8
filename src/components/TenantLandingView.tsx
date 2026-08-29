"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  BookOpen,
  HardHat,
  HelpCircle,
  Users,
  Shield,
  FileText,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
  MessageSquare,
  AlertCircle,
  UserCheck,
  Globe,
  Truck,
  KeyRound,
  MapPin,
  Check,
  Radio,
  RefreshCw,
  PhoneCall,
  Lock,
  ArrowRight,
  DollarSign,
  Briefcase,
  Bot,
  Zap,
  Send,
  Sliders,
  Award,
  Layers,
  Smartphone,
  Phone,
  Mail,
  Flame,
  AlertTriangle,
  X,
  Copy,
  Edit3,
  CheckCheck,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";
import type { ChatStreamType, Issue, SentimentClass } from "@/lib/types";
import { db } from "@/lib/db/mock-data";

interface TenantLandingViewProps {
  tenantSlug?: string;
  onOpenSignIn: () => void;
  onOpenGlobalLanding: () => void;
  onOpenSignup: () => void;
  onSwitchTenant?: (slug: string) => void;
}

export function TenantLandingView({
  tenantSlug = "acme",
  onOpenSignIn,
  onOpenGlobalLanding,
  onOpenSignup,
  onSwitchTenant,
}: TenantLandingViewProps) {
  const cleanSlug = tenantSlug.toLowerCase().trim();
  const isDemo = cleanSlug === "acme" || cleanSlug === "meridian";
  const isMeridian = cleanSlug === "meridian";

  const [activeSurfaceTab, setActiveSurfaceTab] = useState<"work_desk" | "public_portal">("public_portal");
  const [searchQuery, setSearchQuery] = useState("");
  const [trackerTab, setTrackerTab] = useState<"ticket" | "dispatch">(isMeridian ? "dispatch" : "ticket");
  const [trackerSearchId, setTrackerSearchId] = useState("");
  const [trackedItem, setTrackedItem] = useState<any | null>(null);
  const [trackerError, setTrackerError] = useState("");

  // Article Form View Reader Drawer State
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Simulated Work Desk State (for demo sandbox)
  const [selectedItemId, setSelectedItemId] = useState<string>(isMeridian ? "iss_contractor_01" : "iss_01");
  const [simulatedRefundAmount, setSimulatedRefundAmount] = useState<string>("49.00");
  const [generatedPin, setGeneratedPin] = useState<string>("8492-X");
  const [isGeneratingPin, setIsGeneratingPin] = useState<boolean>(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; type: "ok" | "warn" } | null>(null);

  // Quick live edit state for ticket in workdesk demo
  const [editingTicket, setEditingTicket] = useState<boolean>(false);
  const [customReply, setCustomReply] = useState<string>("");
  const [commStubLogs, setCommStubLogs] = useState<Array<{ sender: string; text: string; time: string }>>([
    { sender: "customer", text: "We need urgent status update on this issue.", time: "10 mins ago" },
  ]);

  // Dynamic formatted name
  const formattedName = isMeridian
    ? "Meridian Logistics"
    : cleanSlug === "acme"
    ? "Acme Corp"
    : cleanSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

  // Filtered Issues
  const acmeIssues = db.issues.filter((i) => !i.category?.includes("contractor") && !i.tags?.includes("contractor"));
  const meridianIssues = db.issues.filter((i) => i.category?.includes("contractor") || i.tags?.includes("contractor") || i.entityType === "contractor");
  const currentIssuesList = isMeridian ? meridianIssues : acmeIssues;
  const activeIssue = currentIssuesList.find((i) => i.id === selectedItemId) || currentIssuesList[0] || db.issues[0];

  useEffect(() => {
    if (isMeridian) {
      setSelectedItemId("iss_contractor_01");
      setTrackerTab("dispatch");
    } else {
      setSelectedItemId("iss_01");
      setTrackerTab("ticket");
    }
    setActionFeedback(null);
    setTrackedItem(null);
    setTrackerSearchId("");
  }, [tenantSlug, isMeridian]);

  // Verified Knowledge Base Articles
  const kbArticles = [
    {
      id: "kb_1",
      title: "Contractor On-Site Lockbox & Digital PIN Access Protocol",
      category: "Contractors",
      stream: "contractors" as ChatStreamType,
      snippet: "How to generate and verify one-time electronic site access PINs for Building A and B telecom closets.",
      content: `### Objective\nProvide secure, auditable, and time-bounded electronic lockbox PINs for authorized field technicians.\n\n### Procedure\n1. Verify technician identity and assigned Work Order ID against the live dispatch roster.\n2. In the Dispatch Cockpit, click **Generate Lockbox PIN**.\n3. The system mints an encrypted PIN with a strict 24-hour time-to-live (TTL) and transmits it via SMS to the technician's registered mobile device.\n4. Technician inputs the PIN at the physical lockbox key pad to retrieve physical site keys.\n\n### Safety & Escort Requirements\n- Level 2 Telecom Closet access requires ESD-compliant footwear.\n- Subcontractors must check in with Building Security upon arrival.`,
      views: 342,
      updated: "2 days ago",
    },
    {
      id: "kb_2",
      title: "OrderV8 Autonomous Refund Tokens & Credit Dispatch Guidelines",
      category: "Billing",
      stream: "customers" as ChatStreamType,
      snippet: "Subscriptions under Enterprise and Pro tiers qualify for automated instant credit vouchers up to $500.",
      content: `### Autonomous Credit Issuance Policy\nCustomer service operators and autonomous support workflows can issue immediate credit vouchers to resolve checkout failures and billing discrepancies.\n\n### Eligibility Criteria\n- **Enterprise Tier**: Pre-approved for instant refunds up to $500.00 without secondary managerial sign-off.\n- **Pro Tier**: Pre-approved for instant credit up to $150.00.\n- **Standard Tier**: Inquiries exceeding $50.00 are routed to the CX Lead.\n\n### Audit & Verification\nAll credit vouchers generate a cryptographic SHA-256 ledger token synced directly to the OrderV8 billing engine.`,
      views: 819,
      updated: "1 day ago",
    },
    {
      id: "kb_3",
      title: "Zero-Trust Action Verification & Security Matrix",
      category: "Security",
      stream: "enquiries" as ChatStreamType,
      snippet: "Overview of mutual TLS (mTLS), strict idempotency tokens, and SHA-256 hash chaining on all action endpoints.",
      content: `### Security Architecture\nAll operational actions (e.g. issuing credits, rotating credentials, modifying work orders) are executed through the Zero-Trust Action Gateway.\n\n### Key Protections\n1. **mTLS Encryption**: Every inter-service request is authenticated with mutual TLS.\n2. **Idempotency Tokens**: Prevents accidental double-executions of refunds or provisioning workflows.\n3. **Audit Logging**: Immutable event ledger records operator ID, timestamp, and payload hash.`,
      views: 512,
      updated: "3 days ago",
    },
    {
      id: "kb_4",
      title: "Subcontractor W9 & Certificate of Insurance (COI) Uploads",
      category: "Compliance",
      stream: "contractors" as ChatStreamType,
      snippet: "Step-by-step instructions for uploading updated liability insurance and tax forms to the secure S3 vault.",
      content: `### Compliance Document Uploads\nAll active field contractors and subcontractors must maintain an active Certificate of Insurance (COI) with a minimum of $2,000,000 general liability coverage.\n\n### Upload Steps\n1. Log in to the Contractor Work Desk.\n2. Navigate to **Compliance & Permits**.\n3. Attach the PDF copy of your COI and W-9 form.\n4. Automated OCR checks policy expiration dates and updates work order dispatch eligibility within 15 minutes.`,
      views: 290,
      updated: "5 days ago",
    },
  ];

  // Filtered Knowledge Articles
  const filteredKbArticles = kbArticles.filter((art) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      art.title.toLowerCase().includes(q) ||
      art.snippet.toLowerCase().includes(q) ||
      art.category.toLowerCase().includes(q) ||
      art.content.toLowerCase().includes(q)
    );
  });

  // Track ticket handler (privacy-preserving)
  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setTrackerError("");
    setTrackedItem(null);

    const query = trackerSearchId.trim().toUpperCase();
    if (!query) {
      setTrackerError("Please enter a Ticket ID (e.g. TCK-8821) or Work Order ID (e.g. WO-7741).");
      return;
    }

    if (query === "TCK-8821" || query === "TCK-01" || query.includes("8821")) {
      setTrackedItem({
        id: "TCK-8821",
        type: "ticket",
        title: "OrderV8 Token Sync & Autonomous Refund Confirmation",
        status: "In Progress",
        statusColor: "emerald",
        updatedAt: "12 mins ago",
        assignedTo: "Customer Success Lead (Tier 1)",
        publicNotes: "Your issue has been validated against telemetry and a resolution token is being dispatched.",
      });
    } else if (query === "WO-7741" || query === "WO-01" || query.includes("7741")) {
      setTrackedItem({
        id: "WO-7741",
        type: "dispatch",
        title: "Field Technician Site Dispatch — Building B Telecom Closet",
        status: "En Route",
        statusColor: "amber",
        updatedAt: "5 mins ago",
        assignedTo: "Dave Miller (Apex Telecom HVAC)",
        publicNotes: "Technician is en route. ETA is approximately 15 minutes. Site credentials validated.",
      });
    } else {
      setTrackerError(`No active public request found for "${trackerSearchId}". Please verify your ticket reference.`);
    }
  };

  // Lockbox PIN generation
  const handleGeneratePin = () => {
    setIsGeneratingPin(true);
    setTimeout(() => {
      const randomPin = `${Math.floor(1000 + Math.random() * 9000)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
      setGeneratedPin(randomPin);
      setIsGeneratingPin(false);
      setActionFeedback({
        text: `New Emergency Site PIN ${randomPin} generated with 24h TTL. Dispatched via SMS to technician.`,
        type: "ok",
      });
    }, 450);
  };

  // Refund simulation
  const handleIssueRefund = () => {
    setIsProcessingRefund(true);
    setTimeout(() => {
      setIsProcessingRefund(false);
      setActionFeedback({
        text: `OrderV8 Refund Token $${simulatedRefundAmount} issued successfully. Audit hash: 0x${Math.random().toString(16).substring(2, 10)}`,
        type: "ok",
      });
    }, 500);
  };

  // Send communication stub
  const handleSendCommStub = () => {
    if (!customReply.trim()) return;
    setCommStubLogs((prev) => [
      ...prev,
      { sender: "operator", text: customReply.trim(), time: "Just now" },
    ]);
    setCustomReply("");
    setActionFeedback({
      text: "Message dispatched to customer channel successfully.",
      type: "ok",
    });
  };

  return (
    <div className="min-h-screen bg-[#090E15] text-[#EAF1F8] font-sans selection:bg-[#2ED8B6]/30 selection:text-[#2ED8B6] flex flex-col">
      {/* ========================================================================= */}
      {/* TOP NOTIFICATION & SANDBOX CONTROL BANNER (Only on Demo Slugs) */}
      {/* ========================================================================= */}
      {isDemo && (
        <div className="bg-gradient-to-r from-[#121A24] via-[#162230] to-[#121A24] border-b border-[var(--line)] px-4 lg:px-8 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-[#2ED8B6] animate-pulse" />
            <span className="text-[#EAF1F8] font-bold">
              Demo Sandbox Cockpit:
            </span>
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${isMeridian ? "bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40" : "bg-[#2ED8B6]/20 text-[#2ED8B6] border border-[#2ED8B6]/40"}`}>
              {formattedName} ({isMeridian ? "Field Operations & Dispatch" : "SaaS Customer Care & Billing"})
            </span>
          </div>

          <div className="flex items-center gap-3">
            {onSwitchTenant && (
              <div className="flex items-center gap-1 bg-[#090E15] p-1 rounded-xl border border-[var(--line)] text-[11px]">
                <button
                  type="button"
                  onClick={() => onSwitchTenant("acme")}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    tenantSlug === "acme" ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-sm" : "text-[#8E9AA8] hover:text-[#EAF1F8]"
                  }`}
                >
                  <Users className="w-3 h-3" />
                  <span>Acme Corp (SaaS CS)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTenant("meridian")}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                    tenantSlug === "meridian" ? "bg-[#F5A623] text-[#04201C] font-bold shadow-sm" : "text-[#8E9AA8] hover:text-[#EAF1F8]"
                  }`}
                >
                  <HardHat className="w-3 h-3" />
                  <span>Meridian (Dispatch)</span>
                </button>
              </div>
            )}

            <button
              onClick={onOpenSignup}
              className="btn btn-primary px-3 py-1 text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
            >
              <span>Launch Isolated Workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onOpenGlobalLanding}
              className="text-[#8E9AA8] hover:text-[#EAF1F8] p-1 rounded hover:bg-[#18222E] cursor-pointer"
              title="Exit Demo Sandbox"
            >
              Exit Sandbox
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TENANT HEADER NAVIGATION */}
      {/* ========================================================================= */}
      <header className="bg-[#0B1017]/95 backdrop-blur-md border-b border-[var(--line)] px-6 lg:px-8 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <SupportV8Logo size={30} showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-[#EAF1F8]">
                {formattedName}
              </span>
              <span className="pill text-[9px] font-mono bg-[#141C26] text-[#2ED8B6] border border-[#2ED8B6]/30">
                {cleanSlug}.support.servicev8.com
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#6B7C8D]">
              {isMeridian ? "Contractor Dispatch & Field Resolution Hub" : "AI Customer Care & Self-Service Portal"}
            </p>
          </div>
        </div>

        {/* View Switcher Tabs (Only for Demo Sandbox) */}
        {isDemo ? (
          <div className="hidden md:flex items-center gap-1 bg-[#121A24] p-1 rounded-xl border border-[var(--line)] font-mono text-xs">
            <button
              type="button"
              onClick={() => setActiveSurfaceTab("public_portal")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSurfaceTab === "public_portal"
                  ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-md shadow-[#2ED8B6]/20"
                  : "text-[#8E9AA8] hover:text-[#EAF1F8]"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Public Help Hub</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSurfaceTab("work_desk")}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSurfaceTab === "work_desk"
                  ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-md shadow-[#2ED8B6]/20"
                  : "text-[#8E9AA8] hover:text-[#EAF1F8]"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Operator Work Desk</span>
            </button>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#2ED8B6]">
            <CheckCircle2 className="w-4 h-4" />
            <span>Dedicated Tenant Cloud Ready</span>
          </div>
        )}

        {/* Sign In / Sign Up Gateway */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSignIn}
            className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#EAF1F8] px-3.5 py-1.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5 text-[#2ED8B6]" />
            <span>Sign In</span>
          </button>

          <button
            onClick={onOpenSignup}
            className="btn btn-primary px-3.5 py-1.5 text-xs font-bold shadow-lg shadow-[#2ED8B6]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Register</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VIEW 1: OPERATOR WORK DESK (DEMO SANDBOX COCKPIT) */}
      {/* ========================================================================= */}
      {isDemo && activeSurfaceTab === "work_desk" && (
        <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Action Feedback Banner */}
          {actionFeedback && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-mono animate-in fade-in duration-200 ${
              actionFeedback.type === "ok"
                ? "bg-[#2ED8B6]/10 border-[#2ED8B6]/40 text-[#2ED8B6]"
                : "bg-[#F5A623]/10 border-[#F5A623]/40 text-[#F5A623]"
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{actionFeedback.text}</span>
              </div>
              <button
                onClick={() => setActionFeedback(null)}
                className="hover:text-white cursor-pointer ml-4"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Queue List */}
            <div className="card p-5 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-[#2ED8B6]/15 text-[#2ED8B6]">
                    <Sliders className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">
                    {isMeridian ? "Active Field Work Orders" : "Active Customer Tickets"}
                  </h3>
                </div>
                <span className="pill text-[10px] font-mono bg-[#18222E] text-[#2ED8B6]">
                  {currentIssuesList.length} Ingested
                </span>
              </div>

              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {currentIssuesList.map((issue) => {
                  const isSelected = issue.id === selectedItemId;
                  return (
                    <div
                      key={issue.id}
                      onClick={() => setSelectedItemId(issue.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                        isSelected
                          ? "bg-[#18222E] border-[#2ED8B6] shadow-lg shadow-[#2ED8B6]/10"
                          : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-[#EAF1F8]">{issue.id.toUpperCase()}</span>
                        <span className="pill text-[9px] uppercase font-mono bg-[#141C26] text-[#2ED8B6]">
                          {issue.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-[#B4C2D0] line-clamp-1">{issue.summary}</h4>
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-1">
                        <span>{issue.customerName}</span>
                        <span className="text-[#F5A623] uppercase">{issue.priority}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Middle Resolution Panel */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-5 shadow-xl">
                {/* Ticket Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-lg text-[#EAF1F8]">
                        {activeIssue?.id.toUpperCase()}
                      </span>
                      <span className="pill ok uppercase text-[10px] font-mono">
                        <i className="dot" /> {activeIssue?.status}
                      </span>
                      <span className="pill text-[10px] font-mono bg-[#18222E] text-[#F5A623]">
                        {activeIssue?.priority} Priority
                      </span>
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-[#EAF1F8]">
                      {activeIssue?.summary}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingTicket(!editingTicket)}
                      className="px-3 py-1.5 rounded-xl bg-[#141C26] hover:bg-[#18222E] border border-[var(--line)] text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      <span>{editingTicket ? "Done Editing" : "Edit Details"}</span>
                    </button>

                    <button
                      onClick={onOpenSignIn}
                      className="btn btn-primary px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
                    >
                      <span>Open Full Cockpit</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Simulated Customer Communication Channel */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-[#8E9AA8]">
                    <span className="flex items-center gap-1.5 text-[#2ED8B6]">
                      <MessageSquare className="w-4 h-4" />
                      <span>Live Client Communication Stream</span>
                    </span>
                    <span className="text-[11px] text-[#6B7C8D]">Channel: In-App Chat &amp; Email</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#0B1017] border border-[var(--line)] space-y-3 max-h-48 overflow-y-auto">
                    {commStubLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${
                          log.sender === "operator" ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`p-3 rounded-2xl max-w-md text-xs font-sans ${
                            log.sender === "operator"
                              ? "bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 text-[#EAF1F8]"
                              : "bg-[#141C26] border border-[var(--line)] text-[#B4C2D0]"
                          }`}
                        >
                          <p>{log.text}</p>
                          <span className="text-[9px] font-mono text-[#6B7C8D] block mt-1 text-right">
                            {log.time}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customReply}
                      onChange={(e) => setCustomReply(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSendCommStub();
                      }}
                      placeholder="Type response to client or technician..."
                      className="flex-1 bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    />
                    <button
                      onClick={handleSendCommStub}
                      disabled={!customReply.trim()}
                      className="btn btn-primary px-4 py-2.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>

                {/* Specialized Operator Action Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Lockbox PIN Generator */}
                  <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#F5A623] flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4" />
                        <span>Lockbox &amp; Site PIN</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#6B7C8D]">24h TTL</span>
                    </div>

                    <div className="flex items-center justify-between bg-[#18222E] p-3 rounded-xl border border-[var(--line-2)] font-mono">
                      <span className="text-sm font-bold text-[#EAF1F8]">{generatedPin}</span>
                      <button
                        onClick={handleGeneratePin}
                        disabled={isGeneratingPin}
                        className="btn bg-[#121A24] hover:bg-[#1E2B3A] border border-[var(--line)] text-[#2ED8B6] px-2.5 py-1 text-xs cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingPin ? "Generating..." : "Regenerate"}
                      </button>
                    </div>
                  </div>

                  {/* OrderV8 Refund Voucher */}
                  <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-[#2ED8B6] flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4" />
                        <span>OrderV8 Refund Credit</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#6B7C8D]">Max $500</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={simulatedRefundAmount}
                        onChange={(e) => setSimulatedRefundAmount(e.target.value)}
                        className="w-24 bg-[#18222E] border border-[var(--line-2)] rounded-xl px-3 py-1.5 text-xs font-mono text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                      />
                      <button
                        onClick={handleIssueRefund}
                        disabled={isProcessingRefund}
                        className="flex-1 btn btn-primary py-1.5 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isProcessingRefund ? "Dispatching..." : "Issue Credit Voucher"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: PUBLIC HELP & DISPATCH HUB (END-USER PRIVACY-HARDENED VIEW) */}
      {/* ========================================================================= */}
      {(activeSurfaceTab === "public_portal" || !isDemo) && (
        <main className="max-w-6xl mx-auto px-6 py-10 space-y-10 flex-1 w-full">
          {/* Search Header */}
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#EAF1F8]">
              How can {formattedName} assist you today?
            </h1>
            <p className="text-xs sm:text-sm text-[#8E9AA8]">
              Search verified knowledge documents, verify on-site contractor PINs, or track your live ticket.
            </p>

            {/* Knowledge Search Input */}
            <div className="relative max-w-xl mx-auto pt-2">
              <Search className="w-4 h-4 text-[#6B7C8D] absolute left-4 top-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search knowledge base, refund guidelines, PINs, work orders..."
                className="w-full bg-[#121A24] border border-[var(--line-2)] rounded-2xl pl-11 pr-4 py-3.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] shadow-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-5 text-xs text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Privacy-Preserving Universal Case & Dispatch Tracker */}
          <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-5 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6]">
                  <Clock className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Universal Case &amp; Dispatch Tracker</h3>
                  <p className="text-[10px] font-mono text-[#6B7C8D]">
                    Secure, privacy-gated tracking for customer cases &amp; field work orders
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[#141C26] p-1 rounded-xl border border-[var(--line)] font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTrackerTab("ticket");
                    setTrackedItem(null);
                    setTrackerError("");
                  }}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    trackerTab === "ticket"
                      ? "bg-[#2ED8B6] text-[#04201C] font-bold"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Customer Ticket</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTrackerTab("dispatch");
                    setTrackedItem(null);
                    setTrackerError("");
                  }}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    trackerTab === "dispatch"
                      ? "bg-[#2ED8B6] text-[#04201C] font-bold"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Field Dispatch</span>
                </button>
              </div>
            </div>

            {/* Tracker Input Gate (Protects Customer Data from Public Crawlers) */}
            <form onSubmit={handleTrackSearch} className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Shield className="w-4 h-4 text-[#2ED8B6] absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={trackerSearchId}
                  onChange={(e) => {
                    setTrackerSearchId(e.target.value);
                    if (trackerError) setTrackerError("");
                  }}
                  placeholder={
                    trackerTab === "ticket"
                      ? "Enter Ticket ID (e.g. TCK-8821)..."
                      : "Enter Work Order ID (e.g. WO-7741)..."
                  }
                  className="w-full bg-[#121A24] border border-[var(--line)] rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto btn btn-primary px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
              >
                <span>Track Request</span>
                <Search className="w-3.5 h-3.5" />
              </button>
            </form>

            {trackerError && (
              <div className="p-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#E5484D] shrink-0" />
                <span>{trackerError}</span>
              </div>
            )}

            {/* Privacy Placeholder when no ID entered */}
            {!trackedItem && !trackerError && (
              <div className="p-6 rounded-2xl bg-[#121A24]/60 border border-[var(--line)] text-center space-y-2 font-mono text-xs text-[#6B7C8D]">
                <Lock className="w-6 h-6 text-[#2ED8B6] mx-auto opacity-70" />
                <p className="text-[#B4C2D0]">Customer details &amp; technician lockbox codes are securely protected.</p>
                <p className="text-[11px]">
                  Demo Quick Search: Try searching <button type="button" onClick={() => setTrackerSearchId("TCK-8821")} className="text-[#2ED8B6] underline font-bold cursor-pointer">TCK-8821</button> or <button type="button" onClick={() => setTrackerSearchId("WO-7741")} className="text-[#F5A623] underline font-bold cursor-pointer">WO-7741</button>
                </p>
              </div>
            )}

            {/* Tracked Item Details (Revealed Only After Verification) */}
            {trackedItem && (
              <div className="p-5 rounded-2xl bg-[#121A24] border border-[#2ED8B6]/40 space-y-3 font-mono text-xs animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#EAF1F8] text-sm">{trackedItem.id}</span>
                    <span className="pill ok uppercase text-[9px]"><i className="dot" /> {trackedItem.status}</span>
                  </div>
                  <span className="text-[11px] text-[#6B7C8D]">Updated {trackedItem.updatedAt}</span>
                </div>

                <div className="space-y-1 font-sans">
                  <h4 className="text-sm font-bold text-[#EAF1F8]">{trackedItem.title}</h4>
                  <p className="text-xs text-[#8E9AA8]">{trackedItem.publicNotes}</p>
                </div>

                <div className="text-[11px] text-[#2ED8B6] font-mono pt-1 flex items-center justify-between">
                  <span>Assigned: {trackedItem.assignedTo}</span>
                  <button
                    onClick={onOpenSignIn}
                    className="text-xs text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <span>Sign In for Full Operator Access &rarr;</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Verified Knowledge Base Articles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#EAF1F8] flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#2ED8B6]" />
                <span>Verified Knowledge Base Documents</span>
              </h3>
              <span className="text-xs font-mono text-[#6B7C8D]">
                Showing {filteredKbArticles.length} of {kbArticles.length} verified docs
              </span>
            </div>

            {filteredKbArticles.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#121A24] border border-[var(--line)] text-center font-mono text-xs text-[#6B7C8D]">
                No knowledge base articles matched "{searchQuery}".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredKbArticles.map((art) => (
                  <div
                    key={art.id}
                    onClick={() => setSelectedArticle(art)}
                    className="card p-5 bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6] rounded-2xl transition-all space-y-2 cursor-pointer group shadow-lg hover:shadow-[#2ED8B6]/10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="pill text-[10px] font-mono bg-[#18222E] text-[#2ED8B6]">
                        {art.category}
                      </span>
                      <span className="text-[10px] font-mono text-[#6B7C8D] group-hover:text-[#2ED8B6] flex items-center gap-1 transition-colors">
                        <span>Read in Form View</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-[#EAF1F8] group-hover:text-[#2ED8B6] transition-colors">
                      {art.title}
                    </h4>
                    <p className="text-[11px] text-[#8E9AA8] line-clamp-2">{art.snippet}</p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)]">
                      <span>{art.views} reads</span>
                      <span>Updated {art.updated}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ========================================================================= */}
      {/* FULL-SCREEN / DRAWER FORM VIEW KNOWLEDGE ARTICLE READER */}
      {/* ========================================================================= */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-3xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-8 py-5 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6]">
                  <BookOpen className="w-5 h-5" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="pill text-[9px] font-mono bg-[#18222E] text-[#2ED8B6]">
                      {selectedArticle.category}
                    </span>
                    <span className="text-xs font-mono text-[#6B7C8D]">
                      ID: {selectedArticle.id}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#EAF1F8] mt-0.5">
                    {selectedArticle.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="p-2 rounded-xl bg-[#18222E] text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                  title="Copy Document Link"
                >
                  {copiedLink ? <CheckCheck className="w-4 h-4 text-[#2ED8B6]" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setSelectedArticle(null)}
                  className="p-2 rounded-xl bg-[#18222E] text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Form View Content */}
            <div className="p-8 overflow-y-auto space-y-6 text-xs text-[#B4C2D0] leading-relaxed font-sans">
              <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-1.5 font-mono">
                <div className="text-[11px] text-[#2ED8B6] font-bold">Document Abstract:</div>
                <p className="text-xs text-[#EAF1F8]">{selectedArticle.snippet}</p>
              </div>

              {/* Form View Body */}
              <div className="space-y-4 prose prose-invert max-w-none text-xs">
                {selectedArticle.content.split("\n\n").map((block: string, i: number) => {
                  if (block.startsWith("### ")) {
                    return (
                      <h4 key={i} className="text-sm font-bold text-[#2ED8B6] pt-2 border-b border-[var(--line)] pb-1">
                        {block.replace("### ", "")}
                      </h4>
                    );
                  }
                  if (block.startsWith("- ")) {
                    return (
                      <ul key={i} className="list-disc pl-5 space-y-1 text-[#B4C2D0]">
                        {block.split("\n").map((line, j) => (
                          <li key={j}>{line.replace("- ", "")}</li>
                        ))}
                      </ul>
                    );
                  }
                  if (/^\d+\./.test(block)) {
                    return (
                      <ol key={i} className="list-decimal pl-5 space-y-1 text-[#B4C2D0]">
                        {block.split("\n").map((line, j) => (
                          <li key={j}>{line.replace(/^\d+\.\s*/, "")}</li>
                        ))}
                      </ol>
                    );
                  }
                  return <p key={i}>{block}</p>;
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 bg-[#121A24] border-t border-[var(--line)] flex items-center justify-between text-xs font-mono text-[#6B7C8D]">
              <div className="flex items-center gap-4">
                <span>Verified Status: <strong className="text-[#2ED8B6]">RAG Active</strong></span>
                <span>Views: {selectedArticle.views}</span>
                <span>Last Updated: {selectedArticle.updated}</span>
              </div>

              <button
                onClick={() => setSelectedArticle(null)}
                className="btn btn-secondary px-5 py-2 text-xs font-mono cursor-pointer"
              >
                Close Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Tenant-Scoped Support Chat Widget */}
      <SupportChatWidget
        defaultStream={isMeridian ? "contractors" : "customers"}
        tenantDomain={tenantSlug}
      />
    </div>
  );
}

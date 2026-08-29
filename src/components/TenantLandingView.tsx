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
  const isMeridian = tenantSlug.toLowerCase() === "meridian";
  const [activeSurfaceTab, setActiveSurfaceTab] = useState<"work_desk" | "public_portal">("work_desk");
  const [searchQuery, setSearchQuery] = useState("");
  const [trackerTab, setTrackerTab] = useState<"ticket" | "dispatch">(isMeridian ? "dispatch" : "ticket");

  // Simulated Work Desk State
  const [selectedItemId, setSelectedItemId] = useState<string>(isMeridian ? "iss_contractor_01" : "iss_01");
  const [simulatedRefundAmount, setSimulatedRefundAmount] = useState<string>("49.00");
  const [generatedPin, setGeneratedPin] = useState<string>("8492-X");
  const [isGeneratingPin, setIsGeneratingPin] = useState<boolean>(false);
  const [isProcessingRefund, setIsProcessingRefund] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; type: "ok" | "warn" } | null>(null);

  // Auto-switch default selected item when tenant changes
  useEffect(() => {
    if (isMeridian) {
      setSelectedItemId("iss_contractor_01");
      setTrackerTab("dispatch");
    } else {
      setSelectedItemId("iss_01");
      setTrackerTab("ticket");
    }
    setActionFeedback(null);
  }, [tenantSlug, isMeridian]);

  // Filtered Issues for Acme (Customer Care) vs Meridian (Contractor Dispatch)
  const acmeIssues = db.issues.filter((i) => !i.category?.includes("contractor") && !i.tags?.includes("contractor"));
  const meridianIssues = db.issues.filter((i) => i.category?.includes("contractor") || i.tags?.includes("contractor") || i.entityType === "contractor");

  const currentIssuesList = isMeridian ? meridianIssues : acmeIssues;
  const activeIssue = currentIssuesList.find((i) => i.id === selectedItemId) || currentIssuesList[0] || db.issues[0];

  const formattedName = isMeridian ? "Meridian Logistics" : "Acme Corp";

  // Simulate Lockbox PIN generation
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

  // Simulate OrderV8 Refund Voucher
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

  // Mock Knowledge Base Articles
  const kbArticles = [
    {
      id: "kb_1",
      title: "Contractor On-Site Lockbox & Digital PIN Access Protocol",
      category: "Contractors",
      stream: "contractors" as ChatStreamType,
      snippet: "How to generate and verify one-time electronic site access PINs for Building A and B telecom closets.",
      views: 342,
      updated: "2 days ago",
    },
    {
      id: "kb_2",
      title: "OrderV8 Autonomous Refund Tokens & Credit Dispatch Guidelines",
      category: "Billing",
      stream: "customers" as ChatStreamType,
      snippet: "Subscriptions under Enterprise and Pro tiers qualify for automated instant credit vouchers up to $500.",
      views: 819,
      updated: "1 day ago",
    },
    {
      id: "kb_3",
      title: "Zero-Trust ForgeGW SEC-04 Action Verification Matrix",
      category: "Security",
      stream: "enquiries" as ChatStreamType,
      snippet: "Overview of mutual TLS (mTLS), strict idempotency tokens, and SHA-256 hash chaining on all action endpoints.",
      views: 512,
      updated: "3 days ago",
    },
    {
      id: "kb_4",
      title: "Subcontractor W9 & Certificate of Insurance (COI) Uploads",
      category: "Compliance",
      stream: "contractors" as ChatStreamType,
      snippet: "Step-by-step instructions for uploading updated liability insurance and tax forms to the secure S3 vault.",
      views: 290,
      updated: "5 days ago",
    },
  ];

  return (
    <div className="min-h-screen bg-[#090E15] text-[#EAF1F8] font-sans selection:bg-[#2ED8B6]/30 selection:text-[#2ED8B6] flex flex-col">
      {/* ========================================================================= */}
      {/* TOP NOTIFICATION & SANDBOX CONTROL BANNER */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* TENANT HEADER & SURFACE MODE SWITCHER */}
      {/* ========================================================================= */}
      <header className="bg-[#0B1017]/95 backdrop-blur-md border-b border-[var(--line)] px-6 lg:px-8 py-3.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <SupportV8Logo size={30} showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-[#EAF1F8]">
                {formattedName} <span className="text-[#2ED8B6]">SupportV8 Cockpit</span>
              </span>
              <span className="pill ok text-[9.5px] font-mono"><i className="dot"></i> LIVE MESH</span>
            </div>
            <p className="text-[10px] font-mono text-[#6B7C8D]">{tenantSlug}.support.servicev8.com</p>
          </div>
        </div>

        {/* Surface Selector Toggle: Work Desk vs Public Help Desk */}
        <div className="flex items-center gap-1 bg-[#141C26] p-1 rounded-xl border border-[var(--line)] text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveSurfaceTab("work_desk")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSurfaceTab === "work_desk"
                ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-md"
                : "text-[#8E9AA8] hover:text-[#EAF1F8]"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Operator Work Desk (Interactive)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSurfaceTab("public_portal")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              activeSurfaceTab === "public_portal"
                ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-md"
                : "text-[#8E9AA8] hover:text-[#EAF1F8]"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Public Help &amp; Dispatch Hub</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenSignIn}
            className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#EAF1F8] px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#2ED8B6]" />
            <span>Staff Sign In</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* VIEW 1: UNIQUE OPERATOR WORK DESK (ACME CORP VS MERIDIAN) */}
      {/* ========================================================================= */}
      {activeSurfaceTab === "work_desk" && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#0B1017]">
          {/* Work Desk Metrics Strip */}
          <div className="bg-[#0E1520] border-b border-[var(--line)] px-6 py-2.5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            {isMeridian ? (
              <>
                <div>
                  <span className="text-[#6B7C8D]">ACTIVE TECHNICIANS:</span>
                  <div className="text-[#EAF1F8] font-bold text-sm">28 On-Site</div>
                </div>
                <div>
                  <span className="text-[#6B7C8D]">WORK ORDER DISPATCH SLA:</span>
                  <div className="text-[#F5A623] font-bold text-sm">99.8% (Target &lt; 15m)</div>
                </div>
                <div>
                  <span className="text-[#6B7C8D]">EMERGENCY PIN LATENCY:</span>
                  <div className="text-[#2ED8B6] font-bold text-sm">0.8s (mTLS ForgeGW)</div>
                </div>
                <div>
                  <span className="text-[#6B7C8D]">AI DISPATCH LEAD:</span>
                  <div className="text-[#EAF1F8] font-bold text-sm flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-[#F5A623]" />
                    <span>Alex (Copilot Mode)</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-[#6B7C8D]">PROTECTED ARR VALUE:</span>
                  <div className="text-[#EAF1F8] font-bold text-sm">$420k ARR Portfolio</div>
                </div>
                <div>
                  <span className="text-[#6B7C8D]">CUSTOMER SATISFACTION (CSAT):</span>
                  <div className="text-[#2ED8B6] font-bold text-sm">98.9% (Sophia Lead)</div>
                </div>
                <div>
                  <span className="text-[#6B7C8D]">ORDERV8 REFUND GATEWAY:</span>
                  <div className="text-[#4D9FFF] font-bold text-sm">&lt; $500 Auto-Voucher</div>
                </div>
                <div>
                  <span className="text-[#6B7C8D]">AI CS LEAD:</span>
                  <div className="text-[#EAF1F8] font-bold text-sm flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Sophia (Copilot Mode)</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Action Notice Alert Feedback */}
          {actionFeedback && (
            <div className="bg-[#121A24] border-b border-[#2ED8B6]/40 px-6 py-2 flex items-center justify-between text-xs font-mono text-[#2ED8B6]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{actionFeedback.text}</span>
              </span>
              <button onClick={() => setActionFeedback(null)} className="text-[#6B7C8D] hover:text-[#EAF1F8]">
                Dismiss
              </button>
            </div>
          )}

          {/* 3-Pane Work Desk Layout */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-[var(--line)]">
            {/* PANE 1: Active Tickets / Work Orders Queue (3 Cols) */}
            <div className="lg:col-span-3 flex flex-col min-h-0 bg-[#0C121A]">
              <div className="p-3.5 border-b border-[var(--line)] flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-[#EAF1F8] uppercase">
                  {isMeridian ? "Field Work Orders" : "Priority Customer Queue"}
                </span>
                <span className="pill text-[9px] font-mono bg-[#18222E] text-[#2ED8B6]">
                  {currentIssuesList.length} Active
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
                {currentIssuesList.map((issue) => {
                  const isSelected = issue.id === activeIssue?.id;
                  const isContractorTicket = Boolean(issue.contractor) || issue.entityType === "contractor";

                  return (
                    <div
                      key={issue.id}
                      onClick={() => {
                        setSelectedItemId(issue.id);
                        setActionFeedback(null);
                      }}
                      className={`p-3.5 transition-all cursor-pointer space-y-1.5 ${
                        isSelected
                          ? "bg-[#18222E] border-l-4 border-l-[#2ED8B6]"
                          : "hover:bg-[#141C26] opacity-85 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                        <span className="font-bold text-[#EAF1F8]">{issue.externalId}</span>
                        <span className={`pill ${issue.priority === "urgent" ? "err" : "ok"} text-[9px] py-0 px-1`}>
                          {issue.priority}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#EAF1F8] line-clamp-1">
                        {isContractorTicket && issue.contractor
                          ? `${issue.contractor.contactName} (${issue.contractor.company})`
                          : issue.customerName}
                      </h4>

                      <p className="text-[11px] text-[#8E9AA8] line-clamp-2">
                        {issue.summary}
                      </p>

                      <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-1">
                        <span>{isContractorTicket ? "Field Tech" : "Enterprise"}</span>
                        <span className="text-[#2ED8B6]">
                          {isContractorTicket ? issue.contractor?.siteLocation?.split("•")[0] || "On-Site" : "$420k ARR"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PANE 2: Customer / Contractor 360 Profile (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col min-h-0 bg-[#0E1520] overflow-y-auto p-5 space-y-5">
              {/* Profile Card Header */}
              <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6]">
                      {isMeridian ? <HardHat className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#EAF1F8]">
                        {isMeridian && activeIssue?.contractor
                          ? activeIssue.contractor.contactName
                          : activeIssue?.customerName || "Acme Enterprise Customer"}
                      </h3>
                      <p className="text-[10px] font-mono text-[#6B7C8D]">
                        {isMeridian && activeIssue?.contractor
                          ? `${activeIssue.contractor.company} • ${activeIssue.contractor.trade}`
                          : "Tier-1 Enterprise Customer • ARR $420k"}
                      </p>
                    </div>
                  </div>

                  <span className="pill ok text-[10px] font-mono">
                    <i className="dot"></i> {isMeridian ? "COI VERIFIED" : "ACTIVE SUB"}
                  </span>
                </div>

                {/* Vertical Specific Metadata Table */}
                {isMeridian && activeIssue?.contractor ? (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--line)] text-xs font-mono">
                    <div className="p-2 rounded bg-[#18222E] space-y-0.5">
                      <span className="text-[10px] text-[#6B7C8D]">Site Location:</span>
                      <div className="text-[#EAF1F8] font-bold text-[11px] truncate">
                        {activeIssue.contractor.siteLocation}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#18222E] space-y-0.5">
                      <span className="text-[10px] text-[#6B7C8D]">Work Order #:</span>
                      <div className="text-[#F5A623] font-bold text-[11px]">
                        {activeIssue.contractor.workOrderId}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--line)] text-xs font-mono">
                    <div className="p-2 rounded bg-[#18222E] space-y-0.5">
                      <span className="text-[10px] text-[#6B7C8D]">Stripe Customer Ref:</span>
                      <div className="text-[#EAF1F8] font-bold text-[11px] truncate">
                        cus_acme_prod_99412
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#18222E] space-y-0.5">
                      <span className="text-[10px] text-[#6B7C8D]">SLA Commitment:</span>
                      <div className="text-[#2ED8B6] font-bold text-[11px]">
                        15 Min Response • 99.9%
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Case Summary & Telemetry Log */}
              <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-2.5">
                <div className="text-xs font-bold font-mono text-[#EAF1F8] flex items-center justify-between">
                  <span>Issue Diagnostics &amp; Scope</span>
                  <span className="text-[10px] text-[#2ED8B6] font-mono">Confidence: 94%</span>
                </div>
                <p className="text-xs text-[#B4C2D0] leading-relaxed">
                  {activeIssue?.summary}
                </p>
                <div className="p-2.5 rounded-xl bg-[#18222E] text-[11px] font-mono text-[#8E9AA8] space-y-1">
                  <div>Source: <span className="text-[#EAF1F8]">{activeIssue?.source}</span></div>
                  <div>Sentiment: <span className="text-[#F5A623] uppercase">{activeIssue?.sentiment}</span></div>
                  <div>Category: <span className="text-[#2ED8B6]">{activeIssue?.category}</span></div>
                </div>
              </div>
            </div>

            {/* PANE 3: Specialized Side-Effect Action Dispatcher (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col min-h-0 bg-[#0C121A] p-5 space-y-5 overflow-y-auto">
              <div className="text-xs font-bold font-mono text-[#EAF1F8] flex items-center justify-between">
                <span>{isMeridian ? "Field Action Dispatcher" : "OrderV8 Action Dispatcher"}</span>
                <span className="pill route text-[9px] font-mono">ForgeGW SEC-04</span>
              </div>

              {/* ACTION STATION: MERIDIAN (EMERGENCY SITE PIN GENERATOR) */}
              {isMeridian ? (
                <div className="p-4 rounded-2xl bg-[#121A24] border border-[#F5A623]/40 space-y-3.5 shadow-lg shadow-[#F5A623]/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#F5A623]">
                    <KeyRound className="w-4 h-4" />
                    <span>Emergency Digital Lockbox PIN</span>
                  </div>
                  <p className="text-[11px] text-[#8E9AA8]">
                    Generates an ephemeral 24-hour cryptographic access PIN for building telecom closets and pushes to the contractor via SMS.
                  </p>

                  <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#6B7C8D] font-mono">Current Active PIN:</span>
                      <div className="text-base font-bold text-[#2ED8B6] font-mono tracking-widest">{generatedPin}</div>
                    </div>
                    <span className="pill ok text-[9px] font-mono">24h TTL</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGeneratePin}
                    disabled={isGeneratingPin}
                    className="w-full btn bg-[#F5A623] hover:bg-[#D98200] text-[#04201C] font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    {isGeneratingPin ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="w-3.5 h-3.5" />
                    )}
                    <span>Generate &amp; Dispatch New PIN</span>
                  </button>
                </div>
              ) : (
                /* ACTION STATION: ACME CORP (ORDERV8 REFUND TOKEN DISPATCHER) */
                <div className="p-4 rounded-2xl bg-[#121A24] border border-[#2ED8B6]/40 space-y-3.5 shadow-lg shadow-[#2ED8B6]/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#2ED8B6]">
                    <DollarSign className="w-4 h-4" />
                    <span>OrderV8 Autonomous Refund Token</span>
                  </div>
                  <p className="text-[11px] text-[#8E9AA8]">
                    1-Click issuance of instant billing credit vouchers (&lt; $500) under zero-trust cryptographic limits with Stripe sync.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-[#6B7C8D]">Credit Voucher Amount ($USD):</label>
                    <input
                      type="text"
                      value={simulatedRefundAmount}
                      onChange={(e) => setSimulatedRefundAmount(e.target.value)}
                      className="w-full bg-[#18222E] border border-[var(--line)] rounded-xl px-3 py-2 text-xs font-mono text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleIssueRefund}
                    disabled={isProcessingRefund}
                    className="w-full btn btn-primary font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
                  >
                    {isProcessingRefund ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    <span>Dispatch ${simulatedRefundAmount} Credit Token</span>
                  </button>
                </div>
              )}

              {/* AI Employee Recommended Response Generator */}
              <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#EAF1F8]">
                  <Bot className="w-4 h-4 text-[#2ED8B6]" />
                  <span>{isMeridian ? "Alex's Copilot Recommendation" : "Sophia's Copilot Recommendation"}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#18222E] text-[11px] text-[#B4C2D0] leading-relaxed font-mono">
                  {isMeridian
                    ? `\"Hi Dave, Work Order ${activeIssue?.contractor?.workOrderId || "WO-7741"} is authorized for ${activeIssue?.contractor?.siteLocation || "Building B"}. Access PIN: ${generatedPin}. Telemetry confirms optic link is standby.\"`
                    : `\"Hello ${activeIssue?.customerName || "Customer"}, we have processed your OrderV8 billing adjustment token. Your invoice credit voucher is now active.\"`}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: PUBLIC HELP & DISPATCH HUB (END-USER PREVIEW) */}
      {/* ========================================================================= */}
      {activeSurfaceTab === "public_portal" && (
        <main className="max-w-6xl mx-auto px-6 py-10 space-y-10 flex-1">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#EAF1F8]">
              How can {formattedName} assist you today?
            </h1>
            <p className="text-xs sm:text-sm text-[#8E9AA8]">
              Search verified knowledge documents, verify on-site contractor PINs, or track your live ticket.
            </p>

            <div className="relative max-w-xl mx-auto pt-2">
              <Search className="w-4 h-4 text-[#6B7C8D] absolute left-4 top-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search knowledge base, refund guidelines, PINs, work orders..."
                className="w-full bg-[#121A24] border border-[var(--line-2)] rounded-2xl pl-11 pr-4 py-3.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] shadow-xl"
              />
            </div>
          </div>

          {/* Tracker Station */}
          <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6]">
                  <Clock className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8]">Universal Case &amp; Dispatch Tracker</h3>
                  <p className="text-[10px] font-mono text-[#6B7C8D]">Track Customer Support Tickets, Billing Requests &amp; Field Work Orders</p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[#141C26] p-1 rounded-xl border border-[var(--line)] font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setTrackerTab("ticket")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    trackerTab === "ticket"
                      ? "bg-[#2ED8B6] text-[#04201C] font-bold"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Customer &amp; Account Case</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTrackerTab("dispatch")}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    trackerTab === "dispatch"
                      ? "bg-[#2ED8B6] text-[#04201C] font-bold"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Field Ops &amp; Work Order</span>
                </button>
              </div>
            </div>

            {trackerTab === "ticket" ? (
              <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#EAF1F8] text-sm">TCK-8821</span>
                  <span className="pill ok uppercase text-[9px]"><i className="dot"></i> IN PROGRESS</span>
                </div>
                <p className="text-xs text-[#B4C2D0] font-sans">Autonomous OrderV8 Token Sync &amp; Refund Request #892</p>
                <div className="text-[11px] text-[#6B7C8D] pt-1">Assigned Agent: Sophia (Customer Success Lead)</div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#121A24] border border-[#F5A623]/40 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#EAF1F8] text-sm">WO-7741</span>
                  <span className="pill warn uppercase text-[9px]"><i className="dot"></i> EN ROUTE</span>
                </div>
                <p className="text-xs text-[#B4C2D0] font-sans">Dave Miller (Apex Telecom HVAC) • Building B Telecom Closet</p>
                <div className="text-[11px] text-[#F5A623] font-bold">Lockbox PIN: {generatedPin}</div>
              </div>
            )}
          </div>

          {/* Knowledge Articles */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-[#EAF1F8] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2ED8B6]" />
              <span>Verified Knowledge Base Documents</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kbArticles.map((art) => (
                <div
                  key={art.id}
                  className="card p-5 bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/50 rounded-2xl transition-all space-y-2"
                >
                  <span className="pill text-[10px] font-mono bg-[#18222E] text-[#2ED8B6]">
                    {art.category}
                  </span>
                  <h4 className="text-xs font-bold text-[#EAF1F8]">{art.title}</h4>
                  <p className="text-[11px] text-[#8E9AA8] line-clamp-2">{art.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* Embedded Tenant-Scoped Support Chat Widget */}
      <SupportChatWidget
        defaultStream={isMeridian ? "contractors" : "customers"}
        tenantDomain={tenantSlug}
      />
    </div>
  );
}

"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";
import type { ChatStreamType } from "@/lib/types";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [trackerTab, setTrackerTab] = useState<"ticket" | "dispatch">(isMeridian ? "dispatch" : "ticket");

  // Ticket Lookup State
  const [ticketSearchId, setTicketSearchId] = useState(isMeridian ? "TCK-9042" : "TCK-8821");
  const [ticketResult, setTicketResult] = useState<{
    id: string;
    status: string;
    subject: string;
    assignedTo: string;
    updatedAt: string;
    eta: string;
    priority: string;
    channel: string;
  } | null>({
    id: isMeridian ? "TCK-9042" : "TCK-8821",
    status: "in_progress",
    subject: isMeridian
      ? "HVAC Sensor Calibration & Substation B Alarm Clearance"
      : "Autonomous OrderV8 Token Sync & Refund Request #892",
    assignedTo: isMeridian ? "Alex (Contractor & CX Lead)" : "Sophia (Customer Success Lead)",
    updatedAt: "2 mins ago",
    eta: "< 5 mins",
    priority: "High",
    channel: "Omnichannel Desk",
  });

  // Dispatch / Work Order Lookup State
  const [workOrderSearchId, setWorkOrderSearchId] = useState("WO-7741");
  const [workOrderResult, setWorkOrderResult] = useState<{
    id: string;
    status: string;
    contractorName: string;
    siteAddress: string;
    lockboxPin: string;
    etaMinutes: number;
    sowTask: string;
  } | null>({
    id: "WO-7741",
    status: "en_route",
    contractorName: "Dave Miller (Apex Telecom HVAC)",
    siteAddress: "Building B • 4th Floor Telecom Closet",
    lockboxPin: "8492-X",
    etaMinutes: 14,
    sowTask: "Emergency Fiber Splicing & Secondary Gateway Check",
  });

  const [defaultStream, setDefaultStream] = useState<ChatStreamType>(isMeridian ? "contractors" : "customers");
  const isDemo = tenantSlug.toLowerCase() === "acme" || tenantSlug.toLowerCase() === "meridian";

  const formattedName =
    tenantSlug.toLowerCase() === "meridian"
      ? "Meridian Logistics"
      : tenantSlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ") || "Acme Corp";

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

  const filteredArticles = kbArticles.filter(
    (a) =>
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.snippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTicketLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSearchId.trim()) return;

    if (ticketSearchId.toUpperCase().includes("8821")) {
      setTicketResult({
        id: "TCK-8821",
        status: "in_progress",
        subject: "Autonomous OrderV8 Token Sync & Refund Request #892",
        assignedTo: "Sophia (Customer Success Lead)",
        updatedAt: "Just now",
        eta: "< 5 mins",
        priority: "High",
        channel: "Omnichannel Desk",
      });
    } else if (ticketSearchId.toUpperCase().includes("9042")) {
      setTicketResult({
        id: "TCK-9042",
        status: "in_progress",
        subject: "HVAC Sensor Calibration & Substation B Alarm Clearance",
        assignedTo: "Alex (Contractor & CX Lead)",
        updatedAt: "1 min ago",
        eta: "8 mins",
        priority: "Urgent",
        channel: "Field Work Desk",
      });
    } else {
      setTicketResult({
        id: ticketSearchId.toUpperCase(),
        status: "under_review",
        subject: `Live Support Request: ${ticketSearchId.toUpperCase()}`,
        assignedTo: "Alex (Support Intelligence Lead)",
        updatedAt: "1 min ago",
        eta: "10-15 mins",
        priority: "Normal",
        channel: "Knowledge Suite RAG",
      });
    }
  };

  const handleWorkOrderLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workOrderSearchId.trim()) return;

    if (workOrderSearchId.toUpperCase().includes("7741")) {
      setWorkOrderResult({
        id: "WO-7741",
        status: "en_route",
        contractorName: "Dave Miller (Apex Telecom HVAC)",
        siteAddress: "Building B • 4th Floor Telecom Closet",
        lockboxPin: "8492-X",
        etaMinutes: 14,
        sowTask: "Emergency Fiber Splicing & Secondary Gateway Check",
      });
    } else {
      setWorkOrderResult({
        id: workOrderSearchId.toUpperCase(),
        status: "dispatched",
        contractorName: "Regional Contractor Team #4",
        siteAddress: "Main Distribution Center • Lockbox 03",
        lockboxPin: "1940-A",
        etaMinutes: 28,
        sowTask: "Scheduled Site Inspection & Diagnostic Telemetry",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#090E15] text-[#EAF1F8] font-sans selection:bg-[#2ED8B6]/30 selection:text-[#2ED8B6]">
      {/* Real-Time Live Status Ticker Bar */}
      <div className="bg-[#0D1520] border-b border-[var(--line)] px-4 lg:px-12 py-1.5 text-[11px] font-mono flex items-center justify-between text-[#8E9CAE] overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5 text-[#2ED8B6]">
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="font-bold text-[10px] uppercase">Live Status:</span>
            <span>All Systems Operational</span>
          </div>
          <span className="text-[10px] text-[#6B7C8D]">Telephony Ingress: Normal</span>
          <span className="text-[10px] text-[#6B7C8D]">AI Workforce: Active (Alex &amp; Sophia)</span>
          <span className="text-[10px] text-[#6B7C8D]">Field Dispatch SLA: 99.8%</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#2ED8B6]">
            Tenant: <strong>{tenantSlug}.support.servicev8.com</strong>
          </span>
        </div>
      </div>

      {/* Demo Sandbox Alert Header Banner (When viewing preview) */}
      {isDemo && (
        <div className="bg-gradient-to-r from-[#F5A623]/15 via-[#2ED8B6]/10 to-[#F5A623]/15 border-b border-[#F5A623]/30 px-6 lg:px-12 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 text-[#F5A623]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              <strong>Demo Sandbox Preview:</strong> You are viewing <strong>{formattedName}</strong>.
            </span>
          </div>

          <div className="flex items-center gap-3">
            {onSwitchTenant && (
              <div className="flex items-center gap-1 bg-[#121A24] p-1 rounded-lg border border-[var(--line)] text-[10px]">
                <button
                  type="button"
                  onClick={() => onSwitchTenant("acme")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tenantSlug === "acme" ? "bg-[#2ED8B6] text-[#090E15] font-bold" : "text-[#8E9AA8] hover:text-[#EAF1F8]"
                  }`}
                >
                  Acme Corp (Care)
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchTenant("meridian")}
                  className={`px-2 py-0.5 rounded cursor-pointer ${
                    tenantSlug === "meridian" ? "bg-[#F5A623] text-[#090E15] font-bold" : "text-[#8E9AA8] hover:text-[#EAF1F8]"
                  }`}
                >
                  Meridian (Dispatch)
                </button>
              </div>
            )}

            <button
              onClick={onOpenSignup}
              className="text-[#2ED8B6] font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Create Your Own Isolated Workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tenant Portal Header */}
      <header className="sticky top-0 z-40 bg-[#090E15]/90 backdrop-blur-xl border-b border-[var(--line)] px-6 lg:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SupportV8Logo size={32} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-[#EAF1F8]">
                {formattedName} <span className="text-[#2ED8B6]">Help &amp; Dispatch Desk</span>
              </span>
              <span className="pill ok text-[9.5px] font-mono"><i className="dot"></i> ONLINE</span>
            </div>
            <p className="text-[10px] font-mono text-[#6B7C8D]">{tenantSlug}.support.servicev8.com</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenGlobalLanding}
            className="btn btn-secondary px-3 py-1.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-[#4D9FFF]" />
            <span>Platform Overview</span>
          </button>

          <button
            onClick={onOpenSignIn}
            className="btn bg-[#18222E] hover:bg-[#1E2B3A] border border-[var(--line-2)] text-[#EAF1F8] px-3.5 py-1.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#2ED8B6]" />
            <span>Staff Sign In</span>
          </button>
        </div>
      </header>

      {/* Main Tenant Portal Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Hero Search & Quick Action Channels */}
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

        {/* ========================================================================= */}
        {/* TICKET & CONTRACTOR DISPATCH TRACKER STATION */}
        {/* ========================================================================= */}
        <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6]">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#EAF1F8]">Live Status &amp; Dispatch Tracker</h3>
                <p className="text-[10px] font-mono text-[#6B7C8D]">Track Customer Tickets &amp; Contractor Work Orders</p>
              </div>
            </div>

            {/* Tracker Segment Switcher */}
            <div className="flex items-center gap-1 bg-[#141C26] p-1 rounded-xl border border-[var(--line)] font-mono text-xs">
              <button
                type="button"
                onClick={() => setTrackerTab("ticket")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  trackerTab === "ticket"
                    ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-sm"
                    : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Customer Ticket</span>
              </button>

              <button
                type="button"
                onClick={() => setTrackerTab("dispatch")}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                  trackerTab === "dispatch"
                    ? "bg-[#2ED8B6] text-[#04201C] font-bold shadow-sm"
                    : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Contractor Dispatch</span>
              </button>
            </div>
          </div>

          {/* TAB 1: Customer Ticket Tracker */}
          {trackerTab === "ticket" && (
            <div className="space-y-4">
              <form onSubmit={handleTicketLookup} className="flex gap-2">
                <input
                  type="text"
                  value={ticketSearchId}
                  onChange={(e) => setTicketSearchId(e.target.value)}
                  placeholder="Enter Ticket ID (e.g. TCK-8821 or TCK-9042)"
                  className="flex-1 bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
                <button type="submit" className="btn btn-primary px-4 py-2.5 text-xs font-bold font-mono cursor-pointer">
                  <span>Track Ticket</span>
                </button>
              </form>

              {ticketResult && (
                <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#EAF1F8] text-sm">{ticketResult.id}</span>
                      <span className="pill ok uppercase text-[9px]"><i className="dot"></i> {ticketResult.status.replace("_", " ")}</span>
                    </div>
                    <span className="text-[#F5A623] text-[11px] font-bold">Est. Resolution: {ticketResult.eta}</span>
                  </div>

                  <p className="text-xs text-[#B4C2D0] font-sans">{ticketResult.subject}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--line)] text-[11px] text-[#6B7C8D]">
                    <div>
                      <span>Assigned Agent:</span>
                      <div className="text-[#EAF1F8] font-bold">{ticketResult.assignedTo}</div>
                    </div>
                    <div>
                      <span>Priority:</span>
                      <div className="text-[#2ED8B6] font-bold">{ticketResult.priority}</div>
                    </div>
                    <div>
                      <span>Last Update:</span>
                      <div className="text-[#EAF1F8]">{ticketResult.updatedAt}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Contractor Field Dispatch Tracker */}
          {trackerTab === "dispatch" && (
            <div className="space-y-4">
              <form onSubmit={handleWorkOrderLookup} className="flex gap-2">
                <input
                  type="text"
                  value={workOrderSearchId}
                  onChange={(e) => setWorkOrderSearchId(e.target.value)}
                  placeholder="Enter Work Order # (e.g. WO-7741)"
                  className="flex-1 bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
                <button type="submit" className="btn btn-primary px-4 py-2.5 text-xs font-bold font-mono cursor-pointer">
                  <span>Verify Dispatch</span>
                </button>
              </form>

              {workOrderResult && (
                <div className="p-4 rounded-2xl bg-[#121A24] border border-[#F5A623]/40 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#F5A623]" />
                      <span className="font-bold text-[#EAF1F8] text-sm">{workOrderResult.id}</span>
                      <span className="pill warn uppercase text-[9px]"><i className="dot"></i> {workOrderResult.status.replace("_", " ")}</span>
                    </div>
                    <span className="text-[#2ED8B6] text-[11px] font-bold">Technician ETA: {workOrderResult.etaMinutes} mins</span>
                  </div>

                  <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[#8E9AA8]">Contractor:</span>
                      <strong className="text-[#EAF1F8]">{workOrderResult.contractorName}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#8E9AA8]">Site Location:</span>
                      <span className="text-[#B4C2D0] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#E5484D]" />
                        {workOrderResult.siteAddress}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--line)]">
                      <span className="text-[#8E9AA8]">Emergency Lockbox PIN:</span>
                      <span className="px-2 py-0.5 rounded bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 text-[#2ED8B6] font-bold tracking-wider">
                        {workOrderResult.lockboxPin}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#6B7C8D]">
                    SOW Scope: <span className="text-[#EAF1F8]">{workOrderResult.sowTask}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3 Audience Support Channels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            onClick={() => setDefaultStream("contractors")}
            className={`card p-5 rounded-2xl border transition-all cursor-pointer ${
              defaultStream === "contractors"
                ? "bg-[#18222E] border-[#F5A623] shadow-lg shadow-[#F5A623]/10"
                : "bg-[#121A24] border-[var(--line)] hover:border-[#F5A623]/40"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 text-[#F5A623] flex items-center justify-center mb-3">
              <HardHat className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#EAF1F8]">Contractors &amp; Field Dispatch</h3>
            <p className="text-xs text-[#8E9AA8] mt-1">
              Verify digital site PINs, check work order status, and upload COI compliance proofs.
            </p>
          </div>

          <div
            onClick={() => setDefaultStream("customers")}
            className={`card p-5 rounded-2xl border transition-all cursor-pointer ${
              defaultStream === "customers"
                ? "bg-[#18222E] border-[#2ED8B6] shadow-lg shadow-[#2ED8B6]/10"
                : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#EAF1F8]">Customer Care &amp; Billing</h3>
            <p className="text-xs text-[#8E9AA8] mt-1">
              Request OrderV8 refund tokens, subscription upgrades, and view resolution timers.
            </p>
          </div>

          <div
            onClick={() => setDefaultStream("enquiries")}
            className={`card p-5 rounded-2xl border transition-all cursor-pointer ${
              defaultStream === "enquiries"
                ? "bg-[#18222E] border-[#4D9FFF] shadow-lg shadow-[#4D9FFF]/10"
                : "bg-[#121A24] border-[var(--line)] hover:border-[#4D9FFF]/40"
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-[#4D9FFF]/15 text-[#4D9FFF] flex items-center justify-center mb-3">
              <HelpCircle className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#EAF1F8]">Product Consultations</h3>
            <p className="text-xs text-[#8E9AA8] mt-1">
              Explore enterprise SLA guarantees, custom feature proposals, and security audits.
            </p>
          </div>
        </div>

        {/* Knowledge Articles Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#EAF1F8] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2ED8B6]" />
              <span>Verified Knowledge Base Documents</span>
            </h3>
            <span className="text-xs font-mono text-[#6B7C8D]">
              {filteredArticles.length} documents matching
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((art) => (
              <div
                key={art.id}
                onClick={() => setDefaultStream(art.stream)}
                className="card p-5 bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/50 rounded-2xl transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="pill text-[10px] font-mono bg-[#18222E] text-[#2ED8B6]">
                    {art.category}
                  </span>
                  <span className="text-[#6B7C8D] text-[10px] font-mono">{art.updated}</span>
                </div>
                <h4 className="text-xs font-bold text-[#EAF1F8]">{art.title}</h4>
                <p className="text-[11px] text-[#8E9AA8] line-clamp-2">{art.snippet}</p>
                <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)]">
                  <span>{art.views} views</span>
                  <span className="text-[#2ED8B6] flex items-center gap-1">
                    <span>Ask AI Assistant</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Embedded Tenant-Scoped Support Chat Widget */}
      <SupportChatWidget
        defaultStream={defaultStream}
        tenantDomain={tenantSlug}
      />
    </div>
  );
}

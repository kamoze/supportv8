"use client";

import React, { useState } from "react";
import {
  Search,
  BookOpen,
  HardHat,
  Users,
  Shield,
  ChevronRight,
  Clock,
  ArrowUpRight,
  Sparkles,
  MessageSquare,
  AlertCircle,
  UserCheck,
  Truck,
  Lock,
  X,
  Copy,
  CheckCheck,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";
import type { ChatStreamType } from "@/lib/types";
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
}: TenantLandingViewProps) {
  const cleanSlug = tenantSlug.toLowerCase().trim();
  const isMeridian = cleanSlug === "meridian";
  const isAcmeDemo = cleanSlug === "acme";
  const isDemo = isAcmeDemo || isMeridian;
  const tenantData = db.getTenantData(cleanSlug);
  const isClean = tenantData.isClean;

  const [searchQuery, setSearchQuery] = useState("");
  const [trackerTab, setTrackerTab] = useState<"ticket" | "dispatch">(isMeridian ? "dispatch" : "ticket");
  const [trackerSearchId, setTrackerSearchId] = useState("");
  const [trackedItem, setTrackedItem] = useState<any | null>(null);
  const [trackerError, setTrackerError] = useState("");

  // Article Form View Reader Drawer State
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Dynamic formatted tenant name
  const formattedName = isMeridian
    ? "Meridian Logistics"
    : cleanSlug === "acme"
    ? "Acme Corp"
    : cleanSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

  // Curated Knowledge Base Articles (Empty for clean tenants like acme-movers until published)
  const kbArticles = isClean
    ? []
    : [
        {
          id: "kb_1",
          title: `${formattedName} Telephony Bridge & SIP Voice Provisioning Guide`,
          category: "Telephony",
          stream: "customers" as ChatStreamType,
          snippet: "Comprehensive architecture manual for integrating Twilio voice trunks, WebRTC live audio streaming, and sub-300ms transcription.",
          content: `### Telephony Architecture Overview\n${formattedName} leverages low-latency SIP trunks integrated with Twilio Voice Gateways to enable AI telephony assistants with sub-300ms turn-taking.\n\n### Key Components\n1. **SIP Trunking**: Inbound calls are routed over encrypted TLS SIP trunks to the Telephony Gateway.\n2. **Audio Streaming**: Bi-directional audio chunks are streamed via WebSocket to the speech-to-text pipeline.\n3. **Intent Extraction**: Voice sessions extract customer order references and caller sentiment in real-time.\n\n### Failover & Escalation\nWhen sentiment deteriorates below 0.40 or caller requests a human supervisor, the session executes an unconditional warm transfer to the on-call human operator queue.`,
          views: 1240,
          updated: "2 hours ago",
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

  return (
    <div className="min-h-screen bg-[#090E15] text-[#EAF1F8] font-sans selection:bg-[#2ED8B6]/30 selection:text-[#2ED8B6] flex flex-col">
      {/* ========================================================================= */}
      {/* TENANT HEADER NAVIGATION */}
      {/* ========================================================================= */}
      <header className="bg-[#0B1017]/95 backdrop-blur-md border-b border-[var(--line)] px-6 lg:px-8 py-3.5 flex items-center justify-between shrink-0 sticky top-0 z-40">
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
              {isMeridian ? "Contractor Dispatch & Field Resolution Hub" : "Customer Care & Self-Service Portal"}
            </p>
          </div>
        </div>

        {/* Global Hub Link & Portal Sign In */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onOpenGlobalLanding}
            className="hidden sm:flex text-xs font-mono text-[#8E9AA8] hover:text-[#EAF1F8] px-3 py-1.5 rounded-xl hover:bg-[#141C26] transition-colors cursor-pointer"
          >
            <span>Platform Hub</span>
          </button>

          <button
            onClick={onOpenSignIn}
            className="btn btn-primary px-3.5 py-1.5 text-xs font-bold shadow-lg shadow-[#2ED8B6]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN PUBLIC HELP & DISPATCH HUB */}
      {/* ========================================================================= */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10 flex-1 w-full">
        {/* Search Header */}
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#141C26] border border-[#2ED8B6]/30 text-xs font-mono text-[#2ED8B6]">
            <Sparkles className="w-3.5 h-3.5 text-[#2ED8B6]" />
            <span>{formattedName} Support Network</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#EAF1F8]">
            How can {formattedName} assist you today?
          </h1>
          <p className="text-xs sm:text-sm text-[#8E9AA8] max-w-lg mx-auto">
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

        {/* Feature Streams Showcase Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-3 shadow-xl hover:border-[#2ED8B6]/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6]">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#EAF1F8]">Customer Care &amp; Inquiries</h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Real-time resolutions for billing questions, product assistance, replacement requests, and SLA inquiries.
            </p>
          </div>

          <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-3 shadow-xl hover:border-[#F5A623]/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-[#F5A623]/15 border border-[#F5A623]/40 flex items-center justify-center text-[#F5A623]">
              <HardHat className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#EAF1F8]">Field Dispatch &amp; Work Orders</h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Subcontractor coordination, electronic lockbox access PINs, GPS-verified technician arrival, and change orders.
            </p>
          </div>

          <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-3 shadow-xl hover:border-[#4D9FFF]/40 transition-all">
            <div className="w-10 h-10 rounded-2xl bg-[#4D9FFF]/15 border border-[#4D9FFF]/40 flex items-center justify-center text-[#4D9FFF]">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-[#EAF1F8]">Verified Knowledge Base</h3>
            <p className="text-xs text-[#8E9AA8] leading-relaxed">
              Full-text document browser with interactive Form View reader, policy citations, and instant search.
            </p>
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
                {isDemo
                  ? "Try searching TCK-8821 or WO-7741 to view verified progress."
                  : "Enter your verified reference ID above to inspect real-time progress."}
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
                  <span>Sign In for Staff Operations &rarr;</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Verified Knowledge Base Articles Section */}
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
            <div className="p-8 rounded-2xl bg-[#0E1520] border border-[var(--line)] text-center space-y-3 font-mono text-xs shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-[#2ED8B6]/10 border border-[#2ED8B6]/30 flex items-center justify-center text-[#2ED8B6] mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#EAF1F8]">
                  {isClean ? "No Knowledge Base Documents Published Yet" : "No matching knowledge articles"}
                </h4>
                <p className="text-xs text-[#8E9AA8] max-w-md mx-auto">
                  {isClean
                    ? "This tenant workspace is newly provisioned. Organization administrators can sign in to the Knowledge Suite to upload, crawl, and publish customer-facing articles."
                    : `No knowledge base articles matched "${searchQuery}".`}
                </p>
              </div>
              {isClean && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onOpenSignIn}
                    className="btn btn-primary px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Sign In to Knowledge Suite</span>
                  </button>
                </div>
              )}
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
                <span>Verified Status: <strong className="text-[#2ED8B6]">Active Verified</strong></span>
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

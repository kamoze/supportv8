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
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { SupportChatWidget } from "@/components/chat/SupportChatWidget";
import type { ChatStreamType } from "@/lib/types";

interface TenantLandingViewProps {
  tenantSlug?: string;
  onEnterCockpit: () => void;
  onOpenGlobalLanding: () => void;
  onOpenSignup: () => void;
}

export function TenantLandingView({
  tenantSlug = "acme",
  onEnterCockpit,
  onOpenGlobalLanding,
  onOpenSignup,
}: TenantLandingViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [ticketSearchId, setTicketSearchId] = useState("");
  const [ticketResult, setTicketResult] = useState<{
    id: string;
    status: string;
    subject: string;
    assignedTo: string;
    updatedAt: string;
  } | null>(null);
  const [defaultStream, setDefaultStream] = useState<ChatStreamType>("customers");

  const formattedName =
    tenantSlug
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

  const handleSearchTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSearchId.trim()) return;

    if (ticketSearchId.toUpperCase().includes("WO") || ticketSearchId.toUpperCase().includes("VND")) {
      setTicketResult({
        id: ticketSearchId.toUpperCase(),
        status: "In Progress (On-Site Active)",
        subject: "Field Access Lockbox PIN Generation - Building B",
        assignedTo: "Alex (Contractor Dispatch Lead)",
        updatedAt: "5 minutes ago",
      });
    } else {
      setTicketResult({
        id: ticketSearchId.toUpperCase(),
        status: "Resolved (Refund Dispatched)",
        subject: "Order #ORD-94021 Replacement Sensor Credit",
        assignedTo: "Sophia (Customer Success Lead)",
        updatedAt: "12 minutes ago",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#090E15] text-[#EAF1F8] font-sans selection:bg-[#2ED8B6]/30 selection:text-[#2ED8B6]">
      {/* Branded Tenant Header */}
      <header className="sticky top-0 z-40 bg-[#090E15]/85 backdrop-blur-xl border-b border-[var(--line)] px-6 lg:px-12 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00F2FE] via-[#2ED8B6] to-[#059669] flex items-center justify-center text-[#090E15] font-black text-sm shadow-md shadow-[#2ED8B6]/20">
            {formattedName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-[#EAF1F8]">
                {formattedName} Support Center
              </span>
              <span className="pill text-[9px] font-mono uppercase bg-[#18222E] border-[#2ED8B6]/40 text-[#2ED8B6]">
                {tenantSlug}.support.servicev8.com
              </span>
            </div>
            <p className="text-[10px] font-mono text-[#6B7C8D]">Customer Help Hub & AI Omnichannel Desk</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenGlobalLanding}
            className="text-xs font-mono text-[#6B7C8D] hover:text-[#2ED8B6] transition-colors cursor-pointer hidden sm:block"
          >
            ← Global Landing
          </button>

          <button
            onClick={onEnterCockpit}
            className="btn btn-secondary px-3.5 py-1.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <span>Agent Workspace</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#2ED8B6]" />
          </button>

          <button
            onClick={onOpenSignup}
            className="btn btn-primary px-3.5 py-1.5 text-xs font-bold shadow-md shadow-[#2ED8B6]/20 cursor-pointer"
          >
            Create New Tenant
          </button>
        </div>
      </header>

      {/* Hero Help Search */}
      <section className="relative pt-16 pb-20 px-6 lg:px-12 border-b border-[var(--line)] bg-gradient-to-b from-[#0E1520] to-[#090E15]">
        <div className="max-w-4xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121A24] border border-[var(--line)] text-xs font-mono text-[#2ED8B6]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>24/7 AI-Powered Grounded Knowledge & Triage</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#EAF1F8] tracking-tight">
            How can we help you at <span className="text-[#2ED8B6]">{formattedName}</span>?
          </h1>

          <p className="text-sm text-[#8E9AA8] max-w-2xl mx-auto">
            Search our verified knowledge repository, look up live dispatch work orders, or connect directly with our live support staff and AI specialists.
          </p>

          {/* Search Input Box */}
          <div className="relative max-w-2xl mx-auto pt-3">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-[#6B7C8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles, refund policies, lockbox codes, W9 compliance..."
                className="w-full bg-[#121A24] border-2 border-[var(--line-2)] focus:border-[#2ED8B6] rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#EAF1F8] placeholder:text-[#6B7C8D] focus:outline-none shadow-xl shadow-black/40 transition-colors"
              />
            </div>

            {/* Popular Search Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-[11px] font-mono text-[#6B7C8D]">
              <span>Popular:</span>
              <button
                onClick={() => setSearchQuery("Lockbox PIN")}
                className="px-2.5 py-1 rounded-lg bg-[#121A24] border border-[var(--line)] hover:border-[#2ED8B6] text-[#B4C2D0] hover:text-[#2ED8B6] transition-colors cursor-pointer"
              >
                Lockbox PIN
              </button>
              <button
                onClick={() => setSearchQuery("Refund Token")}
                className="px-2.5 py-1 rounded-lg bg-[#121A24] border border-[var(--line)] hover:border-[#2ED8B6] text-[#B4C2D0] hover:text-[#2ED8B6] transition-colors cursor-pointer"
              >
                Refund Token
              </button>
              <button
                onClick={() => setSearchQuery("W9 Compliance")}
                className="px-2.5 py-1 rounded-lg bg-[#121A24] border border-[var(--line)] hover:border-[#2ED8B6] text-[#B4C2D0] hover:text-[#2ED8B6] transition-colors cursor-pointer"
              >
                W9 Compliance
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Quick Channel Cards */}
      <section className="py-12 px-6 lg:px-12 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Contractors Card */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] hover:border-[#F5A623]/60 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40 flex items-center justify-center">
                <HardHat className="w-5 h-5" />
              </div>
              <span className="pill text-[9px] font-mono bg-[#F5A623]/10 text-[#F5A623]">Contractors</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Field Contractor Portal</h3>
              <p className="text-xs text-[#8E9AA8] mt-1">
                Dispatch work orders, get on-site gate PINs, and submit invoice payment disputes.
              </p>
            </div>
            <div className="pt-2 text-xs font-mono text-[#F5A623] flex items-center gap-1">
              <span>Open live widget below</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Enquiries Card */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] hover:border-[#4D9FFF]/60 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-[#4D9FFF]/15 text-[#4D9FFF] border border-[#4D9FFF]/40 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <span className="pill text-[9px] font-mono bg-[#4D9FFF]/10 text-[#4D9FFF]">General</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Product & Solutions Desk</h3>
              <p className="text-xs text-[#8E9AA8] mt-1">
                Explore platform integrations, security whitepapers, and enterprise SLA packages.
              </p>
            </div>
            <div className="pt-2 text-xs font-mono text-[#4D9FFF] flex items-center gap-1">
              <span>Instant AI Knowledge</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Customers Card */}
          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/60 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="pill text-[9px] font-mono bg-[#2ED8B6]/10 text-[#2ED8B6]">Subscribers</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Client Care & Billing</h3>
              <p className="text-xs text-[#8E9AA8] mt-1">
                Account management, OrderV8 refund token vouchers, and high-priority bug reports.
              </p>
            </div>
            <div className="pt-2 text-xs font-mono text-[#2ED8B6] flex items-center gap-1">
              <span>Priority Triage Queue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* Knowledge Base Articles & Ticket Tracker Grid */}
      <section className="py-8 px-6 lg:px-12 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: KB Articles */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2ED8B6]" />
              <h3 className="text-sm font-bold text-[#EAF1F8]">Knowledge Base & Protocols</h3>
            </div>
            <span className="text-xs font-mono text-[#6B7C8D]">{filteredArticles.length} articles</span>
          </div>

          <div className="space-y-3">
            {filteredArticles.map((article) => (
              <div
                key={article.id}
                className="card p-4 rounded-2xl bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="pill text-[9px] font-mono uppercase bg-[#18222E] text-[#B4C2D0]">
                    {article.category}
                  </span>
                  <span className="text-[10px] font-mono text-[#6B7C8D]">Updated {article.updated}</span>
                </div>
                <h4 className="text-sm font-bold text-[#EAF1F8] hover:text-[#2ED8B6] transition-colors cursor-pointer">
                  {article.title}
                </h4>
                <p className="text-xs text-[#8E9AA8] line-clamp-2">{article.snippet}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Ticket & Dispatch Status Tracker */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[var(--line)]">
            <Clock className="w-4 h-4 text-[#4D9FFF]" />
            <h3 className="text-sm font-bold text-[#EAF1F8]">Ticket & Dispatch Tracker</h3>
          </div>

          <div className="card p-5 rounded-2xl bg-[#121A24] border-[var(--line)] space-y-4">
            <p className="text-xs text-[#8E9AA8]">
              Enter your Ticket ID, Order Number, or Work Order reference to check live status:
            </p>

            <form onSubmit={handleSearchTicket} className="space-y-2.5">
              <input
                type="text"
                value={ticketSearchId}
                onChange={(e) => setTicketSearchId(e.target.value)}
                placeholder="e.g. ORD-94021 or WO-90412"
                className="w-full bg-[#18222E] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
              <button
                type="submit"
                className="btn btn-secondary w-full py-2 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>Track Status</span>
              </button>
            </form>

            {ticketResult && (
              <div className="p-3.5 rounded-xl bg-[#18222E] border border-[#2ED8B6]/40 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#EAF1F8]">{ticketResult.id}</span>
                  <span className="pill ok text-[9px] font-mono">{ticketResult.status}</span>
                </div>
                <p className="text-xs text-[#B4C2D0]">{ticketResult.subject}</p>
                <div className="text-[10px] font-mono text-[#6B7C8D] pt-1 border-t border-[var(--line)] flex items-center justify-between">
                  <span>Assigned: {ticketResult.assignedTo}</span>
                  <span>{ticketResult.updatedAt}</span>
                </div>
              </div>
            )}
          </div>

          {/* Security Box */}
          <div className="p-4 rounded-2xl bg-[#121A24]/60 border border-[var(--line)] space-y-2 text-xs text-[#8E9AA8]">
            <div className="flex items-center gap-1.5 text-[#2ED8B6] font-bold text-xs">
              <Shield className="w-4 h-4" />
              <span>Enterprise RBAC Active</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              All communications on {formattedName} are protected under ServiceV8 tenant isolation and audited with SHA-256 integrity logs.
            </p>
          </div>
        </div>
      </section>

      {/* Embedded Floating Support Chat Widget */}
      <SupportChatWidget
        tenantSlug={tenantSlug}
        tenantName={formattedName}
        defaultStream={defaultStream}
      />
    </div>
  );
}

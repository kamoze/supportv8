"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Headphones,
  MessageSquareText,
  PhoneCall,
  ShieldCheck,
  SlidersHorizontal,
  Layers,
  Cpu,
  ShoppingBag,
  ExternalLink,
  Plus,
  Zap,
  Sparkles,
  Search,
  Box,
  Brain,
  Shield,
  Clock,
  TrendingUp,
  Flame,
  Check,
} from "@/components/ui/FlatIcon";
import type { MarketplaceWorkforceItem } from "@/lib/types/marketplace-types";

interface StudioMarketplaceHubViewProps {
  tenantId?: string;
  tenantName?: string;
  onNotify: (text: string, type?: "success" | "error" | "info") => void;
  onNavigateToStudio?: (subTab?: string) => void;
  onNavigateToInstalled?: () => void;
  onNavigateToConnectors?: () => void;
}

const SOPHIA_LAUNCH_PATH = "/api/voice/sophia/launch";

interface AutonomousPackage {
  id: string;
  title: string;
  category: string;
  version: string;
  description: string;
  icon: string;
  isOnboarded: boolean;
  targetStudioTab: "workflows" | "templates" | "simulator" | "sweeps";
  runtimeTrigger: string;
  varrImpact: string;
}

export function StudioMarketplaceHubView({
  tenantId = "tenant_default",
  tenantName = "this workspace",
  onNotify,
  onNavigateToStudio,
  onNavigateToInstalled,
  onNavigateToConnectors,
}: StudioMarketplaceHubViewProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Track onboarded packages locally for interactive state
  const [packages, setPackages] = useState<AutonomousPackage[]>([
    {
      id: "pkg_triage",
      title: "Customer Support Triage & Tagging",
      category: "Operations",
      version: "v1.4.0",
      description: "Real-time NLP sentiment analysis, intent classification, ticket routing, and proactive SLA timer protection.",
      icon: "fi fi-rr-comment-alt-middle",
      isOnboarded: true,
      targetStudioTab: "workflows",
      runtimeTrigger: "interaction.message.received",
      varrImpact: "+18.4% VARR",
    },
    {
      id: "pkg_ecom_refund",
      title: "E-Commerce Auto-Refund & Verification",
      category: "Commerce",
      version: "v2.1.0",
      description: "End-to-end pipeline connecting OrderV8 with helpdesks to automatically verify order delivery and execute idempotent refunds under $50.",
      icon: "fi fi-rr-shopping-cart",
      isOnboarded: true,
      targetStudioTab: "templates",
      runtimeTrigger: "refund.requested <= $50",
      varrImpact: "+22.5% VARR",
    },
    {
      id: "pkg_stale_sweeper",
      title: "Dormant Ticket Backlog Sweeper",
      category: "Hygiene & Sweep",
      version: "v1.2.0",
      description: "Automated work sweeper cleaning inactive queue backlog without human intervention, maintaining 99.4% database hygiene.",
      icon: "fi fi-rr-broom",
      isOnboarded: true,
      targetStudioTab: "sweeps",
      runtimeTrigger: "schedule: cron(0 2 * * *)",
      varrImpact: "+9.8% VARR",
    },
    {
      id: "pkg_knowledge_miner",
      title: "Knowledge Base Deficit & RAG Sync",
      category: "RAG & Knowledge",
      version: "v1.1.0",
      description: "Mines unassisted first-contact resolutions and drafts vector embeddings in KnowledgeV8 to close institutional knowledge gaps.",
      icon: "fi fi-rr-brain",
      isOnboarded: true,
      targetStudioTab: "workflows",
      runtimeTrigger: "ticket.resolved.unlinked_kb",
      varrImpact: "+6.4% VARR",
    },
    {
      id: "pkg_vip_escalation",
      title: "VIP Churn & Frustration Fast-Track",
      category: "Customer Retention",
      version: "v1.0.0",
      description: "Monitors real-time NLP sentiment across omnichannel ingress. Immediately halts auto-resolution and alerts human TAM for Enterprise accounts.",
      icon: "fi fi-rr-flame",
      isOnboarded: true,
      targetStudioTab: "workflows",
      runtimeTrigger: "sentiment == Frustrated && tier == Enterprise",
      varrImpact: "+14.2% VARR",
    },
    {
      id: "pkg_sla_buffer",
      title: "SLA Pre-Breach Protection Extension",
      category: "SLA Protection",
      version: "v1.0.5",
      description: "Dynamically grants automated safety grace periods on complex enterprise investigations to prevent false breach penalties.",
      icon: "fi fi-rr-shield-check",
      isOnboarded: false,
      targetStudioTab: "workflows",
      runtimeTrigger: "sla_buffer <= 15m",
      varrImpact: "+11.3% VARR",
    },
    {
      id: "pkg_gateway_sre",
      title: "Payment Gateway 504 SRE Broadcast",
      category: "Systemic Incident",
      version: "v1.3.0",
      description: "Detects systemic incident clustering and broadcasts proactive status updates to affected accounts before SLA breach.",
      icon: "fi fi-rr-bell",
      isOnboarded: false,
      targetStudioTab: "simulator",
      runtimeTrigger: "cluster_count >= 5",
      varrImpact: "+18.0% VARR",
    },
  ]);

  // AI Employee catalog items to hire
  const [candidates, setCandidates] = useState<any[]>([
    {
      id: "emp_support_lead",
      name: "Alex",
      role: "Support Intelligence Lead",
      avatarUrl: "/avatars/beaver-manager.jpg",
      isHired: true,
      rating: 4.95,
      description: "Top-tier AI Support Lead analyzing real-time queue patterns, systemic outages, and delegating to sub-agents.",
    },
    {
      id: "emp_incident_analyst",
      name: "Maya",
      role: "Incident & Business Impact Analyst",
      avatarUrl: "/avatars/beaver-analyst.jpg",
      isHired: true,
      rating: 4.98,
      description: "Computes financial exposure, identifies affected customer tiers, and authors proactive incident notifications.",
    },
    {
      id: "emp_kb_refresh",
      name: "Jordan",
      role: "Knowledge Refresh Specialist",
      avatarUrl: "/avatars/beaver-curator.jpg",
      isHired: true,
      rating: 4.88,
      description: "Continuously scans closed tickets for undocumented solutions and generates reusable knowledge base articles.",
    },
    {
      id: "emp_compliance_officer",
      name: "Eleanor",
      role: "AI Governance & Policy Auditor",
      avatarUrl: "/avatars/beaver-eleanor.jpg",
      isHired: false,
      rating: 4.99,
      description: "Audits AI conversations for hallucination drift, sensitive PII redaction, and compliance scorecards.",
    },
    {
      id: "emp_voice_concierge",
      name: "Vivian",
      role: "Voice Concierge Lead",
      avatarUrl: "/avatars/beaver-vivian.jpg",
      isHired: false,
      rating: 4.92,
      description: "Acoustic customer sentiment triage, warm telephony handoffs, and interactive voice response handling.",
    },
  ]);

  const handleOnboardPackage = (pkgId: string) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === pkgId ? { ...p, isOnboarded: true } : p))
    );
    const pkg = packages.find((p) => p.id === pkgId);
    onNotify(`Successfully onboarded package "${pkg?.title}". Manage workflows in Autonomous Studio.`, "success");
  };

  const handleHireCandidate = (candId: string) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candId ? { ...c, isHired: true } : c))
    );
    const cand = candidates.find((c) => c.id === candId);
    onNotify(`Hired ${cand?.name} (${cand?.role}). Roster updated; workflows managed in Studio.`, "success");
  };

  const filteredPackages = packages.filter((p) => {
    const matchesCategory = filterCategory === "all" || p.category.toLowerCase().includes(filterCategory.toLowerCase());
    const matchesSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const studioExternalUrl = `https://studio.servicev8.com/?tenant=${encodeURIComponent(tenantId)}&vertical=support`;

  return (
    <section className="space-y-8" aria-labelledby="workforce-heading">
      {/* Architectural Standard Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-sm">
        <div className="space-y-2 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Marketplace &amp; Package Onboarding</h1>
                <span className="pill ok text-[9px] font-mono">SERVICEV8 ARCHITECTURE</span>
              </div>
              <span className="text-[11px] font-mono text-[#2ED8B6]">Onboard in Marketplace • Manage in Studio • Operate in Workforce</span>
            </div>
          </div>
          <p className="text-xs text-[#B4C2D0] leading-relaxed">
            Marketplace is the single enablement surface for business modules, autonomous packages, connectors, and AI employee hiring. Once onboarded, all workflows, trigger policies, and batch sweeps are configured and managed in <strong>Autonomous Studio</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onNavigateToStudio && (
            <button
              type="button"
              onClick={() => onNavigateToStudio("workflows")}
              className="btn btn-primary text-xs py-2 px-4 font-bold flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Cpu className="w-4 h-4 text-[#04201C]" />
              <span>Manage in Studio</span>
            </button>
          )}

          {onNavigateToInstalled && (
            <button
              type="button"
              onClick={onNavigateToInstalled}
              className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
            >
              <Box className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Installed Products</span>
            </button>
          )}

          <a
            href={studioExternalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-[#8E9AA8] hover:text-[#EAF1F8]"
            title="Open ServiceV8 Cross-Vertical Studio"
          >
            <span>Cross-Vertical Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* SECTION: Voice Support Workforce (Sophia) - Canonical ServiceV8 Voice Flow */}
      <div className="space-y-4">
        <header className="card rounded-2xl border border-[var(--line)] bg-[#121A24] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-3xl space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#2ED8B6]/30 bg-[#2ED8B6]/10 text-[#2ED8B6]"
                  aria-hidden="true"
                >
                  <Headphones className="size-5" />
                </span>
                <h2 id="workforce-heading" className="text-balance text-xl font-bold text-[#EAF1F8] sm:text-2xl">
                  Voice support workforce
                </h2>
              </div>
              <p className="max-w-[72ch] text-sm leading-6 text-[#B4C2D0]">
                Hire Sophia, configure her support policy and voice, then activate inbound calls only after the deployment is ready.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={SOPHIA_LAUNCH_PATH}
                className="btn btn-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#57E5C8]"
              >
                Hire or configure Sophia
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              {onNavigateToStudio && (
                <button
                  type="button"
                  onClick={() => onNavigateToStudio("workflows")}
                  className="btn btn-secondary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-xs font-semibold cursor-pointer"
                >
                  <Cpu className="size-4 text-[#2ED8B6]" />
                  <span>Manage in Studio</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <article className="card min-w-0 rounded-2xl border border-[var(--line)] bg-[#0E1520] p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-full bg-[#182230] text-[#57E5C8]"
                  aria-hidden="true"
                >
                  <Bot className="size-6" />
                </span>
                <div className="min-w-0 space-y-2">
                  <h3 className="break-words text-lg font-semibold text-[#EAF1F8]">
                    Sophia — Customer Support Lead AI
                  </h3>
                  <p className="max-w-[65ch] break-words text-sm leading-6 text-[#B4C2D0]">
                    Autonomous customer care reasoning, order resolution, and sentiment escalation.
                  </p>
                </div>
              </div>
              <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-[#2ED8B6]/30 bg-[#2ED8B6]/10 px-3 py-1 text-xs font-semibold text-[#57E5C8]">
                Demo employee
              </span>
            </div>

            <dl className="mt-7 grid gap-4 border-t border-[var(--line)] pt-6 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-medium text-[#6B7C8D]">Target solution</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-[#EAF1F8]">SupportV8</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium text-[#6B7C8D]">Workspace</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-[#EAF1F8]">{tenantName}</dd>
              </div>
            </dl>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                [MessageSquareText, "Find support tickets and customer context"],
                [PhoneCall, "Create and escalate support cases during calls"],
                [ShieldCheck, "Use tenant-scoped knowledge and audited tools"],
                [SlidersHorizontal, "Tune tone, sentiment floor, and escalation policy"],
              ].map(([Icon, label]) => {
                const FeatureIcon = Icon as typeof MessageSquareText;
                return (
                  <div key={label as string} className="flex min-w-0 items-start gap-3 rounded-xl bg-[#121A24] p-4">
                    <FeatureIcon className="mt-0.5 size-4 shrink-0 text-[#2ED8B6]" aria-hidden="true" />
                    <span className="break-words text-sm leading-5 text-[#B4C2D0]">{label as string}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 flex flex-col gap-3 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[58ch] text-xs leading-5 text-[#8E9AA8]">
                Registry verifies the current entitlement and exact tenant membership when you open the flow. No employee or active state is created in the browser.
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={SOPHIA_LAUNCH_PATH}
                  className="btn btn-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-5 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#57E5C8]"
                >
                  Hire or configure Sophia
                  <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </article>

          <aside className="card rounded-2xl border border-[var(--line)] bg-[#121A24] p-6" aria-labelledby="voice-lifecycle-heading">
            <h3 id="voice-lifecycle-heading" className="text-base font-semibold text-[#EAF1F8]">
              Voice activation path
            </h3>
            <ol className="mt-5 space-y-5">
              {[
                ["Hire", "Free to hire. Voice usage consumes the account subscription allowance first, then purchased top-up credits."],
                ["Configure", "Workforce stores Sophia’s voice, support policy, and approved handoff behavior."],
                ["Activate", "Voice Agents activates inbound calls only after provider and SupportV8 readiness checks pass."],
              ].map(([title, description], index) => (
                <li key={title} className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[#2ED8B6]/30 bg-[#0E1520] text-xs font-semibold tabular-nums text-[#57E5C8]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-[#EAF1F8]">{title}</h4>
                    <p className="mt-1 break-words text-xs leading-5 text-[#8E9AA8]">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-[#2ED8B6]/20 bg-[#0E1520] p-4 text-xs leading-5 text-[#B4C2D0]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2ED8B6]" aria-hidden="true" />
              <p>Ticket access, knowledge search, case creation, and escalation remain authorized inside the current SupportV8 tenant.</p>
            </div>
          </aside>
        </div>
      </div>

      {/* SECTION: Autonomous Packages Catalog */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-[var(--line)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2ED8B6]" />
              <h3 className="text-sm font-bold text-[#EAF1F8] uppercase tracking-wider font-mono">
                Autonomous Solution Packages
              </h3>
            </div>
            <p className="text-xs text-[#8E9AA8]">
              Pre-built end-to-end automation pipelines ready to onboard. All active packages execute in Autonomous Studio.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C8D]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search packages..."
                className="bg-[#121A24] border border-[var(--line)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#EAF1F8] placeholder-[#6B7C8D] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            <div className="flex items-center gap-1 bg-[#121A24] p-1 rounded-xl border border-[var(--line)]">
              {["all", "operations", "commerce", "sweep", "rag"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize cursor-pointer transition-all ${
                    filterCategory === cat
                      ? "bg-[#2ED8B6] text-[#04201C] font-bold"
                      : "text-[#6B7C8D] hover:text-[#EAF1F8]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`card p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-sm ${
                pkg.isOnboarded
                  ? "bg-[#121A24] border-[#2ED8B6]/30 hover:border-[#2ED8B6]/50"
                  : "bg-[#0E1520] border-[var(--line)] hover:border-[var(--line-2)]"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-[#182230] text-[#2ED8B6] border border-[#2ED8B6]/20">
                      <Layers className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-[#EAF1F8] leading-tight">{pkg.title}</h4>
                      <span className="text-[10px] text-[#6B7C8D] font-mono">{pkg.category} • {pkg.version}</span>
                    </div>
                  </div>

                  {pkg.isOnboarded ? (
                    <span className="pill ok text-[8.5px] font-mono uppercase">
                      ONBOARDED
                    </span>
                  ) : (
                    <span className="pill text-[8.5px] font-mono uppercase bg-[#18222E]">
                      AVAILABLE
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#B4C2D0] leading-relaxed line-clamp-3">
                  {pkg.description}
                </p>

                <div className="p-2 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[#6B7C8D] truncate max-w-[170px]">Trigger: {pkg.runtimeTrigger}</span>
                  <span className="text-[#2ED8B6] font-bold">{pkg.varrImpact}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
                {pkg.isOnboarded ? (
                  <>
                    <span className="text-[10px] text-[#8E9AA8] font-mono flex items-center gap-1">
                      <Check className="w-3 h-3 text-[#2ED8B6]" />
                      <span>Ready in Studio</span>
                    </span>
                    {onNavigateToStudio && (
                      <button
                        type="button"
                        onClick={() => onNavigateToStudio(pkg.targetStudioTab)}
                        className="btn btn-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Cpu className="w-3.5 h-3.5 text-[#04201C]" />
                        <span>Manage in Studio</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-[#6B7C8D] font-mono">1-click provisioning</span>
                    <button
                      type="button"
                      onClick={() => handleOnboardPackage(pkg.id)}
                      className="btn btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer hover:border-[#2ED8B6]/50"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      <span>Onboard Package</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION: AI Employees Hire Catalog */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#2ED8B6]" />
              <h3 className="text-sm font-bold text-[#EAF1F8] uppercase tracking-wider font-mono">
                AI Employee Hire Catalog
              </h3>
            </div>
            <p className="text-xs text-[#8E9AA8]">
              Hiring takes place in Marketplace per ServiceV8 standard §1.4; hired agents are operated in Workforce and tuned in Studio.
            </p>
          </div>

          {onNavigateToInstalled && (
            <button
              type="button"
              onClick={onNavigateToInstalled}
              className="text-xs font-mono text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Hired Employees</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {candidates.map((cand) => (
            <div
              key={cand.id}
              className={`card p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-sm ${
                cand.isHired
                  ? "bg-[#121A24] border-[#2ED8B6]/30"
                  : "bg-[#0E1520] border-[var(--line)] hover:border-[var(--line-2)]"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <img
                    src={cand.avatarUrl}
                    alt={cand.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-[#2ED8B6]/40 shadow-sm shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#EAF1F8] truncate">{cand.name}</h4>
                      <span className="text-[10px] font-mono text-[#F5A623]">★ {cand.rating}</span>
                    </div>
                    <div className="text-[11px] text-[#2ED8B6] font-medium truncate">{cand.role}</div>
                    <span className="pill text-[8.5px] font-mono uppercase bg-[#18222E] mt-1">
                      {cand.isHired ? "HIRED & ACTIVE" : "AVAILABLE TO HIRE"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#B4C2D0] leading-relaxed line-clamp-2">
                  {cand.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
                {cand.isHired ? (
                  <>
                    <span className="text-[10px] text-[#4CC38A] font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Hired</span>
                    </span>
                    {onNavigateToStudio && (
                      <button
                        type="button"
                        onClick={() => onNavigateToStudio("workflows")}
                        className="btn btn-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Cpu className="w-3.5 h-3.5 text-[#04201C]" />
                        <span>Manage in Studio</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-[#6B7C8D] font-mono">ServiceV8 Catalog</span>
                    <button
                      type="button"
                      onClick={() => handleHireCandidate(cand.id)}
                      className="btn btn-primary text-xs py-1.5 px-3.5 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Hire Employee</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION: Support Apps & Connectors Quick Navigation */}
      <div className="card p-6 rounded-2xl border border-[var(--line)] bg-[#121A24] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#EAF1F8] font-mono uppercase">
              Connected Support Apps &amp; Vertical Connectors
            </h3>
            <p className="text-xs text-[#8E9AA8]">
              Per ServiceV8 standard §1.4, apps launch in a new tab without iframes. Event triggers are managed in Studio.
            </p>
          </div>

          {onNavigateToConnectors && (
            <button
              type="button"
              onClick={onNavigateToConnectors}
              className="btn btn-secondary text-xs py-1.5 px-3.5 flex items-center gap-1.5 cursor-pointer"
            >
              <Plug className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Browse All Connectors</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {[
            { name: "Knowledge Suite", role: "KnowledgeV8 RAG", href: "https://knowledge.servicev8.com" },
            { name: "OrderV8 Commerce", role: "Commerce & Refunds", href: "https://orderv8.servicev8.com" },
            { name: "Dominion AIOps", role: "Autonomous SRE", href: "https://dominion.servicev8.com" },
            { name: "Forge Gateway", role: "Auth & Entitlements", href: "https://forge.servicev8.com" },
            { name: "GrowthV8", role: "Voice & VIP Telephony", href: "https://growth.servicev8.com" },
          ].map((app) => (
            <a
              key={app.name}
              href={`${app.href}/?tenant=${encodeURIComponent(tenantId)}&vertical=support`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-[#0E1520] border border-[var(--line)] hover:border-[#2ED8B6]/40 transition-all flex flex-col justify-between gap-2 group"
            >
              <div>
                <div className="text-xs font-bold text-[#EAF1F8] group-hover:text-[#2ED8B6] flex items-center justify-between">
                  <span>{app.name}</span>
                  <ExternalLink className="w-3 h-3 text-[#6B7C8D] group-hover:text-[#2ED8B6]" />
                </div>
                <span className="text-[10px] text-[#6B7C8D] font-mono">{app.role}</span>
              </div>
              <span className="text-[9px] text-[#2ED8B6] font-mono">Launch App ↗</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

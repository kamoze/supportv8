"use client";

import React, { useState } from "react";
import {
  Box,
  Layers,
  Cpu,
  Users,
  CheckCircle2,
  Zap,
  ArrowRight,
  ExternalLink,
  Plus,
  ShoppingBag,
  Sparkles,
  Plug,
  Bot,
  Check,
  Search,
  Filter,
} from "@/components/ui/FlatIcon";
import type { MarketplaceWorkforceItem } from "@/lib/types/marketplace-types";

interface MarketplaceWorkforceViewProps {
  workforce?: MarketplaceWorkforceItem[];
  onHireAgent?: (agentId: string) => void;
  onNavigateToStudio?: (subTab?: string) => void;
  onNavigateToMarketplace?: () => void;
  onNavigateToWorkforce?: () => void;
}

export function MarketplaceWorkforceView({
  workforce = [],
  onHireAgent,
  onNavigateToStudio,
  onNavigateToMarketplace,
  onNavigateToWorkforce,
}: MarketplaceWorkforceViewProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "packages" | "employees" | "connectors">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Installed Autonomous Work Packages
  const installedPackages = [
    {
      id: "pkg_triage",
      name: "Customer Support Triage & Tagging",
      category: "Operations",
      version: "v1.4.0",
      description: "Real-time NLP sentiment analysis, intent categorization, ticket auto-routing, and proactive SLA timer protection.",
      executionsToday: 142,
      varrImpact: "+18.4%",
      lastExecution: "3 mins ago",
      studioSubTab: "workflows",
      icon: "fi fi-rr-comment-alt-middle",
    },
    {
      id: "pkg_ecom_refund",
      name: "E-Commerce Auto-Refund & Verification",
      category: "Commerce",
      version: "v2.1.0",
      description: "Idempotent payment refund pipeline connecting OrderV8 with Zendesk & Intercom to automatically verify order delivery.",
      executionsToday: 68,
      varrImpact: "+22.5%",
      lastExecution: "Just now",
      studioSubTab: "templates",
      icon: "fi fi-rr-shopping-cart",
    },
    {
      id: "pkg_stale_sweeper",
      name: "Dormant Ticket Backlog Sweeper",
      category: "Hygiene & Sweep",
      version: "v1.2.0",
      description: "Automated work sweeper cleaning inactive queue backlog without human intervention, maintaining 99.4% database hygiene.",
      executionsToday: 43,
      varrImpact: "+9.8%",
      lastExecution: "12 mins ago",
      studioSubTab: "sweeps",
      icon: "fi fi-rr-broom",
    },
    {
      id: "pkg_knowledge_miner",
      name: "Knowledge Base Deficit & RAG Sync",
      category: "RAG & Knowledge",
      version: "v1.1.0",
      description: "Mines unassisted first-contact resolutions and drafts vector embeddings in KnowledgeV8 to close institutional knowledge gaps.",
      executionsToday: 18,
      varrImpact: "+6.4%",
      lastExecution: "45 mins ago",
      studioSubTab: "workflows",
      icon: "fi fi-rr-brain",
    },
    {
      id: "pkg_vip_escalation",
      name: "VIP Churn & Frustration Fast-Track",
      category: "Customer Retention",
      version: "v1.0.0",
      description: "Monitors real-time NLP sentiment across omnichannel ingress. Immediately halts auto-resolution and alerts human TAM for Enterprise accounts.",
      executionsToday: 24,
      varrImpact: "+14.2%",
      lastExecution: "18 mins ago",
      studioSubTab: "workflows",
      icon: "fi fi-rr-flame",
    },
    {
      id: "pkg_voice_sophia",
      name: "Sophia — Customer Support Lead AI Voice",
      category: "Telephony",
      version: "v2.0.0",
      description: "Autonomous customer care reasoning, order resolution, acoustic sentiment escalation, and telephony SIP orchestration.",
      executionsToday: 56,
      varrImpact: "+19.0%",
      lastExecution: "2 mins ago",
      studioSubTab: "workflows",
      icon: "fi fi-rr-phone-call",
    },
  ];

  // Active Hired Employees
  const hiredEmployees = workforce.length > 0
    ? workforce.filter((w) => w.isHired)
    : [
        {
          id: "emp_support_lead",
          name: "Alex",
          role: "Support Intelligence Lead",
          avatarUrl: "/avatars/beaver-manager.jpg",
          level: "ai_employee",
          skills: ["Multi-Channel Triage", "Problem Correlation", "Supervisor Handoffs"],
          isHired: true,
          rating: 4.95,
          assignedCount: 18,
          description: "Top-tier AI Support Lead that analyzes real-time queue patterns, correlates systemic outages, and delegates tasks.",
        },
        {
          id: "emp_incident_analyst",
          name: "Maya",
          role: "Incident & Business Impact Analyst",
          avatarUrl: "/avatars/beaver-analyst.jpg",
          level: "ai_employee",
          skills: ["Financial Risk Modeling", "ARR Blast Radius", "Proactive Broadcasts"],
          isHired: true,
          rating: 4.98,
          assignedCount: 7,
          description: "Computes financial exposure, identifies affected customer tiers, and authors proactive incident notifications.",
        },
        {
          id: "emp_kb_refresh",
          name: "Jordan",
          role: "Knowledge Refresh Specialist",
          avatarUrl: "/avatars/beaver-curator.jpg",
          level: "ai_employee",
          skills: ["Knowledge Deficit Radar", "Resolution Mining", "Vector Graph Sync"],
          isHired: true,
          rating: 4.88,
          assignedCount: 12,
          description: "Continuously scans closed tickets for undocumented solutions and generates reusable knowledge base articles.",
        },
      ];

  // Active Connectors
  const activeConnectors = [
    { id: "conn_zendesk", name: "Zendesk Support Enterprise", category: "Helpdesk", eventsPerDay: 1420, status: "Active" },
    { id: "conn_intercom", name: "Intercom Messenger & Fin", category: "Helpdesk", eventsPerDay: 840, status: "Active" },
    { id: "conn_twilio", name: "Twilio Voice Telephony & SIP", category: "Telephony", eventsPerDay: 180, status: "Active" },
    { id: "conn_kv8", name: "KnowledgeV8 RAG Vector Hub", category: "Knowledge", eventsPerDay: 2300, status: "Active" },
    { id: "conn_shopify", name: "Shopify / OrderV8 Commerce", category: "Commerce", eventsPerDay: 620, status: "Active" },
  ];

  const totalInstalled = installedPackages.length + hiredEmployees.length + activeConnectors.length;

  return (
    <div className="space-y-6">
      {/* Top Banner: ServiceV8 Architecture Standard */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <Box className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Installed Products &amp; Active Packages</h1>
                <span className="pill ok text-[9px] font-mono">MANAGED IN STUDIO</span>
              </div>
              <span className="text-[11px] font-mono text-[#2ED8B6]">
                {totalInstalled} active deployments in this workspace
              </span>
            </div>
          </div>
          <p className="text-xs text-[#B4C2D0] leading-relaxed">
            All active packages, support apps, and employee capabilities onboarded from Marketplace are managed and orchestrated in <strong>Autonomous Studio</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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

          {onNavigateToMarketplace && (
            <button
              type="button"
              onClick={onNavigateToMarketplace}
              className="btn btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Onboard More</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--line)]">
        <div className="flex items-center gap-1.5 bg-[#121A24] p-1 rounded-xl border border-[var(--line)]">
          {[
            { id: "all", label: "All Installed", count: totalInstalled },
            { id: "packages", label: "Autonomous Packages", count: installedPackages.length },
            { id: "employees", label: "Hired AI Employees", count: hiredEmployees.length },
            { id: "connectors", label: "Active Connectors", count: activeConnectors.length },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === f.id
                  ? "bg-[#2ED8B6] text-[#04201C] shadow-sm"
                  : "text-[#6B7C8D] hover:text-[#EAF1F8]"
              }`}
            >
              <span>{f.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                activeFilter === f.id ? "bg-[#04201C]/20 text-[#04201C]" : "bg-[#18222E] text-[#8E9AA8]"
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C8D]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter installed..."
            className="bg-[#121A24] border border-[var(--line)] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#EAF1F8] placeholder-[#6B7C8D] focus:outline-none focus:border-[#2ED8B6]"
          />
        </div>
      </div>

      {/* SECTION 1: Autonomous Packages */}
      {(activeFilter === "all" || activeFilter === "packages") && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2ED8B6]" />
              <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                Active Autonomous Work Packages ({installedPackages.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#6B7C8D]">
              Orchestrated via Autonomous Studio
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {installedPackages
              .filter((p) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((pkg) => (
                <div
                  key={pkg.id}
                  className="card p-5 rounded-2xl border border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-[#182230] text-[#2ED8B6] border border-[#2ED8B6]/20">
                          <Layers className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-[#EAF1F8] leading-tight">{pkg.name}</h4>
                          <span className="text-[10px] text-[#6B7C8D] font-mono">{pkg.category} • {pkg.version}</span>
                        </div>
                      </div>
                      <span className="pill ok text-[8.5px] font-mono uppercase">
                        ACTIVE
                      </span>
                    </div>

                    <p className="text-xs text-[#B4C2D0] leading-relaxed line-clamp-3">
                      {pkg.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono bg-[#18222E] p-2 rounded-xl border border-[var(--line)]">
                      <div>
                        <span className="text-[9px] text-[#6B7C8D] block">EXECUTIONS TODAY</span>
                        <span className="font-bold text-[#4D9FFF]">{pkg.executionsToday}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-[#6B7C8D] block">VARR IMPACT</span>
                        <span className="font-bold text-[#2ED8B6]">{pkg.varrImpact}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                    <span className="text-[10px] text-[#6B7C8D] font-mono">Last run: {pkg.lastExecution}</span>
                    {onNavigateToStudio && (
                      <button
                        type="button"
                        onClick={() => onNavigateToStudio(pkg.studioSubTab)}
                        className="btn btn-primary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Cpu className="w-3.5 h-3.5 text-[#04201C]" />
                        <span>Manage in Studio</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SECTION 2: Hired AI Employees */}
      {(activeFilter === "all" || activeFilter === "employees") && (
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-[#2ED8B6]" />
              <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                Active Hired AI Employees ({hiredEmployees.length})
              </h3>
            </div>
            {onNavigateToWorkforce && (
              <button
                type="button"
                onClick={onNavigateToWorkforce}
                className="text-xs font-mono text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Go to Workforce Console</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {hiredEmployees
              .filter((e) => !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.role.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((emp) => (
                <div
                  key={emp.id}
                  className="card p-5 rounded-2xl border border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={emp.avatarUrl || "/avatars/beaver-manager.jpg"}
                        alt={emp.name}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-[#2ED8B6]/40 shadow-sm shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-[#EAF1F8] truncate">{emp.name}</h4>
                          <span className="text-[10px] font-mono text-[#F5A623]">★ {emp.rating}</span>
                        </div>
                        <div className="text-[11px] text-[#2ED8B6] font-medium truncate">{emp.role}</div>
                        <span className="pill ok text-[8.5px] font-mono uppercase mt-1">
                          HIRED &amp; ACTIVE
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[#B4C2D0] leading-relaxed line-clamp-2">
                      {emp.description}
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {emp.skills?.slice(0, 3).map((skill: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[var(--line)] text-[10px] text-[#B4C2D0] font-mono">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between gap-2">
                    {onNavigateToWorkforce && (
                      <button
                        type="button"
                        onClick={onNavigateToWorkforce}
                        className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-[#2ED8B6]" />
                        <span>Workforce</span>
                      </button>
                    )}

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
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* SECTION 3: Active Connectors */}
      {(activeFilter === "all" || activeFilter === "connectors") && (
        <div className="space-y-3.5 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="w-4 h-4 text-[#2ED8B6]" />
              <h3 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
                Active Integration Connectors ({activeConnectors.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#6B7C8D]">
              Event Ingress &amp; Webhook Triggers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeConnectors
              .filter((c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((conn) => (
                <div
                  key={conn.id}
                  className="card p-4 rounded-2xl border border-[var(--line)] bg-[#121A24] space-y-3 hover:border-[#2ED8B6]/40 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-[#EAF1F8] truncate">{conn.name}</h4>
                      <span className="pill ok text-[8.5px] font-mono uppercase">CONNECTED</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                      <span>{conn.category}</span>
                      <span className="text-[#2ED8B6] font-bold">{conn.eventsPerDay} events/day</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
                    <span className="text-[10px] text-[#6B7C8D] font-mono">Webhook Listener Active</span>
                    {onNavigateToStudio && (
                      <button
                        type="button"
                        onClick={() => onNavigateToStudio("simulator")}
                        className="text-xs font-mono text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>Simulate in Studio</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Architectural Bottom Callout */}
      <div className="card p-5 bg-[#0E1520] border border-[var(--line)] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-[#EAF1F8] font-mono uppercase">
            Need additional capabilities or custom AI employees?
          </h4>
          <p className="text-xs text-[#8E9AA8]">
            Explore the full ServiceV8 catalog to onboard new packages, modules, and connectors.
          </p>
        </div>

        {onNavigateToMarketplace && (
          <button
            type="button"
            onClick={onNavigateToMarketplace}
            className="btn btn-secondary text-xs py-2 px-4 font-bold flex items-center gap-2 cursor-pointer shrink-0 hover:border-[#2ED8B6]/50"
          >
            <ShoppingBag className="w-4 h-4 text-[#2ED8B6]" />
            <span>Browse Marketplace</span>
          </button>
        )}
      </div>
    </div>
  );
}

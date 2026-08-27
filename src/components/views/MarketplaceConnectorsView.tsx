"use client";

import React, { useState } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  Plug,
  ExternalLink,
  Settings,
  Shield,
  Zap,
  Activity,
  ArrowRight,
  RefreshCw,
  Plus,
  Lock,
} from "lucide-react";
import type { MarketplaceConnector } from "@/lib/types/marketplace-types";

interface MarketplaceConnectorsViewProps {
  connectors: MarketplaceConnector[];
  onToggleConnector: (id: string, isSubscribed: boolean) => void;
  onOpenConfig: (connector: MarketplaceConnector) => void;
}

export function MarketplaceConnectorsView({
  connectors,
  onToggleConnector,
  onOpenConfig,
}: MarketplaceConnectorsViewProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filtered = connectors.filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === "all" || c.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const categories = [
    { id: "all", label: "All Integrations" },
    { id: "helpdesk", label: "Helpdesks & Chat" },
    { id: "telephony", label: "Voice & SIP" },
    { id: "knowledge", label: "Knowledge & RAG" },
    { id: "commerce", label: "Commerce & Orders" },
    { id: "crm", label: "CRM & VIP" },
    { id: "devops", label: "DevOps & SRE" },
    { id: "storage", label: "Document Storage" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <Plug className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">Marketplace Connectors &amp; Ingestion Hub</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Subscribe and activate omnichannel data pipelines. Activated connectors dynamically stream telemetry into the <strong>Vertical Mesh</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] text-center">
            <div className="text-[#2ED8B6] font-bold text-sm">
              {connectors.filter((c) => c.isSubscribed).length} / {connectors.length}
            </div>
            <div className="text-[10px] text-[#6B7C8D]">Active Ingestion Pipelines</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === cat.id
                  ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-bold"
                  : "bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] border border-[var(--line)]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-[#6B7C8D]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search connectors..."
            className="w-full bg-[#18222E] text-[#EAF1F8] pl-8 pr-3 py-2 rounded-xl border border-[var(--line)] text-xs focus:outline-none focus:border-[#2ED8B6]"
          />
        </div>
      </div>

      {/* Connectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((conn) => {
          const isSub = conn.isSubscribed;
          return (
            <div
              key={conn.id}
              className={`card p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                isSub
                  ? "bg-[#121A24] border-[#2ED8B6]/40 shadow-sm"
                  : "bg-[#0E1520] border-[var(--line)] opacity-90 hover:opacity-100"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#18222E] border border-[var(--line-2)] flex items-center justify-center text-lg text-[#2ED8B6]">
                      <i className={conn.icon} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#EAF1F8]">{conn.name}</h3>
                      <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">
                        {conn.category} • {conn.tier}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`pill text-[9px] font-mono ${
                      isSub ? "ok" : "border-[#6B7C8D]/40 text-[#6B7C8D]"
                    }`}
                  >
                    {isSub ? "ACTIVE" : "AVAILABLE"}
                  </span>
                </div>

                <p className="text-xs text-[#B4C2D0] leading-relaxed line-clamp-2">
                  {conn.description}
                </p>

                {isSub && (
                  <div className="p-2.5 rounded-lg bg-[#18222E] border border-[var(--line)] grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div>
                      <span className="text-[#6B7C8D] block">Sync Interval:</span>
                      <span className="text-[#EAF1F8] font-bold">Every {conn.syncFrequencyMinutes} min</span>
                    </div>
                    <div>
                      <span className="text-[#6B7C8D] block">Events Today:</span>
                      <span className="text-[#2ED8B6] font-bold">{conn.eventsPerDay.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => onOpenConfig(conn)}
                  className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 font-mono"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configure</span>
                </button>

                <button
                  type="button"
                  onClick={() => onToggleConnector(conn.id, !isSub)}
                  className={`btn text-xs py-1.5 px-4 font-bold flex items-center gap-1.5 cursor-pointer ${
                    isSub
                      ? "btn-secondary text-[#E5484D] hover:bg-[#E5484D]/15"
                      : "btn-primary shadow-sm"
                  }`}
                >
                  {isSub ? (
                    <span>Disable</span>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      <span>Subscribe</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  SlidersHorizontal,
  ShieldCheck,
} from "@/components/ui/FlatIcon";
import type { MarketplaceWorkforceItem } from "@/lib/types/marketplace-types";

interface MarketplaceWorkforceViewProps {
  workforce?: MarketplaceWorkforceItem[];
  onHireAgent?: (agentId: string) => void;
  onNavigateToStudio?: (subTab?: string) => void;
  onNavigateToMarketplace?: () => void;
  onNavigateToWorkforce?: () => void;
  tenantId?: string;
}

const STUDIO_EXTERNAL_URL = process.env.NEXT_PUBLIC_STUDIOV8_URL || "https://studio.servicev8.com";
const MARKETPLACE_EXTERNAL_URL = process.env.NEXT_PUBLIC_MARKETPLACEV8_URL || "https://marketplace.servicev8.com";

export function MarketplaceWorkforceView({
  workforce = [],
  onHireAgent,
  onNavigateToStudio,
  onNavigateToMarketplace,
  onNavigateToWorkforce,
  tenantId = "acme",
}: MarketplaceWorkforceViewProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "employees" | "connectors">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const studioHref = `${STUDIO_EXTERNAL_URL}/?tenant=${encodeURIComponent(tenantId)}&vertical=support`;
  const marketplaceHref = MARKETPLACE_EXTERNAL_URL;

  const hiredEmployees = workforce.filter((w) => w.isHired);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#5999ec]/15 text-[#5999ec] border border-[#5999ec]/30">
              <Box className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-[#EAF1F8]">Installed Products &amp; Active Packages</h2>
            <span className="pill ok text-[10px] font-mono">MANAGED IN STUDIO</span>
          </div>
          <p className="text-xs text-[#8A99AD] max-w-2xl">
            Authoritative Registry installation projections for this workspace. Capabilities and workforce hires are configured in Studio and acquired from Marketplace.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <a
            href={studioHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Manage Studio</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {onNavigateToMarketplace ? (
            <button
              onClick={onNavigateToMarketplace}
              className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Onboard More</span>
            </button>
          ) : (
            <a
              href={marketplaceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#2ED8B6]" />
              <span>Onboard More</span>
            </a>
          )}
        </div>
      </div>

      {/* Registry Authority Notice */}
      <div className="p-4 rounded-xl bg-[#121A24] border border-[var(--line)] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#5999ec] shrink-0 mt-0.5" />
        <div className="text-xs text-[#8A99AD] space-y-1">
          <p className="font-semibold text-[#EAF1F8]">Registry Projection Authority</p>
          <p>
            ServiceV8 Registry persists versioned manifests, target contracts, and installation authority. Installed records are authoritative projections, not local mock stores.
          </p>
        </div>
      </div>

      {/* SECTION: ACTIVE HIRED EMPLOYEES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#EAF1F8] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#2ED8B6]" />
            <span>Active Hired AI Employees</span>
          </h3>
          <span className="text-xs text-[#6B7C8D] font-mono">{hiredEmployees.length} active</span>
        </div>

        {hiredEmployees.length === 0 ? (
          <div className="card p-8 text-center border-[var(--line)] bg-[#121A24] space-y-2">
            <Bot className="w-6 h-6 text-[#6B7C8D] mx-auto opacity-75" />
            <h4 className="text-xs font-bold text-[#EAF1F8]">No AI Employees Hired</h4>
            <p className="text-xs text-[#6B7C8D] max-w-sm mx-auto">
              Acquire AI employees from the Marketplace to deploy autonomous reasoning agents to your workspace.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hiredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="card p-5 border-[var(--line)] bg-[#121A24] flex items-start gap-3.5 justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#162230] border border-[var(--line)] flex items-center justify-center text-[#2ED8B6] font-bold text-sm shrink-0">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#EAF1F8]">{emp.name}</h4>
                    <p className="text-xs text-[#2ED8B6]">{emp.role}</p>
                    <p className="text-xs text-[#6B7C8D] mt-1 line-clamp-2">{emp.description}</p>
                  </div>
                </div>
                <span className="pill ok text-[10px] font-mono shrink-0">Active</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION: ACTIVE INTEGRATION CONNECTORS */}
      <div className="space-y-3 pt-4 border-t border-[var(--line)]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#EAF1F8] flex items-center gap-2">
            <Plug className="w-4 h-4 text-[#5999ec]" />
            <span>Active Integration Connectors</span>
          </h3>
          <a
            href={studioHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#2ED8B6] hover:underline flex items-center gap-1"
          >
            <span>Manage Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="card p-8 text-center border-[var(--line)] bg-[#121A24] space-y-3">
          <Box className="w-8 h-8 text-[#5999ec] mx-auto opacity-75" />
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-bold text-[#EAF1F8]">No Products Installed</h4>
            <p className="text-xs text-[#8A99AD] leading-relaxed">
              Zero external packages or custom solutions are installed for this workspace. Browse Marketplace to acquire capabilities and configure them in Studio.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1">
            {onNavigateToMarketplace ? (
              <button
                onClick={onNavigateToMarketplace}
                className="btn btn-primary py-2 px-4 text-xs font-mono inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Onboard More</span>
              </button>
            ) : (
              <a
                href={marketplaceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary py-2 px-4 text-xs font-mono inline-flex items-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Onboard More</span>
              </a>
            )}
            <a
              href={studioHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary py-2 px-4 text-xs font-mono inline-flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Manage in Studio</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

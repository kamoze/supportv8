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
  Layers,
  Terminal,
  Server,
  Globe,
  Radio,
  Cpu,
  Check,
  ShoppingBag,
  SlidersHorizontal,
} from "@/components/ui/FlatIcon";
import type { MarketplaceConnector } from "@/lib/types/marketplace-types";

interface MarketplaceConnectorsViewProps {
  connectors: MarketplaceConnector[];
  verticals?: any[];
  onToggleConnector?: (id: string, isSubscribed: boolean) => void;
  onOpenConfig?: (connector: MarketplaceConnector) => void;
  onNotify?: (text: string, type: "success" | "error" | "info") => void;
  onNavigateToStudio?: (subTab?: string) => void;
  onNavigateToInstalled?: () => void;
  tenantId?: string;
}

const STUDIO_EXTERNAL_URL = process.env.NEXT_PUBLIC_STUDIOV8_URL || "https://studio.servicev8.com";
const MARKETPLACE_EXTERNAL_URL = process.env.NEXT_PUBLIC_MARKETPLACEV8_URL || "https://marketplace.servicev8.com";

export function MarketplaceConnectorsView({
  connectors = [],
  verticals = [],
  onToggleConnector,
  onOpenConfig,
  onNotify,
  onNavigateToStudio,
  onNavigateToInstalled,
  tenantId = "acme",
}: MarketplaceConnectorsViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const studioHref = `${STUDIO_EXTERNAL_URL}/?tenant=${encodeURIComponent(tenantId)}&vertical=support&tab=integrations`;
  const marketplaceHref = MARKETPLACE_EXTERNAL_URL;

  const activeConnectors = connectors.filter((c) => c.isSubscribed || c.status === "active");
  const filteredConnectors = activeConnectors.filter((c) =>
    searchQuery ? c.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <Plug className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-[#EAF1F8]">Connectors</h2>
            <span className="pill ok text-[10px] font-mono">ACTION GATEWAY</span>
          </div>
          <p className="text-xs text-[#8A99AD] max-w-2xl">
            Connect your business providers so your employees can take action. Setup happens securely in Studio; connection status is verified by Action Gateway.
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

          <a
            href={marketplaceHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#2ED8B6]" />
            <span>Browse Market</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Architecture Notice */}
      <div className="p-4 rounded-xl bg-[#121A24] border border-[var(--line)] flex items-start gap-3">
        <Shield className="w-5 h-5 text-[#2ED8B6] shrink-0 mt-0.5" />
        <div className="text-xs text-[#8A99AD] space-y-1">
          <p className="font-semibold text-[#EAF1F8]">Action Gateway Authority</p>
          <p>
            Connectors are authenticated external pipes configured once per account in Studio (<code className="text-[#2ED8B6]">studio.servicev8.com/integrations</code>) and stored in AWS SSM Parameter Store. SupportV8 does not duplicate provider secrets.
          </p>
        </div>
      </div>

      {/* Main Content: Active vs Empty */}
      {filteredConnectors.length === 0 ? (
        <div className="card p-12 text-center border-[var(--line)] bg-[#121A24] space-y-4">
          <span className="p-3 rounded-2xl bg-[#2ED8B6]/10 text-[#2ED8B6] border border-[#2ED8B6]/20 inline-block">
            <Plug className="w-8 h-8 opacity-75" />
          </span>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-[#EAF1F8]">No Connectors Configured</h3>
            <p className="text-xs text-[#8A99AD] leading-relaxed">
              Zero external connectors or hardware bridges are active for this workspace. Connectors are enabled when you install capabilities from the Marketplace and integrate them via the Action Gateway, unless configured in default settings.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <a
              href={marketplaceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary py-2 px-4 text-xs font-mono inline-flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Browse Marketplace</span>
            </a>
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
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7C8D]" />
              <input
                type="text"
                placeholder="Filter connectors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121A24] border border-[var(--line)] rounded-lg pl-9 pr-3 py-1.5 text-xs text-[#EAF1F8] placeholder-[#6B7C8D]"
              />
            </div>
            <span className="text-xs text-[#6B7C8D] font-mono">
              {filteredConnectors.length} active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConnectors.map((c) => (
              <div
                key={c.id}
                className="card p-5 border-[var(--line)] bg-[#121A24] space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="p-2.5 rounded-xl bg-[#162230] text-[#2ED8B6]">
                      <i className={c.icon || "fi fi-rr-plug"} />
                    </span>
                    <span className="pill ok text-[10px] font-mono">Connected</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#EAF1F8]">{c.name}</h4>
                    <p className="text-xs text-[#8A99AD] mt-1 leading-relaxed">{c.description}</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between">
                  <span className="text-[10px] text-[#6B7C8D] font-mono uppercase">{c.category}</span>
                  <a
                    href={studioHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary py-1 px-2.5 text-[11px] font-mono flex items-center gap-1 text-[#2ED8B6]"
                  >
                    <span>Manage Triggers in Studio</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

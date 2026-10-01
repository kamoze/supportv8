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
  Plug,
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
const MARKETPLACE_EXTERNAL_URL = process.env.NEXT_PUBLIC_MARKETPLACEV8_URL || "https://marketplace.servicev8.com";

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

  const studioUrl = `https://studio.servicev8.com/?tenant=${encodeURIComponent(tenantId)}&vertical=support`;

  const marketplaceCategories = [
    {
      id: "operations",
      title: "Operations",
      description: "Autonomous customer care reasoning, order resolution, and sentiment escalation.",
      icon: "fi fi-rr-comment-alt-middle",
      badge: "Marketplace",
    },
    {
      id: "voice",
      title: "Voice Concierge",
      description: "Omnichannel voice receptionists, PSTN telephony, and warm call transfers.",
      icon: "fi fi-rr-phone-call",
      badge: "Vapi & Twilio",
    },
    {
      id: "commerce",
      title: "Commerce",
      description: "Order tracking, delivery verification, and automated returns through Action Gateway.",
      icon: "fi fi-rr-shopping-cart",
      badge: "OrderV8",
    },
    {
      id: "knowledge",
      title: "Knowledge",
      description: "Vector RAG ingestion, institutional memory, and knowledge gap indexing.",
      icon: "fi fi-rr-brain",
      badge: "KnowledgeV8",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Architectural Hero Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-[#EAF1F8]">Marketplace</h2>
            <span className="pill ok text-[10px] font-mono">EXTERNAL DISCOVERY</span>
          </div>
          <p className="text-xs text-[#8A99AD] max-w-2xl">
            Onboard in Marketplace • Manage in Studio • Operate in Workforce. Packages and integrations acquired in Marketplace write to Registry and project into SupportV8.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <a
            href={MARKETPLACE_EXTERNAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Browse Market</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <a
            href={studioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#2ED8B6]" />
            <span>Manage in Studio</span>
          </a>

          {onNavigateToInstalled && (
            <button
              onClick={onNavigateToInstalled}
              className="btn btn-secondary py-2 px-3.5 text-xs flex items-center gap-1.5 font-mono cursor-pointer"
            >
              <Box className="w-3.5 h-3.5 text-[#5999ec]" />
              <span>Installed Products</span>
            </button>
          )}
        </div>
      </div>

      {/* External Authority Notice */}
      <div className="p-4 rounded-xl bg-[#121A24] border border-[var(--line)] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#2ED8B6] shrink-0 mt-0.5" />
        <div className="text-xs text-[#8A99AD] space-y-1">
          <p className="font-semibold text-[#EAF1F8]">ServiceV8 Architecture</p>
          <p>
            Marketplace is an external surface (<code className="text-[#2ED8B6]">marketplace.servicev8.com</code>). Capabilities and AI employees are acquired via signed handoff. Missing packages must not be simulated or localized.
          </p>
        </div>
      </div>

      {/* Canonical Sophia Voice Support Onboarding */}
      <div className="card p-6 border-[var(--line)] bg-[#121A24] relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="pill ok text-[10px] font-mono">CANONICAL EMPLOYEE</span>
              <span className="text-[10px] text-[#6B7C8D] font-mono">SV8-VOICE-CANONICAL</span>
            </div>
            <h3 className="text-lg font-bold text-[#EAF1F8]">Sophia — Customer Support Lead AI</h3>
            <p className="text-xs text-[#8A99AD] leading-relaxed">
              Autonomous customer care reasoning, order resolution, and sentiment escalation. Deploys to your inbound voice lines and omnichannel support queue.
            </p>
            <div className="flex items-center gap-4 text-xs text-[#6B7C8D]">
              <span className="flex items-center gap-1.5 text-[#2ED8B6]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Free to hire
              </span>
              <span>•</span>
              <span>subscription allowance first, then purchased top-up credits</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={SOPHIA_LAUNCH_PATH}
              className="btn btn-primary py-2.5 px-4 text-xs flex items-center gap-2 font-mono"
            >
              <Bot className="w-4 h-4" />
              <span>Hire or configure Sophia</span>
            </a>
          </div>
        </div>
      </div>

      {/* Discovery Hub Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#EAF1F8]">Explore Categories</h3>
          <a
            href={MARKETPLACE_EXTERNAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#2ED8B6] hover:underline flex items-center gap-1"
          >
            <span>All Categories</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {marketplaceCategories.map((cat) => (
            <a
              key={cat.id}
              href={MARKETPLACE_EXTERNAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-5 border-[var(--line)] bg-[#121A24] hover:border-[#2ED8B6]/40 transition-colors flex flex-col justify-between space-y-4 group cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="p-2.5 rounded-xl bg-[#162230] text-[#2ED8B6] group-hover:bg-[#2ED8B6]/10 transition-colors">
                    <i className={cat.icon} />
                  </span>
                  <span className="pill text-[9px] font-mono text-[#6B7C8D]">{cat.badge}</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#EAF1F8] group-hover:text-[#2ED8B6] transition-colors">
                    {cat.title}
                  </h4>
                  <p className="text-xs text-[#6B7C8D] mt-1 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs text-[#8A99AD] group-hover:text-[#EAF1F8]">
                <span>Browse Category</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  ShoppingBag,
  ExternalLink,
  Shield,
  Zap,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  Sparkles,
  Server,
  Plug,
  Cpu,
  RefreshCw,
  Clock,
  Radio,
  FileCheck,
  Send,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";

interface StudioMarketplaceHubViewProps {
  tenantId?: string;
  tenantName?: string;
  onNotify: (text: string, type?: "success" | "error" | "info") => void;
}

export function StudioMarketplaceHubView({
  tenantId = "tenant_default",
  tenantName = "Acme Corp",
  onNotify,
}: StudioMarketplaceHubViewProps) {
  const [studioUrl, setStudioUrl] = useState<string>("http://studiov8.servicev8.internal:3000/marketplace");
  const [ssoToken, setSsoToken] = useState<string>(`sso_tk_${tenantId}_${Date.now().toString(36)}`);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Active provisioned capabilities from Capability Registry
  const provisionedCapabilities = [
    {
      id: "cap_voice_sip",
      name: "Twilio Voice & WebRTC SIP Bridge",
      category: "Telephony",
      targetApp: "supportv8",
      source: "servicev8-registry",
      status: "active",
      grantedAt: "2026-08-26",
      dispatchesVia: "action-gateway",
    },
    {
      id: "cap_resend_email",
      name: "Resend Omnichannel Transactional Mail",
      category: "Email",
      targetApp: "supportv8",
      source: "servicev8-registry",
      status: "active",
      grantedAt: "2026-08-26",
      dispatchesVia: "action-gateway",
    },
    {
      id: "cap_orderv8_bridge",
      name: "OrderV8 Action Forge Gateway (Refunds & Ledger)",
      category: "Commerce",
      targetApp: "orderv8",
      source: "servicev8-registry",
      status: "active",
      grantedAt: "2026-08-27",
      dispatchesVia: "forge-gateway",
    },
    {
      id: "cap_knowledge_rag",
      name: "KnowledgeV8 Semantic RAG & Vector S3",
      category: "Knowledge",
      targetApp: "knowledgev8",
      source: "servicev8-registry",
      status: "active",
      grantedAt: "2026-08-25",
      dispatchesVia: "workforce-spine",
    },
    {
      id: "cap_workerv8_dispatch",
      name: "WorkerV8 Field Contractor PIN & SOW Dispatch",
      category: "Field Operations",
      targetApp: "workerv8",
      source: "servicev8-registry",
      status: "active",
      grantedAt: "2026-08-27",
      dispatchesVia: "action-gateway",
    },
  ];

  const handleLaunchStudio = () => {
    const target = `${studioUrl}?tenantId=${encodeURIComponent(tenantId)}&ssoToken=${encodeURIComponent(ssoToken)}`;
    window.open(target, "_blank", "noopener,noreferrer");
    onNotify(`Launched StudioV8 Marketplace with tenant SSO token (${tenantId})`, "success");
  };

  const handleRefreshEntitlements = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setSsoToken(`sso_tk_${tenantId}_${Date.now().toString(36)}`);
      setIsRefreshing(false);
      onNotify("Synchronized tenant entitlements from Capability Registry (`servicev8-registry`)", "success");
    }, 450);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">StudioV8 Marketplace &amp; Capability Hub</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="pill ok text-[9.5px] font-mono"><i className="dot"></i> REGISTRY ACTIVE</span>
                <span className="text-[11px] text-[#6B7C8D] font-mono">servicev8-registry.default.svc:8080</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#B4C2D0] pt-1">
            ServiceV8 Marketplace is the central commercial control plane. All Connectors, AI Employees, and Scenarios are acquired in StudioV8 and entitled via Capability Registry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefreshEntitlements}
            disabled={isRefreshing}
            className="btn btn-secondary text-xs flex items-center gap-1.5 font-mono cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Sync Registry</span>
          </button>

          <button
            type="button"
            onClick={handleLaunchStudio}
            className="btn btn-primary text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Launch Studio Marketplace</span>
          </button>
        </div>
      </div>

      {/* 3-Tier Architecture Flow Visual */}
      <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2ED8B6]" />
            <h3 className="text-xs font-bold text-[#EAF1F8] uppercase tracking-wider font-mono">
              Canonical 3-Tier Marketplace &amp; Action Flow Architecture
            </h3>
          </div>
          <span className="text-[10px] text-[#6B7C8D] font-mono">Zero Direct Connector Surfaces In Support</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Tier 1 */}
          <div className="p-4 rounded-xl bg-[#121A24] border border-[var(--line)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-[#4D9FFF] pb-1 border-b border-[var(--line)]">
                <span>TIER 1: DISCOVERY &amp; CHECKOUT</span>
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-semibold text-[#EAF1F8] mt-2">StudioV8 Web Marketplace</h4>
              <p className="text-[10.5px] text-[#8E9CAE] mt-1 leading-relaxed">
                Single commercial surface. Customers browse scenarios, AI employees, interns &amp; external provider connectors.
              </p>
            </div>
            <div className="p-2 rounded bg-[#18222E] text-[10px] text-[#2ED8B6]">
              Surface: /marketplace
            </div>
          </div>

          {/* Tier 2 */}
          <div className="p-4 rounded-xl bg-[#121A24] border border-[#2ED8B6]/40 space-y-2 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-[#2ED8B6] pb-1 border-b border-[var(--line)]">
                <span>TIER 2: CONTROL PLANE</span>
                <Server className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-semibold text-[#EAF1F8] mt-2">servicev8-registry (Kubernetes)</h4>
              <p className="text-[10.5px] text-[#8E9CAE] mt-1 leading-relaxed">
                Manages SemVer catalogs, audits target app compatibility, and grants immutable tenant capability licenses.
              </p>
            </div>
            <div className="p-2 rounded bg-[#18222E] text-[10px] text-[#4CC38A]">
              HPA 3 &rarr; 20 Replicas &bull; PgBouncer
            </div>
          </div>

          {/* Tier 3 */}
          <div className="p-4 rounded-xl bg-[#121A24] border border-[var(--line)] space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-[#F5A623] pb-1 border-b border-[var(--line)]">
                <span>TIER 3: DISPATCH &amp; EXECUTION</span>
                <Zap className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-semibold text-[#EAF1F8] mt-2">Action Gateway &amp; Workforce Spine</h4>
              <p className="text-[10.5px] text-[#8E9CAE] mt-1 leading-relaxed">
                Executes all external side-effects (Email, SMS, Voice, Stripe, SOW) with KMS envelope secret resolution.
              </p>
            </div>
            <div className="p-2 rounded bg-[#18222E] text-[10px] text-[#F5A623]">
              action-gateway &bull; temporal
            </div>
          </div>
        </div>
      </div>

      {/* Active Provisioned Capabilities Table */}
      <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-[#2ED8B6]" />
            <h3 className="text-xs font-bold text-[#EAF1F8] uppercase tracking-wider font-mono">
              Active Tenant Entitlements &amp; Capabilities ({tenantName})
            </h3>
          </div>
          <span className="text-[10px] text-[#6B7C8D] font-mono">Tenant ID: {tenantId}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--line)] text-[#6B7C8D] text-[10px] uppercase">
                <th className="pb-2">Capability Name</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Target App</th>
                <th className="pb-2">Dispatched Via</th>
                <th className="pb-2">Status</th>
                <th className="pb-2 text-right">Provision Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {provisionedCapabilities.map((cap) => (
                <tr key={cap.id} className="hover:bg-[#121A24]/60 transition-colors">
                  <td className="py-3 font-semibold text-[#EAF1F8]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4CC38A]" />
                      <span>{cap.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-[#B4C2D0]">{cap.category}</td>
                  <td className="py-3 text-[#4D9FFF]">{cap.targetApp}</td>
                  <td className="py-3 text-[#F5A623]">{cap.dispatchesVia}</td>
                  <td className="py-3">
                    <span className="pill ok text-[9px] uppercase">{cap.status}</span>
                  </td>
                  <td className="py-3 text-right text-[#6B7C8D] text-[11px]">{cap.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Action Link to Studio */}
        <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs">
          <span className="text-[#8E9CAE] text-[11px]">
            Need new CRM connectors, voice trunks, or additional AI Employees?
          </span>
          <button
            type="button"
            onClick={handleLaunchStudio}
            className="text-xs text-[#2ED8B6] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Browse StudioV8 Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

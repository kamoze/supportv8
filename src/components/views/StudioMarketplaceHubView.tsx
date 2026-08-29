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
  CreditCard,
  PlusCircle,
  Check,
  Users,
  Bot,
  Globe,
  DollarSign,
  Upload,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";

interface StudioMarketplaceHubViewProps {
  tenantId?: string;
  tenantName?: string;
  onNotify: (text: string, type?: "success" | "error" | "info") => void;
}

interface MarketplacePackage {
  id: string;
  name: string;
  category: "ai_employee" | "connector" | "scenario" | "telephony";
  targetApp: string;
  priceMonthly: number;
  description: string;
  status: "available" | "subscribed" | "pending_approval";
  badge: string;
  author: string;
}

export function StudioMarketplaceHubView({
  tenantId = "tenant_default",
  tenantName = "Acme Corp",
  onNotify,
}: StudioMarketplaceHubViewProps) {
  const [studioUrl, setStudioUrl] = useState<string>("https://studio.servicev8.com/marketplace");
  const [ssoToken, setSsoToken] = useState<string>(`sso_tk_${tenantId}_${Date.now().toString(36)}`);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"catalog" | "partner_submit" | "entitlements">("catalog");

  // Stripe Checkout Simulation State
  const [checkoutPkg, setCheckoutPkg] = useState<MarketplacePackage | null>(null);
  const [isProcessingStripe, setIsProcessingStripe] = useState<boolean>(false);

  // Partner Package Submission Form State
  const [partnerPkgName, setPartnerPkgName] = useState("");
  const [partnerCategory, setPartnerCategory] = useState<"ai_employee" | "connector" | "scenario">("ai_employee");
  const [partnerTargetApp, setPartnerTargetApp] = useState("supportv8");
  const [partnerPrice, setPartnerPrice] = useState("49");
  const [partnerDesc, setPartnerDesc] = useState("");

  // Catalog of packages exposed for purchase
  const [packages, setPackages] = useState<MarketplacePackage[]>([
    {
      id: "pkg_emp_cx_lead",
      name: "Sophia — Customer Support Lead AI",
      category: "ai_employee",
      targetApp: "supportv8",
      priceMonthly: 79,
      description: "Autonomous customer care reasoning, order resolution, and sentiment escalation.",
      status: "available",
      badge: "AI Employee",
      author: "ServiceV8 Labs",
    },
    {
      id: "pkg_emp_dispatch",
      name: "Alex — Contractor & Field Dispatch Lead",
      category: "ai_employee",
      targetApp: "workerv8",
      priceMonthly: 99,
      description: "Automated work order creation, technician GPS routing, and lockbox PIN issuance.",
      status: "available",
      badge: "AI Dispatch",
      author: "ServiceV8 Labs",
    },
    {
      id: "pkg_conn_zendesk",
      name: "Zendesk Enterprise Two-Way Bridge",
      category: "connector",
      targetApp: "supportv8",
      priceMonthly: 39,
      description: "Real-time webhook sync, bi-directional comments, and tag synchronization.",
      status: "available",
      badge: "Connector",
      author: "Zendesk Partner Network",
    },
    {
      id: "pkg_conn_twilio",
      name: "Twilio Voice & WebRTC Telephony Gateway",
      category: "telephony",
      targetApp: "supportv8",
      priceMonthly: 49,
      description: "Inbound SIP trunking, AI live call transcription, and audio streaming.",
      status: "available",
      badge: "Telephony",
      author: "ServiceV8 Labs",
    },
    {
      id: "pkg_orderv8_sync",
      name: "OrderV8 Action Forge & Refund Ledger",
      category: "connector",
      targetApp: "orderv8",
      priceMonthly: 59,
      description: "Instant credit vouchers, automated void authorization, and ledger sync.",
      status: "available",
      badge: "Commerce",
      author: "OrderV8 Core",
    },
  ]);

  // Launch Studio External
  const handleLaunchStudio = () => {
    const target = `${studioUrl}?tenantId=${encodeURIComponent(tenantId)}&ssoToken=${encodeURIComponent(ssoToken)}`;
    window.open(target, "_blank", "noopener,noreferrer");
    onNotify(`Opening Studio Marketplace with tenant SSO token (${tenantId})`, "success");
  };

  // Refresh Entitlements
  const handleRefreshEntitlements = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setSsoToken(`sso_tk_${tenantId}_${Date.now().toString(36)}`);
      setIsRefreshing(false);
      onNotify("Synchronized tenant capability entitlements from Studio Marketplace", "success");
    }, 450);
  };

  // Simulate Stripe Checkout
  const handleExecuteStripeCheckout = () => {
    if (!checkoutPkg) return;
    setIsProcessingStripe(true);

    setTimeout(() => {
      setIsProcessingStripe(false);
      setPackages((prev) =>
        prev.map((p) => (p.id === checkoutPkg.id ? { ...p, status: "subscribed" } : p))
      );
      const pkgName = checkoutPkg.name;
      setCheckoutPkg(null);
      onNotify(`Subscribed to ${pkgName} via Stripe Checkout. Action Gateway enabled!`, "success");
    }, 800);
  };

  // Submit Partner Package for Approval
  const handleSubmitPartnerPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerPkgName.trim() || !partnerDesc.trim()) {
      onNotify("Please provide package name and description", "error");
      return;
    }

    const newPkg: MarketplacePackage = {
      id: `pkg_partner_${Date.now()}`,
      name: partnerPkgName,
      category: partnerCategory,
      targetApp: partnerTargetApp,
      priceMonthly: parseFloat(partnerPrice) || 49,
      description: partnerDesc,
      status: "pending_approval",
      badge: "Partner Submission",
      author: tenantName,
    };

    setPackages((prev) => [newPkg, ...prev]);
    setPartnerPkgName("");
    setPartnerDesc("");
    setActiveTab("catalog");
    onNotify(`Package '${newPkg.name}' submitted to Studio Marketplace review pipeline`, "success");
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
              <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Studio Marketplace &amp; Capability Hub</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="pill ok text-[9.5px] font-mono"><i className="dot" /> MARKETPLACE ONLINE</span>
                <span className="text-[11px] text-[#6B7C8D] font-mono">studio.servicev8.com</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#B4C2D0] pt-1">
            Browse and purchase AI Employees, Omnichannel Connectors, and Custom Domain Blueprints. All external calls are secured via Action Gateway.
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
            <span>Sync Entitlements</span>
          </button>

          <a
            href="https://marketplace.servicev8.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Public Marketplace</span>
          </a>

          <button
            type="button"
            onClick={handleLaunchStudio}
            className="btn btn-primary text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Launch Studio Hub</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("catalog")}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "catalog"
              ? "bg-[#2ED8B6] text-[#04201C] font-bold"
              : "text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Available Packages ({packages.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("partner_submit")}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "partner_submit"
              ? "bg-[#2ED8B6] text-[#04201C] font-bold"
              : "text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Partner Submission</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("entitlements")}
          className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
            activeTab === "entitlements"
              ? "bg-[#2ED8B6] text-[#04201C] font-bold"
              : "text-[#8E9AA8] hover:text-[#EAF1F8]"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Action Gateway Governance</span>
        </button>
      </div>

      {/* TAB 1: AVAILABLE PACKAGES */}
      {activeTab === "catalog" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const isSubscribed = pkg.status === "subscribed";
            const isPending = pkg.status === "pending_approval";

            return (
              <div
                key={pkg.id}
                className={`card p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-lg ${
                  isSubscribed
                    ? "bg-[#14202B] border-[#2ED8B6]/60 shadow-[#2ED8B6]/10"
                    : isPending
                    ? "bg-[#18202A] border-[#F5A623]/50"
                    : "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="pill text-[9.5px] font-mono bg-[#18222E] text-[#2ED8B6]">
                      {pkg.badge}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#EAF1F8]">
                      ${pkg.priceMonthly}/mo
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#EAF1F8]">{pkg.name}</h3>
                  <p className="text-xs text-[#8E9AA8] leading-relaxed">{pkg.description}</p>
                </div>

                <div className="pt-3 border-t border-[var(--line)] space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#6B7C8D]">
                    <span>Target: <strong className="text-[#B4C2D0]">{pkg.targetApp}</strong></span>
                    <span>By: {pkg.author}</span>
                  </div>

                  {isSubscribed ? (
                    <div className="w-full py-2 rounded-xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 text-[#2ED8B6] font-mono text-xs font-bold flex items-center justify-center gap-1.5">
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Subscribed &amp; Active</span>
                    </div>
                  ) : isPending ? (
                    <div className="w-full py-2 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/40 text-[#F5A623] font-mono text-xs font-bold flex items-center justify-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      <span>Pending Partner Approval</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCheckoutPkg(pkg)}
                      className="w-full btn btn-primary py-2 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Subscribe with Stripe</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: PARTNER PACKAGE SUBMISSION */}
      {activeTab === "partner_submit" && (
        <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl max-w-2xl mx-auto space-y-5 shadow-xl">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#EAF1F8]">Submit Package for Marketplace Publishing</h2>
            <p className="text-xs text-[#8E9AA8]">
              Partners can scaffold connectors, AI employees, and automated workflows for approval and monetization.
            </p>
          </div>

          <form onSubmit={handleSubmitPartnerPackage} className="space-y-4 text-xs font-mono">
            <div className="space-y-1.5">
              <label className="text-[#B4C2D0] block">Package Name</label>
              <input
                type="text"
                value={partnerPkgName}
                onChange={(e) => setPartnerPkgName(e.target.value)}
                placeholder="e.g. Stripe Dispute Resolution AI Employee"
                required
                className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[#B4C2D0] block">Category</label>
                <select
                  value={partnerCategory}
                  onChange={(e) => setPartnerCategory(e.target.value as any)}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-3 py-2.5 text-xs text-[#EAF1F8] focus:outline-none"
                >
                  <option value="ai_employee">AI Employee Blueprint</option>
                  <option value="connector">Omnichannel Connector</option>
                  <option value="scenario">Simulation Scenario</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#B4C2D0] block">Target App</label>
                <select
                  value={partnerTargetApp}
                  onChange={(e) => setPartnerTargetApp(e.target.value)}
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-3 py-2.5 text-xs text-[#EAF1F8] focus:outline-none"
                >
                  <option value="supportv8">supportv8</option>
                  <option value="growthv8">growthv8</option>
                  <option value="orderv8">orderv8</option>
                  <option value="workerv8">workerv8</option>
                  <option value="knowledgev8">knowledgev8</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[#B4C2D0] block">Monthly Price ($ USD)</label>
              <input
                type="number"
                value={partnerPrice}
                onChange={(e) => setPartnerPrice(e.target.value)}
                className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#B4C2D0] block">Package Description &amp; Scope of Work</label>
              <textarea
                value={partnerDesc}
                onChange={(e) => setPartnerDesc(e.target.value)}
                placeholder="Explain the capability, endpoints, and automation logic provided..."
                rows={3}
                required
                className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl p-3 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            <div className="pt-3 border-t border-[var(--line)] flex justify-end">
              <button
                type="submit"
                className="btn btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#2ED8B6]/20"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Submit for Approval</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ACTION GATEWAY GOVERNANCE */}
      {activeTab === "entitlements" && (
        <div className="card p-6 bg-[#0E1520] border-[var(--line)] rounded-3xl space-y-4 shadow-xl text-xs font-mono">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#2ED8B6]" />
              <h3 className="font-bold text-[#EAF1F8]">Action Gateway Execution Matrix</h3>
            </div>
            <span className="pill ok text-[9.5px]"><i className="dot" /> STRICT ZERO-TRUST</span>
          </div>

          <div className="space-y-2 text-[#B4C2D0] leading-relaxed">
            <p>
              Every outgoing inter-service action (e.g. OrderV8 refunds, Twilio voice transfers, Resend emails) passes through the <strong>Zero-Trust Action Gateway</strong> with HMAC signature validation and idempotency tokens.
            </p>
            <p className="text-[11px] text-[#8E9AA8]">
              Unsubscribed or inactive capabilities automatically fail closed with <code className="text-[#F5A623]">403 Forbidden (Subscription Required)</code>. Non-LLM autonomous actions remain free and fully standard.
            </p>
          </div>
        </div>
      )}

      {/* STRIPE CHECKOUT MODAL SIMULATION */}
      {checkoutPkg && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-md bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col">
            <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">Stripe Checkout</h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutPkg(null)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-mono">
              <div className="p-4 rounded-2xl bg-[#141C26] border border-[var(--line)] space-y-2">
                <span className="text-[10px] text-[#6B7C8D]">Selected Package:</span>
                <h4 className="text-sm font-bold text-[#EAF1F8]">{checkoutPkg.name}</h4>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--line)]">
                  <span>Billing Frequency: Monthly</span>
                  <span className="text-sm font-bold text-[#2ED8B6]">${checkoutPkg.priceMonthly}.00</span>
                </div>
              </div>

              <div className="text-[11px] text-[#8E9AA8]">
                This action will provision live capability keys and activate the package on tenant <code className="text-[#2ED8B6]">{tenantId}</code>.
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setCheckoutPkg(null)}
                  className="btn btn-secondary px-4 py-2 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingStripe}
                  onClick={handleExecuteStripeCheckout}
                  className="btn btn-primary px-6 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
                >
                  {isProcessingStripe ? "Processing Stripe..." : `Confirm & Pay $${checkoutPkg.priceMonthly}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

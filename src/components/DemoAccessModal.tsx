"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Building2,
  User,
  ArrowRight,
  X,
  Loader2,
  Shield,
  Users,
  HardHat,
  Zap,
  PhoneCall,
  Brain,
  Layers,
  Radio,
  Sparkles,
  Check,
  Briefcase,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";

export interface DemoAccessModalProps {
  isOpen: boolean;
  initialTenantSlug?: string;
  onClose: () => void;
  onSuccess: (tenantSlug: string, email: string) => void;
  onOpenSignIn: () => void;
}

interface CapabilityOption {
  id: string;
  icon: React.ReactNode;
  title: string;
  tag: string;
  description: string;
}

const CAPABILITIES_LIST: CapabilityOption[] = [
  {
    id: "autonomous_action_gateway",
    icon: <Zap className="w-4 h-4 text-[#2ED8B6]" />,
    title: "Autonomous Action Gateway & Refunds",
    tag: "Execution",
    description: "Autonomous credit vouchers, account modifications, and API mutations bounded by confidence thresholds.",
  },
  {
    id: "multichannel_ai_triage",
    icon: <Users className="w-4 h-4 text-[#4D9FFF]" />,
    title: "Multi-Channel AI Frontline Triage",
    tag: "Triage",
    description: "Instant ticket deflection, sentiment scoring (-1.0 to +1.0), and automated categorization across Zendesk & Email.",
  },
  {
    id: "lowlatency_voice_telephony",
    icon: <PhoneCall className="w-4 h-4 text-[#2ED8B6]" />,
    title: "Sub-300ms Low-Latency AI Voice Telephony",
    tag: "Voice",
    description: "Twilio SIP trunking, WebRTC bi-directional audio chunks, sub-300ms speech-to-text, and warm human escalations.",
  },
  {
    id: "field_contractor_dispatch",
    icon: <HardHat className="w-4 h-4 text-[#F5A623]" />,
    title: "Field Dispatch & Contractor Operations",
    tag: "Field Ops",
    description: "Contractor SLA tracking, technician scheduling, work orders, and emergency lockbox access PIN generation (8492-X).",
  },
  {
    id: "vector_rag_knowledge",
    icon: <Brain className="w-4 h-4 text-[#A78BFA]" />,
    title: "1536-dim Vector RAG & Knowledge Radar",
    tag: "Knowledge",
    description: "Semantic chunking, automatic knowledge gap detection, and one-click draft article publishing.",
  },
  {
    id: "zerotrust_governance",
    icon: <Shield className="w-4 h-4 text-[#38BDF8]" />,
    title: "Zero-Trust Governance & Multi-Sig Approvals",
    tag: "Security",
    description: "Strict human supervisor approval gating for high-risk actions ($50+), mTLS, and cryptographic audit ledgers.",
  },
  {
    id: "incident_correlation",
    icon: <Radio className="w-4 h-4 text-[#F43F5E]" />,
    title: "Real-Time Incident Correlation & Proactive Comms",
    tag: "Incidents",
    description: "Cross-system outage clustering ($ revenue exposure tracking) and automated proactive user blasts.",
  },
  {
    id: "stale_work_sweeper",
    icon: <Layers className="w-4 h-4 text-[#FBBF24]" />,
    title: "Stale External Ticket Sweeper",
    tag: "Automation",
    description: "Autonomous background worker to verify and auto-close dormant external helpdesk tickets.",
  },
];

const TICKET_VOLUME_OPTIONS = [
  "< 1,000 / mo",
  "1k - 10k / mo",
  "10k - 50k / mo",
  "50k+ / mo",
];

export function DemoAccessModal({
  isOpen,
  initialTenantSlug = "acme",
  onClose,
  onSuccess,
  onOpenSignIn,
}: DemoAccessModalProps) {
  const [selectedTenant, setSelectedTenant] = useState<string>(initialTenantSlug);
  const [workEmail, setWorkEmail] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [ticketVolume, setTicketVolume] = useState<string>("");
  const [optInEmail, setOptInEmail] = useState<boolean>(true);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([
    "autonomous_action_gateway",
    "multichannel_ai_triage",
    "lowlatency_voice_telephony",
  ]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (isOpen) {
      setSelectedTenant(initialTenantSlug === "meridian" ? "meridian" : "acme");
      setErrorMsg("");
    }
  }, [isOpen, initialTenantSlug]);

  if (!isOpen) return null;

  const toggleCapability = (id: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllCapabilities = () => {
    setSelectedCapabilities(CAPABILITIES_LIST.map((c) => c.id));
  };

  const clearAllCapabilities = () => {
    setSelectedCapabilities([]);
  };

  const executeHandoff = (tenantSlug: string, email: string) => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("sv8_demo_unlocked", "true");
        sessionStorage.setItem("sv8_lead_email", email);
        if (companyName.trim()) {
          sessionStorage.setItem("sv8_lead_company", companyName.trim());
        }
      } catch (_) {}
    }
    onSuccess(tenantSlug, email);
    onClose();
  };

  // Quick Launch (Instant access bypassing form)
  const handleQuickLaunch = async () => {
    setIsLoading(true);
    try {
      // Fire-and-forget guest telemetry
      fetch("/api/leads/demo-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workEmail: "",
          companyName: "Quick Demo Guest",
          targetTenant: selectedTenant,
          needsAssessment: selectedCapabilities.map(
            (id) => CAPABILITIES_LIST.find((c) => c.id === id)?.title || id
          ),
          ticketVolume: ticketVolume || undefined,
          optInEmail: false,
          source: "quick_launch_bypass",
        }),
      }).catch(() => {});
    } catch (_) {}

    setIsLoading(false);
    executeHandoff(selectedTenant, "guest-demo@servicev8.com");
  };

  // Form Submit (Captures user info & Q&A)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const emailTrim = workEmail.trim();
    if (emailTrim && (!emailTrim.includes("@") || !emailTrim.includes("."))) {
      setErrorMsg("Please enter a valid corporate work email address.");
      return;
    }

    setIsLoading(true);

    try {
      const selectedTitles = selectedCapabilities.map(
        (id) => CAPABILITIES_LIST.find((c) => c.id === id)?.title || id
      );

      const res = await fetch("/api/leads/demo-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workEmail: emailTrim || `guest_${Date.now()}@servicev8.com`,
          fullName: fullName.trim() || undefined,
          companyName: companyName.trim() || "Evaluation Organization",
          targetTenant: selectedTenant,
          needsAssessment: selectedTitles,
          ticketVolume: ticketVolume || undefined,
          optInEmail,
          source: "interactive_demo_gate",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok && data?.error) {
        setErrorMsg(data.error);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      executeHandoff(selectedTenant, emailTrim || "guest-demo@servicev8.com");
    } catch (_) {
      setIsLoading(false);
      executeHandoff(selectedTenant, emailTrim || "guest-demo@servicev8.com");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupportV8Logo size={32} showText={false} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-[#EAF1F8] tracking-tight">
                  Launch Interactive Demo Sandbox
                </h3>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2ED8B6]/10 text-[#2ED8B6] text-[10px] font-mono font-bold">
                  <Sparkles className="w-3 h-3" />
                  <span>LIVE ACCESS</span>
                </span>
              </div>
              <p className="text-xs font-mono text-[#6B7C8D]">
                Select your environment &amp; tailored AI support capabilities to begin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center gap-2.5">
              <span className="text-[#E5484D] font-bold">Notice:</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION 1: CHOICE OF DEMO ENVIRONMENT */}
          {/* ========================================================================= */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#B4C2D0] uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span>1. Select Demo Environment</span>
                <span className="text-[#2ED8B6] font-normal">• Operator Cockpit</span>
              </label>
              <span className="text-[11px] font-mono text-[#6B7C8D]">
                Active: <span className="text-[#EAF1F8] font-bold">{selectedTenant === "meridian" ? "Meridian Logistics" : "Acme Corp"}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Acme Corp Option */}
              <div
                onClick={() => setSelectedTenant("acme")}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  selectedTenant === "acme"
                    ? "bg-[#2ED8B6]/10 border-[#2ED8B6] shadow-lg shadow-[#2ED8B6]/10"
                    : "bg-[#141C26] border-[var(--line)] hover:border-[#2ED8B6]/40 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#2ED8B6]/20 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6]">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#EAF1F8]">Acme Corp Sandbox</div>
                      <div className="text-[10px] font-mono text-[#2ED8B6]">SaaS Customer Care &amp; Billing</div>
                    </div>
                  </div>
                  {selectedTenant === "acme" && (
                    <span className="w-5 h-5 rounded-full bg-[#2ED8B6] text-black flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8E9AA8] leading-relaxed mb-2.5">
                  Autonomous credit voucher adjustments, subscription care, Tier-1 CSAT telemetry, and SLA auto-escalations with Sophia (CX Lead).
                </p>
                <div className="text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)] flex items-center justify-between">
                  <span>acme.support.servicev8.com</span>
                  <span className="text-[#2ED8B6]">Sophia Lead</span>
                </div>
              </div>

              {/* Meridian Logistics Option */}
              <div
                onClick={() => setSelectedTenant("meridian")}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  selectedTenant === "meridian"
                    ? "bg-[#F5A623]/10 border-[#F5A623] shadow-lg shadow-[#F5A623]/10"
                    : "bg-[#141C26] border-[var(--line)] hover:border-[#F5A623]/40 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#F5A623]/20 border border-[#F5A623]/40 flex items-center justify-center text-[#F5A623]">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[#EAF1F8]">Meridian Logistics Sandbox</div>
                      <div className="text-[10px] font-mono text-[#F5A623]">Field Dispatch &amp; Contractors</div>
                    </div>
                  </div>
                  {selectedTenant === "meridian" && (
                    <span className="w-5 h-5 rounded-full bg-[#F5A623] text-black flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8E9AA8] leading-relaxed mb-2.5">
                  Emergency digital lockbox PIN generation (8492-X), technician field dispatch, work orders, and contractor compliance tracking.
                </p>
                <div className="text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)] flex items-center justify-between">
                  <span>meridian.support.servicev8.com</span>
                  <span className="text-[#F5A623]">Alex Lead</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: CHECKBOX Q&A — WHAT DO YOU NEED FROM AN AI SUPPORT SYSTEM? */}
          {/* ========================================================================= */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1">
              <div>
                <label className="text-xs font-mono text-[#B4C2D0] uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <span>2. What do you need from an AI Support System?</span>
                </label>
                <p className="text-[11px] text-[#6B7C8D]">
                  Select the key requirements you are evaluating (we will preload relevant workflows)
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <button
                  type="button"
                  onClick={selectAllCapabilities}
                  className="text-[#2ED8B6] hover:underline cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-[#6B7C8D]">•</span>
                <button
                  type="button"
                  onClick={clearAllCapabilities}
                  className="text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  Clear
                </button>
                <span className="text-[#6B7C8D]">({selectedCapabilities.length}/{CAPABILITIES_LIST.length})</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CAPABILITIES_LIST.map((cap) => {
                const isChecked = selectedCapabilities.includes(cap.id);
                return (
                  <div
                    key={cap.id}
                    onClick={() => toggleCapability(cap.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isChecked
                        ? "bg-[#18222E] border-[#2ED8B6]/60 shadow-sm"
                        : "bg-[#121A24] border-[var(--line)] hover:border-[var(--line-2)] opacity-70 hover:opacity-100"
                    }`}
                  >
                    <div className="mt-0.5">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                          isChecked
                            ? "bg-[#2ED8B6] border-[#2ED8B6] text-black"
                            : "border-[var(--line)] bg-[#141C26]"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-xs text-[#EAF1F8] leading-tight truncate">
                          {cap.title}
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#141C26] text-[#8E9AA8] shrink-0">
                          {cap.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8E9AA8] leading-snug line-clamp-2">
                        {cap.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: OPTIONAL USER & ORGANIZATION INFO (OPT-IN) */}
          {/* ========================================================================= */}
          <form id="demo-access-form" onSubmit={handleSubmit} className="space-y-4 pt-3 border-t border-[var(--line)]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-[#B4C2D0] uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span>3. Tell Us About Your Organization</span>
                <span className="text-[#6B7C8D] font-normal text-[10px]">(Optional • Quick Entry)</span>
              </label>
              <span className="text-[10px] font-mono text-[#2ED8B6]">Fast-Track Setup</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Work Email */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-[#8E9AA8] flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>Work Email</span>
                </label>
                <input
                  type="email"
                  value={workEmail}
                  onChange={(e) => setWorkEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              {/* Company Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-[#8E9AA8] flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-[#F5A623]" />
                  <span>Company Name</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Global Inc."
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              {/* Your Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono text-[#8E9AA8] flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#4D9FFF]" />
                  <span>Your Name</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Sarah Vance"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            {/* Ticket Volume Scale Pills */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-mono text-[#8E9AA8] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#A78BFA]" />
                <span>Estimated Monthly Support Volume</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {TICKET_VOLUME_OPTIONS.map((vol) => (
                  <button
                    key={vol}
                    type="button"
                    onClick={() => setTicketVolume(ticketVolume === vol ? "" : vol)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                      ticketVolume === vol
                        ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#2ED8B6] font-bold"
                        : "bg-[#141C26] border-[var(--line)] text-[#8E9AA8] hover:text-[#EAF1F8]"
                    }`}
                  >
                    {vol}
                  </button>
                ))}
              </div>
            </div>

            {/* Email Opt-in */}
            <div
              onClick={() => setOptInEmail(!optInEmail)}
              className="p-3 rounded-2xl bg-[#121A24]/60 border border-[var(--line)] flex items-start gap-2.5 cursor-pointer select-none hover:border-[#2ED8B6]/40 transition-colors"
            >
              <input
                type="checkbox"
                id="optInEmailDemo"
                checked={optInEmail}
                onChange={(e) => setOptInEmail(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 rounded border-[var(--line)] bg-[#141C26] text-[#2ED8B6] focus:ring-[#2ED8B6] accent-[#2ED8B6] cursor-pointer"
              />
              <label htmlFor="optInEmailDemo" className="text-xs text-[#8E9AA8] leading-relaxed cursor-pointer">
                <span>Send me tailored sandbox setup instructions, API keys, and enterprise solution architecture guides via email.</span>{" "}
                <span className="text-[10px] text-[#6B7C8D] font-mono">(Optional)</span>
              </label>
            </div>
          </form>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 sm:px-8 sm:py-5 bg-[#121A24] border-t border-[var(--line)] flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSignIn();
            }}
            className="text-xs text-[#8E9AA8] hover:text-[#2ED8B6] font-mono cursor-pointer order-2 sm:order-1"
          >
            Registered staff member? <span className="underline">Sign In</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2">
            {/* Quick Skip Button */}
            <button
              type="button"
              onClick={handleQuickLaunch}
              disabled={isLoading}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-[var(--line-2)] hover:bg-[#18222E] text-[#B4C2D0] hover:text-[#EAF1F8] text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
            >
              Skip Form &amp; Quick Launch ⚡
            </button>

            {/* Primary Submit Button */}
            <button
              type="submit"
              form="demo-access-form"
              disabled={isLoading}
              className="flex-1 sm:flex-initial btn btn-primary px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Launching Sandbox...</span>
                </>
              ) : (
                <>
                  <span>Launch {selectedTenant === "meridian" ? "Meridian" : "Acme"} Sandbox</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

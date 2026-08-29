"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Mail,
  Building2,
  User,
  ArrowRight,
  X,
  Loader2,
  Shield,
  CheckCircle2,
  Users,
  HardHat,
  RefreshCw,
  Lock,
  Zap,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";

interface DemoAccessModalProps {
  isOpen: boolean;
  initialTenantSlug?: string;
  onClose: () => void;
  onSuccess: (tenantSlug: string, email: string) => void;
  onOpenSignIn: () => void;
}

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Simple Captcha Verification
  const [captchaNum1, setCaptchaNum1] = useState(3);
  const [captchaNum2, setCaptchaNum2] = useState(5);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaError, setCaptchaError] = useState(false);

  const refreshCaptcha = () => {
    const n1 = Math.floor(Math.random() * 6) + 2;
    const n2 = Math.floor(Math.random() * 6) + 2;
    setCaptchaNum1(n1);
    setCaptchaNum2(n2);
    setCaptchaAnswer("");
    setCaptchaError(false);
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedTenant(initialTenantSlug || "acme");
      refreshCaptcha();
      setErrorMsg("");
    }
  }, [isOpen, initialTenantSlug]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!workEmail.trim() || !workEmail.includes("@") || !workEmail.includes(".")) {
      setErrorMsg("Please provide a valid work email address.");
      return;
    }

    if (parseInt(captchaAnswer.trim(), 10) !== captchaNum1 + captchaNum2) {
      setCaptchaError(true);
      setErrorMsg("Security check answer is incorrect. Please try again.");
      refreshCaptcha();
      return;
    }

    setIsLoading(true);

    try {
      // Capture lead in sales pipeline
      await fetch("/api/leads/demo-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workEmail,
          fullName,
          companyName,
          targetTenant: selectedTenant,
          source: "interactive_demo_gate",
        }),
      });

      // Mark demo as unlocked for this browser session
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("sv8_demo_unlocked", "true");
          sessionStorage.setItem("sv8_lead_email", workEmail);
        } catch (_) {}
      }

      setIsLoading(false);
      onSuccess(selectedTenant, workEmail);
      onClose();
    } catch (_) {
      setIsLoading(false);
      // Fallback unlock so the prospect is not blocked
      if (typeof window !== "undefined") {
        sessionStorage.setItem("sv8_demo_unlocked", "true");
      }
      onSuccess(selectedTenant, workEmail);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupportV8Logo size={28} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#EAF1F8]">Unlock Live Interactive Sandbox</h3>
                <span className="pill text-[9px] font-mono text-[#2ED8B6] bg-[#2ED8B6]/15">Instant Access</span>
              </div>
              <p className="text-[10px] font-mono text-[#6B7C8D]">Pre-Seeded Enterprise CX &amp; Dispatch Telemetry</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <p className="text-xs text-[#8E9AA8] leading-relaxed">
            Enter your business email to explore full customer care workflows, autonomous refund tokens (&lt; $500), contractor lockbox PINs, and real-time dispatch tracking.
          </p>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center gap-2">
              <span className="text-[#E5484D] font-bold">Error:</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sandbox Tenant Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono text-[#B4C2D0] block">Select Sandbox Environment</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedTenant("acme")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedTenant === "acme"
                    ? "bg-[#2ED8B6]/15 border-[#2ED8B6] shadow-lg shadow-[#2ED8B6]/10"
                    : "bg-[#141C26] border-[var(--line)] hover:border-[#2ED8B6]/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 font-bold text-xs text-[#EAF1F8]">
                    <Users className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Acme Corp</span>
                  </span>
                  <span className="text-[9px] font-mono text-[#2ED8B6]">SaaS Care</span>
                </div>
                <p className="text-[10px] text-[#8E9AA8]">
                  OrderV8 refund tokens, subscription care, and high-priority customer desk.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTenant("meridian")}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedTenant === "meridian"
                    ? "bg-[#F5A623]/15 border-[#F5A623] shadow-lg shadow-[#F5A623]/10"
                    : "bg-[#141C26] border-[var(--line)] hover:border-[#F5A623]/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5 font-bold text-xs text-[#EAF1F8]">
                    <HardHat className="w-3.5 h-3.5 text-[#F5A623]" />
                    <span>Meridian</span>
                  </span>
                  <span className="text-[9px] font-mono text-[#F5A623]">Field Dispatch</span>
                </div>
                <p className="text-[10px] text-[#8E9AA8]">
                  Contractor work orders, emergency telecom PINs, and technician tracking.
                </p>
              </button>
            </div>
          </div>

          {/* Form */}
          <form id="demo-access-form" onSubmit={handleSubmit} className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#2ED8B6]" />
                <span>Work Email *</span>
              </label>
              <input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="alex@enterprise.com"
                required
                className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#4D9FFF]" />
                  <span>Full Name</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Vance"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#F5A623]" />
                  <span>Company</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Vance Telecom"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            {/* Captcha */}
            <div className="p-3 rounded-xl bg-[#121A24] border border-[var(--line)] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#B4C2D0]">
                <span className="flex items-center gap-1.5 text-[#2ED8B6]">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Human Verification</span>
                </span>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-[10px] text-[#6B7C8D] hover:text-[#EAF1F8] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded-lg bg-[#18222E] border border-[var(--line-2)] text-xs font-mono font-bold text-[#EAF1F8] select-none tracking-widest">
                  {captchaNum1} + {captchaNum2} = ?
                </div>
                <input
                  type="number"
                  value={captchaAnswer}
                  onChange={(e) => {
                    setCaptchaAnswer(e.target.value);
                    setCaptchaError(false);
                  }}
                  placeholder="Sum"
                  required
                  className={`flex-1 bg-[#141C26] border rounded-xl px-3 py-1.5 text-xs font-mono text-[#EAF1F8] focus:outline-none ${
                    captchaError ? "border-[#E5484D]" : "border-[var(--line)] focus:border-[#2ED8B6]"
                  }`}
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#121A24] border-t border-[var(--line)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSignIn();
            }}
            className="text-xs text-[#8E9AA8] hover:text-[#2ED8B6] font-mono cursor-pointer"
          >
            Already have staff credentials? <span className="underline">Sign In</span>
          </button>

          <button
            type="submit"
            form="demo-access-form"
            disabled={isLoading}
            className="btn btn-primary px-6 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Unlocking Sandbox...</span>
              </>
            ) : (
              <>
                <span>Launch {selectedTenant === "meridian" ? "Meridian" : "Acme"} Demo</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

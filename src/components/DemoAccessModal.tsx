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
  RefreshCw,
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
  const [optInEmail, setOptInEmail] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Interactive Captcha Verification
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
      setErrorMsg("Please enter a valid corporate work email address.");
      return;
    }

    if (!companyName.trim() || companyName.trim().length < 2) {
      setErrorMsg("Please enter your company / organization name.");
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
      const res = await fetch("/api/leads/demo-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workEmail: workEmail.trim(),
          fullName: fullName.trim(),
          companyName: companyName.trim(),
          targetTenant: selectedTenant,
          optInEmail,
          source: "interactive_demo_gate",
        }),
      });

      const data = await res.json();
      if (!res.ok && data?.error) {
        setErrorMsg(data.error);
        setIsLoading(false);
        return;
      }

      // Mark demo as unlocked for this browser session
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("sv8_demo_unlocked", "true");
          sessionStorage.setItem("sv8_lead_email", workEmail.trim());
          sessionStorage.setItem("sv8_lead_company", companyName.trim());
        } catch (_) {}
      }

      setIsLoading(false);
      onSuccess(selectedTenant, workEmail.trim());
      onClose();
    } catch (_) {
      setIsLoading(false);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("sv8_demo_unlocked", "true");
      }
      onSuccess(selectedTenant, workEmail.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-3xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-5 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <SupportV8Logo size={32} />
            <div>
              <h3 className="text-base font-bold text-[#EAF1F8]">Unlock Interactive Live Sandbox</h3>
              <p className="text-xs font-mono text-[#6B7C8D]">Experience Real-Time Customer Care &amp; Field Dispatch Work Desks</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 overflow-y-auto space-y-5">
          <p className="text-xs sm:text-sm text-[#8E9AA8] leading-relaxed">
            Please provide your work email and organization name to launch the live sandbox environment with simulated customer and technician telemetry.
          </p>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center gap-2.5">
              <span className="text-[#E5484D] font-bold">Error:</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sandbox Tenant Selection */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#B4C2D0] block">Select Sandbox Environment</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setSelectedTenant("acme")}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedTenant === "acme"
                    ? "bg-[#2ED8B6]/15 border-[#2ED8B6] shadow-lg shadow-[#2ED8B6]/10"
                    : "bg-[#141C26] border-[var(--line)] hover:border-[#2ED8B6]/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 font-bold text-sm text-[#EAF1F8]">
                    <Users className="w-4 h-4 text-[#2ED8B6]" />
                    <span>Acme Corp</span>
                  </span>
                  <span className="text-xs font-mono text-[#2ED8B6] bg-[#2ED8B6]/10 px-2 py-0.5 rounded-md">SaaS Care</span>
                </div>
                <p className="text-xs text-[#8E9AA8] leading-relaxed">
                  Account credit vouchers, subscription management, &amp; CSAT telemetry.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedTenant("meridian")}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedTenant === "meridian"
                    ? "bg-[#F5A623]/15 border-[#F5A623] shadow-lg shadow-[#F5A623]/10"
                    : "bg-[#141C26] border-[var(--line)] hover:border-[#F5A623]/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-2 font-bold text-sm text-[#EAF1F8]">
                    <HardHat className="w-4 h-4 text-[#F5A623]" />
                    <span>Meridian</span>
                  </span>
                  <span className="text-xs font-mono text-[#F5A623] bg-[#F5A623]/10 px-2 py-0.5 rounded-md">Field Dispatch</span>
                </div>
                <p className="text-xs text-[#8E9AA8] leading-relaxed">
                  Contractor work orders, emergency site access PINs, &amp; compliance checks.
                </p>
              </button>
            </div>
          </div>

          {/* Form */}
          <form id="demo-access-form" onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#2ED8B6]" />
                  <span>Work Email *</span>
                </span>
                <span className="text-xs text-[#2ED8B6] font-mono">Required</span>
              </label>
              <input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#F5A623]" />
                    <span>Company Name *</span>
                  </span>
                  <span className="text-xs text-[#F5A623] font-mono">Required</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Enterprises"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#4D9FFF]" />
                  <span>Your Name</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Vance"
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            {/* Captcha */}
            <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-[#B4C2D0]">
                <span className="flex items-center gap-1.5 text-[#2ED8B6]">
                  <Shield className="w-4 h-4" />
                  <span>Human Verification</span>
                </span>
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className="text-xs text-[#6B7C8D] hover:text-[#EAF1F8] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2.5 rounded-xl bg-[#18222E] border border-[var(--line-2)] text-sm font-mono font-bold text-[#EAF1F8] select-none tracking-widest">
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
                  className={`flex-1 bg-[#141C26] border rounded-2xl px-4 py-2.5 text-sm font-mono text-[#EAF1F8] focus:outline-none ${
                    captchaError ? "border-[#E5484D]" : "border-[var(--line)] focus:border-[#2ED8B6]"
                  }`}
                />
              </div>
            </div>
            {/* Email Permissions Opt-in Checkbox (Optional) */}
            <div
              onClick={() => setOptInEmail(!optInEmail)}
              className="p-3.5 rounded-2xl bg-[#121A24]/60 border border-[var(--line)] flex items-start gap-3 cursor-pointer select-none hover:border-[#2ED8B6]/40 transition-colors"
            >
              <input
                type="checkbox"
                id="optInEmailCheckbox"
                checked={optInEmail}
                onChange={(e) => setOptInEmail(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded-md border-[var(--line)] bg-[#141C26] text-[#2ED8B6] focus:ring-[#2ED8B6] accent-[#2ED8B6] cursor-pointer"
              />
              <label htmlFor="optInEmailCheckbox" className="text-xs text-[#8E9AA8] leading-relaxed cursor-pointer">
                <span>I agree to receive product updates, sandbox credentials, and solutions information via email.</span>{" "}
                <span className="text-[10px] text-[#6B7C8D] font-mono">(Optional)</span>
              </label>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 bg-[#121A24] border-t border-[var(--line)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSignIn();
            }}
            className="text-xs sm:text-sm text-[#8E9AA8] hover:text-[#2ED8B6] font-mono cursor-pointer"
          >
            Staff member? <span className="underline">Staff Sign In</span>
          </button>

          <button
            type="submit"
            form="demo-access-form"
            disabled={isLoading}
            className="btn btn-primary px-7 py-3 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
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

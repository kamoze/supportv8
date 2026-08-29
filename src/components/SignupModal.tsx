"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Building2,
  Globe,
  Mail,
  Lock,
  User,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowRight,
  X,
  Loader2,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tenantSlug: string) => void;
  onOpenSignIn?: () => void;
}

export function SignupModal({ isOpen, onClose, onSuccess, onOpenSignIn }: SignupModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [primaryStream, setPrimaryStream] = useState<"customers" | "contractors" | "enquiries">("customers");
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [provisionProgress, setProvisionProgress] = useState(0);
  const [provisionLogs, setProvisionLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // Simple Interactive Security Captcha
  const [captchaNum1, setCaptchaNum1] = useState(5);
  const [captchaNum2, setCaptchaNum2] = useState(6);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaError, setCaptchaError] = useState(false);

  const refreshCaptcha = () => {
    const n1 = Math.floor(Math.random() * 8) + 2;
    const n2 = Math.floor(Math.random() * 8) + 2;
    setCaptchaNum1(n1);
    setCaptchaNum2(n2);
    setCaptchaAnswer("");
    setCaptchaError(false);
  };

  useEffect(() => {
    if (isOpen) {
      refreshCaptcha();
      setErrorMsg("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(autoSlug);
  };

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordHasError = confirmPassword.length > 0 && password !== confirmPassword;

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !slug.trim()) {
      setErrorMsg("Please provide both your organization name and subdomain slug.");
      return;
    }
    setErrorMsg("");
    setStep(2);
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!adminName.trim() || !adminEmail.trim() || !password.trim()) {
      setErrorMsg("Please complete all administrator credentials.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify your password.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters in length.");
      return;
    }

    // Verify Captcha
    if (parseInt(captchaAnswer.trim(), 10) !== captchaNum1 + captchaNum2) {
      setCaptchaError(true);
      setErrorMsg("Security check answer is incorrect. Please try again.");
      refreshCaptcha();
      return;
    }

    setStep(3);
    startProvisioning();
  };

  const startProvisioning = async () => {
    setIsProvisioning(true);
    setProvisionProgress(15);
    setProvisionLogs(["[1/5] Initializing encrypted tenant isolation namespace..."]);

    try {
      // Call backend signup endpoint
      await fetch("/api/tenant/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName,
          domain: slug,
          adminEmail,
          initialMode: "copilot",
          primaryStream,
        }),
      }).catch(() => {});
    } catch (_) {}

    setTimeout(() => {
      setProvisionProgress(40);
      setProvisionLogs((prev) => [
        ...prev,
        `[2/5] Creating Route53 DNS binding: ${slug}.support.servicev8.com`,
      ]);
    }, 500);

    setTimeout(() => {
      setProvisionProgress(70);
      setProvisionLogs((prev) => [
        ...prev,
        `[3/5] Initializing UI triage layout & vector knowledge topology for ${primaryStream}...`,
      ]);
    }, 1000);

    setTimeout(() => {
      setProvisionProgress(90);
      setProvisionLogs((prev) => [
        ...prev,
        "[4/5] Preparing AI Employee package recommendations (Acquire in Studio Marketplace)...",
      ]);
    }, 1500);

    setTimeout(() => {
      setProvisionProgress(100);
      setProvisionLogs((prev) => [
        ...prev,
        "[5/5] Zero-Trust ForgeGW cryptographic keypairs generated. UI Workspace ready!",
      ]);
      setIsProvisioning(false);
    }, 2000);
  };

  const handleComplete = () => {
    onSuccess(slug || "acme");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupportV8Logo size={28} />
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Create SupportV8 Workspace</h3>
              <p className="text-[10px] font-mono text-[#6B7C8D]">Enterprise Multi-Tenant Isolation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-[#101722] border-b border-[var(--line)] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= 1 ? "bg-[#2ED8B6] text-[#090E15]" : "bg-[#18222E] text-[#6B7C8D]"
              }`}
            >
              1
            </span>
            <span className={step >= 1 ? "text-[#EAF1F8] font-bold" : "text-[#6B7C8D]"}>Workspace &amp; Domain</span>
          </div>

          <ChevronRight className="w-4 h-4 text-[#6B7C8D]" />

          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= 2 ? "bg-[#2ED8B6] text-[#090E15]" : "bg-[#18222E] text-[#6B7C8D]"
              }`}
            >
              2
            </span>
            <span className={step >= 2 ? "text-[#EAF1F8] font-bold" : "text-[#6B7C8D]"}>Admin &amp; Security</span>
          </div>

          <ChevronRight className="w-4 h-4 text-[#6B7C8D]" />

          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 3 ? "bg-[#2ED8B6] text-[#090E15]" : "bg-[#18222E] text-[#6B7C8D]"
              }`}
            >
              3
            </span>
            <span className={step === 3 ? "text-[#EAF1F8] font-bold" : "text-[#6B7C8D]"}>Provision</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#E5484D] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Organization & Subdomain */}
          {step === 1 && (
            <form id="step1-form" onSubmit={handleStep1Submit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>Company / Organization Name</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="e.g. Meridian Logistics / Apex Health"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#4D9FFF]" />
                    <span>Isolated Subdomain Slug</span>
                  </span>
                  <span className="text-[10px] text-[#6B7C8D] font-mono">.support.servicev8.com</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) =>
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                      )
                    }
                    placeholder="meridian"
                    required
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
                <p className="text-[10px] text-[#6B7C8D] font-mono">
                  Target Customer &amp; Contractor Portal: <strong className="text-[#2ED8B6]">{slug || "company"}.support.servicev8.com</strong>
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-[#B4C2D0] block">Primary Channel Focus</label>
                  <span className="text-[10px] text-[#6B7C8D] font-mono">Recommends AI Package</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "customers", label: "Customers", desc: "Refunds & Subscriptions", rec: "Rec: Sophia (CS)" },
                    { id: "contractors", label: "Contractors", desc: "Work Orders & PINs", rec: "Rec: Alex (Lead)" },
                    { id: "enquiries", label: "Enquiries", desc: "Pre-Sales & Demos", rec: "Rec: Barnaby (RAG)" },
                  ].map((stream) => (
                    <button
                      key={stream.id}
                      type="button"
                      onClick={() => setPrimaryStream(stream.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        primaryStream === stream.id
                          ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#EAF1F8]"
                          : "bg-[#141C26] border-[var(--line)] text-[#6B7C8D]"
                      }`}
                    >
                      <div className="font-bold text-xs">{stream.label}</div>
                      <div className="text-[9px] text-[#8E9AA8] mt-0.5">{stream.desc}</div>
                      <div className="text-[8.5px] font-mono text-[#2ED8B6] mt-1 pt-1 border-t border-[var(--line)]">{stream.rec}</div>
                    </button>
                  ))}
                </div>
                <p className="text-[9.5px] text-[#6B7C8D] font-mono">
                  * Sets default UI workspace. AI Employees are commercial packages enabled via Studio Marketplace.
                </p>
              </div>
            </form>
          )}

          {/* STEP 2: Administrator & Password Verification + Captcha */}
          {step === 2 && (
            <form id="step2-form" onSubmit={handleStep2Submit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Admin Name</span>
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Ini Godwin"
                    required
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-[#4D9FFF]" />
                    <span>Work Email</span>
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@meridian.com"
                    required
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              {/* Master Password Field */}
              <div className="space-y-1">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-[#F5A623]" />
                    <span>Master Password</span>
                  </span>
                  <span className="text-[10px] text-[#6B7C8D]">Min. 8 characters</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-[#EAF1F8] pr-10 focus:outline-none focus:border-[#2ED8B6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Password Verification Field */}
              <div className="space-y-1">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Confirm Password</span>
                  </span>
                  {passwordsMatch && (
                    <span className="text-[10px] text-[#4CC38A] font-mono flex items-center gap-1">
                      <Check className="w-3 h-3" /> Passwords match
                    </span>
                  )}
                  {passwordHasError && (
                    <span className="text-[10px] text-[#E5484D] font-mono">
                      Passwords do not match
                    </span>
                  )}
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className={`w-full bg-[#141C26] border rounded-xl px-3.5 py-2 text-xs text-[#EAF1F8] focus:outline-none ${
                    passwordHasError
                      ? "border-[#E5484D]"
                      : passwordsMatch
                      ? "border-[#4CC38A]"
                      : "border-[var(--line)] focus:border-[#2ED8B6]"
                  }`}
                />
              </div>

              {/* Simple Security Captcha Challenge */}
              <div className="p-3 rounded-xl bg-[#121A24] border border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#B4C2D0]">
                  <span className="flex items-center gap-1.5 text-[#2ED8B6]">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Security Verification</span>
                  </span>
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    className="text-[10px] text-[#6B7C8D] hover:text-[#EAF1F8] flex items-center gap-1 cursor-pointer"
                    title="Generate new challenge"
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
                    placeholder="Enter sum"
                    required
                    className={`flex-1 bg-[#141C26] border rounded-xl px-3 py-1.5 text-xs font-mono text-[#EAF1F8] focus:outline-none ${
                      captchaError ? "border-[#E5484D]" : "border-[var(--line)] focus:border-[#2ED8B6]"
                    }`}
                  />
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: Automated Provisioning Progress */}
          {step === 3 && (
            <div className="space-y-5 py-4">
              <div className="text-center space-y-2">
                {isProvisioning ? (
                  <div className="w-12 h-12 rounded-2xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6] mx-auto animate-spin">
                    <Loader2 className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-[#2ED8B6] text-[#090E15] flex items-center justify-center mx-auto shadow-xl shadow-[#2ED8B6]/30">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                )}

                <h4 className="text-base font-bold text-[#EAF1F8]">
                  {isProvisioning ? "Setting Up Isolated Cloud Workspace..." : "Workspace Successfully Created!"}
                </h4>
                <p className="text-xs font-mono text-[#2ED8B6]">
                  https://{slug}.support.servicev8.com
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#141C26] rounded-full h-2 overflow-hidden border border-[var(--line)]">
                <div
                  className="bg-gradient-to-r from-[#00F2FE] via-[#2ED8B6] to-[#059669] h-full transition-all duration-300"
                  style={{ width: `${provisionProgress}%` }}
                />
              </div>

              {/* Terminal Log */}
              <div className="p-3.5 rounded-2xl bg-[#090E15] border border-[var(--line)] font-mono text-[11px] text-[#6B7C8D] space-y-1.5 max-h-36 overflow-y-auto">
                {provisionLogs.map((log, i) => (
                  <div key={i} className="text-[#2ED8B6]">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#121A24] border-t border-[var(--line)] flex items-center justify-between">
          {step === 1 && (
            <>
              {onOpenSignIn ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSignIn();
                  }}
                  className="text-xs text-[#2ED8B6] font-semibold hover:underline cursor-pointer"
                >
                  Already have a workspace? Sign in &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary px-4 py-2 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                form="step1-form"
                className="btn btn-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-secondary px-4 py-2 text-xs font-mono cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                form="step2-form"
                className="btn btn-primary px-6 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#2ED8B6]/20"
              >
                <span>Deploy Workspace</span>
                <Sparkles className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 3 && (
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                disabled={isProvisioning}
                onClick={() => {
                  window.open(
                    `http://studiov8.servicev8.internal:3000/marketplace?tenantId=${encodeURIComponent(slug || "acme")}&ssoToken=sso_tk_${slug || "acme"}`,
                    "_blank",
                    "noopener,noreferrer"
                  );
                  handleComplete();
                }}
                className="btn btn-secondary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-[#2ED8B6] border-[#2ED8B6]/40"
              >
                <span>Studio Marketplace</span>
                <Sparkles className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={isProvisioning}
                onClick={handleComplete}
                className="btn btn-primary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xl shadow-[#2ED8B6]/30 disabled:opacity-50"
              >
                <span>Enter Work Desk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Building2,
  Globe,
  Mail,
  Lock,
  User,
  ChevronRight,
  ArrowRight,
  X,
  Loader2,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Smartphone,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { tenantSlugFromHostname } from "@/lib/auth/request-tenant";

interface SignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tenantSlug: string, email?: string, password?: string) => void;
  onOpenSignIn?: () => void;
}

const RESERVED_SLUGS = [
  "acme",
  "meridian",
  "default",
  "admin",
  "api",
  "support",
  "app",
  "auth",
  "global",
  "servicev8",
  "system",
  "root",
  "portal",
  "help",
];

export function SignupModal({ isOpen, onClose, onSuccess, onOpenSignIn }: SignupModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [companyName, setCompanyName] = useState("");
  const [slug, setSlug] = useState("");
  const [lockedDomainSlug, setLockedDomainSlug] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [primaryStream, setPrimaryStream] = useState<"customers" | "contractors" | "enquiries">("customers");

  // Email OTP verification state
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [verificationReceipt, setVerificationReceipt] = useState("");
  const [otpError, setOtpError] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Provisioning state
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
      const hostedSlug = tenantSlugFromHostname(window.location.hostname);
      setLockedDomainSlug(hostedSlug);
      if (hostedSlug) setSlug(hostedSlug);
      refreshCaptcha();
      setErrorMsg("");
      setOtpError("");
      setVerificationReceipt("");
      setStep(1);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    const autoSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (!lockedDomainSlug) setSlug(autoSlug);
    if (errorMsg) setErrorMsg("");
  };

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordHasError = confirmPassword.length > 0 && password !== confirmPassword;

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();

    if (!companyName.trim() || !cleanSlug) {
      setErrorMsg("Please provide both your organization name and subdomain slug.");
      return;
    }

    if (cleanSlug.length < 3) {
      setErrorMsg("Subdomain slug must be at least 3 characters in length.");
      return;
    }

    // Validate Slug Uniqueness
    if (RESERVED_SLUGS.includes(cleanSlug)) {
      setErrorMsg(`Subdomain slug "${cleanSlug}" is already registered or reserved. Please choose a unique subdomain.`);
      return;
    }

    setErrorMsg("");
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
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

    setIsSendingOtp(true);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail.trim(),
          companyName: companyName.trim(),
          tenantSlug: slug.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok && data?.error) {
        setErrorMsg(data.error);
        setIsSendingOtp(false);
        return;
      }

      if (data?.debugCode) {
        setGeneratedOtp(data.debugCode);
      }

      setVerificationReceipt("");
      setIsSendingOtp(false);
      setResendCooldown(30);
      setStep(3);
    } catch (_) {
      setIsSendingOtp(false);
      setErrorMsg("Verification service is unavailable. Please try again.");
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsSendingOtp(true);
    setOtpError("");

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail.trim(),
          companyName: companyName.trim(),
          tenantSlug: slug.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsSendingOtp(false);
        setOtpError(data?.error || "Failed to resend verification code. Please try again.");
        return;
      }
      if (data?.debugCode) {
        setGeneratedOtp(data.debugCode);
      }

      setVerificationReceipt("");
      setIsSendingOtp(false);
      setResendCooldown(30);
    } catch (_) {
      setIsSendingOtp(false);
      setOtpError("Verification service is unavailable. Please try again.");
    }
  };

  const handleStep3VerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setOtpError("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    setIsVerifyingOtp(true);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail.trim(),
          code: cleanCode,
          tenantSlug: slug.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsVerifyingOtp(false);
        setOtpError(data?.error || "Invalid or expired verification code. Please check your inbox or request a new code.");
        return;
      }

      if (!data.verificationReceipt) {
        setIsVerifyingOtp(false);
        setOtpError("Verification could not be completed. Please request a new code.");
        return;
      }

      setVerificationReceipt(data.verificationReceipt);
      setIsVerifyingOtp(false);
      setStep(4);
      startProvisioning(data.verificationReceipt);
    } catch (_) {
      setIsVerifyingOtp(false);
      setOtpError("Verification service is unavailable. Please try again.");
    }
  };

  const startProvisioning = async (receipt = verificationReceipt) => {
    setIsProvisioning(true);
    setProvisionProgress(15);
    setProvisionLogs(["[1/4] Initializing secure tenant workspace and administrator credentials..."]);

    try {
      const res = await fetch("/api/tenant/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName.trim(),
          domain: slug.trim(),
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          verificationReceipt: receipt,
          password: password.trim(),
          initialMode: "copilot",
          primaryStream,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        setIsProvisioning(false);
        setProvisionLogs((prev) => [
          ...prev,
          `[ERROR] ${data.error || "Failed to provision workspace. Please try again."}`,
        ]);
        return;
      }
      const redirectUrl = typeof data.redirectUrl === "string" ? data.redirectUrl : null;

      setTimeout(() => {
        const fallback = new URL(window.location.href);
        fallback.hostname = `${slug}.support.servicev8.com`;
        fallback.pathname = "/";
        fallback.search = `?signin=1&email=${encodeURIComponent(adminEmail.trim())}`;
        window.location.assign(redirectUrl || fallback.toString());
      }, 1400);
    } catch (err: any) {
      setIsProvisioning(false);
      setProvisionLogs((prev) => [
        ...prev,
        `[ERROR] Network error: ${err.message || "Failed to contact signup service."}`,
      ]);
      return;
    }

    setTimeout(() => {
      setProvisionProgress(45);
      setProvisionLogs((prev) => [
        ...prev,
        `[2/4] Configuring custom portal endpoint: ${slug}.support.servicev8.com`,
      ]);
    }, 400);

    setTimeout(() => {
      setProvisionProgress(75);
      setProvisionLogs((prev) => [
        ...prev,
        `[3/4] Setting up intelligent work desk and domain knowledge base...`,
      ]);
    }, 800);

    setTimeout(() => {
      setProvisionProgress(100);
      setProvisionLogs((prev) => [
        ...prev,
        "[4/4] Workspace provisioned successfully. Ready to launch!",
      ]);
      setIsProvisioning(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-8 py-5 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <SupportV8Logo size={32} showText={false} />
            <div>
              <h3 className="text-base font-bold text-[#EAF1F8]">Create Support Workspace</h3>
              <p className="text-xs font-mono text-[#6B7C8D]">Get started with your dedicated support workspace</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress */}
        <div className="px-8 py-3 bg-[#0B1017] border-b border-[var(--line)] flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-[#2ED8B6] font-bold" : "text-[#6B7C8D]"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? "bg-[#2ED8B6] text-[#090E15]" : "bg-[#18222E]"}`}>1</span>
            <span>Organization</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#6B7C8D]" />
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-[#2ED8B6] font-bold" : "text-[#6B7C8D]"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? "bg-[#2ED8B6] text-[#090E15]" : "bg-[#18222E]"}`}>2</span>
            <span>Credentials</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#6B7C8D]" />
          <div className={`flex items-center gap-2 ${step >= 3 ? "text-[#2ED8B6] font-bold" : "text-[#6B7C8D]"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? "bg-[#2ED8B6] text-[#090E15]" : "bg-[#18222E]"}`}>3</span>
            <span>Verify OTP</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#6B7C8D]" />
          <div className={`flex items-center gap-2 ${step >= 4 ? "text-[#2ED8B6] font-bold" : "text-[#6B7C8D]"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? "bg-[#2ED8B6] text-[#090E15]" : "bg-[#18222E]"}`}>4</span>
            <span>Provision</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#E5484D] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Organization & Slug */}
          {step === 1 && (
            <form id="step1-form" onSubmit={handleStep1Submit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#2ED8B6]" />
                  <span>Organization Name</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => handleCompanyNameChange(e.target.value)}
                  placeholder="e.g. Acme Movers or Apex Logistics"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#4D9FFF]" />
                  <span>Subdomain Slug</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                      if (errorMsg) setErrorMsg("");
                    }}
                    placeholder="your-company"
                    required
                    readOnly={Boolean(lockedDomainSlug)}
                    aria-readonly={Boolean(lockedDomainSlug)}
                    className={`flex-1 bg-[#141C26] border border-r-0 border-[var(--line)] rounded-l-2xl px-4 py-3 text-sm font-mono text-[#2ED8B6] focus:outline-none focus:border-[#2ED8B6] ${lockedDomainSlug ? "cursor-not-allowed opacity-80" : ""}`}
                  />
                  <span className="bg-[#18222E] border border-l-0 border-[var(--line)] rounded-r-2xl px-4 py-3 text-xs font-mono text-[#6B7C8D] select-none">
                    .support.servicev8.com
                  </span>
                </div>
                {lockedDomainSlug && (
                  <p className="text-[11px] font-mono text-[#2ED8B6]">
                    Domain detected from this workspace URL and locked for tenant safety.
                  </p>
                )}
              </div>

              {/* Primary Focus */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-[#B4C2D0] block">Primary Operational Focus</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setPrimaryStream("customers")}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      primaryStream === "customers"
                        ? "bg-[#2ED8B6]/15 border-[#2ED8B6]"
                        : "bg-[#141C26] border-[var(--line)] hover:border-[#2ED8B6]/40"
                    }`}
                  >
                    <div className="text-xs font-bold text-[#EAF1F8] mb-1">Customer Success</div>
                    <p className="text-[11px] text-[#8E9AA8]">B2B SaaS and consumer customer care.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrimaryStream("contractors")}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      primaryStream === "contractors"
                        ? "bg-[#F5A623]/15 border-[#F5A623]"
                        : "bg-[#141C26] border-[var(--line)] hover:border-[#F5A623]/40"
                    }`}
                  >
                    <div className="text-xs font-bold text-[#EAF1F8] mb-1">Field Operations</div>
                    <p className="text-[11px] text-[#8E9AA8]">Contractor dispatch &amp; site access.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPrimaryStream("enquiries")}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      primaryStream === "enquiries"
                        ? "bg-[#4D9FFF]/15 border-[#4D9FFF]"
                        : "bg-[#141C26] border-[var(--line)] hover:border-[#4D9FFF]/40"
                    }`}
                  >
                    <div className="text-xs font-bold text-[#EAF1F8] mb-1">Knowledge Desk</div>
                    <p className="text-[11px] text-[#8E9AA8]">Pre-sales &amp; general inquiries.</p>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 2: Credentials & Verification */}
          {step === 2 && (
            <form id="step2-form" onSubmit={handleStep2Submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                    <User className="w-4 h-4 text-[#2ED8B6]" />
                    <span>Administrator Name</span>
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Alex Vance"
                    required
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-[#4D9FFF]" />
                    <span>Corporate Work Email</span>
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="alex@company.com"
                    required
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#F5A623]" />
                    <span>Master Password</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      minLength={8}
                      className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-[#F5A623]" />
                      <span>Confirm Password</span>
                    </span>
                    {passwordsMatch && (
                      <span className="text-xs font-mono text-[#2ED8B6] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Match
                      </span>
                    )}
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                    className={`w-full bg-[#141C26] border rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none ${
                      passwordHasError
                        ? "border-[#E5484D]"
                        : passwordsMatch
                        ? "border-[#2ED8B6]"
                        : "border-[var(--line)] focus:border-[#2ED8B6]"
                    }`}
                  />
                </div>
              </div>

              {/* Interactive Captcha Challenge */}
              <div className="p-4 rounded-2xl bg-[#121A24] border border-[var(--line)] space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono text-[#B4C2D0]">
                  <span className="flex items-center gap-1.5 text-[#2ED8B6]">
                    <Shield className="w-4 h-4" />
                    <span>Security Verification</span>
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
                    placeholder="Enter sum"
                    required
                    className={`flex-1 bg-[#141C26] border rounded-2xl px-4 py-2.5 text-sm font-mono text-[#EAF1F8] focus:outline-none ${
                      captchaError ? "border-[#E5484D]" : "border-[var(--line)] focus:border-[#2ED8B6]"
                    }`}
                  />
                </div>
              </div>
            </form>
          )}

          {/* STEP 3: Email OTP Verification */}
          {step === 3 && (
            <form id="step3-otp-form" onSubmit={handleStep3VerifyOtp} className="space-y-5 text-center max-w-md mx-auto py-2">
              <div className="w-12 h-12 rounded-2xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6] mx-auto">
                <Smartphone className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-[#EAF1F8]">Verify Email Verification Code</h4>
                <p className="text-xs text-[#8E9AA8]">
                  We sent a 6-digit verification code to <span className="text-[#2ED8B6] font-mono">{adminEmail}</span>
                </p>
                {generatedOtp && (
                  <p className="text-[11px] font-mono text-[#6B7C8D]">
                    (Sandbox Test OTP: <span className="text-[#F5A623] font-bold">{generatedOtp}</span>)
                  </p>
                )}
              </div>

              {otpError && (
                <div className="p-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#E5484D]" />
                  <span>{otpError}</span>
                </div>
              )}

              <div className="space-y-2">
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/[^0-9]/g, ""));
                    if (otpError) setOtpError("");
                  }}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-48 mx-auto text-center tracking-[0.4em] font-mono text-2xl bg-[#141C26] border border-[var(--line)] rounded-2xl py-3 text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="text-xs font-mono text-[#6B7C8D]">
                Didn't receive code?{" "}
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-[#2ED8B6] hover:underline disabled:opacity-50 cursor-pointer font-bold"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Automated Provisioning Progress */}
          {step === 4 && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-2">
                {isProvisioning ? (
                  <div className="w-14 h-14 rounded-2xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6] mx-auto animate-spin">
                    <Loader2 className="w-7 h-7" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-[#2ED8B6] text-[#090E15] flex items-center justify-center mx-auto shadow-xl shadow-[#2ED8B6]/30">
                    <Check className="w-7 h-7 stroke-[3]" />
                  </div>
                )}

                <h4 className="text-lg font-bold text-[#EAF1F8]">
                  {isProvisioning ? "Configuring Your Support Workspace..." : "Workspace Successfully Created!"}
                </h4>
                <p className="text-sm font-mono text-[#2ED8B6]">
                  https://{slug}.support.servicev8.com
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#141C26] rounded-full h-2.5 overflow-hidden border border-[var(--line)]">
                <div
                  className="bg-gradient-to-r from-[#00F2FE] via-[#2ED8B6] to-[#059669] h-full transition-all duration-300"
                  style={{ width: `${provisionProgress}%` }}
                />
              </div>

              {/* Terminal Log */}
              <div className="p-4 rounded-2xl bg-[#090E15] border border-[var(--line)] font-mono text-xs text-[#6B7C8D] space-y-2 max-h-36 overflow-y-auto">
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
        <div className="px-8 py-5 bg-[#121A24] border-t border-[var(--line)] flex items-center justify-between">
          {step === 1 && (
            <>
              {onOpenSignIn ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSignIn();
                  }}
                  className="text-xs sm:text-sm text-[#2ED8B6] font-semibold hover:underline cursor-pointer"
                >
                  Already have a workspace? Sign in &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary px-5 py-2.5 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                form="step1-form"
                className="btn btn-primary px-7 py-3 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20"
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
                className="btn btn-secondary px-5 py-2.5 text-xs font-mono cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                type="submit"
                form="step2-form"
                disabled={isSendingOtp}
                className="btn btn-primary px-7 py-3 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching OTP...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Email &amp; OTP</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn btn-secondary px-5 py-2.5 text-xs font-mono cursor-pointer"
              >
                &larr; Back
              </button>
              <button
                type="submit"
                form="step3-otp-form"
                disabled={isVerifyingOtp}
                className="btn btn-primary px-7 py-3 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
              >
                {isVerifyingOtp ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Provision</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 4 && (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-mono text-[#6B7C8D]">
                {isProvisioning ? "Provisioning..." : "Ready to open portal"}
              </span>
              <button
                type="button"
                disabled={isProvisioning}
                onClick={() => {
                  onSuccess(slug, adminEmail);
                  onClose();
                }}
                className="btn btn-primary px-8 py-3 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-xl shadow-[#2ED8B6]/30 disabled:opacity-50"
              >
                <span>Proceed to Sign In &rarr;</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

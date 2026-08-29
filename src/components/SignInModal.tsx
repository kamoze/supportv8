"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  X,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { AuthService, type AuthSession } from "@/lib/auth-service";

interface SignInModalProps {
  isOpen: boolean;
  lockedTenantSlug?: string;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  onOpenSignup: () => void;
}

export function SignInModal({
  isOpen,
  lockedTenantSlug,
  onClose,
  onSuccess,
  onOpenSignup,
}: SignInModalProps) {
  const [tenantSlug, setTenantSlug] = useState(lockedTenantSlug || "acme");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Interactive Security Captcha
  const [captchaNum1, setCaptchaNum1] = useState(4);
  const [captchaNum2, setCaptchaNum2] = useState(7);
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
      if (lockedTenantSlug) {
        setTenantSlug(lockedTenantSlug);
      }
      refreshCaptcha();
      setErrorMsg("");
      setEmail("");
      setPassword("");
    }
  }, [isOpen, lockedTenantSlug]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const targetSlug = (lockedTenantSlug || tenantSlug).trim().toLowerCase();

    if (!targetSlug) {
      setErrorMsg("Please specify your workspace domain.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter your work email and password.");
      return;
    }

    // Verify Captcha
    if (parseInt(captchaAnswer.trim(), 10) !== captchaNum1 + captchaNum2) {
      setCaptchaError(true);
      setErrorMsg("Security check answer is incorrect. Please try again.");
      refreshCaptcha();
      return;
    }

    setIsLoading(true);

    // Cryptographic operator session generation
    setTimeout(() => {
      setIsLoading(false);
      const session = AuthService.createSession(targetSlug, email, "operator");
      onSuccess(session);
      onClose();
    }, 450);
  };

  const formattedTenantName = (lockedTenantSlug || tenantSlug)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-8 py-5 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <SupportV8Logo size={32} showText={false} />
            <div>
              <h3 className="text-base font-bold text-[#EAF1F8]">
                {lockedTenantSlug ? `${formattedTenantName} Sign In` : "Sign In"}
              </h3>
              <p className="text-xs font-mono text-[#6B7C8D]">
                {lockedTenantSlug
                  ? `${lockedTenantSlug}.support.servicev8.com`
                  : "Enter your workspace credentials to continue"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#E5484D] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="signin-form" onSubmit={handleSubmit} className="space-y-4">
            {/* If on a specific subdomain, show locked badge; otherwise show domain input */}
            {lockedTenantSlug ? (
              <div className="p-4 rounded-2xl bg-[#141C26] border border-[var(--line)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-[#2ED8B6]" />
                  <div>
                    <div className="text-sm font-bold text-[#EAF1F8]">{formattedTenantName} Workspace</div>
                    <div className="text-xs font-mono text-[#6B7C8D]">{lockedTenantSlug}.support.servicev8.com</div>
                  </div>
                </div>
                <span className="pill ok text-xs font-mono">SCOPED</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#2ED8B6]" />
                    <span>Workspace Domain</span>
                  </span>
                  <span className="text-xs text-[#6B7C8D] font-mono">.support.servicev8.com</span>
                </label>
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="e.g. acme or meridian"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm font-mono text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            )}

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#4D9FFF]" />
                <span>Work Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={lockedTenantSlug ? `staff@${lockedTenantSlug}.com` : "operator@company.com"}
                required
                className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#F5A623]" />
                  <span>Password</span>
                </span>
                <span className="text-xs text-[#6B7C8D] hover:underline cursor-pointer">Forgot?</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] pr-12 focus:outline-none focus:border-[#2ED8B6]"
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

            {/* Security Captcha */}
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
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-5 bg-[#121A24] border-t border-[var(--line)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSignup();
            }}
            className="text-xs sm:text-sm text-[#2ED8B6] font-semibold hover:underline cursor-pointer"
          >
            Create new workspace &rarr;
          </button>

          <button
            type="submit"
            form="signin-form"
            disabled={isLoading}
            className="btn btn-primary px-7 py-3 text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

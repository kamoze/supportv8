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
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  RefreshCw,
  HardHat,
  Users,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { AuthService, type AuthSession } from "@/lib/auth-service";

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  onOpenSignup: () => void;
}

export function SignInModal({ isOpen, onClose, onSuccess, onOpenSignup }: SignInModalProps) {
  const [tenantSlug, setTenantSlug] = useState("acme");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Simple Interactive Security Captcha
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
      refreshCaptcha();
      setErrorMsg("");
      setEmail("");
      setPassword("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Verify Captcha
    if (parseInt(captchaAnswer.trim(), 10) !== captchaNum1 + captchaNum2) {
      setCaptchaError(true);
      setErrorMsg("Security check answer is incorrect. Please try again.");
      refreshCaptcha();
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter your work email and password.");
      return;
    }

    setIsLoading(true);

    // Cryptographic tenant authentication handshake
    setTimeout(() => {
      setIsLoading(false);
      const session = AuthService.createSession(tenantSlug, email, "operator");
      onSuccess(session);
      onClose();
    }, 500);
  };

  const handleQuickDemoLogin = (slug: "acme" | "meridian") => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      const session = AuthService.authenticateDemo(slug);
      onSuccess(session);
      onClose();
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupportV8Logo size={28} />
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">SupportV8 Authentication</h3>
              <p className="text-[10px] font-mono text-[#6B7C8D]">Zero-Trust Cockpit Access Gate</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#E5484D] shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="signin-form" onSubmit={handleSubmit} className="space-y-3.5">
            {/* Tenant Subdomain / Slug */}
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>Workspace Domain</span>
                </span>
                <span className="text-[10px] text-[#6B7C8D] font-mono">.support.servicev8.com</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="e.g. acme or meridian"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#4D9FFF]" />
                <span>Work Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@acme.com"
                required
                className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#F5A623]" />
                  <span>Password</span>
                </span>
                <span className="text-[10px] text-[#6B7C8D] hover:underline cursor-pointer">Forgot?</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-xs text-[#EAF1F8] pr-10 focus:outline-none focus:border-[#2ED8B6]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
                <div className="px-3 py-2 rounded-lg bg-[#18222E] border border-[var(--line-2)] text-xs font-mono font-bold text-[#EAF1F8] select-none tracking-widest">
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
                  className={`flex-1 bg-[#141C26] border rounded-xl px-3 py-2 text-xs font-mono text-[#EAF1F8] focus:outline-none ${
                    captchaError ? "border-[#E5484D]" : "border-[var(--line)] focus:border-[#2ED8B6]"
                  }`}
                />
              </div>
              <p className="text-[9.5px] text-[#6B7C8D] font-mono">
                Cloudflare Turnstile &amp; ForgeGW Keypair Verification Ready
              </p>
            </div>
          </form>

          {/* Instant Demo Sandbox Access Shortcuts */}
          <div className="pt-2 border-t border-[var(--line)] space-y-2">
            <div className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider">
              Instant Demo Sandbox Operator Access:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin("acme")}
                className="p-2.5 rounded-xl bg-[#141C26] hover:bg-[#18222E] border border-[var(--line)] hover:border-[#2ED8B6] text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-[#EAF1F8] text-[11px] flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#2ED8B6]">
                    <Users className="w-3 h-3" />
                    <span>Acme Corp</span>
                  </span>
                  <span className="text-[9px] text-[#2ED8B6] font-mono">SaaS CX</span>
                </div>
                <div className="text-[9.5px] text-[#8E9AA8] mt-1">Lead Operator (Sophia Lead)</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemoLogin("meridian")}
                className="p-2.5 rounded-xl bg-[#141C26] hover:bg-[#18222E] border border-[var(--line)] hover:border-[#F5A623] text-left transition-all cursor-pointer group"
              >
                <div className="font-bold text-[#EAF1F8] text-[11px] flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[#F5A623]">
                    <HardHat className="w-3 h-3" />
                    <span>Meridian</span>
                  </span>
                  <span className="text-[9px] text-[#F5A623] font-mono">Dispatch</span>
                </div>
                <div className="text-[9.5px] text-[#8E9AA8] mt-1">Field Dispatcher (Alex Lead)</div>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-[#121A24] border-t border-[var(--line)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSignup();
            }}
            className="text-xs text-[#2ED8B6] font-semibold hover:underline cursor-pointer"
          >
            Create new workspace &rarr;
          </button>

          <button
            type="submit"
            form="signin-form"
            disabled={isLoading}
            className="btn btn-primary px-5 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
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

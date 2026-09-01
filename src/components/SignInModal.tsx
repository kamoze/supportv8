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
  CheckCircle2,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";
import { AuthService, type AuthSession } from "@/lib/auth-service";

interface SignInModalProps {
  isOpen: boolean;
  lockedTenantSlug?: string;
  initialTenantSlug?: string;
  initialEmail?: string;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  onOpenSignup: () => void;
}

type ModalView = "signin" | "forgot_email" | "forgot_otp";

export function SignInModal({
  isOpen,
  lockedTenantSlug,
  initialTenantSlug,
  initialEmail,
  onClose,
  onSuccess,
  onOpenSignup,
}: SignInModalProps) {
  const [modalView, setModalView] = useState<ModalView>("signin");
  const [tenantSlug, setTenantSlug] = useState(lockedTenantSlug || initialTenantSlug || "acme");
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Password Recovery States
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [debugOtpCode, setDebugOtpCode] = useState("");

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
      } else if (initialTenantSlug) {
        setTenantSlug(initialTenantSlug);
      }
      if (initialEmail) {
        setEmail(initialEmail);
      }
      setModalView("signin");
      refreshCaptcha();
      setErrorMsg("");
      setSuccessMsg("");
      setPassword("");
      setForgotEmail("");
      setForgotOtp("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
      setDebugOtpCode("");
    }
  }, [isOpen, lockedTenantSlug, initialTenantSlug, initialEmail]);

  if (!isOpen) return null;

  // Handler: Normal Sign In
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const targetSlug = (lockedTenantSlug || tenantSlug).trim().toLowerCase();

    if (!targetSlug) {
      setErrorMsg("Please specify your workspace domain.");
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter your email and password.");
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

    AuthService.loginWithPassword(email.trim(), password.trim(), targetSlug)
      .then((loginRes) => {
        setIsLoading(false);
        if (loginRes.success && loginRes.session) {
          onSuccess(loginRes.session);
          onClose();
        } else {
          setErrorMsg(loginRes.error || "Incorrect email or password. Please try again.");
        }
      })
      .catch(() => {
        setIsLoading(false);
        setErrorMsg("Authentication service unavailable.");
      });
  };

  // Handler: Password Recovery - Step 1 (Send OTP)
  const handleSendRecoveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please enter a valid registered work email address.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/password/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_otp",
          email: cleanEmail,
          tenantSlug: lockedTenantSlug || tenantSlug || undefined,
        }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMsg(data?.error || "Failed to dispatch recovery code. Please check your email.");
        return;
      }

      if (data.debugCode) {
        setDebugOtpCode(data.debugCode);
      }

      setSuccessMsg(`Recovery code dispatched to ${cleanEmail}. Please enter the 6-digit code below.`);
      setModalView("forgot_otp");
    } catch (_) {
      setIsLoading(false);
      setErrorMsg("Password recovery service is unavailable. Please try again.");
    }
  };

  // Handler: Password Recovery - Step 2 (Verify OTP & Reset Password)
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanEmail = forgotEmail.trim().toLowerCase();
    const cleanCode = forgotOtp.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    if (!forgotNewPassword || forgotNewPassword.length < 8) {
      setErrorMsg("New password must be at least 8 characters in length.");
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMsg("Passwords do not match. Please verify your new password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/password/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          email: cleanEmail,
          code: cleanCode,
          newPassword: forgotNewPassword,
          tenantSlug: lockedTenantSlug || tenantSlug || undefined,
        }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || !data.success) {
        setErrorMsg(data?.error || "Password reset failed. Please check your recovery code.");
        return;
      }

      // Success: prefill and return to sign in
      setEmail(cleanEmail);
      setPassword(forgotNewPassword);
      setSuccessMsg("Password successfully reset! You may now sign in with your new password.");
      setModalView("signin");
      refreshCaptcha();
    } catch (_) {
      setIsLoading(false);
      setErrorMsg("Service temporarily unavailable. Please try again.");
    }
  };

  const formattedTenantName = (lockedTenantSlug || tenantSlug)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl bg-[#0E1520] border border-[var(--line-2)] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-8 py-5 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <SupportV8Logo size={32} showText={false} />
            <div>
              <h3 className="text-base font-bold text-[#EAF1F8]">
                {modalView === "signin"
                  ? lockedTenantSlug
                    ? `${formattedTenantName} Sign In`
                    : "Sign In"
                  : "Password Recovery"}
              </h3>
              <p className="text-xs font-mono text-[#6B7C8D]">
                {modalView === "signin"
                  ? lockedTenantSlug
                    ? `${lockedTenantSlug}.support.servicev8.com`
                    : "Enter your workspace credentials to continue"
                  : "Recover your SupportV8 workspace credentials"}
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

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-[#2ED8B6]/10 border border-[#2ED8B6]/30 text-xs text-[#EAF1F8] flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#2ED8B6] shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {debugOtpCode && (
            <div className="p-3 rounded-xl bg-[#F5A623]/10 border border-[#F5A623]/30 text-xs font-mono text-[#EAF1F8] flex items-center justify-between">
              <span className="text-[#F5A623]">6-Digit Code (Dev Preview):</span>
              <span className="font-bold tracking-widest text-[#2ED8B6] bg-[#141C26] px-2 py-0.5 rounded border border-[var(--line)]">
                {debugOtpCode}
              </span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 1: SIGN IN FORM */}
          {/* ========================================================================= */}
          {modalView === "signin" && (
            <form id="signin-form" onSubmit={handleSignIn} className="space-y-4">
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
                  placeholder={lockedTenantSlug ? `staff@${lockedTenantSlug}.com` : "name@company.com"}
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
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setErrorMsg("");
                      setSuccessMsg("");
                      setModalView("forgot_email");
                    }}
                    className="text-xs text-[#2ED8B6] hover:underline cursor-pointer font-mono"
                  >
                    Forgot Password?
                  </button>
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
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: FORGOT PASSWORD - STEP 1 (EMAIL ENTRY) */}
          {/* ========================================================================= */}
          {modalView === "forgot_email" && (
            <form id="forgot-email-form" onSubmit={handleSendRecoveryOtp} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#141C26] border border-[var(--line)] space-y-2">
                <div className="flex items-center gap-2.5 text-sm font-bold text-[#EAF1F8]">
                  <KeyRound className="w-4 h-4 text-[#2ED8B6]" />
                  <span>Password Reset Request</span>
                </div>
                <p className="text-xs text-[#8E9AA8] leading-relaxed">
                  Enter your registered account email address. We will send a secure 6-digit verification code to verify your identity and reset your password.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#4D9FFF]" />
                  <span>Registered Work Email</span>
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  autoFocus
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* VIEW 3: FORGOT PASSWORD - STEP 2 (OTP + NEW PASSWORD) */}
          {/* ========================================================================= */}
          {modalView === "forgot_otp" && (
            <form id="forgot-otp-form" onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#141C26] border border-[var(--line)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-[#2ED8B6] font-bold">Step 2: Enter Verification Code</span>
                  <span className="text-[11px] font-mono text-[#6B7C8D]">{forgotEmail}</span>
                </div>
                <p className="text-xs text-[#8E9AA8]">
                  Enter the 6-digit code received in your email and choose a new password.
                </p>
              </div>

              {/* 6-Digit OTP Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-[#F5A623]" />
                    <span>6-Digit Verification Code</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSendRecoveryOtp}
                    disabled={isLoading}
                    className="text-xs text-[#2ED8B6] hover:underline cursor-pointer font-mono"
                  >
                    Resend Code
                  </button>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-center text-lg font-mono tracking-widest text-[#2ED8B6] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#2ED8B6]" />
                  <span>New Password (min. 6 chars)</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] pr-12 focus:outline-none focus:border-[#2ED8B6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-3.5 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#B4C2D0] flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#F5A623]" />
                  <span>Confirm New Password</span>
                </label>
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#141C26] border border-[var(--line)] rounded-2xl px-4 py-3 text-sm text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-5 bg-[#121A24] border-t border-[var(--line)] flex items-center justify-between">
          {modalView === "signin" ? (
            <>
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
            </>
          ) : modalView === "forgot_email" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setModalView("signin");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="text-xs text-[#8E9AA8] hover:text-[#EAF1F8] font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>

              <button
                type="submit"
                form="forgot-email-form"
                disabled={isLoading}
                className="btn btn-primary px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Recovery Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setModalView("forgot_email");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="text-xs text-[#8E9AA8] hover:text-[#EAF1F8] font-mono flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Email</span>
              </button>

              <button
                type="submit"
                form="forgot-otp-form"
                disabled={isLoading}
                className="btn btn-primary px-6 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer shadow-lg shadow-[#2ED8B6]/20 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password &amp; Sign In</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Sparkles,
  Shield,
  Server,
  Database,
  Lock,
  ArrowRight,
  RefreshCw,
  Building,
  Mail,
  User,
  Eye,
  EyeOff,
  Zap,
  Check,
  Cpu,
} from "lucide-react";
import { SupportV8Logo } from "@/components/SupportV8Logo";

export default function SignupPage() {
  const router = useRouter();

  // Step flow: 1 = Workspace, 2 = Admin & Password, 3 = Captcha & Provision, 4 = Complete
  const [step, setStep] = useState<number>(1);

  // Form State
  const [companyName, setCompanyName] = useState<string>("Acme Global Technologies");
  const [workspaceSlug, setWorkspaceSlug] = useState<string>("acme-global");
  const [operatingMode, setOperatingMode] = useState<"autonomous" | "copilot" | "observe">("autonomous");
  
  const [adminName, setAdminName] = useState<string>("Elena Rostova");
  const [adminEmail, setAdminEmail] = useState<string>("elena@acme.com");
  const [password, setPassword] = useState<string>("SupportV8#2026!Secure");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Interactive CAPTCHA State
  const [captchaAnswer, setCaptchaAnswer] = useState<string>("");
  const [captchaNum1, setCaptchaNum1] = useState<number>(14);
  const [captchaNum2, setCaptchaNum2] = useState<number>(8);
  const [captchaVerified, setCaptchaVerified] = useState<boolean>(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  // Provisioning pipeline animation state
  const [provisioning, setProvisioning] = useState<boolean>(false);
  const [provisionStep, setProvisionStep] = useState<number>(0);

  // Password strength calculation
  const calculatePasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const passwordScore = calculatePasswordStrength(password);
  const getScoreColor = (score: number) => {
    if (score <= 25) return "bg-[#E5484D]";
    if (score <= 50) return "bg-[#F5A623]";
    if (score <= 75) return "bg-[#4D9FFF]";
    return "bg-[#2ED8B6]";
  };

  const handleVerifyCaptcha = () => {
    if (parseInt(captchaAnswer) === captchaNum1 + captchaNum2) {
      setCaptchaVerified(true);
      setCaptchaError(null);
    } else {
      setCaptchaVerified(false);
      setCaptchaError("Incorrect math answer. Please try again.");
    }
  };

  const handleStartProvisioning = () => {
    if (!captchaVerified) {
      setCaptchaError("Please solve the security challenge first.");
      return;
    }

    setProvisioning(true);
    setStep(3);

    // Simulate real-time cloud tenant provisioning pipeline
    setTimeout(() => setProvisionStep(1), 700);
    setTimeout(() => setProvisionStep(2), 1500);
    setTimeout(() => setProvisionStep(3), 2300);
    setTimeout(() => setProvisionStep(4), 3100);
    setTimeout(() => {
      setProvisionStep(5);
      setProvisioning(false);
      setStep(4);
    }, 3900);
  };

  return (
    <div className="min-h-screen bg-[#0B1017] text-[#EAF1F8] font-sans flex flex-col justify-between selection:bg-[#2ED8B6] selection:text-[#04201C]">
      {/* Top Navigation */}
      <header className="border-b border-[var(--line)] px-6 py-4 flex items-center justify-between bg-[#0C121A]/80 backdrop-blur-md sticky top-0 z-30">
        <Link href="/" className="flex items-center gap-2">
          <SupportV8Logo size={32} showText={true} />
        </Link>

        <div className="flex items-center gap-4">
          <span className="pill ok text-[10px] hidden sm:inline-flex">
            <i className="dot"></i> CLOUD REGION US-EAST (MULTI-TENANT)
          </span>
          <Link href="/" className="btn btn-secondary text-xs">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-xl card shadow-2xl p-6 md:p-8 border-[var(--line)] space-y-6 bg-[#0E1520] rounded-2xl">
          {/* Header Step Counter */}
          <div className="flex items-center justify-between pb-4 border-b border-[var(--line)] text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#2ED8B6]/15 text-[#2ED8B6]">
                <Shield className="w-4 h-4" />
              </span>
              <span className="text-[#EAF1F8] font-bold">New Tenant Provisioning</span>
            </div>
            <div className="text-[#6B7C8D]">
              Step <strong className="text-[#2ED8B6]">{step}</strong> of 4
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= step ? "bg-[#2ED8B6]" : "bg-[#18222E]"
                }`}
              />
            ))}
          </div>

          {/* STEP 1: Workspace & Operating Mode */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#EAF1F8]">Create your customer support workspace</h2>
                <p className="text-xs text-[#6B7C8D] mt-1">
                  Configure your isolated multi-tenant organization and default AI autonomy level.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-[#B4C2D0] font-semibold block mb-1.5 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Company / Organization Name</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => {
                      setCompanyName(e.target.value);
                      setWorkspaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-"));
                    }}
                    placeholder="e.g. Acme Global Technologies"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-3 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6] font-medium"
                  />
                </div>

                <div>
                  <label className="text-[#B4C2D0] font-semibold block mb-1.5">Dedicated Tenant URL Subdomain</label>
                  <div className="flex items-center rounded-xl bg-[#18222E] border border-[var(--line-2)] overflow-hidden focus-within:border-[#2ED8B6]">
                    <span className="pl-3.5 text-[#6B7C8D] font-mono text-xs">https://</span>
                    <input
                      type="text"
                      value={workspaceSlug}
                      onChange={(e) => setWorkspaceSlug(e.target.value)}
                      className="flex-1 bg-transparent text-[#2ED8B6] font-mono p-3 focus:outline-none font-bold text-xs"
                    />
                    <span className="pr-3.5 text-[#6B7C8D] font-mono text-xs">.supportv8.com</span>
                  </div>
                  <span className="text-[10px] text-[#4CC38A] mt-1 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3 h-3 text-[#4CC38A]" />
                    Subdomain available for automated RLS isolation
                  </span>
                </div>

                <div>
                  <label className="text-[#B4C2D0] font-semibold block mb-1.5">Default AI Autonomy Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "autonomous", label: "Autonomous", desc: "AI resolves directly" },
                      { id: "copilot", label: "Copilot", desc: "Agent approves AI" },
                      { id: "observe", label: "Observe", desc: "Read-only analytics" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setOperatingMode(mode.id as any)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          operatingMode === mode.id
                            ? "bg-[#2ED8B6]/12 border-[#2ED8B6] text-[#2ED8B6] shadow-sm font-semibold"
                            : "bg-[#18222E] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                        }`}
                      >
                        <div className="font-bold text-xs">{mode.label}</div>
                        <div className="text-[10px] opacity-75">{mode.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-primary py-2.5 px-5 text-xs flex items-center gap-2"
                >
                  <span>Continue to Admin Setup</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Admin Credentials & Password Strength */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-[#EAF1F8]">Create Admin Account</h2>
                <p className="text-xs text-[#6B7C8D] mt-1">
                  Master credentials for Keycloak tenant authentication &amp; RBAC administration.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-[#B4C2D0] font-semibold block mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Administrator Name</span>
                  </label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-3 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div>
                  <label className="text-[#B4C2D0] font-semibold block mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Work Email Address</span>
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-3 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[#B4C2D0] font-semibold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#2ED8B6]" />
                      <span>Master Password</span>
                    </label>
                    <span className="text-[10px] font-mono text-[#6B7C8D]">
                      Strength:{" "}
                      <strong className={passwordScore >= 75 ? "text-[#2ED8B6]" : "text-[#F5A623]"}>
                        {passwordScore <= 25 ? "Weak" : passwordScore <= 50 ? "Fair" : passwordScore <= 75 ? "Good" : "Unbreakable"}
                      </strong>
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#18222E] text-[#EAF1F8] pl-3.5 pr-10 py-3 rounded-xl border border-[var(--line-2)] font-mono text-xs focus:outline-none focus:border-[#2ED8B6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter */}
                  <div className="w-full bg-[#18222E] h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full transition-all duration-300 ${getScoreColor(passwordScore)}`}
                      style={{ width: `${passwordScore}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1 mt-2 text-[10px] font-mono text-[#6B7C8D]">
                    <span className={password.length >= 8 ? "text-[#2ED8B6]" : ""}>✓ 8+ Characters</span>
                    <span className={/[A-Z]/.test(password) ? "text-[#2ED8B6]" : ""}>✓ Uppercase Letter</span>
                    <span className={/[0-9]/.test(password) ? "text-[#2ED8B6]" : ""}>✓ Numbers Included</span>
                    <span className={/[^A-Za-z0-9]/.test(password) ? "text-[#2ED8B6]" : ""}>✓ Special Character</span>
                  </div>
                </div>
              </div>

              {/* Security CAPTCHA Challenge */}
              <div className="p-4 rounded-xl bg-[#121A24] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#EAF1F8] flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#2ED8B6]" />
                    <span>Human Verification Challenge</span>
                  </span>
                  <span className="pill text-[10px]">CAPTCHA v2</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2 rounded-lg bg-[#18222E] font-mono font-bold text-sm tracking-wider text-[#2ED8B6] border border-[var(--line-2)] select-none">
                    {captchaNum1} + {captchaNum2} = ?
                  </div>
                  <input
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Answer"
                    disabled={captchaVerified}
                    className="w-24 bg-[#18222E] text-[#EAF1F8] p-2 rounded-lg border border-[var(--line-2)] text-xs font-mono text-center focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCaptcha}
                    disabled={captchaVerified || !captchaAnswer}
                    className={`btn text-xs py-2 px-3 ${
                      captchaVerified ? "btn-primary" : "btn-secondary"
                    }`}
                  >
                    {captchaVerified ? <Check className="w-3.5 h-3.5" /> : "Verify"}
                    <span>{captchaVerified ? "Verified" : "Check"}</span>
                  </button>
                </div>

                {captchaError && (
                  <div className="text-[11px] text-[#E5484D] font-mono">{captchaError}</div>
                )}
                {captchaVerified && (
                  <div className="text-[11px] text-[#4CC38A] font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Identity verified. Ready for cloud cluster provisioning.</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-secondary text-xs"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleStartProvisioning}
                  disabled={!captchaVerified}
                  className="btn btn-primary py-2.5 px-6 text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Provision Cloud Workspace</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Live Provisioning Stepper */}
          {step === 3 && (
            <div className="space-y-6 py-4">
              <div className="text-center space-y-1">
                <div className="inline-flex p-3 rounded-2xl bg-[#2ED8B6]/15 text-[#2ED8B6] mb-2 border border-[#2ED8B6]/30">
                  <RefreshCw className="w-7 h-7 animate-spin" />
                </div>
                <h2 className="text-base font-bold text-[#EAF1F8]">Provisioning Isolated Cloud Stack...</h2>
                <p className="text-xs text-[#6B7C8D]">
                  Spinning up dedicated PostgreSQL schema, Redis cluster cache, and Keycloak realm for {workspaceSlug}
                </p>
              </div>

              {/* Provisioning Pipeline Cards */}
              <div className="space-y-2.5 text-xs font-mono">
                {[
                  { title: "PostgreSQL Database Schema", desc: "RLS Tenant Isolation partitioned", icon: Database },
                  { title: "Redis Cache Cluster", desc: "Allocated high-speed session memory", icon: Zap },
                  { title: "Keycloak Security Realm", desc: "OAuth2 & SAML SSO endpoints initialized", icon: Lock },
                  { title: "KnowledgeV8 RAG Spine", desc: "pgvector semantic embeddings vault configured", icon: Server },
                  { title: "AI Employee Deployment", desc: "Alex (Support Intelligence Lead) activated", icon: Cpu },
                ].map((item, idx) => {
                  const isDone = provisionStep > idx;
                  const isCurrent = provisionStep === idx;
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        isDone
                          ? "bg-[#121A24] border-[#2ED8B6]/50 text-[#2ED8B6]"
                          : isCurrent
                          ? "bg-[#18222E] border-[#2ED8B6] text-[#EAF1F8] animate-pulse"
                          : "bg-[#18222E]/40 border-[var(--line)] text-[#6B7C8D]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isDone ? "text-[#2ED8B6]" : isCurrent ? "text-[#2ED8B6]" : "text-[#6B7C8D]"}`} />
                        <div>
                          <div className="font-bold">{item.title}</div>
                          <div className="text-[10px] text-[#6B7C8D]">{item.desc}</div>
                        </div>
                      </div>
                      <div>
                        {isDone && <CheckCircle2 className="w-4 h-4 text-[#2ED8B6]" />}
                        {isCurrent && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2ED8B6]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Success & Launch */}
          {step === 4 && (
            <div className="text-center space-y-6 py-4">
              <div className="inline-flex p-4 rounded-full bg-[#4CC38A]/15 text-[#4CC38A] border border-[#4CC38A]/30">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-[#EAF1F8]">Workspace Successfully Deployed!</h2>
                <p className="text-xs text-[#B4C2D0]">
                  Your enterprise AI support environment is live and ready for production ingress.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#121A24] border border-[var(--line)] text-left font-mono text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7C8D]">Workspace:</span>
                  <span className="text-[#EAF1F8] font-bold">{companyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7C8D]">Subdomain:</span>
                  <span className="text-[#2ED8B6] font-bold">{workspaceSlug}.supportv8.com</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7C8D]">Admin Login:</span>
                  <span className="text-[#EAF1F8]">{adminEmail}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#6B7C8D]">Assigned AI Lead:</span>
                  <span className="text-[#2ED8B6]">Alex — Support Intelligence Lead</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="btn btn-primary w-full py-3 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg"
              >
                <span>Enter supportV8 Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] py-4 text-center text-xs text-[#6B7C8D] font-mono">
        supportV8 Autonomous Multi-Tenant Architecture • Powered by ServiceV8 &amp; Temporal Spine
      </footer>
    </div>
  );
}

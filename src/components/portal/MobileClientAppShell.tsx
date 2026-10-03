"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  ListOrdered,
  HelpCircle,
  User,
  X,
  Loader2,
  LogOut,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "@/components/ui/FlatIcon";

export interface MobileClientAppShellProps {
  tenantSlug: string;
  onOpenChat?: () => void;
  onOpenHelp?: () => void;
  tenantName?: string;
}

export interface ClientTicket {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  assignedTo?: string;
  publicNotes?: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function MobileClientAppShell({
  tenantSlug,
  onOpenChat,
  onOpenHelp,
}: MobileClientAppShellProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "requests" | "help" | "account" | null>(null);
  const [clientToken, setClientToken] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);

  // OTP State
  const [emailInput, setEmailInput] = useState("");
  const [otpStep, setOtpStep] = useState<"email" | "code">("email");
  const [codeInput, setCodeInput] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  // Requests State
  const [tickets, setTickets] = useState<ClientTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState("");

  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // Load stored token and session on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedToken = localStorage.getItem("supportv8_client_token");
      const sessionKey = `supportv8_client_session_${tenantSlug}`;
      const storedSession = localStorage.getItem(sessionKey);

      if (storedToken) {
        setClientToken(storedToken);
      }
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        if (parsed.email) setCustomerEmail(parsed.email);
        if (parsed.name) setCustomerName(parsed.name);
      }
    } catch {
      // Ignore storage read errors
    }

    const handleClientAuth = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        const { clientToken: token, customer } = customEvent.detail;
        if (token) setClientToken(token);
        if (customer?.email) setCustomerEmail(customer.email);
        if (customer?.name) setCustomerName(customer.name);
      }
    };

    window.addEventListener("supportv8:client-authenticated", handleClientAuth);
    return () => {
      window.removeEventListener("supportv8:client-authenticated", handleClientAuth);
    };
  }, [tenantSlug]);

  // Handle PWA beforeinstallprompt
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Fetch tickets when authenticated and on Requests tab
  const fetchTickets = useCallback(async () => {
    if (!clientToken) return;
    setTicketsLoading(true);
    setTicketsError("");
    try {
      const res = await fetch("/api/portal/tickets", {
        headers: {
          Authorization: `Bearer ${clientToken}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      } else {
        setTicketsError("Fetch Failed");
      }
    } catch {
      setTicketsError("Network Error");
    } finally {
      setTicketsLoading(false);
    }
  }, [clientToken]);

  useEffect(() => {
    if (activeTab === "requests" && clientToken) {
      void fetchTickets();
    }
  }, [activeTab, clientToken, fetchTickets]);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
    } catch {
      // Ignore prompt failure
    } finally {
      setShowInstallBanner(false);
      setInstallPrompt(null);
    }
  };

  const handleSendOtp = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setOtpError("Invalid Email");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/portal/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tenantSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setOtpStep("code");
        setCooldown(30);
      } else {
        setOtpError("Send Failed");
      }
    } catch {
      setOtpError("Network Error");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const email = emailInput.trim().toLowerCase();
    const code = codeInput.trim();
    if (!code || code.length !== 6) {
      setOtpError("Invalid Code");
      return;
    }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/portal/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, tenantSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.clientToken) {
        setClientToken(data.clientToken);
        const emailVal = data.customer?.email || email;
        const nameVal = data.customer?.name || email.split("@")[0];
        setCustomerEmail(emailVal);
        setCustomerName(nameVal);

        try {
          localStorage.setItem("supportv8_client_token", data.clientToken);
          localStorage.setItem(
            `supportv8_client_session_${tenantSlug}`,
            JSON.stringify({
              email: emailVal,
              name: nameVal,
              tenantSlug,
              customerId: data.customer?.id,
            })
          );
        } catch {
          // Ignore localStorage errors
        }

        window.dispatchEvent(
          new CustomEvent("supportv8:client-authenticated", {
            detail: {
              customer: data.customer,
              clientToken: data.clientToken,
            },
          })
        );

        setOtpStep("email");
        setCodeInput("");
        setEmailInput("");
      } else {
        setOtpError("Verification Failed");
      }
    } catch {
      setOtpError("Network Error");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleLogout = () => {
    setClientToken(null);
    setCustomerEmail(null);
    setCustomerName(null);
    setTickets([]);
    setOtpStep("email");
    setEmailInput("");
    setCodeInput("");
    try {
      localStorage.removeItem("supportv8_client_token");
      localStorage.removeItem(`supportv8_client_session_${tenantSlug}`);
    } catch {
      // Ignore localStorage errors
    }
  };

  const handleTabClick = (tab: "chat" | "requests" | "help" | "account") => {
    if (tab === "chat") {
      setActiveTab("chat");
      onOpenChat?.();
      window.dispatchEvent(
        new CustomEvent("supportv8:open-chat", {
          detail: { stream: "customers" },
        })
      );
      return;
    }
    if (tab === "help") {
      setActiveTab("help");
      onOpenHelp?.();
      return;
    }
    setActiveTab(tab);
  };

  return (
    <>
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="fixed top-3 inset-x-3 z-50 md:hidden flex items-center justify-between rounded-xl border border-[var(--line)] bg-[#0E1520]/95 px-4 py-3 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Smartphone className="text-[var(--portal-primary)]" size={20} />
            <div>
              <p className="text-xs font-semibold text-white">Install App</p>
              <p className="text-[11px] text-[#8E9AA8]">Quick Access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="rounded-lg bg-[var(--portal-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--portal-on-primary)]"
            >
              Install App
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              className="rounded-lg p-1.5 text-[#8E9AA8] hover:text-white"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Requests Modal / Overlay View */}
      {activeTab === "requests" && (
        <div className="fixed inset-0 z-40 md:hidden bg-[#090E15]/95 pb-20 pt-6 px-4 overflow-y-auto backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="text-[var(--portal-primary)]" size={18} />
              <h2 className="text-sm font-semibold text-white">Support Requests</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="rounded-lg p-1.5 text-[#8E9AA8] hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4">
            {!clientToken ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[#0E1520] p-6 text-center">
                <AlertCircle className="mx-auto text-[var(--portal-accent)] mb-3" size={28} />
                <h3 className="text-sm font-semibold text-white">Sign In</h3>
                <p className="mt-1 text-xs text-[#8E9AA8]">Access Tickets</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("account")}
                  className="mt-4 w-full rounded-xl bg-[var(--portal-primary)] py-2.5 text-xs font-semibold text-[var(--portal-on-primary)]"
                >
                  Sign In
                </button>
              </div>
            ) : ticketsLoading ? (
              <div className="py-12 text-center text-xs text-[#8E9AA8] flex items-center justify-center gap-2">
                <Loader2 className="animate-spin text-[var(--portal-primary)]" size={18} />
                <span>Loading Requests</span>
              </div>
            ) : ticketsError ? (
              <div className="rounded-xl border border-[var(--line)] bg-[#0E1520] p-4 text-center">
                <p className="text-xs text-[#FF9A9E]">{ticketsError}</p>
                <button
                  type="button"
                  onClick={fetchTickets}
                  className="mt-3 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-[#EAF1F8]"
                >
                  Retry
                </button>
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[#0E1520] p-6 text-center">
                <p className="text-xs text-[#8E9AA8]">No Requests</p>
                <button
                  type="button"
                  onClick={() => handleTabClick("chat")}
                  className="mt-3 rounded-xl bg-[var(--portal-primary)] px-4 py-2 text-xs font-semibold text-[var(--portal-on-primary)]"
                >
                  New Request
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[var(--line)] bg-[#0E1520] p-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-white">{t.id}</span>
                      <span className="rounded-full bg-[var(--portal-primary-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--portal-accent)]">
                        {t.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-[#EAF1F8]">{t.title}</p>
                    {t.publicNotes && (
                      <p className="mt-1.5 text-[11px] text-[#8E9AA8] line-clamp-2">
                        {t.publicNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Account Modal / Overlay View */}
      {activeTab === "account" && (
        <div className="fixed inset-0 z-40 md:hidden bg-[#090E15]/95 pb-20 pt-6 px-4 overflow-y-auto backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <User className="text-[var(--portal-primary)]" size={18} />
              <h2 className="text-sm font-semibold text-white">Client Account</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="rounded-lg p-1.5 text-[#8E9AA8] hover:text-white"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4">
            {clientToken ? (
              <div className="rounded-2xl border border-[var(--line)] bg-[#0E1520] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--portal-primary-soft)] text-[var(--portal-primary)]">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {customerName || "Client"}
                    </p>
                    <p className="truncate text-[11px] text-[#8E9AA8]">{customerEmail}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4 text-xs text-[#8E9AA8]">
                  <div className="flex items-center justify-between">
                    <span>Workspace</span>
                    <span className="font-medium text-white">{tenantSlug}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active Token</span>
                    <span className="font-mono text-[10px] text-[var(--portal-accent)]">
                      Active
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[#121A24] py-2.5 text-xs font-semibold text-[#FF9A9E] hover:bg-[#1a2330]"
                >
                  <LogOut size={16} />
                  <span>Log Out</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--line)] bg-[#0E1520] p-5">
                <h3 className="text-xs font-semibold text-white">Sign In</h3>

                {otpStep === "email" ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendOtp();
                    }}
                    className="mt-4 space-y-4"
                  >
                    <div>
                      <label htmlFor="otp-email" className="block text-xs font-medium text-[#8E9AA8]">
                        Email Address
                      </label>
                      <input
                        id="otp-email"
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="client@company.com"
                        required
                        className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[#121A24] px-3.5 py-2.5 text-xs text-white placeholder:text-[#6B7C8D] outline-none focus:border-[var(--portal-primary)]"
                      />
                    </div>

                    {otpError && (
                      <p className="text-xs text-[#FF9A9E]">{otpError}</p>
                    )}

                    <button
                      type="submit"
                      onClick={(e) => {
                        e.preventDefault();
                        void handleSendOtp();
                      }}
                      disabled={otpLoading || !emailInput.trim()}
                      className="w-full rounded-xl bg-[var(--portal-primary)] py-2.5 text-xs font-semibold text-[var(--portal-on-primary)] disabled:opacity-50"
                    >
                      {otpLoading ? "Sending Code" : "Verify"}
                    </button>
                  </form>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleVerifyOtp();
                    }}
                    className="mt-4 space-y-4"
                  >
                    <div>
                      <label htmlFor="otp-code" className="block text-xs font-medium text-[#8E9AA8]">
                        Verification Code
                      </label>
                      <input
                        id="otp-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value)}
                        placeholder="123456"
                        required
                        className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[#121A24] px-3.5 py-2.5 text-center font-mono text-base tracking-widest text-white placeholder:text-[#6B7C8D] outline-none focus:border-[var(--portal-primary)]"
                      />
                    </div>

                    {otpError && (
                      <p className="text-xs text-[#FF9A9E]">{otpError}</p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-[#8E9AA8]">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpStep("email");
                          setOtpError("");
                        }}
                        className="text-[var(--portal-accent)]"
                      >
                        Change Email
                      </button>
                      {cooldown > 0 ? (
                        <span>{cooldown}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="flex items-center gap-1 text-[var(--portal-accent)]"
                        >
                          <RefreshCw size={12} />
                          <span>Resend Code</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      onClick={(e) => {
                        e.preventDefault();
                        void handleVerifyOtp();
                      }}
                      disabled={otpLoading || codeInput.length !== 6}
                      className="w-full rounded-xl bg-[var(--portal-primary)] py-2.5 text-xs font-semibold text-[var(--portal-on-primary)] disabled:opacity-50"
                    >
                      {otpLoading ? "Checking Code" : "Verify"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation Dock */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-[var(--line)] bg-[#0B1017]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] safe-area-bottom"
      >
        <div className="grid grid-cols-4 h-16">
          <button
            type="button"
            onClick={() => handleTabClick("chat")}
            className={`flex flex-col items-center justify-center gap-1 text-xs transition ${
              activeTab === "chat" ? "text-[var(--portal-primary)]" : "text-[#8E9AA8] hover:text-white"
            }`}
          >
            <MessageSquare size={18} />
            <span className="text-[10px] font-medium leading-none">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick("requests")}
            className={`flex flex-col items-center justify-center gap-1 text-xs transition ${
              activeTab === "requests" ? "text-[var(--portal-primary)]" : "text-[#8E9AA8] hover:text-white"
            }`}
          >
            <ListOrdered size={18} />
            <span className="text-[10px] font-medium leading-none">Requests</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick("help")}
            className={`flex flex-col items-center justify-center gap-1 text-xs transition ${
              activeTab === "help" ? "text-[var(--portal-primary)]" : "text-[#8E9AA8] hover:text-white"
            }`}
          >
            <HelpCircle size={18} />
            <span className="text-[10px] font-medium leading-none">Help</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabClick("account")}
            className={`flex flex-col items-center justify-center gap-1 text-xs transition ${
              activeTab === "account" ? "text-[var(--portal-primary)]" : "text-[#8E9AA8] hover:text-white"
            }`}
          >
            <User size={18} />
            <span className="text-[10px] font-medium leading-none">Account</span>
          </button>
        </div>
      </nav>
    </>
  );
}

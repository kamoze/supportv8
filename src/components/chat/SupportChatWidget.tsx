"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  X,
  Send,
  Minimize2,
  HardHat,
  HelpCircle,
  Users,
  Shield,
  Clock,
  Sparkles,
  ChevronRight,
  UserCheck,
  Bot,
  RefreshCw,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Phone,
  PhoneCall,
  Smartphone,
  Zap,
  ArrowLeft,
} from "@/components/ui/FlatIcon";
import type {
  ChatStreamType,
  CustomerChatMessage,
  CustomerChatSession,
  ChatWorkflowConfig,
} from "@/lib/types";
import {
  DEFAULT_CHAT_WORKFLOWS,
  ChatWorkflowService,
  isAsunPalaceTenant,
} from "@/lib/services/chat-workflow-service";
import {
  clearStoredChatSessionId,
  createOptimisticChatMessage,
  mergeChatSession,
  readStoredChatSessionId,
  recoverStoredChatSession,
  storeChatSessionId,
  useChatRealtimeSession,
} from "@/lib/chat/use-chat-realtime";
import { soundAlertService } from "@/lib/services/sound-alert-service";
import { SoundAlertToggle } from "@/components/SoundAlertToggle";
import { ChatMessage as ChatMessageView, PlainChatText } from "@/components/chat-ui/ChatMessage";
import { ChatTranscript } from "@/components/chat-ui/ChatTranscript";
import { FormattedChatMessage } from "@/components/chat-ui/FormattedChatMessage";
import { handleChatComposerKeyDown } from "@/components/chat-ui/composer-keys";

interface SupportChatWidgetProps {
  tenantSlug?: string;
  tenantName?: string;
  tenantDomain?: string;
  defaultStream?: ChatStreamType;
  brandColor?: string;
}

function readableInk(hex: string): string {
  const value = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "2ED8B6";
  // Pick the ink with the higher WCAG contrast (SupportV8 teal needs dark ink: 10.9:1 vs 1.8:1 for white).
  const luminance = (hex6: string) => {
    const [r, g, b] = [0, 2, 4].map((offset) => {
      const c = Number.parseInt(hex6.slice(offset, offset + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const brand = luminance(value);
  const onDark = (brand + 0.05) / (luminance("04110E") + 0.05);
  const onLight = (1.05) / (brand + 0.05);
  return onDark >= onLight ? "#04110E" : "#FFFFFF";
}

interface ClientIdentity {
  name?: string;
  email?: string;
  tenantSlug?: string;
  customerId?: string;
}

function getStoredClientSession(tenantKey?: string, domainKey?: string): ClientIdentity | null {
  if (typeof window === "undefined") return null;
  const keys = [
    tenantKey ? `supportv8_client_session_${tenantKey}` : null,
    domainKey && domainKey !== tenantKey ? `supportv8_client_session_${domainKey}` : null,
  ].filter(Boolean) as string[];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.email || parsed.name)) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse or storage errors
    }
  }
  return null;
}

function createClientChatSession(
  tenantKey: string,
  stream: ChatStreamType,
  name: string,
  email: string,
  intakeData?: Record<string, string>,
  tenantName?: string,
): CustomerChatSession {
  const assignedTo = tenantName ? `${tenantName} Support` : "Sophia — Customer Success";
  return {
    id: `sess_client_${crypto.randomUUID().replace(/-/g, "")}`,
    tenantDomain: tenantKey || "default",
    stream,
    customerName: name || "Customer",
    customerEmail: email || "user@example.com",
    intakeData: {
      name: name || "Customer",
      email: email || "user@example.com",
      ...(intakeData || {}),
    },
    assignedType: "ai",
    assignedId: "emp_support_lead",
    assignedName: assignedTo,
    assignedTo,
    assignedAvatar: "/avatars/beaver-sophia.jpg",
    status: "active",
    priority: "normal",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

export function SupportChatWidget({
  tenantSlug,
  tenantName = "Acme Corp",
  tenantDomain,
  defaultStream = "customers",
  // SupportV8 teal unless the tenant's portal branding supplies a colour.
  brandColor = "#2ED8B6",
}: SupportChatWidgetProps) {
  const safeBrandColor = /^#[0-9a-f]{6}$/i.test(brandColor) ? brandColor : "#2ED8B6";
  const brandStyle = {
    "--chat-brand": safeBrandColor,
    "--chat-brand-soft": `${safeBrandColor}26`,
    "--chat-brand-hover": `${safeBrandColor}40`,
    "--chat-brand-border": `${safeBrandColor}66`,
    "--chat-brand-shadow": `${safeBrandColor}59`,
    "--chat-on-brand": readableInk(safeBrandColor),
  } as React.CSSProperties;
  const [isOpen, setIsOpen] = useState(false);
  const [isPromptMinimized, setIsPromptMinimized] = useState(false);
  const [activeStep, setActiveStep] = useState<"select_stream" | "intake_form" | "chat">("select_stream");
  const [selectedStream, setSelectedStream] = useState<ChatStreamType>(defaultStream || "customers");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeSession, setActiveSession] = useState<CustomerChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sendingDraft, setSendingDraft] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isGuestShopper, setIsGuestShopper] = useState(false);

  const chatConnectionState = useChatRealtimeSession(activeSession?.id, (session) => {
    setActiveSession((current) => {
      if (current) {
        const prevMsgIds = new Set(current.messages.map((m) => m.id));
        const hasNewIncoming = session.messages.some((m) => !prevMsgIds.has(m.id) && m.sender !== "customer");
        if (hasNewIncoming) {
          void soundAlertService.playChatAlert();
        }
      }
      return mergeChatSession(current, session);
    });
  });


  const tenantSessionKey = tenantDomain || tenantSlug;
  const rawHost = typeof window !== "undefined" ? window.location.hostname : "";
  const searchParamTenant = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tenant") : null;
  const isAsunTenant = isAsunPalaceTenant(tenantDomain) || isAsunPalaceTenant(tenantSlug) || isAsunPalaceTenant(rawHost) || isAsunPalaceTenant(searchParamTenant);
  const workflows = ChatWorkflowService.getWorkflows(isAsunTenant ? "asun-palace-store" : tenantSessionKey);
  const currentWorkflow: ChatWorkflowConfig = workflows[selectedStream] || DEFAULT_CHAT_WORKFLOWS.customers;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setActiveSession(null);
    setActiveStep("select_stream");
    setSelectedStream(defaultStream || "customers");
    setFormData({});
    setFormErrors({});
    setInputMessage("");
    setChatError(null);

    // Parse URL search params for deep linking from storefronts, order trackers & returns portals
    const searchParams = new URLSearchParams(window.location.search);
    const urlStream = searchParams.get("stream") as ChatStreamType | null;
    const isGuest = searchParams.get("guest") === "true";
    const orderId = searchParams.get("orderId") || searchParams.get("orderRef");
    const email = searchParams.get("email");
    const customerName = searchParams.get("customerName") || searchParams.get("name");
    const topic = searchParams.get("topic");

    if (isGuest && isAsunTenant) {
      setIsGuestShopper(true);
    }

    const prefilledData: Record<string, string> = {};
    if (customerName) prefilledData.name = customerName;
    if (email) prefilledData.email = email;
    if (orderId) {
      prefilledData.accountOrOrderId = orderId;
      prefilledData.workOrderNumber = orderId;
    }
    if (topic) {
      if (isAsunTenant) {
        if (topic === "general_inquiry") {
          prefilledData.enquiryType = "Store Menu, Hours & General Inquiries";
        } else if (topic === "returns" || topic === "refunds") {
          prefilledData.issueType = "Returns, Refunds & Damaged Items";
          prefilledData.enquiryType = "Returns, Refunds & Policies";
        } else if (topic === "orders" || topic === "delivery") {
          prefilledData.issueType = "Order Status, Delivery & Tracking";
          prefilledData.enquiryType = "Order Status, Delivery & Tracking";
        }
      } else {
        if (topic === "returns" || topic === "refunds") {
          prefilledData.issueType = "Billing, Invoices & Refund Request";
        }
      }
    }

    if (Object.keys(prefilledData).length > 0) {
      setFormData(prefilledData);
    }

    const effectiveStream: ChatStreamType | null =
      urlStream && (urlStream === "enquiries" || urlStream === "customers" || urlStream === "contractors")
        ? urlStream
        : isGuest
        ? "enquiries"
        : null;

    // Check for authenticated client session
    const storedClient = getStoredClientSession(tenantSlug, tenantSessionKey);
    if (storedClient && (storedClient.email || storedClient.name)) {
      if (storedClient.name) prefilledData.name = storedClient.name;
      if (storedClient.email) prefilledData.email = storedClient.email;
      const initialStream = effectiveStream || defaultStream || "customers";
      setSelectedStream(initialStream);
      setActiveSession(
        createClientChatSession(
          tenantSessionKey || tenantSlug || "default",
          initialStream,
          storedClient.name || "Customer",
          storedClient.email || "user@example.com",
          prefilledData,
          tenantName,
        ),
      );
      setActiveStep("chat");
    } else if (effectiveStream) {
      setSelectedStream(effectiveStream);
      setActiveStep("intake_form");
      setIsOpen(true);
    } else if (isGuest || orderId || topic) {
      setIsOpen(true);
    }

    if (Object.keys(prefilledData).length > 0) {
      setFormData(prefilledData);
    }

    if (!readStoredChatSessionId(window.sessionStorage, tenantSessionKey)) return;

    let cancelled = false;
    setIsTyping(true);
    setChatError(null);
    recoverStoredChatSession(window.sessionStorage, tenantSessionKey, async (storedSessionId) => {
      const response = await fetch(`/api/chat/session?sessionId=${encodeURIComponent(storedSessionId)}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json();
      return { status: response.status, session: result?.session as CustomerChatSession | undefined };
    })
      .then((recovery) => {
        if (cancelled) return;
        if (recovery.state === "restored") {
          setSelectedStream(recovery.session.stream);
          setFormData(recovery.session.intakeData || {});
          setActiveSession(recovery.session);
          setActiveStep("chat");
        } else if (recovery.state === "retry") {
          setChatError("We could not restore your chat yet. Reload to retry without losing the conversation.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsTyping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [defaultStream, tenantSessionKey, tenantSlug]);

  useEffect(() => {
    const handleClientAuthenticated = (event: Event) => {
      const detail = (event as CustomEvent<{
        customer?: { name?: string; email?: string };
        name?: string;
        email?: string;
      }>).detail;
      if (!detail) return;
      const name = detail.customer?.name || detail.name || "";
      const email = detail.customer?.email || detail.email || "";
      if (name || email) {
        setFormData((prev) => ({
          ...prev,
          name: name || prev.name || "",
          email: email || prev.email || "",
        }));
        setActiveSession((current) => {
          if (current) {
            return {
              ...current,
              customerName: name || current.customerName,
              customerEmail: email || current.customerEmail,
              intakeData: {
                ...current.intakeData,
                name: name || current.customerName,
                email: email || current.customerEmail,
              },
            };
          }
          return createClientChatSession(
            tenantSessionKey || tenantSlug || "default",
            selectedStream || defaultStream || "customers",
            name || "Customer",
            email || "user@example.com",
            undefined,
            tenantName,
          );
        });
        setActiveStep("chat");
      }
    };

    window.addEventListener("supportv8:client-authenticated", handleClientAuthenticated);
    return () => {
      window.removeEventListener("supportv8:client-authenticated", handleClientAuthenticated);
    };
  }, [defaultStream, selectedStream, tenantSessionKey, tenantSlug]);

  useEffect(() => {
    const openFromPortal = (event: Event) => {
      const detail = (event as CustomEvent<{ topic?: string; stream?: ChatStreamType }>).detail || {};
      const stream = detail.stream && workflows[detail.stream] ? detail.stream : defaultStream;
      setIsOpen(true);
      setIsPromptMinimized(true);

      const client = getStoredClientSession(tenantSlug, tenantSessionKey);
      if (activeSession) {
        if (detail.topic) {
          setInputMessage(detail.topic);
        }
        setActiveStep("chat");
      } else if (client && (client.email || client.name)) {
        const cName = client.name || "Customer";
        const cEmail = client.email || "user@example.com";
        setSelectedStream(stream);
        setFormData((current) => ({
          ...current,
          name: cName,
          email: cEmail,
          details: detail.topic || current.details || "",
        }));
        setActiveSession(
          createClientChatSession(
            tenantSessionKey || tenantSlug || "default",
            stream,
            cName,
            cEmail,
            {
              details: detail.topic || "",
            },
            tenantName,
          ),
        );
        if (detail.topic) {
          setInputMessage(detail.topic);
        }
        setActiveStep("chat");
      } else {
        setSelectedStream(stream);
        setActiveStep("intake_form");
        setFormData((current) => ({ ...current, details: detail.topic || current.details || "" }));
      }
    };
    window.addEventListener("supportv8:open-chat", openFromPortal);
    return () => window.removeEventListener("supportv8:open-chat", openFromPortal);
  }, [activeSession, defaultStream, tenantSessionKey, tenantSlug, workflows]);

  // The transcript (ChatTranscript) follows new messages while the reader is within 64px of the bottom.

  const handleSelectStream = (stream: ChatStreamType) => {
    setSelectedStream(stream);
    setFormData({});
    setFormErrors({});
    setActiveStep("intake_form");
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    currentWorkflow.intakeFields.forEach((field) => {
      if (field.required && !formData[field.name]?.trim()) {
        errors[field.name] = `${field.label} is required`;
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // Start session
    setIsTyping(true);
    setChatError(null);

    try {
      const response = await fetch("/api/chat/session", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: tenantSessionKey,
          stream: selectedStream,
          customerName: formData.name || "Customer",
          customerEmail: formData.email || "user@example.com",
          intakeData: formData,
        }),
      });
      const res = await response.json();
      if (!response.ok || !res?.session) {
        throw new Error(res?.error || "Unable to start a durable chat session");
      }
      const session = res.session as CustomerChatSession;

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sv8_ticket_created", { detail: session }));
      }

      setActiveSession(session);
      setActiveStep("chat");
      if (typeof window !== "undefined") {
        storeChatSessionId(window.sessionStorage, tenantSessionKey, session.id);
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to start chat. Please try again.");
    } finally {
      setTimeout(() => setIsTyping(false), 500);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, directText?: string) => {
    e?.preventDefault();
    const typed = directText === undefined;
    const textToSend = (typed ? inputMessage : directText).trim();
    if (!textToSend || !activeSession || (typed && sendingDraft)) return;

    // A typed draft stays (read-only) until the message is saved; it is kept if saving fails.
    if (typed) setSendingDraft(true);
    setIsTyping(true);
    setChatError(null);
    const clientMessageId = `msg_${crypto.randomUUID().replace(/-/g, "")}`;
    const optimisticMessage = createOptimisticChatMessage({
      id: clientMessageId,
      sender: "customer",
      senderName: activeSession.customerName,
      content: textToSend,
    });
    setActiveSession((current) =>
      current ? { ...current, messages: [...current.messages, optimisticMessage] } : current,
    );

    try {
      let currentSession = activeSession;
      if (currentSession.id.startsWith("sess_client_")) {
        const initResponse = await fetch("/api/chat/session", {
          method: "POST",
          signal: AbortSignal.timeout(15_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantSlug: tenantSessionKey,
            stream: currentSession.stream,
            customerName: currentSession.customerName,
            customerEmail: currentSession.customerEmail,
            intakeData: currentSession.intakeData || {
              name: currentSession.customerName,
              email: currentSession.customerEmail,
            },
          }),
        });
        const initRes = await initResponse.json();
        if (!initResponse.ok || !initRes?.session) {
          throw new Error(initRes?.error || "Unable to start a durable chat session");
        }
        currentSession = {
          ...initRes.session,
          messages: currentSession.messages,
        };
        setActiveSession(currentSession);
        if (typeof window !== "undefined") {
          storeChatSessionId(window.sessionStorage, tenantSessionKey, currentSession.id);
          window.dispatchEvent(new CustomEvent("sv8_ticket_created", { detail: currentSession }));
        }
      }

      const response = await fetch("/api/chat/message", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession.id,
          content: textToSend,
          sender: "customer",
          senderName: currentSession.customerName,
          clientMessageId,
        }),
      });
      const res = await response.json();
      if (!response.ok || !res?.session) {
        throw new Error(res?.error || "Unable to save your message");
      }

      setActiveSession((current) => mergeChatSession(current, res.session as CustomerChatSession));
      if (typed) setInputMessage((draft) => (draft.trim() === textToSend ? "" : draft));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sv8_ticket_created", { detail: res.session }));
      }
    } catch (error) {
      setActiveSession((current) =>
        current
          ? { ...current, messages: current.messages.filter((message) => message.id !== clientMessageId) }
          : current,
      );
      if (!typed) setInputMessage(textToSend);
      setChatError(error instanceof Error ? error.message : "Unable to save your message. Please try again.");
    } finally {
      if (typed) setSendingDraft(false);
      setTimeout(() => setIsTyping(false), 450);
    }
  };

  const handleActionClick = (actionId: string, label: string) => {
    if (!activeSession) return;
    if (actionId === "act_human" || label.toLowerCase().includes("human")) {
      handleRequestHuman();
      return;
    }
    if (actionId === "act_resolve" || label.toLowerCase().includes("confirm resolution")) {
      handleSendMessage(undefined, "I confirm this issue is resolved. Thank you!");
      return;
    }
    handleSendMessage(undefined, `[Action Requested: ${label}]`);
  };

  const handleRequestHuman = () => {
    if (!activeSession) return;
    handleSendMessage(undefined, "I would like to speak directly with a live human operator.");
  };

  const handleResetChat = () => {
    if (typeof window !== "undefined") {
      clearStoredChatSessionId(window.sessionStorage, tenantSessionKey);
    }
    const client = getStoredClientSession(tenantSlug, tenantSessionKey);
    if (client && (client.email || client.name)) {
      const cName = client.name || "Customer";
      const cEmail = client.email || "user@example.com";
      setFormData({ name: cName, email: cEmail });
      setFormErrors({});
      setActiveSession(
        createClientChatSession(
          tenantSessionKey || tenantSlug || "default",
          defaultStream || "customers",
          cName,
          cEmail,
          undefined,
          tenantName,
        ),
      );
      setActiveStep("chat");
    } else {
      setActiveSession(null);
      setFormData({});
      setFormErrors({});
      setActiveStep("select_stream");
    }
    setInputMessage("");
    setChatError(null);
  };

  return (
    <div style={brandStyle}>
      {/* Floating Action Trigger Button (Bottom-Right) */}
      {!isOpen && (
        <div className="fixed bottom-20 sm:bottom-5 right-5 z-40 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {!isPromptMinimized && (
            <div className="hidden sm:flex items-center gap-2 bg-[#0E1520] border border-[var(--line-2)] text-[#EAF1F8] px-3.5 py-2 rounded-2xl shadow-xl shadow-black/50 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-[var(--chat-brand)] animate-pulse" />
              <span>Need help? Chat with {tenantName}</span>
              <button
                onClick={() => setIsPromptMinimized(true)}
                className="text-[#6B7C8D] hover:text-[#EAF1F8] ml-1 p-0.5 cursor-pointer"
                title="Minimize prompt"
                aria-label="Minimize prompt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open support chat"
            className="w-14 h-14 sm:w-12 sm:h-12 rounded-2xl bg-[var(--chat-brand)] text-[var(--chat-on-brand)] flex items-center justify-center shadow-[0_18px_42px_var(--chat-brand-shadow)] hover:scale-105 active:scale-95 transition-all cursor-pointer group shrink-0"
          >
            <MessageSquare className="w-6 h-6 sm:w-5 sm:h-5 group-hover:rotate-6 transition-transform" />
          </button>
        </div>
      )}

      {/* Expanded Modal / Native Fullscreen Phone Flyout */}
      {isOpen && (
        <div className="chat-widget-panel fixed inset-0 bottom-20 sm:bottom-6 sm:right-6 sm:inset-auto z-50 w-full sm:w-[480px] h-[100dvh] max-h-[calc(100dvh-5rem)] sm:h-[640px] sm:max-h-[88vh] bg-[#0E1520] border-0 sm:border sm:border-[var(--line-2)] rounded-none sm:rounded-3xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-200 text-[#EAF1F8]">
          {/* Widget Header */}
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between shrink-0 pt-[max(env(safe-area-inset-top),12px)] sm:pt-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[var(--chat-brand-soft)] border border-[var(--chat-brand-border)] flex items-center justify-center text-[var(--chat-brand)] font-bold shrink-0">
                {activeSession?.assignedAvatar ? (
                  <img
                    src={activeSession.assignedAvatar}
                    alt="Agent"
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs sm:text-sm font-bold text-[#EAF1F8] truncate">{tenantName} Support</h3>
                  <span className="w-2 h-2 rounded-full bg-[var(--chat-brand)] shrink-0" />
                </div>
                <p className="text-[10px] font-mono text-[#6B7C8D] truncate">
                  {activeStep === "chat"
                    ? activeSession?.assignedName
                    : isAsunTenant && isGuestShopper
                    ? "Storefront Shopper & Guest Helpdesk"
                    : "Intelligent Triage & Live Omnichannel"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 text-[#6B7C8D] shrink-0">
              {/* Direct Native Telephony Link */}
              <a
                href="tel:+18005558880"
                className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-[var(--chat-brand-soft)] text-[var(--chat-brand)] border border-[var(--chat-brand-border)] flex items-center gap-1 text-[11px] font-mono font-bold hover:bg-[var(--chat-brand-hover)] transition-colors cursor-pointer"
                title="Direct Telephony Call"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Call Live</span>
              </a>

              <SoundAlertToggle showDropdown={false} className="p-2 rounded-xl min-w-0 min-h-0 h-8 w-8 hover:bg-[#1C2836]" />

              {activeStep === "chat" && (
                <button
                  onClick={handleResetChat}
                  title="Start New Topic"
                  className="p-2 rounded-xl hover:bg-[#1C2836] hover:text-[#EAF1F8] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-2 rounded-xl hover:bg-[#1C2836] hover:text-[#EAF1F8] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* STEP 1: Stream Selector */}
          {activeStep === "select_stream" && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="space-y-1">
                <span className="pill text-[10px] font-mono uppercase bg-[#18222E] text-[var(--chat-brand)] px-2.5 py-0.5">
                  Select Support Channel
                </span>
                <h4 className="text-base sm:text-sm font-bold text-[#EAF1F8]">How can we assist you?</h4>
                <p className="text-xs text-[#8E9AA8] leading-relaxed">
                  Choose your inquiry type to be routed directly to the dedicated live support desk or AI specialist.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Contractors & Field Ops Option */}
                <button
                  onClick={() => handleSelectStream("contractors")}
                  className="w-full text-left p-4 sm:p-3.5 rounded-2xl bg-[#121A24] border border-[var(--line)] hover:border-[#F5A623]/60 hover:bg-[#16212E] active:scale-[0.99] transition-all cursor-pointer group flex items-start gap-3.5 shadow-md"
                >
                  <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40 flex items-center justify-center shrink-0">
                    <HardHat className="w-5 h-5 sm:w-4 sm:h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-xs font-bold text-[#EAF1F8] group-hover:text-[#F5A623] transition-colors">
                        Contractors &amp; Field Ops
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#6B7C8D] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-xs sm:text-[11px] text-[#8E9AA8] mt-0.5 leading-normal">
                      Work order dispatch, Lockbox PINs, GPS navigation, and site safety permits.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-[#F5A623] bg-[#F5A623]/15 px-2 py-0.5 rounded font-bold">
                        <Zap className="w-2.5 h-2.5" />
                        Instant Dispatch
                      </span>
                      <span className="text-[9px] font-mono text-[#6B7C8D]">Mobile PIN Ready</span>
                    </div>
                  </div>
                </button>

                {/* Customers & Clients Option */}
                <button
                  onClick={() => handleSelectStream("customers")}
                  className="w-full text-left p-4 sm:p-3.5 rounded-2xl bg-[#121A24] border border-[var(--line)] hover:border-[var(--chat-brand-border)] hover:bg-[#16212E] active:scale-[0.99] transition-all cursor-pointer group flex items-start gap-3.5 shadow-md"
                >
                  <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[var(--chat-brand-soft)] text-[var(--chat-brand)] border border-[var(--chat-brand-border)] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 sm:w-4 sm:h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-xs font-bold text-[#EAF1F8] group-hover:text-[var(--chat-brand)] transition-colors">
                        Customers &amp; Clients
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#6B7C8D] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-xs sm:text-[11px] text-[#8E9AA8] mt-0.5 leading-normal">
                      Subscriber care, OrderV8 credit vouchers, replacement requests, and live billing triage.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-mono text-[var(--chat-brand)] bg-[var(--chat-brand-soft)] px-2 py-0.5 rounded font-bold">
                        SLA: &lt; 1.2s Response
                      </span>
                    </div>
                  </div>
                </button>

                {/* General Enquiries Option */}
                <button
                  onClick={() => handleSelectStream("enquiries")}
                  className="w-full text-left p-4 sm:p-3.5 rounded-2xl bg-[#121A24] border border-[var(--line)] hover:border-[#4D9FFF]/60 hover:bg-[#16212E] active:scale-[0.99] transition-all cursor-pointer group flex items-start gap-3.5 shadow-md"
                >
                  <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[#4D9FFF]/15 text-[#4D9FFF] border border-[#4D9FFF]/40 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-5 h-5 sm:w-4 sm:h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-xs font-bold text-[#EAF1F8] group-hover:text-[#4D9FFF] transition-colors">
                        General &amp; Partnership Enquiries
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#6B7C8D] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-xs sm:text-[11px] text-[#8E9AA8] mt-0.5 leading-normal">
                      Product features, enterprise SLAs, and marketplace extensions.
                    </p>
                  </div>
                </button>
              </div>

              {/* Trust Badge Footer */}
              <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-[10px] font-mono text-[#6B7C8D]">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[var(--chat-brand)]" />
                  Governed &amp; Encrypted
                </span>
                <span>supportV8 Engine</span>
              </div>
            </div>
          )}

          {/* STEP 2: Pre-Chat Intake Form */}
          {activeStep === "intake_form" && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setActiveStep("select_stream")}
                    className="text-xs font-mono text-[#6B7C8D] hover:text-[var(--chat-brand)] flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Back Channels</span>
                  </button>
                  <span
                    className="pill text-[9px] font-mono uppercase px-2 py-0.5"
                    style={{ borderColor: currentWorkflow.badgeColor, color: currentWorkflow.badgeColor }}
                  >
                    {currentWorkflow.title}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#EAF1F8]">{currentWorkflow.subtitle}</h4>
                  <p className="text-xs text-[#8E9AA8] mt-0.5">
                    Please provide these details so we can verify your records before routing.
                  </p>
                </div>

                <form id="intake-form" onSubmit={handleSubmitIntake} className="space-y-3 pt-1">
                  {currentWorkflow.intakeFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <label className="text-xs font-mono text-[#B4C2D0] flex items-center justify-between">
                        <span>{field.label}</span>
                        {field.required && <span className="text-[var(--chat-brand)] text-[10px]">*required</span>}
                      </label>

                      {field.type === "select" ? (
                        <select
                          value={formData[field.name] || ""}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          className={`w-full bg-[#141C26] border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-[#EAF1F8] focus:outline-none focus:border-[var(--chat-brand)] ${
                            formErrors[field.name] ? "border-[#E5484D]" : "border-[var(--line)]"
                          }`}
                        >
                          <option value="">-- Select an option --</option>
                          {field.options?.map((opt, i) => (
                            <option key={i} value={opt} className="bg-[#141C26]">
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          rows={3}
                          value={formData[field.name] || ""}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className={`w-full bg-[#141C26] border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-[#EAF1F8] focus:outline-none focus:border-[var(--chat-brand)] resize-none ${
                            formErrors[field.name] ? "border-[#E5484D]" : "border-[var(--line)]"
                          }`}
                        />
                      ) : (
                        <input
                          type={field.type}
                          inputMode={field.type === "number" ? "numeric" : "text"}
                          value={formData[field.name] || ""}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className={`w-full bg-[#141C26] border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-[#EAF1F8] focus:outline-none focus:border-[var(--chat-brand)] ${
                            formErrors[field.name] ? "border-[#E5484D]" : "border-[var(--line)]"
                          }`}
                        />
                      )}

                      {formErrors[field.name] && (
                        <p className="text-[10px] text-[#E5484D] font-mono">{formErrors[field.name]}</p>
                      )}
                    </div>
                  ))}
                  {chatError && (
                    <p className="text-xs text-[#E5484D] bg-[#E5484D]/10 border border-[#E5484D]/30 rounded-xl p-2.5" role="alert">
                      {chatError}
                    </p>
                  )}
                </form>
              </div>

              <div className="pt-4 border-t border-[var(--line)] pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-0">
                <button
                  type="submit"
                  form="intake-form"
                  className="btn w-full rounded-2xl bg-[var(--chat-brand)] py-3 text-sm font-bold text-[var(--chat-on-brand)] shadow-[0_10px_28px_var(--chat-brand-shadow)] flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <span>Start Live Session</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Live Conversation Stream */}
          {activeStep === "chat" && activeSession && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Active Channel Strip */}
              <div className="px-4 py-2 bg-[#141C26] border-b border-[var(--line)] flex items-center justify-between text-xs font-mono shrink-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: currentWorkflow.badgeColor }}
                  />
                  <span className="text-[#EAF1F8] font-bold">{currentWorkflow.title}</span>
                  <span className="text-[#6B7C8D]">•</span>
                  <span className="text-[#6B7C8D]">
                    {activeSession.assignedType === "human" ? "Human Staff" : "AI Specialist"}
                  </span>
                  <span className="text-[#6B7C8D]">•</span>
                  <span
                    role="status"
                    aria-live="polite"
                    className={chatConnectionState === "live" ? "text-[#4CC38A]" : "text-[#F5A623]"}
                  >
                    {chatConnectionState === "live"
                      ? "Live"
                      : chatConnectionState === "offline"
                        ? "Offline — retrying"
                        : "Reconnecting"}
                  </span>
                </div>
                <button
                  onClick={handleRequestHuman}
                  className="text-[var(--chat-brand)] hover:underline flex items-center gap-1 cursor-pointer text-xs font-semibold"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Request Human
                </button>
              </div>

              {/* Message List: Runtime's transcript and message anatomy */}
              <ChatTranscript className="flex-1 min-h-0 compact chat-widget-transcript">
                {activeSession.messages.map((msg) => {
                  if (msg.sender === "system") {
                    return (
                      <ChatMessageView key={msg.id} kind="system" author={msg.senderName || `${tenantName} Support`} time={msg.timestamp}>
                        <FormattedChatMessage content={msg.content} />
                      </ChatMessageView>
                    );
                  }
                  if (msg.sender === "customer") {
                    return (
                      <ChatMessageView
                        key={msg.id}
                        kind="user"
                        author="You"
                        time={msg.timestamp}
                        footer={msg.deliveryState === "sending" ? <span className="chat-delivery" role="status">Sending…</span> : undefined}
                      >
                        <PlainChatText content={msg.content} />
                      </ChatMessageView>
                    );
                  }
                  const isAi = msg.sender === "ai_employee";
                  return (
                    <ChatMessageView
                      key={msg.id}
                      kind="assistant"
                      author={msg.senderName || (isAi ? "AI specialist" : "Support team")}
                      role={isAi ? "AI specialist" : "Support team"}
                      time={msg.timestamp}
                      portrait={isAi ? { name: msg.senderName || "", role: "support" } : null}
                      footer={(msg.citations?.length || msg.suggestedActions?.length) ? (
                        <div className="chat-message-footer">
                          {/* Citations */}
                          {msg.citations?.map((c) => (
                            <span key={c.id} className="chat-widget-chip">
                              <Shield className="w-3 h-3" />
                              <span>{c.title}</span>
                            </span>
                          ))}
                          {/* Suggested 1-Click Action Chips */}
                          {msg.suggestedActions?.map((act, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleActionClick(act.actionId, act.label)}
                              className="chat-widget-chip chat-widget-action"
                            >
                              <span>{act.label}</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      ) : undefined}
                    >
                      {isAi ? <FormattedChatMessage content={msg.content} /> : <PlainChatText content={msg.content} />}
                    </ChatMessageView>
                  );
                })}

                {isTyping && <p className="chat-pending" role="status">Sending your message securely…</p>}
              </ChatTranscript>

              {/* Composer: label, Enter/Shift+Enter, read-only while sending, draft kept on error */}
              <div className="chat-compose compact chat-widget-compose shrink-0 pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-3">
                <form onSubmit={handleSendMessage}>
                  <label htmlFor="support-widget-message">Message {tenantName} Support</label>
                  <div className="flex items-end gap-2">
                    <textarea
                      id="support-widget-message"
                      rows={2}
                      value={inputMessage}
                      onChange={(e) => { setInputMessage(e.target.value); if (chatError) setChatError(null); }}
                      onKeyDown={(e) => handleChatComposerKeyDown(e, () => void handleSendMessage(), sendingDraft)}
                      readOnly={sendingDraft}
                      aria-invalid={chatError ? true : undefined}
                      aria-describedby={chatError ? "support-widget-error support-widget-help" : "support-widget-help"}
                      placeholder="Type a message, ask about PINs, or status..."
                    />
                    <button
                      type="submit"
                      aria-label={sendingDraft ? "Sending message" : "Send message"}
                      disabled={!inputMessage.trim() || sendingDraft}
                      className="w-11 h-11 rounded-xl bg-[var(--chat-brand)] text-[var(--chat-on-brand)] flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  {chatError && (
                    <p id="support-widget-error" className="chat-compose-error" role="alert">
                      {chatError}
                    </p>
                  )}
                  <span id="support-widget-help" className="chat-compose-help">Enter to send; Shift+Enter for a new line.</span>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
} from "lucide-react";
import type {
  ChatStreamType,
  CustomerChatMessage,
  CustomerChatSession,
  ChatWorkflowConfig,
} from "@/lib/types";
import {
  DEFAULT_CHAT_WORKFLOWS,
  ChatWorkflowService,
} from "@/lib/services/chat-workflow-service";
import {
  createOptimisticChatMessage,
  mergeChatSession,
  useChatRealtimeSession,
} from "@/lib/chat/use-chat-realtime";

interface SupportChatWidgetProps {
  tenantSlug?: string;
  tenantName?: string;
  tenantDomain?: string;
  defaultStream?: ChatStreamType;
}

export function SupportChatWidget({
  tenantSlug,
  tenantName = "Acme Corp",
  tenantDomain,
  defaultStream = "customers",
}: SupportChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPromptMinimized, setIsPromptMinimized] = useState(false);
  const [activeStep, setActiveStep] = useState<"select_stream" | "intake_form" | "chat">("select_stream");
  const [selectedStream, setSelectedStream] = useState<ChatStreamType>(defaultStream || "customers");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [activeSession, setActiveSession] = useState<CustomerChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const chatConnectionState = useChatRealtimeSession(activeSession?.id, (session) => {
    setActiveSession((current) => mergeChatSession(current, session));
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const workflows = ChatWorkflowService.getWorkflows();
  const currentWorkflow: ChatWorkflowConfig = workflows[selectedStream] || DEFAULT_CHAT_WORKFLOWS.customers;

  // Auto-scroll on new messages
  useEffect(() => {
    if (activeStep === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSession?.messages, isTyping, activeStep]);

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
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to start chat. Please try again.");
    } finally {
      setTimeout(() => setIsTyping(false), 500);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, directText?: string) => {
    e?.preventDefault();
    const textToSend = (directText !== undefined ? directText : inputMessage).trim();
    if (!textToSend || !activeSession) return;

    setInputMessage("");
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
      const response = await fetch("/api/chat/message", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSession.id,
          content: textToSend,
          sender: "customer",
          senderName: activeSession.customerName,
          clientMessageId,
        }),
      });
      const res = await response.json();
      if (!response.ok || !res?.session) {
        throw new Error(res?.error || "Unable to save your message");
      }

      setActiveSession((current) => mergeChatSession(current, res.session as CustomerChatSession));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("sv8_ticket_created", { detail: res.session }));
      }
    } catch (error) {
      setActiveSession((current) =>
        current
          ? { ...current, messages: current.messages.filter((message) => message.id !== clientMessageId) }
          : current,
      );
      setInputMessage(textToSend);
      setChatError(error instanceof Error ? error.message : "Unable to save your message. Please try again.");
    } finally {
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
    setActiveSession(null);
    setFormData({});
    setFormErrors({});
    setActiveStep("select_stream");
    setInputMessage("");
    setChatError(null);
  };

  return (
    <>
      {/* Floating Action Trigger Button (Bottom-Right) */}
      {!isOpen && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-300">
          {!isPromptMinimized && (
            <div className="hidden sm:flex items-center gap-2 bg-[#0E1520] border border-[var(--line-2)] text-[#EAF1F8] px-3.5 py-2 rounded-2xl shadow-xl shadow-black/50 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-[#2ED8B6] animate-pulse" />
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
            className="w-14 h-14 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-[#00F2FE] via-[#2ED8B6] to-[#059669] text-[#090E15] flex items-center justify-center shadow-2xl shadow-[#2ED8B6]/35 hover:scale-105 active:scale-95 transition-all cursor-pointer group shrink-0"
          >
            <MessageSquare className="w-6 h-6 sm:w-5 sm:h-5 group-hover:rotate-6 transition-transform" />
          </button>
        </div>
      )}

      {/* Expanded Modal / Native Fullscreen Phone Flyout */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 w-full sm:w-[480px] h-[100dvh] sm:h-[640px] sm:max-h-[88vh] bg-[#0E1520] border-0 sm:border sm:border-[var(--line-2)] rounded-none sm:rounded-3xl shadow-2xl shadow-black/90 flex flex-col overflow-hidden backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-200 text-[#EAF1F8]">
          {/* Widget Header */}
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between shrink-0 pt-[max(env(safe-area-inset-top),12px)] sm:pt-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6] font-bold shrink-0">
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
                  <span className="w-2 h-2 rounded-full bg-[#2ED8B6] shrink-0" />
                </div>
                <p className="text-[10px] font-mono text-[#6B7C8D] truncate">
                  {activeStep === "chat"
                    ? activeSession?.assignedName
                    : "Intelligent Triage & Live Omnichannel"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 text-[#6B7C8D] shrink-0">
              {/* Direct Native Telephony Link */}
              <a
                href="tel:+18005558880"
                className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40 flex items-center gap-1 text-[11px] font-mono font-bold hover:bg-[#2ED8B6]/25 transition-colors cursor-pointer"
                title="Direct Telephony Call"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Call Live</span>
              </a>

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
                <span className="pill text-[10px] font-mono uppercase bg-[#18222E] text-[#2ED8B6] px-2.5 py-0.5">
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
                      <span className="text-[9px] font-mono text-[#F5A623] bg-[#F5A623]/15 px-2 py-0.5 rounded font-bold">
                        ⚡ Instant Dispatch
                      </span>
                      <span className="text-[9px] font-mono text-[#6B7C8D]">Mobile PIN Ready</span>
                    </div>
                  </div>
                </button>

                {/* Customers & Clients Option */}
                <button
                  onClick={() => handleSelectStream("customers")}
                  className="w-full text-left p-4 sm:p-3.5 rounded-2xl bg-[#121A24] border border-[var(--line)] hover:border-[#2ED8B6]/60 hover:bg-[#16212E] active:scale-[0.99] transition-all cursor-pointer group flex items-start gap-3.5 shadow-md"
                >
                  <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 sm:w-4 sm:h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm sm:text-xs font-bold text-[#EAF1F8] group-hover:text-[#2ED8B6] transition-colors">
                        Customers &amp; Clients
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#6B7C8D] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-xs sm:text-[11px] text-[#8E9AA8] mt-0.5 leading-normal">
                      Subscriber care, OrderV8 credit vouchers, replacement requests, and live billing triage.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] font-mono text-[#2ED8B6] bg-[#2ED8B6]/15 px-2 py-0.5 rounded font-bold">
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
                  <Shield className="w-3.5 h-3.5 text-[#2ED8B6]" />
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
                    className="text-xs font-mono text-[#6B7C8D] hover:text-[#2ED8B6] flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Channels
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
                        {field.required && <span className="text-[#2ED8B6] text-[10px]">*required</span>}
                      </label>

                      {field.type === "select" ? (
                        <select
                          value={formData[field.name] || ""}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          className={`w-full bg-[#141C26] border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] ${
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
                          className={`w-full bg-[#141C26] border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] resize-none ${
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
                          className={`w-full bg-[#141C26] border rounded-xl px-3 py-2.5 text-sm sm:text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] ${
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
                  className="btn btn-primary w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#2ED8B6]/25 cursor-pointer active:scale-[0.99]"
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
                  className="text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer text-xs font-semibold"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Request Human
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {activeSession.messages.map((msg) => {
                  const isUser = msg.sender === "customer";
                  const isSystem = msg.sender === "system";

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="p-2.5 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 text-xs text-[#EAF1F8] flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#E5484D] shrink-0 mt-0.5" />
                        <span>{msg.content}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {!isUser && (
                        <div className="w-7 h-7 rounded-lg bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6] text-xs font-bold shrink-0 overflow-hidden">
                          {msg.senderAvatar ? (
                            <img src={msg.senderAvatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <Bot className="w-4 h-4" />
                          )}
                        </div>
                      )}

                      <div className={`space-y-1 max-w-[88%] ${isUser ? "items-end text-right" : "items-start text-left"}`}>
                        <div className="text-[10px] font-mono text-[#6B7C8D] flex items-center gap-1.5">
                          <span className="font-bold text-[#B4C2D0]">{msg.senderName}</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-[11px] leading-relaxed shadow-sm ${
                            isUser
                              ? "bg-[#2ED8B6]/20 border border-[#2ED8B6]/40 text-[#EAF1F8] rounded-tr-none"
                              : "bg-[#141C26] border border-[var(--line)] text-[#EAF1F8] rounded-tl-none whitespace-pre-line"
                          }`}
                        >
                          {msg.content}
                        </div>
                        {isUser && msg.deliveryState === "sending" && (
                          <span className="text-[9px] text-[#8E9AA8]" role="status">Sending…</span>
                        )}

                        {/* Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {msg.citations.map((c) => (
                              <div
                                key={c.id}
                                className="px-2 py-0.5 rounded-lg bg-[#101720] border border-[var(--line)] text-[9px] font-mono text-[#2ED8B6] flex items-center gap-1"
                              >
                                <Shield className="w-2.5 h-2.5" />
                                <span>{c.title}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Suggested 1-Click Action Chips */}
                        {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {msg.suggestedActions.map((act, i) => (
                              <button
                                key={i}
                                onClick={() => handleActionClick(act.actionId, act.label)}
                                className="px-2.5 py-1 rounded-xl bg-[#18222E] border border-[#2ED8B6]/40 hover:border-[#2ED8B6] text-[10px] font-mono text-[#2ED8B6] flex items-center gap-1 transition-colors cursor-pointer active:scale-95 shadow-sm"
                              >
                                <span>{act.label}</span>
                                <ChevronRight className="w-2.5 h-2.5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex items-center gap-1.5 text-xs font-mono text-[#6B7C8D] p-2 bg-[#141C26] rounded-xl w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2ED8B6] animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2ED8B6] animate-pulse delay-75" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#2ED8B6] animate-pulse delay-150" />
                    <span>Sending message securely…</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="bg-[#121A24] border-t border-[var(--line)] shrink-0">
                {chatError && (
                  <p className="px-3 pt-2 text-xs text-[#E5484D]" role="alert">
                    {chatError}
                  </p>
                )}
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 flex items-center gap-2 pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-3"
                >
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Type a message, ask about PINs, or status..."
                    className="flex-1 bg-[#18222E] border border-[var(--line)] rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                  />
                  <button
                    type="submit"
                    disabled={!inputMessage.trim()}
                    className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[#2ED8B6] text-[#090E15] flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shrink-0 active:scale-95 shadow-md shadow-[#2ED8B6]/20"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

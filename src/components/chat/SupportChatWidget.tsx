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

interface SupportChatWidgetProps {
  tenantSlug?: string;
  tenantName?: string;
  defaultStream?: ChatStreamType;
}

export function SupportChatWidget({
  tenantSlug = "acme",
  tenantName = "Acme Corp",
  defaultStream,
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

  const handleSubmitIntake = (e: React.FormEvent) => {
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
    const session = ChatWorkflowService.startSession({
      tenantDomain: tenantSlug,
      stream: selectedStream,
      customerName: formData.name || "Customer",
      customerEmail: formData.email || "user@example.com",
      intakeData: formData,
    });

    setActiveSession(session);
    setActiveStep("chat");
    setTimeout(() => setIsTyping(false), 600);
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !activeSession) return;

    const userText = inputMessage.trim();
    setInputMessage("");
    setIsTyping(true);

    setTimeout(() => {
      const result = ChatWorkflowService.sendMessage({
        sessionId: activeSession.id,
        sender: "customer",
        senderName: activeSession.customerName,
        content: userText,
      });

      setActiveSession({ ...result.session });
      setIsTyping(false);
    }, 700);
  };

  const handleActionClick = (actionId: string, actionLabel: string) => {
    if (!activeSession) return;
    setInputMessage(`Executing action: ${actionLabel}`);
    setIsTyping(true);

    setTimeout(() => {
      const result = ChatWorkflowService.sendMessage({
        sessionId: activeSession.id,
        sender: "customer",
        senderName: activeSession.customerName,
        content: `Selected action: [${actionLabel}]`,
      });
      setActiveSession({ ...result.session });
      setIsTyping(false);
    }, 600);
  };

  const handleRequestHuman = () => {
    if (!activeSession) return;
    setInputMessage("I would like to speak to a human supervisor please.");
    handleSendMessage();
  };

  const handleResetChat = () => {
    setActiveSession(null);
    setFormData({});
    setFormErrors({});
    setActiveStep("select_stream");
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5">
          {!isPromptMinimized && (
            <div className="hidden md:flex items-center gap-2 bg-[#121A24]/95 backdrop-blur-md border border-[#2ED8B6]/50 pl-3.5 pr-2 py-1.5 rounded-2xl shadow-xl shadow-black/50 text-[11px] font-medium text-[#EAF1F8] animate-in fade-in slide-in-from-right-4 duration-300 group">
              <span className="w-2 h-2 rounded-full bg-[#2ED8B6] animate-ping shrink-0" />
              <span
                onClick={() => setIsOpen(true)}
                className="cursor-pointer hover:text-[#2ED8B6] transition-colors font-sans"
              >
                Need Support or Dispatch? Chat with AI &amp; Staff
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPromptMinimized(true);
                }}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] hover:bg-[#18222E] rounded-lg transition-colors cursor-pointer ml-1"
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
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00F2FE] via-[#2ED8B6] to-[#059669] text-[#090E15] flex items-center justify-center shadow-2xl shadow-[#2ED8B6]/30 hover:scale-105 active:scale-95 transition-all cursor-pointer group shrink-0"
          >
            <MessageSquare className="w-5 h-5 group-hover:rotate-6 transition-transform" />
          </button>
        </div>
      )}

      {/* Expanded Modal / Flyout Dialog */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[92vw] sm:w-[420px] h-[620px] max-h-[86vh] bg-[#0E1520] border border-[var(--line-2)] rounded-2xl shadow-2xl shadow-black/70 flex flex-col overflow-hidden backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-200 text-[#EAF1F8]">
          {/* Widget Header */}
          <div className="px-4 py-3 bg-[#121A24] border-b border-[var(--line)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6] font-bold shrink-0">
                {activeSession?.assignedAvatar ? (
                  <img
                    src={activeSession.assignedAvatar}
                    alt="Agent"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-[#EAF1F8]">{tenantName} Support</h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2ED8B6]" />
                </div>
                <p className="text-[9px] font-mono text-[#6B7C8D]">
                  {activeStep === "chat"
                    ? activeSession?.assignedName
                    : "Intelligent Triage & Live Omnichannel"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[#6B7C8D]">
              {activeStep === "chat" && (
                <button
                  onClick={handleResetChat}
                  title="Start New Topic"
                  className="p-1 rounded-md hover:bg-[#1C2836] hover:text-[#EAF1F8] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize chat"
                className="p-1 rounded-md hover:bg-[#1C2836] hover:text-[#EAF1F8] transition-colors cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1 rounded-md hover:bg-[#1C2836] hover:text-[#EAF1F8] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* STEP 1: Stream Selector */}
          {activeStep === "select_stream" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
              <div className="space-y-1">
                <span className="pill text-[9px] font-mono uppercase bg-[#18222E] text-[#2ED8B6] px-2 py-0.5">
                  Select Support Channel
                </span>
                <h4 className="text-xs font-bold text-[#EAF1F8]">How can we assist you?</h4>
                <p className="text-[11px] text-[#8E9AA8] leading-relaxed">
                  Choose your inquiry type to be routed directly to the dedicated live support desk or AI specialist.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                {/* Contractors Option */}
                <button
                  onClick={() => handleSelectStream("contractors")}
                  className="w-full text-left p-3 rounded-xl bg-[#121A24] border border-[var(--line)] hover:border-[#F5A623]/60 hover:bg-[#16212E] transition-all cursor-pointer group flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#F5A623]/15 text-[#F5A623] border border-[#F5A623]/40 flex items-center justify-center shrink-0">
                    <HardHat className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#EAF1F8] group-hover:text-[#F5A623] transition-colors">
                        Contractors & Vendors
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#6B7C8D] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[10px] text-[#8E9AA8] mt-0.5 leading-normal">
                      Invoices, work order dispatch, W9/compliance uploads, and site access.
                    </p>
                    <span className="inline-block mt-1.5 text-[9px] font-mono text-[#F5A623] bg-[#F5A623]/10 px-1.5 py-0.5 rounded">
                      SLA: &lt; 2 min dispatch
                    </span>
                  </div>
                </button>

                {/* General Enquiries Option */}
                <button
                  onClick={() => handleSelectStream("enquiries")}
                  className="w-full text-left p-3 rounded-xl bg-[#121A24] border border-[var(--line)] hover:border-[#4D9FFF]/60 hover:bg-[#16212E] transition-all cursor-pointer group flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#4D9FFF]/15 text-[#4D9FFF] border border-[#4D9FFF]/40 flex items-center justify-center shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#EAF1F8] group-hover:text-[#4D9FFF] transition-colors">
                        General Enquiries
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#6B7C8D] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[10px] text-[#8E9AA8] mt-0.5 leading-normal">
                      Product questions, enterprise pricing, developer API, and partnerships.
                    </p>
                    <span className="inline-block mt-1.5 text-[9px] font-mono text-[#4D9FFF] bg-[#4D9FFF]/10 px-1.5 py-0.5 rounded">
                      Instant AI Knowledge Solutions
                    </span>
                  </div>
                </button>

                {/* Customers & Clients Option */}
                <button
                  onClick={() => handleSelectStream("customers")}
                  className="w-full text-left p-3 rounded-xl bg-[#121A24] border border-[var(--line)] hover:border-[#2ED8B6]/60 hover:bg-[#16212E] transition-all cursor-pointer group flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/40 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#EAF1F8] group-hover:text-[#2ED8B6] transition-colors">
                        Customers & Clients
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#6B7C8D] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[10px] text-[#8E9AA8] mt-0.5 leading-normal">
                      Subscriber account care, OrderV8 refund token dispatch, and technical support.
                    </p>
                    <span className="inline-block mt-1.5 text-[9px] font-mono text-[#2ED8B6] bg-[#2ED8B6]/10 px-1.5 py-0.5 rounded">
                      Live Omnichannel Queue + AI Assist
                    </span>
                  </div>
                </button>
              </div>

              {/* Trust Badge Footer */}
              <div className="pt-3 border-t border-[var(--line)] flex items-center justify-between text-[9px] font-mono text-[#6B7C8D]">
                <span className="flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5 text-[#2ED8B6]" />
                  Zero-Trust ForgeGW Encrypted
                </span>
                <span>supportV8 Engine</span>
              </div>
            </div>
          )}

          {/* STEP 2: Pre-Chat Intake Form */}
          {activeStep === "intake_form" && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setActiveStep("select_stream")}
                    className="text-[10px] font-mono text-[#6B7C8D] hover:text-[#2ED8B6] flex items-center gap-1 cursor-pointer"
                  >
                    ← Back to Channels
                  </button>
                  <span
                    className="pill text-[8.5px] font-mono uppercase px-2 py-0.5"
                    style={{ borderColor: currentWorkflow.badgeColor, color: currentWorkflow.badgeColor }}
                  >
                    {currentWorkflow.title}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-[#EAF1F8]">{currentWorkflow.subtitle}</h4>
                  <p className="text-[10px] text-[#8E9AA8] mt-0.5">
                    Please provide these details so we can pull your records before routing.
                  </p>
                </div>

                <form id="intake-form" onSubmit={handleSubmitIntake} className="space-y-2.5 pt-1">
                  {currentWorkflow.intakeFields.map((field) => (
                    <div key={field.id} className="space-y-0.5">
                      <label className="text-[10px] font-mono text-[#B4C2D0] flex items-center justify-between">
                        <span>{field.label}</span>
                        {field.required && <span className="text-[#2ED8B6] text-[9px]">*required</span>}
                      </label>

                      {field.type === "select" ? (
                        <select
                          value={formData[field.name] || ""}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          className={`w-full bg-[#141C26] border rounded-lg px-2.5 py-1.5 text-[11px] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] ${
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
                          rows={2}
                          value={formData[field.name] || ""}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className={`w-full bg-[#141C26] border rounded-lg px-2.5 py-1.5 text-[11px] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] resize-none ${
                            formErrors[field.name] ? "border-[#E5484D]" : "border-[var(--line)]"
                          }`}
                        />
                      ) : (
                        <input
                          type={field.type}
                          value={formData[field.name] || ""}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className={`w-full bg-[#141C26] border rounded-lg px-2.5 py-1.5 text-[11px] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6] ${
                            formErrors[field.name] ? "border-[#E5484D]" : "border-[var(--line)]"
                          }`}
                        />
                      )}

                      {formErrors[field.name] && (
                        <p className="text-[9px] text-[#E5484D] font-mono">{formErrors[field.name]}</p>
                      )}
                    </div>
                  ))}
                </form>
              </div>

              <div className="pt-3 border-t border-[var(--line)]">
                <button
                  type="submit"
                  form="intake-form"
                  className="btn btn-primary w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-[#2ED8B6]/20 cursor-pointer"
                >
                  <span>Start Live Session</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Live Conversation Stream */}
          {activeStep === "chat" && activeSession && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Active Channel Strip */}
              <div className="px-3.5 py-1.5 bg-[#141C26] border-b border-[var(--line)] flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: currentWorkflow.badgeColor }}
                  />
                  <span className="text-[#EAF1F8] font-bold">{currentWorkflow.title}</span>
                  <span className="text-[#6B7C8D]">•</span>
                  <span className="text-[#6B7C8D]">
                    {activeSession.assignedType === "human" ? "Human Staff" : "AI Employee"}
                  </span>
                </div>
                <button
                  onClick={handleRequestHuman}
                  className="text-[#2ED8B6] hover:underline flex items-center gap-1 cursor-pointer text-[10px]"
                >
                  <UserCheck className="w-3 h-3" />
                  Request Human
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {activeSession.messages.map((msg) => {
                  const isUser = msg.sender === "customer";
                  const isSystem = msg.sender === "system";

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="p-2 rounded-lg bg-[#E5484D]/10 border border-[#E5484D]/30 text-[10px] text-[#EAF1F8] flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#E5484D] shrink-0 mt-0.5" />
                        <span>{msg.content}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {!isUser && (
                        <div className="w-6 h-6 rounded-md bg-[#2ED8B6]/15 border border-[#2ED8B6]/40 flex items-center justify-center text-[#2ED8B6] text-[10px] font-bold shrink-0 overflow-hidden">
                          {msg.senderAvatar ? (
                            <img src={msg.senderAvatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <Bot className="w-3.5 h-3.5" />
                          )}
                        </div>
                      )}

                      <div className={`space-y-0.5 max-w-[84%] ${isUser ? "items-end text-right" : "items-start text-left"}`}>
                        <div className="text-[9px] font-mono text-[#6B7C8D] flex items-center gap-1">
                          <span className="font-bold text-[#B4C2D0]">{msg.senderName}</span>
                          <span>{msg.timestamp}</span>
                        </div>

                        <div
                          className={`p-2.5 rounded-xl text-[11px] leading-relaxed ${
                            isUser
                              ? "bg-[#2ED8B6]/20 border border-[#2ED8B6]/40 text-[#EAF1F8] rounded-tr-none"
                              : "bg-[#141C26] border border-[var(--line)] text-[#EAF1F8] rounded-tl-none whitespace-pre-line"
                          }`}
                        >
                          {msg.content}
                        </div>

                        {/* Citations */}
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {msg.citations.map((c) => (
                              <div
                                key={c.id}
                                className="px-1.5 py-0.5 rounded bg-[#101720] border border-[var(--line)] text-[8.5px] font-mono text-[#2ED8B6] flex items-center gap-1"
                              >
                                <Shield className="w-2 h-2" />
                                <span>{c.title}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Suggested 1-Click Action Chips */}
                        {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {msg.suggestedActions.map((act, i) => (
                              <button
                                key={i}
                                onClick={() => handleActionClick(act.actionId, act.label)}
                                className="px-2 py-0.5 rounded-md bg-[#18222E] border border-[#2ED8B6]/40 hover:border-[#2ED8B6] text-[9px] font-mono text-[#2ED8B6] flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <span>{act.label}</span>
                                <ChevronRight className="w-2 h-2" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#6B7C8D] p-1.5 bg-[#141C26] rounded-lg w-fit">
                    <span className="w-1 h-1 rounded-full bg-[#2ED8B6] animate-pulse" />
                    <span className="w-1 h-1 rounded-full bg-[#2ED8B6] animate-pulse delay-75" />
                    <span className="w-1 h-1 rounded-full bg-[#2ED8B6] animate-pulse delay-150" />
                    <span>Agent is reviewing knowledge base...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 bg-[#121A24] border-t border-[var(--line)] flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type a message or issue question..."
                  className="flex-1 bg-[#18222E] border border-[var(--line)] rounded-lg px-3 py-2 text-[11px] text-[#EAF1F8] focus:outline-none focus:border-[#2ED8B6]"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="w-8 h-8 rounded-lg bg-[#2ED8B6] text-[#090E15] flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}

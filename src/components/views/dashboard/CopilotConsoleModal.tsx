"use client";

import React, { useState } from "react";
import type { ChatMessage } from "@/app/page";
import { SoundAlertToggle } from "@/components/SoundAlertToggle";
import { ArrowRight, Bot, CornerDownLeft, RefreshCw, Send, Sparkles, Trash2, X } from "@/components/ui/FlatIcon";
import { WorkforceAvatar } from "@/components/WorkforceAvatar";
import { DEFAULT_RAG_ASSISTANT } from "@/lib/types";
import { ChatMessage as ChatMessageView, PlainChatText } from "@/components/chat-ui/ChatMessage";
import { ChatTranscript } from "@/components/chat-ui/ChatTranscript";
import { EmployeeAvatar } from "@/components/chat-ui/EmployeeAvatar";
import { FormattedChatMessage } from "@/components/chat-ui/FormattedChatMessage";
import { handleChatComposerKeyDown } from "@/components/chat-ui/composer-keys";
import { employeeDisplayName } from "@/lib/chat/employee-avatar";

export interface CopilotConsoleModalProps {
  chatLoading: boolean;
  chatMessages: ChatMessage[];
  chatQuery: string;
  /** Resolves false when no reply arrived; the draft is then kept. */
  handleAskChat: (e?: React.FormEvent, overrideQuery?: string) => Promise<boolean | void>;
  handleChatAction: (act: { label: string; action: string; targetTab?: string; payload?: any; }) => void;
  handleClearChat: () => void;
  handleSelectEmployee: (empId: string) => void;
  selectedEmployeeId: string;
  setChatQuery: React.Dispatch<React.SetStateAction<string>>;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowModalPrompts: React.Dispatch<React.SetStateAction<boolean>>;
  showModalPrompts: boolean;
  workforce: any[];
}

export function CopilotConsoleModal({
  chatLoading,
  chatMessages,
  chatQuery,
  handleAskChat,
  handleChatAction,
  handleClearChat,
  handleSelectEmployee,
  selectedEmployeeId,
  setChatQuery,
  setIsChatOpen,
  setShowModalPrompts,
  showModalPrompts,
  workforce,
}: CopilotConsoleModalProps) {
  // The page sends to selectedEmployeeId, or to the RAG assistant when none is selected.
  const recipient = workforce.find((w) => w.id === selectedEmployeeId) || DEFAULT_RAG_ASSISTANT;
  const recipientName = employeeDisplayName(recipient.name);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const pending = chatLoading || sending;
  const send = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!chatQuery.trim() || pending) return;
    setSending(true);
    setSendError(null);
    try {
      const answered = await handleAskChat();
      if (answered === false) setSendError("No reply was received. Your draft is still here; try again.");
    } catch {
      setSendError("No reply was received. Your draft is still here; try again.");
    } finally {
      setSending(false);
    }
  };
  return (
<div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-6 pb-12 sm:pb-8">
          <div className="w-full max-w-4xl h-[78vh] max-h-[720px] card shadow-2xl p-0 border-[var(--line)] flex flex-col overflow-hidden bg-[#0C121A] rounded-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center justify-between bg-[#121A24]/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#EAF1F8]" data-testid="chat-room-heading">{recipientName ? `Speak with ${recipientName}` : "Team conversation"}</h3>
                    <span className="pill ok text-[10px] py-0 px-2">
                      <i className="dot"></i> {workforce.length} HIRED
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B7C8D]">
                    Only AI employees hired by this workspace can appear here.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SoundAlertToggle showDropdown={false} className="p-2 min-w-0 min-h-0 h-8 w-8 rounded-lg" />
                <button
                  onClick={handleClearChat}
                  title="Clear Chat History"
                  className="btn btn-secondary text-xs p-2 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </button>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* AI Employee & Intern Selector Strip */}
            <div className="p-3 border-b border-[var(--line)] bg-[#0E1520] shrink-0">
              <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-[#6B7C8D]">
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-[#2ED8B6]" />
                  <span>HIRED AI EMPLOYEES:</span>
                </div>
                <span className="text-[#B4C2D0]">
                  Active: <strong className="text-[#2ED8B6]">{workforce.find((w) => w.id === selectedEmployeeId)?.name || "None hired"}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {workforce.map((w) => {
                  const isSelected = selectedEmployeeId === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleSelectEmployee(w.id)}
                      className={`flex flex-col text-left p-2 rounded-xl transition-all border cursor-pointer ${
                        isSelected
                          ? "bg-[#2ED8B6]/12 border-[#2ED8B6] shadow-sm ring-1 ring-[#2ED8B6]/40"
                          : "bg-[#18222E]/80 border-[var(--line)] hover:border-[#2ED8B6]/50 hover:bg-[#18222E]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <EmployeeAvatar name={employeeDisplayName(w.name)} role={w.role} kind={w.level === "ai_intern" ? "intern" : undefined} />
                        <span
                          className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                            w.level === "ai_employee"
                              ? "bg-[#2ED8B6]/20 text-[#2ED8B6]"
                              : "bg-[#F5A623]/20 text-[#F5A623]"
                          }`}
                        >
                          {w.level === "ai_employee" ? "Employee" : "Intern"}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#EAF1F8] truncate">{w.name.split("—")[0].trim()}</div>
                      <div className="text-[10px] text-[#6B7C8D] truncate">{w.role}</div>
                      <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-[#6B7C8D]">
                        <span>{w.status}</span>
                        <span className="text-[#EAF1F8]">{w.autonomyLevel}</span>
                      </div>
                    </button>
                  );
                })}
                {workforce.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-[var(--line-2)] bg-[#121A24] p-4 text-xs text-[#8E9AA8]">
                    No AI employees are enabled. Customer chats are routed to the authenticated human operator queue.
                  </div>
                )}
              </div>
            </div>

            {/* Chat Message Stream (Multi-Turn): Runtime's transcript and message anatomy */}
            <ChatTranscript className="flex-1 min-h-0 compact">
              {chatMessages.length === 0 && (
                <div className="chat-no-messages">
                  <h3>No AI conversation yet</h3>
                  <p>
                    {selectedEmployeeId === DEFAULT_RAG_ASSISTANT.id
                      ? "Query tickets, runbooks, and pgvector knowledge with SupportV8 RAG Intelligence."
                      : workforce.length > 0
                      ? `Ask ${workforce.find((w) => w.id === selectedEmployeeId)?.name || "your AI employee"} anything or select a prompt below.`
                      : "Hire an AI employee from Marketplace before starting a workforce chat."}
                  </p>
                </div>
              )}
              {chatMessages.map((msg) => {
                if (msg.role === "system") {
                  return (
                    <ChatMessageView key={msg.id} kind="system" author="SupportV8" time={msg.timestamp}>
                      <FormattedChatMessage content={msg.content} />
                    </ChatMessageView>
                  );
                }
                if (msg.role === "user") {
                  return (
                    <ChatMessageView key={msg.id} kind="user" author="You" time={msg.timestamp}>
                      <PlainChatText content={msg.content} />
                    </ChatMessageView>
                  );
                }
                const emp = workforce.find((w) => w.id === msg.employeeId);
                const name = employeeDisplayName(msg.employeeName || emp?.name || "AI employee");
                const role = msg.employeeRole || emp?.role;
                return (
                  <ChatMessageView
                    key={msg.id}
                    kind="assistant"
                    author={name}
                    role={role}
                    time={msg.timestamp}
                    portrait={{ name, role, kind: emp?.level === "ai_intern" ? "intern" : undefined }}
                    footer={(msg.citations?.length || msg.suggestedActions?.length) ? (
                      <div className="chat-message-footer">
                        {/* Grounded knowledge citations */}
                        {msg.citations?.map((c, i) => (
                          <span key={i} className="pill text-[11px] py-0.5 px-2">
                            <span className="font-mono">{c.id}:</span> {c.title}
                          </span>
                        ))}
                        {/* Suggested actions */}
                        {msg.suggestedActions?.map((act, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleChatAction(act)}
                            className="btn btn-secondary text-xs py-1 px-2.5 cursor-pointer flex items-center gap-1.5"
                          >
                            <ArrowRight className="w-3 h-3" />
                            <span>{act.label}</span>
                          </button>
                        ))}
                      </div>
                    ) : undefined}
                  >
                    <FormattedChatMessage content={msg.content} />
                  </ChatMessageView>
                );
              })}

              {pending && <p className="chat-pending" role="status">Waiting for {recipientName}’s reply…</p>}
            </ChatTranscript>

            {/* Dynamic Suggestion Chips */}
            {selectedEmployeeId && showModalPrompts ? (
              <div className="px-4 py-2.5 border-t border-[var(--line)] bg-[#0E1520] shrink-0 transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <span className="text-[10px] font-mono text-[#2ED8B6] font-bold uppercase shrink-0 mr-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Prompts:</span>
                    </span>
                    {(selectedEmployeeId === "emp_rag_intelligence" || !selectedEmployeeId) && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Want to check on your inventory")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Want to check on your inventory&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "How do I configure Okta SAML SSO?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;How do I configure Okta SAML SSO?&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Diagnose 504 Gateway Timeout on checkout")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Diagnose 504 Gateway Timeout on checkout&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "emp_support_lead" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Why did billing CSAT drop?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Why did billing CSAT drop?&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "What active problems are threatening SLA?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;What active problems are threatening SLA?&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Summarize today's VARR performance")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Summarize today's VARR performance&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "emp_incident_analyst" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Calculate active revenue exposure")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Calculate active revenue exposure&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "What is active problem PRB-218?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;What is active problem PRB-218?&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Which Enterprise accounts are impacted?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Which Enterprise accounts are impacted?&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "emp_kb_refresh" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Show knowledge deficit gaps")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Show knowledge deficit gaps&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "What article proposals are ready to publish?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;What article proposals are ready?&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "intern_tagger" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Show intent classification breakdown")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Show intent classification breakdown&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "What triage tags were applied today?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;What tags were applied today?&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "intern_stale_sweeper" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Run work sweep analysis")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Run work sweep analysis&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "How many dormant tickets can be closed?")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;How many dormant tickets can be closed?&rdquo;
                        </button>
                      </>
                    )}
                    {selectedEmployeeId === "intern_summarizer" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Show recent voice call transcript and sentiment")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Show recent voice call transcript&rdquo;
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAskChat(undefined, "Check IVR refund execution")}
                          className="pill cursor-pointer hover:border-[#2ED8B6] hover:text-[#2ED8B6] text-[11px]"
                        >
                          &ldquo;Check IVR refund execution&rdquo;
                        </button>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowModalPrompts(false)}
                    className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer shrink-0 mt-0.5"
                    title="Close prompt suggestions"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : selectedEmployeeId ? (
              <div className="px-4 py-1 border-t border-[var(--line)] bg-[#0E1520] shrink-0">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowModalPrompts(true)}
                    className="text-[10px] font-mono text-[#6B7C8D] hover:text-[#2ED8B6] flex items-center gap-1 cursor-pointer py-0.5"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Show Prompts</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Composer: Runtime's label, "To:", Enter/Shift+Enter, read-only while pending, draft kept on error */}
            <div className="chat-compose compact">
              <form onSubmit={send}>
                <label htmlFor="copilot-chat-message">Message your AI team</label>
                <p className="chat-recipient-summary" aria-live="polite">{pending ? `Sending to ${recipientName}…` : `To: ${recipientName}`}</p>
                <textarea
                  id="copilot-chat-message"
                  rows={2}
                  value={chatQuery}
                  onChange={(e) => { setChatQuery(e.target.value); setSendError(null); }}
                  onKeyDown={(e) => handleChatComposerKeyDown(e, () => void send(), pending)}
                  placeholder={`Ask ${workforce.find((w) => w.id === selectedEmployeeId)?.name || "SupportV8 RAG Intelligence"} about tickets, runbooks, or vector knowledge...`}
                  readOnly={pending}
                  aria-invalid={sendError ? true : undefined}
                  aria-describedby={sendError ? "copilot-chat-error copilot-chat-help" : "copilot-chat-help"}
                />
                {sendError && <p id="copilot-chat-error" className="chat-compose-error" role="alert">{sendError}</p>}
                <div className="chat-compose-actions">
                  <span id="copilot-chat-help" className="chat-compose-help">Enter to send; Shift+Enter for a new line. Drag the corner to resize.</span>
                  <div className="chat-compose-buttons">
                    <button
                      type="submit"
                      disabled={pending || !chatQuery.trim()}
                      className="btn btn-primary py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{pending ? "Sending…" : "Send"}</span>
                    </button>
                  </div>
                </div>
                {pending && <span className="sv8-sr-only" role="status">Sending to {recipientName}. Your draft clears when the reply arrives.</span>}
              </form>
            </div>
          </div>
        </div>
  );
}

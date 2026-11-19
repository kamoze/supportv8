"use client";

import React from "react";
import type { ChatMessage } from "@/app/page";
import { SoundAlertToggle } from "@/components/SoundAlertToggle";
import { ArrowRight, Bot, CornerDownLeft, RefreshCw, Send, Sparkles, Trash2, X } from "@/components/ui/FlatIcon";
import { WorkforceAvatar } from "@/components/WorkforceAvatar";
import { DEFAULT_RAG_ASSISTANT } from "@/lib/types";

export interface CopilotConsoleModalProps {
  chatLoading: boolean;
  chatMessages: ChatMessage[];
  chatQuery: string;
  handleAskChat: (e?: React.FormEvent, overrideQuery?: string) => Promise<void>;
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
                    <h3 className="text-sm font-bold text-[#EAF1F8]">Workforce Chat</h3>
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
                        <img src={w.avatarUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />
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

            {/* Chat Message Stream (Multi-Turn) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-[#0B1017]">
              {chatMessages.length === 0 && (
                <div className="flex h-full min-h-40 items-center justify-center text-center">
                  <div className="max-w-sm space-y-2">
                    <Bot className="mx-auto h-6 w-6 text-[#6B7C8D]" />
                    <p className="text-sm font-semibold text-[#EAF1F8]">No AI conversation yet</p>
                    <p className="text-xs text-[#8E9AA8]">
                      {selectedEmployeeId === DEFAULT_RAG_ASSISTANT.id
                        ? "Query tickets, runbooks, and pgvector knowledge with SupportV8 RAG Intelligence."
                        : workforce.length > 0
                        ? `Ask ${workforce.find((w) => w.id === selectedEmployeeId)?.name || "your AI employee"} anything or select a prompt below.`
                        : "Hire an AI employee from Marketplace before starting a workforce chat."}
                    </p>
                  </div>
                </div>
              )}
              {chatMessages.map((msg) => {
                if (msg.role === "system") {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <div className="text-[11px] text-[#6B7C8D] font-mono bg-[#121A24] px-3 py-1 rounded-full border border-[var(--line)] shadow-sm">
                        {msg.content}
                      </div>
                    </div>
                  );
                }

                if (msg.role === "user") {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[85%] sm:max-w-[70%] bg-[#18222E] border border-[var(--line-2)] text-[#EAF1F8] p-3.5 rounded-2xl rounded-tr-sm text-xs shadow-md">
                        <div className="flex items-center justify-between gap-3 pb-1 mb-1 border-b border-[var(--line)]/50 text-[10px] text-[#6B7C8D] font-mono">
                          <span className="font-semibold text-[#B4C2D0]">You (CX Lead)</span>
                          <span>{msg.timestamp}</span>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                      </div>
                    </div>
                  );
                }

                // Assistant message
                return (
                  <div key={msg.id} className="flex gap-3 max-w-[92%] sm:max-w-[85%]">
                    <WorkforceAvatar
                      name={msg.employeeName}
                      avatar={msg.employeeAvatar}
                      role={msg.employeeRole}
                      size="sm"
                    />
                    <div className="flex-1 bg-[#121A24] border border-[var(--line)] text-[#EAF1F8] p-4 rounded-2xl rounded-tl-sm text-xs space-y-3 shadow-md">
                      <div className="flex items-center justify-between pb-2 border-b border-[var(--line)] text-[11px]">
                        <div className="flex items-center gap-2">
                          <strong className="text-[#2ED8B6] font-semibold">
                            {msg.employeeName || "AI employee"}
                          </strong>
                          <span className="text-[10px] text-[#6B7C8D]">({msg.employeeRole || "AI Employee"})</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#6B7C8D]">{msg.timestamp}</span>
                      </div>

                      <div className="whitespace-pre-wrap leading-relaxed text-[#EAF1F8]">
                        {msg.content}
                      </div>

                      {/* Citations */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider block">
                            Grounded Knowledge Citations:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.citations.map((c, i) => (
                              <span key={i} className="pill text-[10px] py-0.5 px-2 bg-[#18222E] border-[var(--line-2)] text-[#B4C2D0]">
                                <i className="dot"></i>
                                <span className="font-mono">{c.id}:</span> {c.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Actions */}
                      {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                        <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider block">
                            Suggested Autonomous Actions:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.suggestedActions.map((act, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleChatAction(act)}
                                className="btn btn-secondary text-xs py-1 px-2.5 hover:border-[#2ED8B6] hover:text-[#2ED8B6] cursor-pointer flex items-center gap-1.5 transition-all"
                              >
                                <ArrowRight className="w-3 h-3 text-[#2ED8B6]" />
                                <span>{act.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {chatLoading && (
                <div className="flex gap-3 max-w-[80%] animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-[#121A24] border border-[#2ED8B6]/40 flex items-center justify-center text-base shrink-0">
                    <Sparkles className="w-4 h-4 text-[#2ED8B6] animate-spin" />
                  </div>
                  <div className="bg-[#121A24] border border-[#2ED8B6]/30 text-[#2ED8B6] p-3.5 rounded-2xl rounded-tl-sm text-xs flex items-center gap-2 font-mono">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Querying pgvector embeddings &amp; synthesizing response...</span>
                  </div>
                </div>
              )}
            </div>

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

            {/* Chat Input Bar with Drag-to-Resize Support */}
            <div className="p-4 border-t border-[var(--line)] bg-[#121A24] shrink-0">
              <form onSubmit={handleAskChat} className="space-y-2">
                <div className="relative">
                  <textarea
                    rows={2}
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAskChat(e);
                      }
                    }}
                    placeholder={`Ask ${workforce.find((w) => w.id === selectedEmployeeId)?.name || "SupportV8 RAG Intelligence"} about tickets, runbooks, or vector knowledge...`}
                    disabled={chatLoading}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-3 pr-12 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6] text-xs transition-colors shadow-inner resize-y min-h-[64px] max-h-[240px] leading-relaxed"
                  />
                  <div className="absolute right-3 top-3 text-[10px] font-mono text-[#6B7C8D] pointer-events-none flex items-center gap-1">
                    <CornerDownLeft className="w-2.5 h-2.5" />
                    <span>ENTER</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-[11px] font-mono text-[#6B7C8D]">
                  <span className="text-[10px] text-[#2ED8B6] flex items-center gap-1">
                    <span>Drag corner to resize</span>
                  </span>

                  <button
                    type="submit"
                    disabled={chatLoading || !chatQuery.trim()}
                    className="btn btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
  );
}

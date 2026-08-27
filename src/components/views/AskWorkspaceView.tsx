"use client";

import React, { useState } from "react";
import {
  Send,
  Sparkles,
  Bot,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Shield,
  Search,
  CheckCircle2,
} from "lucide-react";
import type { ChatMessage } from "@/app/page";

interface AskWorkspaceViewProps {
  workforce: any[];
  selectedEmployeeId: string;
  onSelectEmployee: (empId: string) => void;
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  onClearChat: () => void;
  onChatAction: (action: any) => void;
  loading: boolean;
}

export function AskWorkspaceView({
  workforce,
  selectedEmployeeId,
  onSelectEmployee,
  messages,
  onSendMessage,
  onClearChat,
  onChatAction,
  loading,
}: AskWorkspaceViewProps) {
  const [inputQuery, setInputQuery] = useState<string>("");

  const activeEmployee = workforce.find((w) => w.id === selectedEmployeeId) || workforce[0];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || loading) return;
    onSendMessage(inputQuery.trim());
    setInputQuery("");
  };

  const PROMPT_SUGGESTIONS: Record<string, string[]> = {
    emp_support_lead: [
      "What is our active SLA attainment rate across all tiers?",
      "Summarize active systemic problems correlated by AI.",
      "Check VIP customer churn risks across Enterprise tier.",
    ],
    emp_incident_analyst: [
      "Compute total ARR financial exposure for PRB-401.",
      "Draft a proactive broadcast notification for affected checkout customers.",
      "What is the blast radius of current payment gateway latency?",
    ],
    emp_kb_refresh: [
      "What are the top 3 unresolved knowledge deficit gaps?",
      "Author a knowledge proposal based on recent checkout resolutions.",
      "Check vector embedding sync status with KnowledgeV8.",
    ],
    intern_tagger: [
      "Show sentiment breakdown for incoming Zendesk tickets.",
      "Run intent auto-tagger across the last 50 issues.",
    ],
    intern_stale_sweeper: [
      "How many dormant tickets are eligible for auto-close?",
      "Run a dry-run sweep across stale tickets.",
    ],
    intern_summarizer: [
      "Summarize the recent Twilio voice recording for caller Marcus Vance.",
      "Extract action items from latest voice support transcripts.",
    ],
  };

  const suggestions = PROMPT_SUGGESTIONS[selectedEmployeeId] || PROMPT_SUGGESTIONS.emp_support_lead;

  return (
    <div className="p-3 sm:p-5 md:p-6 h-full min-h-0 w-full flex flex-col overflow-hidden bg-[#0B1017]">
      {/* Framed Console with Teal Border Frame */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border-2 border-[#2ED8B6] shadow-[0_0_30px_rgba(46,216,182,0.18)] ring-1 ring-[#2ED8B6]/40 overflow-hidden bg-[#0C121A]">
        {/* Top Banner with AI Employee Selector Strip */}
        <div className="bg-[#121A24] border-b border-[#2ED8B6]/30 p-4 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <i className="fi fi-rr-comment-alt-dots text-base"></i>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#EAF1F8]">Ask supportV8 AI Workforce</h2>
              <p className="text-[11px] text-[#6B7C8D]">
                Select an enabled AI Employee to ground responses with specialized RAG memory &amp; autonomy permissions.
              </p>
            </div>
          </div>

          <button
            onClick={onClearChat}
            className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-mono"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset History</span>
          </button>
        </div>

        {/* AI Workforce Selector Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {workforce.map((emp) => {
            const isSelected = emp.id === selectedEmployeeId;
            return (
              <button
                key={emp.id}
                onClick={() => onSelectEmployee(emp.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? "bg-[#2ED8B6]/15 border-[#2ED8B6] text-[#EAF1F8] shadow-md ring-1 ring-[#2ED8B6]/40"
                    : "bg-[#18222E] border-[var(--line)] text-[#B4C2D0] hover:bg-[#1C2836]"
                }`}
              >
                <img
                  src={emp.avatarUrl || "/avatars/beaver-manager.jpg"}
                  alt={emp.name}
                  className="w-8 h-8 rounded-lg object-cover border border-[var(--line-2)] shrink-0"
                />
                <div className="text-left">
                  <div className="text-xs font-bold truncate max-w-[130px]">{emp.name.split("—")[0]}</div>
                  <div className="text-[10px] font-mono text-[#6B7C8D] uppercase tracking-wider">
                    {emp.level === "ai_employee" ? "AI Lead" : "Intern"} • {emp.autonomyLevel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl w-full mx-auto">
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const isSystem = msg.role === "system";

          if (isSystem) {
            return (
              <div key={msg.id} className="text-center my-3">
                <span className="inline-block px-3 py-1 rounded-full bg-[#18222E] border border-[var(--line)] text-[10px] font-mono text-[#6B7C8D]">
                  {msg.content}
                </span>
              </div>
            );
          }

          const emp = workforce.find((w) => w.id === msg.employeeId) || activeEmployee;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              {isUser ? (
                <div className="w-8 h-8 rounded-xl bg-[#2ED8B6]/20 text-[#2ED8B6] border border-[#2ED8B6]/40 flex items-center justify-center text-xs font-bold shrink-0">
                  U
                </div>
              ) : (
                <img
                  src={emp?.avatarUrl || "/avatars/beaver-manager.jpg"}
                  alt="Avatar"
                  className="w-8 h-8 rounded-xl object-cover border border-[var(--line)] shrink-0"
                />
              )}

              <div className={`space-y-1.5 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
                <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7C8D]">
                  <span className="font-bold text-[#B4C2D0]">
                    {isUser ? "You (CX Lead)" : emp?.name || "Alex — Support Lead"}
                  </span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs leading-relaxed ${
                    isUser
                      ? "bg-[#2ED8B6]/15 border border-[#2ED8B6]/30 text-[#EAF1F8] rounded-tr-none"
                      : "bg-[#18222E] border border-[var(--line-2)] text-[#EAF1F8] rounded-tl-none whitespace-pre-line"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Grounded Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {msg.citations.map((cit, idx) => (
                      <span
                        key={idx}
                        className="pill text-[9px] font-mono flex items-center gap-1 bg-[#121A24] border border-[var(--line)]"
                      >
                        <Shield className="w-2.5 h-2.5 text-[#2ED8B6]" />
                        <span>{cit.title}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested 1-Click Action Buttons */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {msg.suggestedActions.map((act, idx) => (
                      <button
                        key={idx}
                        onClick={() => onChatAction(act)}
                        className="btn btn-secondary py-1 px-2.5 text-[11px] font-mono flex items-center gap-1.5 hover:border-[#2ED8B6] text-[#2ED8B6] cursor-pointer"
                      >
                        <span>{act.label}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3">
            <img
              src={activeEmployee?.avatarUrl || "/avatars/beaver-manager.jpg"}
              alt="Avatar"
              className="w-8 h-8 rounded-xl object-cover border border-[var(--line)] shrink-0 animate-pulse"
            />
            <div className="p-3.5 rounded-2xl bg-[#18222E] border border-[var(--line)] text-xs text-[#6B7C8D] font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2ED8B6] animate-ping" />
              <span>{activeEmployee?.name.split("—")[0]} is analyzing telemetry &amp; knowledge graph...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="bg-[#121A24] border-t border-[#2ED8B6]/20 px-4 sm:px-6 py-2.5 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono text-[#2ED8B6] font-bold uppercase tracking-wider shrink-0">Prompts:</span>
          {suggestions.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSendMessage(sug)}
              className="px-3 py-1 rounded-full bg-[#18222E] hover:bg-[#2ED8B6]/20 hover:text-[#2ED8B6] border border-[var(--line)] hover:border-[#2ED8B6]/50 text-[11px] text-[#B4C2D0] transition-all whitespace-nowrap cursor-pointer shadow-sm"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Query Input Bar with Drag-to-Resize Support */}
      <form onSubmit={handleSend} className="p-3 sm:p-4 bg-[#0E1520] border-t border-[#2ED8B6]/30 shrink-0">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="relative">
            <textarea
              rows={3}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={`Ask ${activeEmployee?.name || "supportV8"} anything... (e.g. "Draft RCA for Stripe webhook timeout", "Summarize refund trends", "Query pgvector for SAML configs")`}
              className="w-full bg-[#18222E] text-[#EAF1F8] p-3.5 pr-14 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] focus:ring-1 focus:ring-[#2ED8B6]/40 font-medium transition-all shadow-inner resize-y min-h-[80px] max-h-[360px] leading-relaxed"
            />
            <div className="absolute right-3.5 top-3.5 text-[#6B7C8D] text-[10px] font-mono pointer-events-none">
              ↵ ENTER
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 text-[11px] font-mono text-[#6B7C8D]">
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline">Press <strong className="text-[#EAF1F8]">Enter ↵</strong> to send</span>
              <span className="hidden sm:inline">&bull;</span>
              <span className="hidden sm:inline"><strong className="text-[#EAF1F8]">Shift + Enter</strong> for new line</span>
              <span className="hidden md:inline">&bull;</span>
              <span className="text-[#2ED8B6] flex items-center gap-1">
                <span>Drag bottom-right ⤡ to expand</span>
              </span>
            </div>

            <button
              type="submit"
              disabled={!inputQuery.trim() || loading}
              className="btn btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 disabled:opacity-40 cursor-pointer shadow-md shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  );
}

"use client";

import React from "react";
import { ArrowRight, Brain, Check, CheckCircle2, Copy, Edit3, ExternalLink, HardHat, Layers, Search, Sparkles, X } from "@/components/ui/FlatIcon";
import type { Issue, PriorityLevel, SentimentClass } from "@/lib/types";

export interface IssuesExplorerViewProps {
  currentTenantSlug: string;
  explorerEditAssignee: string;
  explorerEditCategory: string;
  explorerEditPriority: PriorityLevel;
  explorerEditRecommendedAction: string;
  explorerEditSentiment: SentimentClass;
  explorerEditStatus: string;
  explorerEditSummary: string;
  explorerNewNoteText: string;
  filteredIssues: Issue[];
  handleAddExplorerNote: () => Promise<void>;
  handleExplorerIndexToRag: () => Promise<void>;
  handleExplorerStatusChange: (newStatus: string) => Promise<void>;
  handleOpenRawSource: (issue: Issue) => void;
  handleSaveExplorerEdits: () => Promise<void>;
  isExplorerEditMode: boolean;
  isExplorerSaving: boolean;
  issueSearch: string;
  issueSentimentFilter: string;
  issueSourceFilter: string;
  notify: (text: string, type?: "success" | "error" | "info") => void;
  openWorkspaceTicket: (id: string) => void;
  rawSourceIssue: Issue | null;
  selectedIssue: Issue | null;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  setExplorerEditAssignee: React.Dispatch<React.SetStateAction<string>>;
  setExplorerEditCategory: React.Dispatch<React.SetStateAction<string>>;
  setExplorerEditPriority: React.Dispatch<React.SetStateAction<PriorityLevel>>;
  setExplorerEditRecommendedAction: React.Dispatch<React.SetStateAction<string>>;
  setExplorerEditSentiment: React.Dispatch<React.SetStateAction<SentimentClass>>;
  setExplorerEditStatus: React.Dispatch<React.SetStateAction<string>>;
  setExplorerEditSummary: React.Dispatch<React.SetStateAction<string>>;
  setExplorerNewNoteText: React.Dispatch<React.SetStateAction<string>>;
  setIsExplorerEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  setIssueSearch: React.Dispatch<React.SetStateAction<string>>;
  setIssueSentimentFilter: React.Dispatch<React.SetStateAction<string>>;
  setIssueSourceFilter: React.Dispatch<React.SetStateAction<string>>;
  setRawSourceIssue: React.Dispatch<React.SetStateAction<Issue | null>>;
  setSelectedIssue: React.Dispatch<React.SetStateAction<Issue | null>>;
}

export function IssuesExplorerView({
  currentTenantSlug,
  explorerEditAssignee,
  explorerEditCategory,
  explorerEditPriority,
  explorerEditRecommendedAction,
  explorerEditSentiment,
  explorerEditStatus,
  explorerEditSummary,
  explorerNewNoteText,
  filteredIssues,
  handleAddExplorerNote,
  handleExplorerIndexToRag,
  handleExplorerStatusChange,
  handleOpenRawSource,
  handleSaveExplorerEdits,
  isExplorerEditMode,
  isExplorerSaving,
  issueSearch,
  issueSentimentFilter,
  issueSourceFilter,
  notify,
  openWorkspaceTicket,
  rawSourceIssue,
  selectedIssue,
  setActiveTab,
  setExplorerEditAssignee,
  setExplorerEditCategory,
  setExplorerEditPriority,
  setExplorerEditRecommendedAction,
  setExplorerEditSentiment,
  setExplorerEditStatus,
  setExplorerEditSummary,
  setExplorerNewNoteText,
  setIsExplorerEditMode,
  setIssueSearch,
  setIssueSentimentFilter,
  setIssueSourceFilter,
  setRawSourceIssue,
  setSelectedIssue,
}: IssuesExplorerViewProps) {
  return (
<div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 card p-5 rounded-2xl">
              <div>
                <h2 className="text-lg font-bold text-[#EAF1F8]">Issues Explorer</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 w-full sm:w-80 md:w-96 min-w-0 sm:min-w-[340px] flex items-center">
                  <Search className="w-3.5 h-3.5 absolute left-3 text-[#6B7C8D] pointer-events-none z-10" />
                  <input
                    type="text"
                    value={issueSearch}
                    onChange={(e) => setIssueSearch(e.target.value)}
                    placeholder="Search issues, tags, customers..."
                    className="w-full bg-[#18222E] text-xs text-[#EAF1F8] !pl-9 pr-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none focus:border-[#2ED8B6] transition-colors"
                  />
                </div>

                <select
                  value={issueSentimentFilter}
                  onChange={(e) => setIssueSentimentFilter(e.target.value)}
                  className="bg-[#18222E] text-xs text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer shrink-0"
                >
                  <option value="all">All Sentiments</option>
                  <option value="urgent">Urgent</option>
                  <option value="angry">Angry</option>
                  <option value="frustrated">Frustrated</option>
                  <option value="neutral">Neutral</option>
                  <option value="positive">Positive</option>
                </select>

                <select
                  value={issueSourceFilter}
                  onChange={(e) => setIssueSourceFilter(e.target.value)}
                  className="bg-[#18222E] text-xs text-[#EAF1F8] px-3 py-2 rounded-xl border border-[var(--line-2)] focus:outline-none cursor-pointer shrink-0"
                >
                  <option value="all">All Sources</option>
                  <option value="manual">Manual Operator</option>
                  <option value="chat">Live Chat</option>
                  <option value="email">Email</option>
                  <option value="voice">Voice</option>
                </select>
              </div>
            </div>

            {/* Full-Width Issues Table */}
            <div className="card p-5 overflow-hidden w-full rounded-2xl bg-[#121A24] border-[var(--line)]">
              <div className="overflow-x-auto">
                <table className="gv8-table w-full">
                  <thead>
                    <tr>
                      <th>Source / Issue ID</th>
                      <th>Customer &amp; Tier</th>
                      <th>Summary &amp; Category</th>
                      <th>Sentiment</th>
                      <th>AI Confidence</th>
                      <th>Problem Link</th>
                      <th>Assigned Agent</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-[#8E9AA8]">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[#182635] border border-[#2ED8B6]/30 flex items-center justify-center text-[#2ED8B6]">
                              <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-bold text-[#EAF1F8]">No Issues</h4>
                              <p className="text-xs text-[#6B7C8D] max-w-md mx-auto">
                                {currentTenantSlug === "acme"
                                  ? "All issues have been resolved or filtered out."
                                  : `Workspace '${currentTenantSlug}' is clean and operational. Inbound customer tickets from live chat, webhooks, or email will appear here in real-time.`}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredIssues.map((issue) => (
                        <tr
                          key={issue.id}
                          onClick={() => setSelectedIssue(issue)}
                          className={`cursor-pointer transition-colors hover:bg-[#18222E]/60 ${
                            selectedIssue?.id === issue.id ? "bg-[#18222E] border-l-2 border-[#2ED8B6]" : ""
                          }`}
                        >
                          <td className="font-mono">
                            <span className="font-bold text-[#EAF1F8] text-xs block">{issue.externalId}</span>
                            <span className="pill text-[9px] uppercase mt-0.5 inline-block">{issue.source}</span>
                          </td>
                        <td>
                          <div className="font-bold text-[#EAF1F8] text-xs">{issue.customerName}</div>
                          <span className="text-[10px] text-[#6B7C8D] font-mono">{issue.customerTier} Tier</span>
                        </td>
                        <td>
                          <div className="font-medium text-[#EAF1F8] text-xs leading-snug">{issue.summary}</div>
                          <div className="text-[10px] text-[#2ED8B6] font-mono mt-0.5">{issue.category}</div>
                        </td>
                        <td>
                          <span
                            className={`pill text-[10px] ${
                              issue.sentiment === "urgent" || issue.sentiment === "angry"
                                ? "err"
                                : issue.sentiment === "frustrated"
                                ? "warn"
                                : "ok"
                            }`}
                          >
                            <i className="dot"></i>
                            {issue.sentiment}
                          </span>
                        </td>
                        <td className="font-mono text-xs font-bold text-[#4CC38A]">
                          {(issue.confidence * 100).toFixed(0)}%
                        </td>
                        <td className="font-mono text-xs">
                          {issue.problemId ? (
                            <span className="pill ok text-[10px]">
                              <i className="dot"></i>
                              {issue.problemId}
                            </span>
                          ) : (
                            <span className="text-[#6B7C8D] text-xs">—</span>
                          )}
                        </td>
                        <td className="text-xs text-[#B4C2D0] font-mono">
                          {issue.assignedTo || "Unassigned"}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setSelectedIssue(issue)}
                              className="btn btn-secondary text-xs py-1 px-2.5 font-mono cursor-pointer hover:text-[#2ED8B6] hover:border-[#2ED8B6] flex items-center gap-1.5"
                            >
                              <span>Inspect Details</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRawSource(issue);
                              }}
                              className="btn btn-secondary p-1.5 rounded-lg inline-flex items-center text-[#6B7C8D] hover:text-[#2ED8B6] hover:border-[#2ED8B6] cursor-pointer"
                              title={issue.sourceUrl ? `Open Raw Source (${issue.sourceUrl})` : "Open Raw Source"}
                              aria-label="Open Raw Source"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* COMPREHENSIVE TICKET INSPECTOR & EDIT SUITE SLIDE-OVER DRAWER */}
            {/* ========================================================================= */}
            {selectedIssue && (
              <>
                {/* Backdrop Blur Overlay */}
                <div
                  className="fixed inset-0 z-40 bg-[#0B1017]/70 backdrop-blur-sm transition-opacity"
                  onClick={() => {
                    setSelectedIssue(null);
                    setIsExplorerEditMode(false);
                  }}
                />

                {/* Floating Slide-over Drawer Panel */}
                <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[390px] bg-[#0C121A] border-l border-[var(--line)] shadow-2xl p-3.5 overflow-y-auto flex flex-col justify-between space-y-3 animate-in slide-in-from-right duration-200 text-xs">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                      <div className="min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs font-extrabold text-[#2ED8B6]">{selectedIssue.externalId}</span>
                          <span className="pill uppercase text-[9px] font-mono">{selectedIssue.source}</span>
                          <span className="pill uppercase text-[9px] font-mono">{selectedIssue.category}</span>
                          <span
                            className={`pill text-[9px] uppercase font-mono font-bold ${
                              selectedIssue.status === "escalated"
                                ? "bg-[#E5484D]/20 text-[#FF7575] border border-[#E5484D]/40"
                                : selectedIssue.status === "resolved"
                                ? "bg-[#4CC38A]/20 text-[#4CC38A] border border-[#4CC38A]/40"
                                : selectedIssue.status === "in_progress"
                                ? "bg-[#4D9FFF]/20 text-[#4D9FFF] border border-[#4D9FFF]/40"
                                : "bg-[#18222E] text-[#2ED8B6] border border-[#2ED8B6]/30"
                            }`}
                          >
                            <i className="dot"></i>
                            {selectedIssue.status || "open"}
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-[#EAF1F8] mt-1 truncate">
                          {selectedIssue.summary}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsExplorerEditMode(!isExplorerEditMode)}
                          className={`p-1.5 rounded-lg text-xs font-mono flex items-center gap-1 cursor-pointer border transition-colors ${
                            isExplorerEditMode
                              ? "bg-[#2ED8B6] text-[#04201C] border-[#2ED8B6] font-bold"
                              : "bg-[#18222E] hover:bg-[#1E2B3A] text-[#2ED8B6] border-[var(--line-2)]"
                          }`}
                          title="Edit Ticket Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{isExplorerEditMode ? "Cancel" : "Edit"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedIssue(null);
                            setIsExplorerEditMode(false);
                          }}
                          className="p-1.5 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Interactive 5-Button Status Lifecycle Bar */}
                    <div className="p-1.5 rounded-xl bg-[#121A24] border border-[var(--line)]">
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { id: "open", label: "Open", color: "bg-[#18222E] text-[#2ED8B6] border-[#2ED8B6]" },
                          { id: "in_progress", label: "In Prog", color: "bg-[#4D9FFF]/20 text-[#4D9FFF] border-[#4D9FFF]" },
                          { id: "escalated", label: "Escalate", color: "bg-[#E5484D]/20 text-[#FF7575] border-[#E5484D]" },
                          { id: "resolved", label: "Resolve", color: "bg-[#4CC38A]/20 text-[#4CC38A] border-[#4CC38A]" },
                          { id: "closed", label: "Close", color: "bg-[#6B7C8D]/20 text-[#8E9AA8] border-[#6B7C8D]" },
                        ].map((st) => {
                          const isActive = (selectedIssue.status || "open") === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => handleExplorerStatusChange(st.id)}
                              className={`py-1 px-0.5 rounded-lg text-[10px] font-mono font-bold text-center border transition-all cursor-pointer ${
                                isActive
                                  ? `${st.color} shadow-sm ring-1 ring-white/20`
                                  : "bg-[#0E1520] border-[var(--line)] text-[#6B7C8D] hover:text-[#EAF1F8]"
                              }`}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* IN-DRAWER EDIT MODE FORM */}
                    {isExplorerEditMode ? (
                      <div className="card p-3 bg-[#141C26] border border-[#2ED8B6]/40 rounded-xl space-y-2.5 animate-in fade-in-50 duration-150">
                        <div className="flex items-center justify-between border-b border-[var(--line)] pb-1.5 text-xs font-mono text-[#2ED8B6] font-bold">
                          <span className="flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit Ticket #{selectedIssue.externalId}</span>
                          </span>
                          <span className="text-[10px] text-[#8E9AA8]">Direct Update</span>
                        </div>

                        <div className="space-y-2 text-xs font-mono">
                          <div>
                            <label className="text-[10px] text-[#8E9AA8] block mb-1">Issue Summary / Title</label>
                            <input
                              type="text"
                              value={explorerEditSummary}
                              onChange={(e) => setExplorerEditSummary(e.target.value)}
                              className="w-full bg-[#0E1520] text-xs text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6]"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#8E9AA8] block mb-1">Category</label>
                              <input
                                type="text"
                                value={explorerEditCategory}
                                onChange={(e) => setExplorerEditCategory(e.target.value)}
                                className="w-full bg-[#0E1520] text-xs text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6]"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-[#8E9AA8] block mb-1">Priority</label>
                              <select
                                value={explorerEditPriority}
                                onChange={(e) => setExplorerEditPriority(e.target.value as any)}
                                className="w-full bg-[#0E1520] text-xs text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                              >
                                <option value="urgent">Urgent</option>
                                <option value="high">High</option>
                                <option value="normal">Normal</option>
                                <option value="low">Low</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#8E9AA8] block mb-1">Status</label>
                              <select
                                value={explorerEditStatus}
                                onChange={(e) => setExplorerEditStatus(e.target.value)}
                                className="w-full bg-[#0E1520] text-xs text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                              >
                                <option value="open">Open</option>
                                <option value="in_progress">In Progress</option>
                                <option value="escalated">Escalated</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-[#8E9AA8] block mb-1">Sentiment</label>
                              <select
                                value={explorerEditSentiment}
                                onChange={(e) => setExplorerEditSentiment(e.target.value as any)}
                                className="w-full bg-[#0E1520] text-xs text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6] cursor-pointer"
                              >
                                <option value="urgent">Urgent</option>
                                <option value="angry">Angry</option>
                                <option value="frustrated">Frustrated</option>
                                <option value="neutral">Neutral</option>
                                <option value="positive">Positive</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-[#8E9AA8] block mb-1">Assigned Agent</label>
                            <input
                              type="text"
                              value={explorerEditAssignee}
                              onChange={(e) => setExplorerEditAssignee(e.target.value)}
                              className="w-full bg-[#0E1520] text-xs text-[#EAF1F8] px-2.5 py-1.5 rounded-lg border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-[#8E9AA8] block mb-1">AI Recommendation</label>
                            <textarea
                              rows={2}
                              value={explorerEditRecommendedAction}
                              onChange={(e) => setExplorerEditRecommendedAction(e.target.value)}
                              className="w-full bg-[#0E1520] text-xs text-[#EAF1F8] p-2 rounded-lg border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6] resize-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                          <button
                            type="button"
                            onClick={() => setIsExplorerEditMode(false)}
                            className="btn btn-secondary text-xs px-2.5 py-1 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveExplorerEdits}
                            disabled={isExplorerSaving}
                            className="btn btn-primary text-xs px-3.5 py-1 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{isExplorerSaving ? "Saving..." : "Save"}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Customer Snapshot */}
                        <div className="p-2.5 rounded-xl bg-[#141C26] border border-[var(--line)] space-y-1 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[#EAF1F8]">{selectedIssue.customerName}</span>
                            <span className="pill ok uppercase text-[9px]">{selectedIssue.customerTier} Tier</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[10px] text-[#6B7C8D] font-mono pt-0.5">
                            <div>
                              <span>Ref:</span> <strong className="text-[#EAF1F8]">{selectedIssue.customerRef || "CUST-9921"}</strong>
                            </div>
                            <div>
                              <span>Risk:</span> <strong className="text-[#F5A623]">{selectedIssue.resolutionRiskScore || "0.18"}</strong>
                            </div>
                            <div>
                              <span>Channel:</span> <strong className="text-[#2ED8B6] uppercase">{selectedIssue.source}</strong>
                            </div>
                            <div>
                              <span>Agent:</span> <strong className="text-[#EAF1F8]">{selectedIssue.assignedTo || "Unassigned"}</strong>
                            </div>
                            <div>
                              <span>Product:</span> <strong className="text-[#EAF1F8]">{selectedIssue.product}</strong>
                            </div>
                            <div>
                              <span>Confidence:</span> <strong className="text-[#4CC38A]">{(selectedIssue.confidence * 100).toFixed(0)}%</strong>
                            </div>
                          </div>
                        </div>

                        {/* Contractor / Field Ops Dispatch Card */}
                        {selectedIssue.contractor && (
                          <div className="p-2.5 rounded-xl bg-[#141C26] border border-[#F5A623]/40 space-y-1.5 text-[11px] font-mono">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 text-[#F5A623] font-bold">
                                <HardHat className="w-3.5 h-3.5" />
                                <span>Field Dispatch</span>
                              </span>
                              <span className="pill warn text-[9px] uppercase font-bold">{selectedIssue.contractor.dispatchStatus}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1 text-[10px] text-[#8E9AA8]">
                              <div>
                                <span>Company:</span> <strong className="text-[#EAF1F8]">{selectedIssue.contractor.company}</strong>
                              </div>
                              <div>
                                <span>Tech:</span> <strong className="text-[#EAF1F8]">{selectedIssue.contractor.contactName}</strong>
                              </div>
                              <div>
                                <span>Site:</span> <strong className="text-[#EAF1F8]">{selectedIssue.contractor.siteLocation}</strong>
                              </div>
                              <div>
                                <span>Trade:</span> <strong className="text-[#EAF1F8]">{selectedIssue.contractor.trade}</strong>
                              </div>
                            </div>
                            {selectedIssue.contractor.accessCode && (
                              <div className="flex items-center justify-between p-1 rounded bg-[#0E1520] border border-[var(--line)] text-[10px]">
                                <span className="text-[#6B7C8D]">PIN:</span>
                                <span className="font-bold text-[#F5A623]">{selectedIssue.contractor.accessCode}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* AI Triage & Reasoning */}
                        <div className="p-2.5 rounded-xl bg-[#141C26] border border-[var(--line)] space-y-1 text-[11px]">
                          <span className="text-[#2ED8B6] font-mono uppercase text-[10px] font-bold block">
                            AI Recommendation
                          </span>
                          <p className="text-[#B4C2D0] text-[11px] leading-relaxed">
                            {selectedIssue.recommendedAction || "Autonomous assessment completed. Ready for dispatch."}
                          </p>
                        </div>

                        {/* 1-Click Save Resolution to Knowledge Base (RAG) */}
                        <div className="p-2 rounded-xl bg-[#141C26] border border-[var(--line)] flex items-center justify-between">
                          <div className="text-xs font-bold text-[#EAF1F8] flex items-center gap-1.5">
                            <Brain className="w-3.5 h-3.5 text-[#2ED8B6]" />
                            <span>Knowledge RAG</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleExplorerIndexToRag}
                            disabled={selectedIssue.ragIngested}
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all border ${
                              selectedIssue.ragIngested
                                ? "bg-[#4CC38A]/20 text-[#4CC38A] border-[#4CC38A]/40"
                                : "bg-[#182635] hover:bg-[#203348] text-[#2ED8B6] border-[#2ED8B6]/50"
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{selectedIssue.ragIngested ? "Indexed" : "Index RAG"}</span>
                          </button>
                        </div>

                        {/* Correlated Problem Incident */}
                        {selectedIssue.problemId && (
                          <div className="p-2 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/30 space-y-1 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-[#E5484D] font-bold font-mono text-[10px]">Problem</span>
                              <span className="pill err text-[9px]">{selectedIssue.problemId}</span>
                            </div>
                          </div>
                        )}

                        {/* Ticket Activity Timeline & Internal Notes */}
                        <div className="space-y-1 pt-0.5">
                          <span className="text-[#6B7C8D] font-mono uppercase text-[10px] font-bold block">
                            Timeline
                          </span>

                          <div className="p-2 rounded-xl bg-[#141C26] border border-[var(--line)] space-y-1.5">
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={explorerNewNoteText}
                                onChange={(e) => setExplorerNewNoteText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleAddExplorerNote();
                                  }
                                }}
                                placeholder="Add note..."
                                className="flex-1 bg-[#0E1520] text-xs text-[#EAF1F8] px-2 py-1 rounded-lg border border-[var(--line)] focus:outline-none focus:border-[#2ED8B6]"
                              />
                              <button
                                type="button"
                                onClick={handleAddExplorerNote}
                                className="btn btn-secondary text-xs px-2 py-1 cursor-pointer font-bold"
                              >
                                Post
                              </button>
                            </div>

                            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                              {(selectedIssue.timeline || [
                                {
                                  id: "tl_init",
                                  timestamp: "Initial Ingest",
                                  actor: "Omnichannel Ingress",
                                  actorType: "system",
                                  action: `Ticket ingested from ${selectedIssue.source}`,
                                },
                              ]).map((ev) => (
                                <div key={ev.id} className="p-1.5 rounded-lg bg-[#0E1520] border border-[var(--line)] text-xs font-mono flex items-start justify-between gap-1.5">
                                  <div>
                                    <div className="font-bold text-[#EAF1F8] text-[10px]">{ev.action}</div>
                                    {ev.details && <div className="text-[9px] text-[#8E9AA8]">{ev.details}</div>}
                                  </div>
                                  <span className="text-[9px] text-[#6B7C8D] shrink-0">{ev.timestamp}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-2.5 border-t border-[var(--line)] flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        openWorkspaceTicket(selectedIssue.id);
                        setSelectedIssue(null);
                        setActiveTab("workspace");
                        notify(`Opened ${selectedIssue.externalId} in Focused Work Desk`, "info");
                      }}
                      className="btn btn-primary w-full py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Open Desk</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExplorerStatusChange("resolved")}
                        className="btn btn-secondary flex-1 py-1 text-xs flex items-center justify-center gap-1 cursor-pointer hover:text-[#4CC38A] hover:border-[#4CC38A]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenRawSource(selectedIssue)}
                        className="btn btn-secondary py-1 px-2.5 text-xs flex items-center gap-1 cursor-pointer hover:text-[#2ED8B6]"
                        title={selectedIssue.sourceUrl ? `Open Raw Source (${selectedIssue.sourceUrl})` : "Open Raw Source"}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Raw Source</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRawSourceIssue(selectedIssue)}
                        className="btn btn-secondary py-1 px-2 text-xs flex items-center gap-1 cursor-pointer hover:text-[#2ED8B6]"
                        title="View Raw Ingestion Payload"
                      >
                        <span>JSON</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ========================================================================= */}
            {/* RAW SOURCE INGESTION MODAL */}
            {/* ========================================================================= */}
            {rawSourceIssue && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B1017]/80 backdrop-blur-sm animate-in fade-in duration-150"
                onClick={() => setRawSourceIssue(null)}
              >
                <div
                  className="w-full max-w-lg bg-[#0C121A] border border-[var(--line)] rounded-2xl shadow-2xl p-3.5 flex flex-col gap-2.5 font-mono animate-in zoom-in-95 duration-150 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-[#EAF1F8]">Raw Source</h3>
                          <span className="pill ok text-[9px] uppercase">{rawSourceIssue.source}</span>
                        </div>
                        <span className="text-[10px] text-[#6B7C8D] block">{rawSourceIssue.externalId}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRawSourceIssue(null)}
                      className="p-1 rounded-lg hover:bg-[#18222E] text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-[#121A24] border border-[var(--line)] text-[10px]">
                    <div>
                      <span className="text-[#6B7C8D] block">Format:</span>
                      <span className="text-[#2ED8B6] font-bold">application/json</span>
                    </div>
                    <div>
                      <span className="text-[#6B7C8D] block">Channel:</span>
                      <span className="text-[#EAF1F8] uppercase font-bold">{rawSourceIssue.source}</span>
                    </div>
                    <div>
                      <span className="text-[#6B7C8D] block">Customer:</span>
                      <span className="text-[#EAF1F8] truncate block">{rawSourceIssue.customerName}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-[#8E9AA8]">
                      <span>Ingested Payload</span>
                      <span>UTF-8</span>
                    </div>
                    <pre className="p-2.5 rounded-xl bg-[#080D14] border border-[var(--line)] text-[#2ED8B6] text-[10px] leading-relaxed max-h-52 overflow-auto font-mono select-all">
                      {JSON.stringify({
                        externalId: rawSourceIssue.externalId,
                        source: rawSourceIssue.source,
                        sourceUrl: rawSourceIssue.sourceUrl,
                        customer: {
                          name: rawSourceIssue.customerName,
                          tier: rawSourceIssue.customerTier,
                          ref: rawSourceIssue.customerRef,
                        },
                        summary: rawSourceIssue.summary,
                        category: rawSourceIssue.category,
                        priority: rawSourceIssue.priority,
                        sentiment: {
                          class: rawSourceIssue.sentiment,
                          score: rawSourceIssue.sentimentScore,
                          trajectory: rawSourceIssue.sentimentTrajectory,
                        },
                        triage: {
                          confidence: rawSourceIssue.confidence,
                          assignedTo: rawSourceIssue.assignedTo,
                          recommendedAction: rawSourceIssue.recommendedAction,
                        },
                        tags: rawSourceIssue.tags,
                        createdAt: rawSourceIssue.createdAt,
                        updatedAt: rawSourceIssue.updatedAt,
                      }, null, 2)}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                    <a
                      href={rawSourceIssue.sourceUrl || `https://${currentTenantSlug}.support.servicev8.com/tickets/${rawSourceIssue.externalId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 text-[#8E9AA8] hover:text-[#EAF1F8]"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Source Link</span>
                    </a>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(rawSourceIssue, null, 2));
                          notify("Raw JSON payload copied to clipboard", "success");
                        }}
                        className="btn btn-primary text-xs py-1 px-2.5 font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy JSON</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRawSourceIssue(null)}
                        className="btn btn-secondary text-xs py-1 px-2.5 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
  );
}

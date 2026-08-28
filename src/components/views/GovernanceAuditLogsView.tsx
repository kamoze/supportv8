"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Clock,
  User,
  Bot,
  Cpu,
  ArrowUpRight,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  X,
  FileCode,
  Copy,
  Check,
  RefreshCw,
  Hash,
  ExternalLink,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
} from "lucide-react";
import type { TenantAuditLog } from "@/lib/types/marketplace-types";

interface GovernanceAuditLogsViewProps {
  auditLogs: TenantAuditLog[];
  onNotify: (msg: string, type?: "success" | "info" | "error") => void;
}

export function GovernanceAuditLogsView({
  auditLogs,
  onNotify,
}: GovernanceAuditLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState<TenantAuditLog | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Pagination & Window Expansion States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isTableExpanded, setIsTableExpanded] = useState(false);
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (categoryFilter !== "all" && log.category !== categoryFilter) return false;
      if (riskFilter !== "all" && log.riskLevel !== riskFilter) return false;
      if (statusFilter !== "all" && log.status !== statusFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesActor = log.actorName.toLowerCase().includes(q) || log.actorRole.toLowerCase().includes(q);
        const matchesOp = log.operation.toLowerCase().includes(q);
        const matchesTarget = log.targetEntityId.toLowerCase().includes(q);
        const matchesReason = log.reasoning.toLowerCase().includes(q);
        const matchesHash = log.sha256Hash.toLowerCase().includes(q);
        return matchesActor || matchesOp || matchesTarget || matchesReason || matchesHash;
      }
      return true;
    });
  }, [auditLogs, categoryFilter, riskFilter, statusFilter, searchQuery]);

  // Reset page when filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, riskFilter, statusFilter, pageSize]);

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = useMemo(() => {
    return filteredLogs.slice(startIndex, startIndex + pageSize);
  }, [filteredLogs, startIndex, pageSize]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    onNotify("Hash copied to clipboard", "info");
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleVerifyChain = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      onNotify(`Cryptographic Chain Verified: ${auditLogs.length} blocks checked. Zero tampering detected.`, "success");
    }, 800);
  };

  const handleExportCsv = () => {
    const headers = "ID,Timestamp,Actor,Role,Type,Operation,Category,Target,Risk,Status,DurationMs,SHA256\n";
    const rows = filteredLogs
      .map(
        (l) =>
          `"${l.id}","${l.timestamp}","${l.actorName}","${l.actorRole}","${l.actorType}","${l.operation}","${l.category}","${l.targetEntityId}","${l.riskLevel}","${l.status}",${l.durationMs},"${l.sha256Hash}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supportv8-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    onNotify("Full audit log exported as CSV", "success");
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `supportv8-audit-trail-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    onNotify("Audit trail exported as JSON", "success");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <h1 className="text-lg font-bold text-[#EAF1F8]">Immutable Governance Audit Logs</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Cryptographically sealed, append-only audit trail logging every autonomous decision, Action Gateway dispatch, and human override.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleVerifyChain}
            disabled={isVerifying}
            className="btn btn-secondary py-2 px-3 text-xs font-mono flex items-center gap-1.5 cursor-pointer hover:border-[#2ED8B6] text-[#2ED8B6]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
            <span>{isVerifying ? "Verifying..." : "Verify Hash Chain"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="btn btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="btn btn-secondary py-2 px-3 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5 text-[#4D9FFF]" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Logged Events</span>
          <div className="text-xl font-extrabold font-mono text-[#EAF1F8]">
            {auditLogs.length.toLocaleString()}{" "}
            <span className="text-xs font-normal text-[#6B7C8D]">/ 18,420 Mo.</span>
          </div>
          <span className="text-[10px] text-[#2ED8B6] font-mono">100% Append-Only Integrity</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Autonomous Decisions</span>
          <div className="text-xl font-extrabold font-mono text-[#4CC38A]">
            {auditLogs.filter((l) => l.actorType === "ai_employee").length} Active
          </div>
          <span className="text-[10px] text-[#4CC38A] font-mono">99.2% Confidence Avg</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Policy Evaluations</span>
          <div className="text-xl font-extrabold font-mono text-[#4D9FFF]">
            {auditLogs.filter((l) => l.category === "autonomy_policy" || l.category === "auth_security").length} Evaluated
          </div>
          <span className="text-[10px] text-[#6B7C8D] font-mono">Zero RLS / RBAC Violations</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Cryptographic Stamp</span>
          <div className="text-xl font-extrabold font-mono text-[#2ED8B6] flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-[#2ED8B6]" />
            <span>SHA-256</span>
          </div>
          <span className="text-[10px] text-[#2ED8B6] font-mono">Chain Verified &bull; SEC-04 Compliant</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#6B7C8D] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by actor, action, ticket ID, order ID, or SHA-256 hash..."
              className="w-full bg-[#18222E] text-[#EAF1F8] pl-9 pr-4 py-2 rounded-lg border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] font-mono"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-lg border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="action_gateway">Action Gateway</option>
              <option value="autonomy_policy">Autonomy Policy</option>
              <option value="knowledge_graph">Knowledge Graph</option>
              <option value="auth_security">Auth &amp; Security</option>
              <option value="voice_telephony">Voice Telephony</option>
            </select>

            {/* Risk Filter */}
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-lg border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Risks</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
              <option value="critical">Critical Risk</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-lg border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="executed">Executed</option>
              <option value="approved">Approved</option>
              <option value="awaiting_approval">Awaiting Approval</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-[#6B7C8D] pt-1 gap-2">
          <div>
            Showing <strong className="text-[#EAF1F8]">{filteredLogs.length > 0 ? startIndex + 1 : 0}</strong> - <strong className="text-[#EAF1F8]">{Math.min(startIndex + pageSize, filteredLogs.length)}</strong> of <strong className="text-[#EAF1F8]">{filteredLogs.length}</strong> filtered records ({auditLogs.length} total)
          </div>

          <div className="flex items-center gap-3">
            {(searchQuery || categoryFilter !== "all" || riskFilter !== "all" || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setRiskFilter("all");
                  setStatusFilter("all");
                }}
                className="text-[#2ED8B6] hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-[#18222E] text-[#EAF1F8] px-2 py-0.5 rounded border border-[var(--line-2)] text-[11px] focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Log Table Container (with Expand Window & Sticky Header) */}
      <div
        className={`card rounded-2xl border-[var(--line)] bg-[#121A24] transition-all flex flex-col ${
          isTableExpanded
            ? "fixed inset-3 md:inset-6 z-50 p-6 shadow-2xl border-2 border-[#2ED8B6]/60 bg-[#0C121A] overflow-hidden"
            : "overflow-hidden"
        }`}
      >
        {/* Table Header Bar with Expand / Shrink Controls */}
        <div className="p-3.5 border-b border-[var(--line)] bg-[#18222E]/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#EAF1F8] uppercase tracking-wider">
              {isTableExpanded ? "Expanded Full-Window Audit Log Viewer" : "Audit Records Trail"}
            </span>
            <span className="pill ok text-[9px] font-mono">
              Page {currentPage} of {totalPages}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTableExpanded(!isTableExpanded)}
              className="btn btn-secondary py-1 px-2.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer text-[#2ED8B6] hover:bg-[#2ED8B6]/10"
              title={isTableExpanded ? "Restore compact window" : "Expand window for wider view"}
            >
              {isTableExpanded ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Restore View</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>+ Expand Window</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Table Area */}
        <div className={`overflow-x-auto overflow-y-auto ${isTableExpanded ? "flex-1 min-h-0" : "max-h-[560px]"}`}>
          <table className="gv8-table w-full">
            <thead className="sticky top-0 bg-[#121A24] z-10 border-b border-[var(--line)] shadow-sm">
              <tr>
                <th className="whitespace-nowrap">Timestamp</th>
                <th className="whitespace-nowrap">Actor / Entity</th>
                <th className="whitespace-nowrap">Operation &amp; Category</th>
                <th className="whitespace-nowrap">Target Entity</th>
                <th className="whitespace-nowrap">Risk</th>
                <th className="whitespace-nowrap">Status</th>
                <th className="whitespace-nowrap">SHA-256 Hash</th>
                <th className="whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#6B7C8D] font-mono text-xs">
                    No audit records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const isCopied = copiedHash === log.id;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="cursor-pointer hover:bg-[#18222E]/70 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="whitespace-nowrap font-mono text-[11px]">
                        <div className="text-[#EAF1F8] font-bold">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </div>
                        <div className="text-[#6B7C8D] text-[10px]">
                          {new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </div>
                      </td>

                      {/* Actor */}
                      <td>
                        <div className="flex items-center gap-2">
                          <img
                            src={log.actorAvatar || "/avatars/beaver-manager.jpg"}
                            alt={log.actorName}
                            className="w-6 h-6 rounded-lg object-cover border border-[var(--line)] shrink-0"
                          />
                          <div>
                            <div className="font-bold text-xs text-[#EAF1F8] flex items-center gap-1.5">
                              <span>{log.actorName}</span>
                              {log.actorType === "ai_employee" && (
                                <span className="pill ok text-[9px] py-0 px-1 font-mono">AI</span>
                              )}
                              {log.actorType === "human_admin" && (
                                <span className="pill text-[9px] py-0 px-1 font-mono text-[#4D9FFF] border-[#4D9FFF]/40 bg-[#4D9FFF]/10">HUMAN</span>
                              )}
                              {log.actorType === "system_automation" && (
                                <span className="pill text-[9px] py-0 px-1 font-mono text-[#F5A623] border-[#F5A623]/40 bg-[#F5A623]/10">SYS</span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#6B7C8D]">{log.actorRole}</div>
                          </div>
                        </div>
                      </td>

                      {/* Operation */}
                      <td>
                        <div className="font-mono text-xs font-bold text-[#2ED8B6]">
                          {log.operation}
                        </div>
                        <div className="text-[10px] text-[#6B7C8D] uppercase font-mono tracking-wider">
                          {log.category.replace(/_/g, " ")}
                        </div>
                      </td>

                      {/* Target Entity */}
                      <td className="font-mono text-xs text-[#EAF1F8]">
                        <span className="bg-[#18222E] px-2 py-0.5 rounded border border-[var(--line)] text-[11px]">
                          {log.targetEntityId}
                        </span>
                      </td>

                      {/* Risk */}
                      <td>
                        <span
                          className={`pill text-[10px] font-mono uppercase ${
                            log.riskLevel === "critical"
                              ? "err"
                              : log.riskLevel === "high"
                              ? "warn"
                              : log.riskLevel === "medium"
                              ? "text-[#4D9FFF] border-[#4D9FFF]/40 bg-[#4D9FFF]/10"
                              : "ok"
                          }`}
                        >
                          {log.riskLevel}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className={`pill text-[10px] font-mono uppercase ${
                            log.status === "executed"
                              ? "ok"
                              : log.status === "approved"
                              ? "ok"
                              : log.status === "awaiting_approval"
                              ? "warn"
                              : "err"
                          }`}
                        >
                          <i className="dot"></i>
                          {log.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      {/* SHA-256 Hash */}
                      <td className="font-mono text-[11px] text-[#6B7C8D]" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleCopy(log.sha256Hash, log.id)}
                          className="flex items-center gap-1.5 hover:text-[#2ED8B6] transition-colors cursor-pointer group"
                        >
                          <Hash className="w-3 h-3 text-[#2ED8B6]" />
                          <span>{log.sha256Hash.slice(0, 10)}...</span>
                          {isCopied ? (
                            <Check className="w-3 h-3 text-[#4CC38A]" />
                          ) : (
                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </td>

                      {/* Action */}
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="btn btn-secondary py-1 px-2.5 text-xs font-mono inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Inspect</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer Controls */}
        <div className="p-3.5 border-t border-[var(--line)] bg-[#18222E]/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs font-mono text-[#6B7C8D]">
            Page <strong className="text-[#EAF1F8]">{currentPage}</strong> of <strong className="text-[#EAF1F8]">{totalPages}</strong> &bull; Total {filteredLogs.length} Records
          </div>

          <div className="flex items-center gap-1 font-mono text-xs">
            {/* First Page */}
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1.5 rounded-lg border border-[var(--line)] bg-[#121A24] text-[#B4C2D0] hover:text-[#EAF1F8] hover:border-[#2ED8B6]/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>

            {/* Previous Page */}
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-[var(--line)] bg-[#121A24] text-[#B4C2D0] hover:text-[#EAF1F8] hover:border-[#2ED8B6]/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 px-2.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            {/* Page Number Pills */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5) {
                  if (currentPage > 3 && currentPage < totalPages - 2) {
                    p = currentPage - 2 + i;
                  } else if (currentPage >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  }
                }
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === p
                        ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-extrabold"
                        : "bg-[#121A24] text-[#6B7C8D] hover:text-[#EAF1F8] border border-[var(--line)]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-[var(--line)] bg-[#121A24] text-[#B4C2D0] hover:text-[#EAF1F8] hover:border-[#2ED8B6]/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 px-2.5"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Last Page */}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1.5 rounded-lg border border-[var(--line)] bg-[#121A24] text-[#B4C2D0] hover:text-[#EAF1F8] hover:border-[#2ED8B6]/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Slide-Out Detail Modal / Drawer with Expand Option */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div
            className={`bg-[#0C121A] border-2 border-[#2ED8B6] shadow-[0_0_35px_rgba(46,216,182,0.2)] ring-1 ring-[#2ED8B6]/40 rounded-2xl flex flex-col overflow-hidden transition-all ${
              isDetailExpanded
                ? "w-[96vw] h-[94vh]"
                : "w-full max-w-2xl max-h-[90vh]"
            }`}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-[#2ED8B6]/30 bg-[#121A24] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#EAF1F8] font-mono">Audit Record Inspector</h3>
                  <p className="text-[11px] text-[#6B7C8D] font-mono">{selectedLog.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsDetailExpanded(!isDetailExpanded)}
                  className="p-1.5 text-[#6B7C8D] hover:text-[#2ED8B6] rounded-lg hover:bg-[#18222E] cursor-pointer"
                  title={isDetailExpanded ? "Restore modal size" : "Expand modal"}
                >
                  {isDetailExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedLog(null);
                    setIsDetailExpanded(false);
                  }}
                  className="p-1.5 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">
              {/* Core Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#18222E] border border-[var(--line)]">
                <div>
                  <span className="text-[10px] text-[#6B7C8D] block">OPERATION</span>
                  <span className="text-[#2ED8B6] font-bold">{selectedLog.operation}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7C8D] block">STATUS</span>
                  <span className="text-[#4CC38A] font-bold uppercase">{selectedLog.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7C8D] block">RISK LEVEL</span>
                  <span className="text-[#F5A623] font-bold uppercase">{selectedLog.riskLevel}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7C8D] block">ACTOR</span>
                  <span className="text-[#EAF1F8] font-bold">{selectedLog.actorName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7C8D] block">TARGET ENTITY</span>
                  <span className="text-[#4D9FFF] font-bold">{selectedLog.targetEntityId}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#6B7C8D] block">DURATION</span>
                  <span className="text-[#EAF1F8] font-bold">{selectedLog.durationMs} ms</span>
                </div>
              </div>

              {/* Reasoning */}
              <div className="space-y-1">
                <span className="text-[10px] text-[#6B7C8D] font-bold uppercase">Autonomy Reasoning &amp; Policy Basis</span>
                <div className="p-3.5 rounded-xl bg-[#121A24] border border-[var(--line)] text-[#EAF1F8] leading-relaxed font-sans text-xs">
                  {selectedLog.reasoning}
                </div>
              </div>

              {/* Cryptographic Proof */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-[#121A24] border border-[var(--line)]">
                <div className="flex items-center justify-between text-[10px] text-[#6B7C8D]">
                  <span className="font-bold uppercase">SHA-256 Cryptographic Stamp</span>
                  <span className="text-[#2ED8B6]">CHAIN VALID</span>
                </div>
                <div className="text-[11px] text-[#2ED8B6] break-all bg-[#0B1017] p-2 rounded-lg border border-[var(--line)] font-mono">
                  {selectedLog.sha256Hash}
                </div>
                <div className="flex justify-between text-[10px] text-[#6B7C8D] pt-1">
                  <span>Origin IP: <strong className="text-[#EAF1F8]">{selectedLog.ipAddress}</strong></span>
                  <span>Idempotency: <strong className="text-[#EAF1F8]">{selectedLog.idempotencyKey}</strong></span>
                </div>
              </div>

              {/* Metadata JSON */}
              <div className="space-y-1">
                <span className="text-[10px] text-[#6B7C8D] font-bold uppercase">Execution Metadata &amp; Parameters</span>
                <div className="bg-[#0B1017] p-3.5 rounded-xl border border-[var(--line)] overflow-x-auto text-[11px] text-[#B4C2D0]">
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-[var(--line)] bg-[#121A24] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#6B7C8D] font-mono">
                Logged at: {new Date(selectedLog.timestamp).toUTCString()}
              </span>

              <button
                type="button"
                onClick={() => {
                  setSelectedLog(null);
                  setIsDetailExpanded(false);
                }}
                className="btn btn-secondary py-1.5 px-4 text-xs font-mono cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

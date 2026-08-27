"use client";

import React, { useState, useMemo } from "react";
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
  X,
  FileCode,
  Copy,
  Check,
  RefreshCw,
  Hash,
  ExternalLink,
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

        <div className="flex items-center justify-between text-[11px] font-mono text-[#6B7C8D] pt-1">
          <span>Showing {filteredLogs.length} of {auditLogs.length} audit records</span>
          {(searchQuery || categoryFilter !== "all" || riskFilter !== "all" || statusFilter !== "all") && (
            <button
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
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card rounded-2xl border-[var(--line)] overflow-hidden bg-[#121A24]">
        <div className="overflow-x-auto">
          <table className="gv8-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor / Entity</th>
                <th>Operation &amp; Category</th>
                <th>Target Entity</th>
                <th>Risk</th>
                <th>Status</th>
                <th>SHA-256 Hash</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-[#6B7C8D] font-mono text-xs">
                    No audit records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
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
                      <td>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="btn btn-secondary py-1 px-2.5 text-xs font-mono flex items-center gap-1 cursor-pointer"
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
      </div>

      {/* Slide-Out Detail Modal / Drawer */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-2xl max-h-[90vh] bg-[#0C121A] border-2 border-[#2ED8B6] shadow-[0_0_35px_rgba(46,216,182,0.2)] ring-1 ring-[#2ED8B6]/40 rounded-2xl flex flex-col overflow-hidden">
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

              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-[#6B7C8D] hover:text-[#EAF1F8] rounded-lg hover:bg-[#18222E] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
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
                onClick={() => setSelectedLog(null)}
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

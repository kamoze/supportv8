"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  X,
  Shield,
  Bot,
  User,
  Zap,
  ChevronDown,
  ChevronUp,
} from "@/components/ui/FlatIcon";

export interface PendingApproval {
  id: string;
  actionId: string;
  employeeName: string;
  employeeAvatar?: string;
  actionType: string;
  payload: Record<string, any>;
  riskScore: number;
  explanation: string;
  status: "pending" | "approved" | "rejected";
  timestamp: string;
}

interface WorkforceApprovalsViewProps {
  onNotify?: (text: string, type?: "success" | "error" | "info") => void;
}

const INITIAL_APPROVALS: PendingApproval[] = [
  {
    id: "app_101",
    actionId: "act_refund_9941",
    employeeName: "Sophia — Customer Support Lead",
    employeeAvatar: "/avatars/beaver-sophia.jpg",
    actionType: "orderv8.refund",
    payload: {
      orderId: "ORD-99412",
      customerId: "CUST-8821",
      refundAmount: 49.0,
      currency: "USD",
      reason: "Double-charge on step 3 checkout glitch",
    },
    riskScore: 0.72,
    explanation: "Customer was charged twice within 30 seconds due to a 504 gateway timeout. Autonomy policy permits refunds up to $25 without review; $49.00 requires supervisor sign-off.",
    status: "pending",
    timestamp: "5 mins ago",
  },
  {
    id: "app_102",
    actionId: "act_override_sla_881",
    employeeName: "Arthur — Autonomous Auditor",
    employeeAvatar: "/avatars/beaver-arthur.jpg",
    actionType: "ticket.sla_override",
    payload: {
      ticketId: "ISS-1004",
      customerName: "Global Logistics Inc.",
      newSlaTargetMinutes: 240,
      reason: "Carrier API outage upstream (FedEx/UPS webhook delay)",
    },
    riskScore: 0.65,
    explanation: "External carrier latency exceeds SLA window. Extension requested to prevent false positive SLA penalty breach.",
    status: "pending",
    timestamp: "18 mins ago",
  },
  {
    id: "app_103",
    actionId: "act_kb_auto_publish_302",
    employeeName: "Vivian — Knowledge Specialist",
    employeeAvatar: "/avatars/beaver-vivian.jpg",
    actionType: "knowledge.publish_article",
    payload: {
      articleTitle: "Resolving 504 Gateway Timeouts During Peak Checkout",
      targetCategory: "billing_errors",
      confidence: 0.94,
    },
    riskScore: 0.58,
    explanation: "Correlated 43 resolved tickets to author a new public RAG document for portal indexing.",
    status: "pending",
    timestamp: "42 mins ago",
  },
];

export function WorkforceApprovalsView({ onNotify }: WorkforceApprovalsViewProps) {
  const [approvals, setApprovals] = useState<PendingApproval[]>(INITIAL_APPROVALS);
  const [expandedPayloadIds, setExpandedPayloadIds] = useState<Set<string>>(new Set());
  const [decidedHistory, setDecidedHistory] = useState<Array<PendingApproval & { decidedAt: string }>>([
    {
      id: "app_100",
      actionId: "act_refund_9910",
      employeeName: "Sophia — Customer Support Lead",
      actionType: "orderv8.refund",
      payload: { orderId: "ORD-99011", refundAmount: 19.99 },
      riskScore: 0.35,
      explanation: "Approved refund for damaged item packaging.",
      status: "approved",
      timestamp: "2 hours ago",
      decidedAt: "Today at 09:12",
    },
  ]);

  const togglePayload = (id: string) => {
    setExpandedPayloadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDecision = (actionId: string, decision: "approved" | "rejected") => {
    const target = approvals.find((a) => a.actionId === actionId);
    if (!target) return;

    setApprovals((prev) => prev.filter((a) => a.actionId !== actionId));
    setDecidedHistory((prev) => [
      { ...target, status: decision, decidedAt: "Just now" },
      ...prev,
    ]);

    if (onNotify) {
      onNotify(
        `${decision === "approved" ? "Approved" : "Rejected"} request ${target.actionType} for ${target.employeeName}`,
        decision === "approved" ? "success" : "info",
      );
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Top Overview Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Workforce Autonomy Approvals</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Autonomous actions proposed by hired AI employees that exceed configured autonomy thresholds require human sign-off before execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="pill warn text-xs font-mono font-bold">
            {approvals.length} PENDING REVIEW
          </span>
          <span className="pill ok text-xs font-mono">
            {decidedHistory.length} DECIDED TODAY
          </span>
        </div>
      </div>

      {/* Main Approval Queue */}
      <div className="card p-6 rounded-2xl border border-[var(--line)] bg-[#0E1520] space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#2ED8B6]" />
            <h2 className="text-sm font-bold text-[#EAF1F8]">Pending Autonomy Action Queue</h2>
          </div>
          <span className="text-[11px] text-[#6B7C8D] font-mono">{approvals.length} requests waiting</span>
        </div>

        {approvals.length > 0 ? (
          <div className="space-y-3">
            {approvals.map((app) => {
              const isExpanded = expandedPayloadIds.has(app.id);
              return (
                <div
                  key={app.id}
                  className="card p-5 rounded-xl border border-[var(--line)] bg-[#121A24] hover:border-[#2ED8B6]/30 transition-all space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] flex items-center justify-center font-mono font-bold text-xs">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#EAF1F8] text-sm">{app.actionType}</span>
                          <span className="pill warn text-[10px] font-mono">
                            Risk: {(app.riskScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-[#6B7C8D] mt-0.5">{app.employeeName} &bull; {app.timestamp}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDecision(app.actionId, "rejected")}
                        className="btn btn-secondary text-xs py-2 px-3.5 cursor-pointer flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5 text-[#F55252]" />
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(app.actionId, "approved")}
                        className="btn btn-primary text-xs py-2 px-4 cursor-pointer flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve &amp; Dispatch</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#B4C2D0] leading-relaxed bg-[#0C121A] p-3 rounded-lg border border-[var(--line)]">
                    {app.explanation}
                  </p>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => togglePayload(app.id)}
                      className="text-[#2ED8B6] hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <span>{isExpanded ? "Hide Action Payload" : "View Action Payload"}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <span className="text-[#6B7C8D] font-mono text-[10px]">Action ID: {app.actionId}</span>
                  </div>

                  {isExpanded && (
                    <pre className="p-3 rounded-lg bg-[#080D14] text-[#2ED8B6] font-mono text-[11px] overflow-x-auto border border-[var(--line)]">
                      {JSON.stringify(app.payload, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#2ED8B6]/15 text-[#2ED8B6] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#EAF1F8]">No Pending Approvals</h3>
            <p className="text-xs text-[#6B7C8D] max-w-md mx-auto">
              All autonomous operations are within configured policy thresholds. New high-risk actions will appear here for manager authorization.
            </p>
          </div>
        )}
      </div>

      {/* Decided History Section */}
      {decidedHistory.length > 0 && (
        <div className="card p-6 rounded-2xl border border-[var(--line)] bg-[#0E1520] space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6B7C8D]" />
              <h2 className="text-sm font-bold text-[#EAF1F8]">Recent Approval Decisions</h2>
            </div>
            <span className="text-[11px] text-[#6B7C8D] font-mono">Audit Log Synced</span>
          </div>

          <div className="space-y-2">
            {decidedHistory.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#141C26] border border-[var(--line)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-[#EAF1F8]">{item.actionType}</span>
                    <span
                      className={`pill text-[10px] font-mono uppercase ${
                        item.status === "approved" ? "ok" : "err"
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-[#6B7C8D] font-mono text-[10px]">{item.employeeName}</span>
                  </div>
                  <p className="text-[11px] text-[#B4C2D0] truncate max-w-2xl">{item.explanation}</p>
                </div>

                <span className="text-[10px] text-[#6B7C8D] font-mono shrink-0">{item.decidedAt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

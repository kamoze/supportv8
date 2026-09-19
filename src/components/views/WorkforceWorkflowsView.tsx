"use client";

import React, { useState } from "react";
import {
  Layers,
  Zap,
  Play,
  Bot,
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Settings,
  RefreshCw,
} from "@/components/ui/FlatIcon";

export type WorkflowNode = {
  id: string;
  type: "trigger" | "agent" | "condition" | "action";
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  config: Record<string, string | number | boolean>;
};

export type WorkflowPipeline = {
  id: string;
  name: string;
  description: string;
  category: "Finance" | "Tickets" | "Hygiene" | "VIP Care";
  active: boolean;
  triggerType: "Schedule (Cron)" | "Event Listener" | "Webhook" | "Manual";
  lastRun?: string;
  lastStatus?: "SUCCESS" | "FAILED" | "PENDING_APPROVAL";
  runsCount: number;
  nodes: WorkflowNode[];
};

const STARTER_WORKFLOWS: WorkflowPipeline[] = [
  {
    id: "wf-eod-summary",
    name: "End-of-Day Customer Support Summary & Email Digest",
    description: "Triggers automatically at 5:00 PM daily. Arthur reconciles customer tickets, refunds, and CSAT scores, synthesizes SLA attainment, and dispatches an executive digest to management.",
    category: "Finance",
    active: true,
    triggerType: "Schedule (Cron)",
    lastRun: "Today at 17:00:02",
    lastStatus: "SUCCESS",
    runsCount: 142,
    nodes: [
      {
        id: "n-1",
        type: "trigger",
        title: "Daily Cron Trigger",
        subtitle: "Every Day at 5:00 PM (17:00 EST)",
        icon: "⏰",
        color: "#38BDF8",
        config: { cronExpression: "0 17 * * *", timezone: "America/New_York" },
      },
      {
        id: "n-2",
        type: "agent",
        title: "Arthur • Autonomous Auditor",
        subtitle: "Reconcile Tickets vs Refunds",
        icon: "🦫",
        color: "#34D399",
        config: { employeePersona: "Arthur", task: "Reconcile daily tickets, CSAT %, and refunds." },
      },
      {
        id: "n-3",
        type: "condition",
        title: "Check Unresolved Variances",
        subtitle: "If unresolved escalations > 0",
        icon: "⚖️",
        color: "#FBBF24",
        config: { conditionField: "escalated_tickets", operator: "> 0" },
      },
      {
        id: "n-4",
        type: "action",
        title: "Send Executive Digest (Email / Slack)",
        subtitle: "leadership@acme.com, #support-exec",
        icon: "✉️",
        color: "#A78BFA",
        config: { template: "executive_support_digest" },
      },
    ],
  },
  {
    id: "wf-dormant-sweeper",
    name: "Dormant Ticket Backlog Hygiene & Auto-Close Sweep",
    description: "Daily automated sweep identifying customer support tickets inactive for >14 days. Drafts gentle resolution notices and archives safe tickets.",
    category: "Hygiene",
    active: true,
    triggerType: "Schedule (Cron)",
    lastRun: "Today at 03:00:10",
    lastStatus: "SUCCESS",
    runsCount: 310,
    nodes: [
      {
        id: "n-1",
        type: "trigger",
        title: "Nightly Cron Trigger",
        subtitle: "Daily at 03:00 AM UTC",
        icon: "🌙",
        color: "#38BDF8",
        config: { cronExpression: "0 3 * * *" },
      },
      {
        id: "n-2",
        type: "agent",
        title: "Sophia • Support Lead",
        subtitle: "Identify Stale Work Candidates",
        icon: "🦫",
        color: "#34D399",
        config: { employeePersona: "Sophia", tool: "stale_work_sweep" },
      },
      {
        id: "n-3",
        type: "action",
        title: "Batch Resolution Notice",
        subtitle: "Close dormant cases & notify",
        icon: "⚡",
        color: "#2ED8B6",
        config: { autoClose: true, retentionWindowDays: 14 },
      },
    ],
  },
  {
    id: "wf-vip-churn-fast-track",
    name: "VIP Churn Risk & Sentiment Pre-Breach Alert",
    description: "Real-time event listener monitoring NLP sentiment across omnichannel ingress. Automatically escalates frustrated Enterprise customers to human leads.",
    category: "VIP Care",
    active: true,
    triggerType: "Event Listener",
    lastRun: "8 mins ago",
    lastStatus: "SUCCESS",
    runsCount: 88,
    nodes: [
      {
        id: "n-1",
        type: "trigger",
        title: "Real-Time NLP Sentiment Stream",
        subtitle: "Ingress on Chat & Tickets",
        icon: "📡",
        color: "#F43F5E",
        config: { eventTopic: "chat.message.analyzed" },
      },
      {
        id: "n-2",
        type: "condition",
        title: "Frustration & Tier Filter",
        subtitle: "Sentiment == Angry AND Tier == Enterprise",
        icon: "🔍",
        color: "#FBBF24",
        config: { filter: "sentiment == 'angry' && tier == 'enterprise'" },
      },
      {
        id: "n-3",
        type: "action",
        title: "Slack Priority Broadcast & PagerDuty",
        subtitle: "Channel #cx-vip-escalations",
        icon: "🚨",
        color: "#FB7185",
        config: { priority: "P1_URGENT" },
      },
    ],
  },
];

interface WorkforceWorkflowsViewProps {
  onNotify?: (text: string, type?: "success" | "error" | "info") => void;
}

export function WorkforceWorkflowsView({ onNotify }: WorkforceWorkflowsViewProps) {
  const [pipelines, setPipelines] = useState<WorkflowPipeline[]>(STARTER_WORKFLOWS);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(STARTER_WORKFLOWS[0].id);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0];

  const handleToggleActive = (id: string) => {
    setPipelines((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const next = !p.active;
          if (onNotify) onNotify(`Workflow '${p.name}' is now ${next ? "ACTIVE" : "PAUSED"}`, "info");
          return { ...p, active: next };
        }
        return p;
      })
    );
  };

  const handleTriggerRun = (p: WorkflowPipeline) => {
    setExecutingId(p.id);
    setTimeout(() => {
      setExecutingId(null);
      setPipelines((prev) =>
        prev.map((item) =>
          item.id === p.id
            ? {
                ...item,
                lastRun: "Just now",
                lastStatus: "SUCCESS",
                runsCount: item.runsCount + 1,
              }
            : item
        )
      );
      if (onNotify) onNotify(`Triggered workflow '${p.name}' successfully! Nodes executed without error.`, "success");
    }, 900);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
              <Layers className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Support Workflow Pipelines</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Autonomous end-to-end execution pipelines connecting triggers, AI digital employees, policy gates, and external communication actions.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="pill ok">
            {pipelines.filter((p) => p.active).length} Active Pipelines
          </span>
          <span className="pill text-[10px] bg-[#18222E] border border-[var(--line)] text-[#B4C2D0]">
            Temporal Orchestrated
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pipeline List */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-xs font-bold text-[#6B7C8D] uppercase tracking-wider font-mono">
            Configured Pipelines ({pipelines.length})
          </h2>

          <div className="space-y-2">
            {pipelines.map((p) => {
              const isSelected = p.id === selectedPipelineId;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedPipelineId(p.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? "bg-[#141C26] border-[#2ED8B6]/50 shadow-md ring-1 ring-[#2ED8B6]/20"
                      : "bg-[#0E1520] border-[var(--line)] hover:border-[var(--line-2)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold text-[#EAF1F8] leading-snug">{p.name}</h3>
                    <span
                      className={`pill text-[9px] font-mono shrink-0 uppercase ${
                        p.active ? "ok" : "border-[#6B7C8D]/40 text-[#6B7C8D]"
                      }`}
                    >
                      {p.active ? "ACTIVE" : "PAUSED"}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#B4C2D0] line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-2 border-t border-[var(--line)]">
                    <span>{p.triggerType}</span>
                    <span>{p.runsCount} runs</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Pipeline Node Canvas */}
        <div className="lg:col-span-8 card p-6 rounded-2xl border border-[var(--line)] bg-[#121A24] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="pill ok text-[10px] font-mono uppercase">{selectedPipeline.category}</span>
                <h2 className="text-base font-bold text-[#EAF1F8]">{selectedPipeline.name}</h2>
              </div>
              <p className="text-xs text-[#B4C2D0] mt-1">{selectedPipeline.description}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleActive(selectedPipeline.id)}
                className={`btn text-xs py-1.5 px-3 font-mono cursor-pointer ${
                  selectedPipeline.active ? "btn-secondary text-[#E5484D]" : "btn-primary"
                }`}
              >
                {selectedPipeline.active ? "Pause" : "Activate"}
              </button>

              <button
                type="button"
                onClick={() => handleTriggerRun(selectedPipeline)}
                disabled={executingId === selectedPipeline.id}
                className="btn btn-primary text-xs py-1.5 px-4 font-bold flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                {executingId === selectedPipeline.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>Run Now</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Node Flow Diagram */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono font-bold text-[#6B7C8D] uppercase tracking-wider">
              Execution Flow Graph ({selectedPipeline.nodes.length} Stages)
            </h3>

            <div className="space-y-2">
              {selectedPipeline.nodes.map((node, idx) => (
                <div key={node.id} className="relative">
                  <div className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-base border shrink-0"
                        style={{
                          background: `${node.color}18`,
                          borderColor: `${node.color}40`,
                          color: node.color,
                        }}
                      >
                        <span>{node.icon}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#EAF1F8]">{node.title}</span>
                          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">
                            Stage {idx + 1} • {node.type}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#B4C2D0] mt-0.5">{node.subtitle}</p>
                      </div>
                    </div>

                    <span className="pill ok text-[9px] font-mono">READY</span>
                  </div>

                  {idx < selectedPipeline.nodes.length - 1 && (
                    <div className="flex justify-center py-1">
                      <div className="w-0.5 h-4 bg-[#2ED8B6]/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry Summary */}
          <div className="p-4 rounded-xl bg-[#0B1017] border border-[var(--line)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div>
              <span className="text-[#6B7C8D] block text-[10px]">Trigger Mechanism</span>
              <span className="text-[#EAF1F8] font-bold">{selectedPipeline.triggerType}</span>
            </div>
            <div>
              <span className="text-[#6B7C8D] block text-[10px]">Lifetime Invocations</span>
              <span className="text-[#2ED8B6] font-bold">{selectedPipeline.runsCount} executions</span>
            </div>
            <div>
              <span className="text-[#6B7C8D] block text-[10px]">Last Status</span>
              <span className="text-[#2ED8B6] font-bold">{selectedPipeline.lastStatus || "NOMINAL"}</span>
            </div>
            <div>
              <span className="text-[#6B7C8D] block text-[10px]">Last Run Time</span>
              <span className="text-[#EAF1F8]">{selectedPipeline.lastRun || "Never"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

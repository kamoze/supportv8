"use client";

import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Sliders,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileCode,
  DollarSign,
  UserCheck,
  Lock,
  Headphones,
  Eye,
  Trash2,
  Edit2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Layers,
  HelpCircle,
  X,
} from "lucide-react";
import type { SupportPolicy, PolicyRule, OperatingMode } from "@/lib/types";

interface PoliciesAndRulesViewProps {
  policy: SupportPolicy;
  onUpdatePolicy: (updated: SupportPolicy) => void;
  onNotify: (msg: string, type?: "success" | "info" | "error") => void;
}

export function PoliciesAndRulesView({
  policy,
  onUpdatePolicy,
  onNotify,
}: PoliciesAndRulesViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<"rules" | "guardrails" | "queues" | "scheduler" | "simulator">("rules");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  // Rules list state
  const [rules, setRules] = useState<PolicyRule[]>(policy.rules || []);

  // Modal States
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PolicyRule | null>(null);

  // Ingest Queues State
  const [queues, setQueues] = useState<Array<{
    id: string;
    name: string;
    ingestType: "chat" | "voice" | "email" | "contractor_sms" | "api_webhook";
    assignedOperator: string;
    slaTargetMinutes: number;
    priorityWeight: number;
    autoEscalateFrustrated: boolean;
    status: "active" | "paused";
  }>>([
    {
      id: "q_chat_live",
      name: "Omnichannel Live Chat Queue",
      ingestType: "chat",
      assignedOperator: "Alex — Support Intelligence Lead (AI)",
      slaTargetMinutes: 15,
      priorityWeight: 10,
      autoEscalateFrustrated: true,
      status: "active",
    },
    {
      id: "q_voice_vip",
      name: "VIP Telephony & Emergency Voice Queue",
      ingestType: "voice",
      assignedOperator: "Sophia — Enterprise Relationship Manager (AI)",
      slaTargetMinutes: 5,
      priorityWeight: 15,
      autoEscalateFrustrated: true,
      status: "active",
    },
    {
      id: "q_tech_dispatch",
      name: "Field Technician & Lockbox Pass Queue",
      ingestType: "contractor_sms",
      assignedOperator: "Ini Godwin (Escalated Lead)",
      slaTargetMinutes: 30,
      priorityWeight: 8,
      autoEscalateFrustrated: false,
      status: "active",
    },
    {
      id: "q_email_general",
      name: "Asynchronous Email & Web Ticket Queue",
      ingestType: "email",
      assignedOperator: "Barnaby — Knowledge & Runbook Lead (AI)",
      slaTargetMinutes: 60,
      priorityWeight: 5,
      autoEscalateFrustrated: true,
      status: "active",
    },
  ]);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [newQueueName, setNewQueueName] = useState("");
  const [newQueueIngestType, setNewQueueIngestType] = useState<"chat" | "voice" | "email" | "contractor_sms" | "api_webhook">("chat");
  const [newQueueOperator, setNewQueueOperator] = useState("Alex — Support Intelligence Lead (AI)");
  const [newQueueSla, setNewQueueSla] = useState(15);

  // Automation Action Schedulers (Cron Jobs) State
  const [schedules, setSchedules] = useState<Array<{
    id: string;
    name: string;
    cronExpression: string;
    humanSchedule: string;
    actionType: "stale_work_sweep" | "sla_breach_triage" | "vip_retention_sync" | "kb_pgvector_reindex";
    targetPackage: string;
    lastRun: string;
    status: "active" | "paused";
  }>>([
    {
      id: "sched_01",
      name: "Stale Work Nightly Sweeper",
      cronExpression: "0 2 * * *",
      humanSchedule: "Daily at 02:00 UTC",
      actionType: "stale_work_sweep",
      targetPackage: "Autonomous Sweeper & OrderV8 Reconciliation",
      lastRun: "Today at 02:00 UTC (18 tickets closed)",
      status: "active",
    },
    {
      id: "sched_02",
      name: "Hourly SLA Pre-Breach Triage & Urgency Bump",
      cronExpression: "0 * * * *",
      humanSchedule: "Every hour at minute 0",
      actionType: "sla_breach_triage",
      targetPackage: "SLA Sentinel & VIP Executive Escalator",
      lastRun: "34 minutes ago (2 escalated)",
      status: "active",
    },
    {
      id: "sched_03",
      name: "Continuous Knowledge Base RAG & S3 Vector Re-sync",
      cronExpression: "*/30 * * * *",
      humanSchedule: "Every 30 minutes",
      actionType: "kb_pgvector_reindex",
      targetPackage: "Barnaby Vector Grounding & pgvector Indexer",
      lastRun: "12 minutes ago (4 documents synced)",
      status: "active",
    },
  ]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [newSchedName, setNewSchedName] = useState("");
  const [newSchedCron, setNewSchedCron] = useState("0 2 * * *");
  const [newSchedAction, setNewSchedAction] = useState<any>("stale_work_sweep");
  const [newSchedPackage, setNewSchedPackage] = useState("Autonomous Sweeper & OrderV8 Reconciliation");

  // Rule Form Fields
  const [ruleName, setRuleName] = useState("");
  const [ruleCategory, setRuleCategory] = useState<PolicyRule["category"]>("autonomy_risk");
  const [ruleDescription, setRuleDescription] = useState("");
  const [ruleRiskLevel, setRuleRiskLevel] = useState<PolicyRule["riskLevel"]>("medium");
  const [rulePriority, setRulePriority] = useState<number>(3);
  const [ruleCondition, setRuleCondition] = useState("");
  const [ruleActionType, setRuleActionType] = useState<PolicyRule["actionType"]>("auto_execute");
  const [ruleActionDetails, setRuleActionDetails] = useState("");

  // Simulator States
  const [simMessage, setSimMessage] = useState("I demand an immediate refund for double charge on checkout!");
  const [simCustomerTier, setSimCustomerTier] = useState<"standard" | "pro" | "enterprise">("enterprise");
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any | null>(null);

  // Preset loading state
  const [presetLoading, setPresetLoading] = useState(false);

  // Filtered Rules
  const filteredRules = rules.filter((r) => {
    const matchesCat = categoryFilter === "all" || r.category === categoryFilter;
    const matchesRisk = riskFilter === "all" || r.riskLevel === riskFilter;
    const matchesSearch =
      !searchQuery ||
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.condition.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesRisk && matchesSearch;
  });

  // Toggle Rule
  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_rule",
          ruleId,
          ruleUpdates: { enabled },
        }),
      }).then((r) => r.json());

      if (res.success) {
        setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, enabled } : r)));
        onNotify(`Rule ${enabled ? "enabled" : "disabled"} successfully`, "success");
      }
    } catch {
      onNotify("Failed to update rule state", "error");
    }
  };

  // Delete Rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this policy rule?")) return;
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_rule",
          ruleId,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setRules((prev) => prev.filter((r) => r.id !== ruleId));
        onNotify("Policy rule removed", "success");
      }
    } catch {
      onNotify("Failed to delete rule", "error");
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingRule(null);
    setRuleName("");
    setRuleCategory("financial_refund");
    setRuleDescription("");
    setRuleRiskLevel("medium");
    setRulePriority(3);
    setRuleCondition("customerTier == 'vip' AND intent == 'refund' AND amount <= 200");
    setRuleActionType("auto_execute");
    setRuleActionDetails("Dispatch orderv8.order.refund without human gate");
    setIsRuleModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (rule: PolicyRule) => {
    setEditingRule(rule);
    setRuleName(rule.name);
    setRuleCategory(rule.category);
    setRuleDescription(rule.description);
    setRuleRiskLevel(rule.riskLevel);
    setRulePriority(rule.priority);
    setRuleCondition(rule.condition);
    setRuleActionType(rule.actionType);
    setRuleActionDetails(rule.actionDetails);
    setIsRuleModalOpen(true);
  };

  // Save Rule (Create or Update)
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      onNotify("Rule name is required", "error");
      return;
    }

    try {
      if (editingRule) {
        const res = await fetch("/api/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_rule",
            ruleId: editingRule.id,
            ruleUpdates: {
              name: ruleName,
              category: ruleCategory,
              description: ruleDescription,
              riskLevel: ruleRiskLevel,
              priority: Number(rulePriority),
              condition: ruleCondition,
              actionType: ruleActionType,
              actionDetails: ruleActionDetails,
            },
          }),
        }).then((r) => r.json());

        if (res.success) {
          setRules((prev) => prev.map((r) => (r.id === editingRule.id ? res.data : r)));
          onNotify(`Rule '${ruleName}' updated!`, "success");
          setIsRuleModalOpen(false);
        }
      } else {
        const res = await fetch("/api/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_rule",
            rule: {
              name: ruleName,
              category: ruleCategory,
              description: ruleDescription,
              riskLevel: ruleRiskLevel,
              priority: Number(rulePriority),
              condition: ruleCondition,
              actionType: ruleActionType,
              actionDetails: ruleActionDetails,
              enabled: true,
            },
          }),
        }).then((r) => r.json());

        if (res.success) {
          setRules((prev) => [res.data, ...prev]);
          onNotify(`Rule '${ruleName}' created!`, "success");
          setIsRuleModalOpen(false);
        }
      }
    } catch {
      onNotify("Failed to save rule", "error");
    }
  };

  // Apply Preset Profile
  const handleApplyPreset = async (preset: "strict_governance" | "balanced_enterprise" | "high_velocity" | "hipaa_healthcare") => {
    setPresetLoading(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply_preset", preset }),
      }).then((r) => r.json());

      if (res.success) {
        onUpdatePolicy(res.data);
        if (res.data.rules) setRules(res.data.rules);
        onNotify(`Preset '${preset.replace(/_/g, " ").toUpperCase()}' applied successfully!`, "success");
        setIsPresetModalOpen(false);
      }
    } catch {
      onNotify("Failed to apply preset profile", "error");
    } finally {
      setPresetLoading(false);
    }
  };

  // Run Simulator
  const handleRunSimulator = async () => {
    setSimLoading(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "simulate",
          sampleMessage: simMessage,
          customerTier: simCustomerTier,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSimResult(res.data);
        onNotify("Policy sandbox simulation completed!", "success");
      }
    } catch {
      onNotify("Simulation failed", "error");
    } finally {
      setSimLoading(false);
    }
  };

  // Update Guardrail Setting
  const handleUpdateGuardrail = async (key: keyof SupportPolicy, value: any) => {
    const updated = { ...policy, [key]: value };
    onUpdatePolicy(updated);
    try {
      await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          policyUpdates: { [key]: value },
        }),
      });
      onNotify("Guardrail setting saved", "info");
    } catch {
      onNotify("Failed to persist guardrail setting", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card p-6 bg-gradient-to-r from-[#121A24] via-[#15202E] to-[#121A24] border-[var(--line)] flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#2ED8B6]/15 text-[#2ED8B6] border border-[#2ED8B6]/30 shadow-sm">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-[#EAF1F8] tracking-tight">Policies, Rules &amp; Governance Matrix</h1>
          </div>
          <p className="text-xs text-[#B4C2D0]">
            Autonomous execution boundaries, risk ceilings, financial dollar limits, sentiment gates, and regulatory guardrails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsPresetModalOpen(true)}
            className="btn btn-secondary py-2 px-3.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer hover:border-[#2ED8B6]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#2ED8B6]" />
            <span>Apply Preset Profile</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="btn btn-primary py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Policy Rule</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Active Policy Rules</span>
          <div className="text-xl font-extrabold font-mono text-[#EAF1F8]">
            {rules.filter((r) => r.enabled).length}{" "}
            <span className="text-xs font-normal text-[#6B7C8D]">/ {rules.length} Total</span>
          </div>
          <span className="text-[10px] text-[#2ED8B6] font-mono">100% Real-time Enforcement</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Operating Mode</span>
          <div className="text-xl font-extrabold font-mono text-[#4CC38A] uppercase">
            {policy.operatingMode}
          </div>
          <span className="text-[10px] text-[#4CC38A] font-mono">Max Risk: {policy.autonomyThreshold.toUpperCase()}</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Confidence Minimum</span>
          <div className="text-xl font-extrabold font-mono text-[#4D9FFF]">
            {((policy.confidenceMin || 0.85) * 100).toFixed(0)}%
          </div>
          <span className="text-[10px] text-[#6B7C8D] font-mono">Sub-confidence Held for Approval</span>
        </div>

        <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-1">
          <span className="text-[10px] font-mono text-[#6B7C8D] uppercase">Active Guardrails</span>
          <div className="text-xl font-extrabold font-mono text-[#2ED8B6] flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-[#2ED8B6]" />
            <span>4 Shield Layers</span>
          </div>
          <span className="text-[10px] text-[#2ED8B6] font-mono">PII Redaction &bull; Prompt Shield &bull; SLA</span>
        </div>
      </div>

      {/* Sub-View Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#121A24] border border-[var(--line)] font-mono text-xs w-fit">
        <button
          type="button"
          onClick={() => setActiveSubTab("rules")}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "rules"
              ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-extrabold"
              : "text-[#6B7C8D] hover:text-[#EAF1F8]"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Active Rules ({rules.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("guardrails")}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "guardrails"
              ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-extrabold"
              : "text-[#6B7C8D] hover:text-[#EAF1F8]"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Guardrails &amp; Ceilings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("queues")}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "queues"
              ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-extrabold"
              : "text-[#6B7C8D] hover:text-[#EAF1F8]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Ingest Queues &amp; Routing</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("scheduler")}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "scheduler"
              ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-extrabold"
              : "text-[#6B7C8D] hover:text-[#EAF1F8]"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Automation Schedulers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("simulator")}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "simulator"
              ? "bg-[#2ED8B6] text-[#04201C] shadow-sm font-extrabold"
              : "text-[#6B7C8D] hover:text-[#EAF1F8]"
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Policy Simulator</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: ACTIVE POLICY RULES */}
      {/* ========================================================================= */}
      {activeSubTab === "rules" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="card p-4 rounded-xl border-[var(--line)] bg-[#121A24] space-y-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-[#6B7C8D] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rules by name, condition, or action..."
                  className="w-full bg-[#18222E] text-[#EAF1F8] pl-9 pr-4 py-2 rounded-lg border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6] font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-lg border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="all">All Domains</option>
                  <option value="financial_refund">Financial &amp; Refunds</option>
                  <option value="autonomy_risk">Autonomy &amp; Risk</option>
                  <option value="safety_pii">Safety &amp; PII</option>
                  <option value="sla_escalation">SLA &amp; Escalations</option>
                  <option value="voice_telephony">Voice Telephony</option>
                  <option value="security_rbac">Security &amp; RBAC</option>
                </select>

                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="bg-[#18222E] text-[#EAF1F8] px-3 py-2 rounded-lg border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                  <option value="critical">Critical Risk</option>
                </select>
              </div>
            </div>
          </div>

          {/* Rules Grid */}
          <div className="grid grid-cols-1 gap-3.5">
            {filteredRules.length === 0 ? (
              <div className="card p-12 text-center text-[#6B7C8D] font-mono text-xs rounded-2xl bg-[#121A24] border-[var(--line)]">
                No policy rules match the current filters.
              </div>
            ) : (
              filteredRules.map((rule) => {
                const isFinancial = rule.category === "financial_refund";
                const isSafety = rule.category === "safety_pii";
                const isEscalation = rule.category === "sla_escalation";
                return (
                  <div
                    key={rule.id}
                    className={`card p-5 rounded-2xl border transition-all space-y-3.5 ${
                      rule.enabled
                        ? "bg-[#121A24] border-[var(--line)] hover:border-[#2ED8B6]/40"
                        : "bg-[#0E1520] border-[var(--line)] opacity-60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs text-[#2ED8B6]">{rule.id}</span>
                          <h3 className="text-sm font-bold text-[#EAF1F8]">{rule.name}</h3>
                          <span className="pill text-[9px] font-mono uppercase">
                            {rule.category.replace(/_/g, " ")}
                          </span>
                          <span
                            className={`pill text-[9px] font-mono uppercase ${
                              rule.riskLevel === "critical"
                                ? "err"
                                : rule.riskLevel === "high"
                                ? "warn"
                                : rule.riskLevel === "medium"
                                ? "text-[#4D9FFF] border-[#4D9FFF]/40 bg-[#4D9FFF]/10"
                                : "ok"
                            }`}
                          >
                            {rule.riskLevel} RISK
                          </span>
                          <span className="text-[10px] text-[#6B7C8D] font-mono">P{rule.priority}</span>
                        </div>
                        <p className="text-xs text-[#B4C2D0] leading-relaxed">{rule.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                          className={`pill text-[10px] font-mono cursor-pointer transition-all ${
                            rule.enabled ? "ok font-bold" : "border-[#6B7C8D]/40 text-[#6B7C8D]"
                          }`}
                        >
                          <i className="dot"></i>
                          {rule.enabled ? "ACTIVE" : "DISABLED"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(rule)}
                          className="p-1.5 text-[#6B7C8D] hover:text-[#4D9FFF] rounded-lg hover:bg-[#18222E] cursor-pointer"
                          title="Edit Rule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 text-[#6B7C8D] hover:text-[#E5484D] rounded-lg hover:bg-[#18222E] cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Condition & Action Display */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                        <span className="text-[10px] text-[#6B7C8D] uppercase font-bold block">TRIGGER CONDITION:</span>
                        <code className="text-[#2ED8B6] text-[11px] block break-words">{rule.condition}</code>
                      </div>

                      <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1">
                        <span className="text-[10px] text-[#6B7C8D] uppercase font-bold block">AUTONOMOUS ACTION:</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`pill text-[9px] uppercase font-mono ${
                              rule.actionType === "auto_execute"
                                ? "ok"
                                : rule.actionType === "require_approval"
                                ? "warn"
                                : rule.actionType === "block_and_log"
                                ? "err"
                                : "text-[#4D9FFF] border-[#4D9FFF]/40 bg-[#4D9FFF]/10"
                            }`}
                          >
                            {rule.actionType.replace(/_/g, " ")}
                          </span>
                          <span className="text-[#EAF1F8] text-[11px] truncate">{rule.actionDetails}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rule Telemetry Footer */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7C8D] pt-1 border-t border-[var(--line)]">
                      <span>Evaluated &bull; Matched: <strong className="text-[#EAF1F8]">{rule.matchCount} times</strong></span>
                      <span>Last triggered: <strong className="text-[#EAF1F8]">{rule.lastTriggeredAt || "Never"}</strong></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: GUARDRAILS & SAFETY LIMITS */}
      {/* ========================================================================= */}
      {activeSubTab === "guardrails" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Core Autonomy Thresholds */}
          <div className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 text-xs font-mono">
            <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
              <Sliders className="w-4 h-4 text-[#2ED8B6]" />
              <h3 className="text-sm font-bold text-[#EAF1F8] uppercase">Global Autonomy Controls</h3>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[#6B7C8D] block mb-1">Operating Mode</label>
                <select
                  value={policy.operatingMode}
                  onChange={(e) => handleUpdateGuardrail("operatingMode", e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="autonomous">Autonomous (Agents self-resolve within risk thresholds)</option>
                  <option value="human_in_loop">Human in Loop (Dual authorization required for critical mutations)</option>
                  <option value="observe">Observe Only (Read-only analytics &amp; suggestions, mutations blocked)</option>
                  <option value="shadow">Shadow Mode (Parallel simulation without executing mutations)</option>
                </select>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Max Auto-Execute Risk Level</label>
                <select
                  value={policy.autonomyThreshold}
                  onChange={(e) => handleUpdateGuardrail("autonomyThreshold", e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="none">None (Deny all autonomous actions)</option>
                  <option value="read">Read-only (Lookups, telemetry queries)</option>
                  <option value="low">Low Risk (Tagging, prioritization, notes)</option>
                  <option value="medium">Medium Risk (Standard refunds &lt; $150, dispatches)</option>
                  <option value="high">High Risk (Full automated state mutations)</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#6B7C8D]">Autonomous Confidence Minimum Floor</label>
                  <span className="text-[#2ED8B6] font-bold">{((policy.confidenceMin || 0.85) * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="99"
                  value={((policy.confidenceMin || 0.85) * 100).toFixed(0)}
                  onChange={(e) => handleUpdateGuardrail("confidenceMin", Number(e.target.value) / 100)}
                  className="w-full accent-[#2ED8B6] cursor-pointer"
                />
                <span className="text-[10px] text-[#6B7C8D] block mt-1">
                  Decisions with AI confidence score below this threshold will automatically route to human triage.
                </span>
              </div>
            </div>
          </div>

          {/* Safety & Compliance Shields */}
          <div className="card p-5 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-4 text-xs font-mono">
            <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
              <ShieldAlert className="w-4 h-4 text-[#F5A623]" />
              <h3 className="text-sm font-bold text-[#EAF1F8] uppercase">Compliance &amp; Sentiment Interventions</h3>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#18222E] border border-[var(--line)]">
                <div>
                  <div className="text-[#EAF1F8] font-bold">Sentiment Auto-Escalation</div>
                  <div className="text-[10px] text-[#6B7C8D]">Interrupt autonomy and route angry customers to Human SRE Leads.</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateGuardrail("sentimentEscalationEnabled", !policy.sentimentEscalationEnabled)}
                  className={`pill text-[10px] font-mono cursor-pointer ${
                    policy.sentimentEscalationEnabled ? "ok" : "border-[#6B7C8D]/40 text-[#6B7C8D]"
                  }`}
                >
                  {policy.sentimentEscalationEnabled ? "ENABLED" : "DISABLED"}
                </button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#18222E] border border-[var(--line)]">
                <div>
                  <div className="text-[#EAF1F8] font-bold">Proactive Communications Approval Gate</div>
                  <div className="text-[10px] text-[#6B7C8D]">Require human lead signature before sending outbound incident emails.</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateGuardrail("proactiveCommsApprovalRequired", !policy.proactiveCommsApprovalRequired)}
                  className={`pill text-[10px] font-mono cursor-pointer ${
                    policy.proactiveCommsApprovalRequired ? "ok" : "border-[#6B7C8D]/40 text-[#6B7C8D]"
                  }`}
                >
                  {policy.proactiveCommsApprovalRequired ? "ENABLED" : "DISABLED"}
                </button>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1">Raw Context Data Retention (Hours)</label>
                <input
                  type="number"
                  value={policy.retentionRawContextHours || 48}
                  onChange={(e) => handleUpdateGuardrail("retentionRawContextHours", Number(e.target.value))}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: POLICY SIMULATOR & SANDBOX */}
      {/* ========================================================================= */}
      {activeSubTab === "simulator" && (
        <div className="card p-6 rounded-2xl border-[var(--line)] bg-[#121A24] space-y-5">
          <div className="flex items-center gap-2 border-b border-[var(--line)] pb-3">
            <Play className="w-4 h-4 text-[#2ED8B6]" />
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8]">Policy Sandbox &amp; Dry-Run Simulator</h3>
              <p className="text-xs text-[#B4C2D0]">
                Simulate inbound prompts and customer requests against the full policy rule tree to verify autonomous approvals vs. human gates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Sample Inbound Customer Message</label>
                <textarea
                  rows={4}
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  placeholder="Enter sample ticket text or customer query..."
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-3 rounded-xl border border-[var(--line-2)] text-xs leading-relaxed focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Simulated Customer Tier</label>
                <select
                  value={simCustomerTier}
                  onChange={(e) => setSimCustomerTier(e.target.value as any)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="enterprise">Enterprise (VIP Tier)</option>
                  <option value="pro">Pro Tier</option>
                  <option value="standard">Standard Tier</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleRunSimulator}
                disabled={simLoading}
                className="btn btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${simLoading ? "animate-spin" : ""}`} />
                <span>{simLoading ? "Evaluating Policy Tree..." : "Run Sandbox Simulation"}</span>
              </button>
            </div>

            {/* Simulation Results Output */}
            <div className="space-y-3 font-mono text-xs">
              <label className="text-[#6B7C8D] block uppercase text-[10px] font-bold">Policy Evaluation Output</label>
              {simResult ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-[#6B7C8D] uppercase">AUTONOMY DECISION:</span>
                      <span
                        className={`pill text-[10px] font-mono uppercase font-bold ${
                          simResult.autonomyDecision === "allowed_autonomous"
                            ? "ok"
                            : simResult.autonomyDecision === "held_for_approval"
                            ? "warn"
                            : simResult.autonomyDecision === "blocked"
                            ? "err"
                            : "err"
                        }`}
                      >
                        <i className="dot"></i>
                        {simResult.autonomyDecision.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[11px] bg-[#121A24] p-2 rounded-lg border border-[var(--line)]">
                      <div>
                        <span className="text-[#6B7C8D] block text-[9.5px]">CATEGORY</span>
                        <strong className="text-[#2ED8B6]">{simResult.category}</strong>
                      </div>
                      <div>
                        <span className="text-[#6B7C8D] block text-[9.5px]">SENTIMENT</span>
                        <strong className={simResult.sentiment === "angry" ? "text-[#E5484D]" : "text-[#EAF1F8]"}>
                          {simResult.sentiment}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#6B7C8D] block text-[9.5px]">CONFIDENCE</span>
                        <strong className="text-[#4CC38A]">{(simResult.confidence * 100).toFixed(0)}%</strong>
                      </div>
                    </div>

                    <p className="text-[11px] text-[#B4C2D0] leading-relaxed pt-1">
                      {simResult.explanation}
                    </p>
                  </div>

                  {/* Matched Rules */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-[#6B7C8D] uppercase font-bold">MATCHED RULES ({simResult.matchedRules?.length || 0}):</span>
                    <div className="space-y-1.5">
                      {(simResult.matchedRules || []).map((mr: any) => (
                        <div key={mr.id} className="p-2.5 rounded-lg bg-[#18222E] border border-[var(--line)] flex justify-between items-center text-[11px]">
                          <div>
                            <span className="text-[#2ED8B6] font-bold mr-2">{mr.id}</span>
                            <span className="text-[#EAF1F8]">{mr.name}</span>
                          </div>
                          <span className="pill text-[9px] uppercase font-mono">{mr.actionType}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-[#0B1017] border border-[var(--line)] text-center text-[#6B7C8D] italic">
                  Click "Run Sandbox Simulation" to test message against active rules.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 4: INGEST QUEUES & OPERATOR ROUTING */}
      {/* ========================================================================= */}
      {activeSubTab === "queues" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8] font-mono flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#2ED8B6]" />
                <span>Custom Ingest Queues &amp; Operator Routing</span>
              </h3>
              <p className="text-xs text-[#8E9AA8]">
                Route omnichannel inbound channels (Chat, Voice, Email, Contractor SMS) to dedicated AI employees or human lead queues.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsQueueModalOpen(true)}
              className="btn btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Ingest Queue</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {queues.map((q) => (
              <div
                key={q.id}
                className="card p-5 rounded-2xl border border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="pill ok text-[9px] font-mono uppercase font-bold">
                        {q.ingestType}
                      </span>
                      <h4 className="text-xs font-bold text-[#EAF1F8]">{q.name}</h4>
                    </div>
                    <p className="text-[11px] font-mono text-[#6B7C8D]">
                      Queue ID: <strong className="text-[#B4C2D0]">{q.id}</strong>
                    </p>
                  </div>

                  <span
                    className={`pill text-[9px] font-mono ${
                      q.status === "active" ? "ok" : "border-[#6B7C8D]/40 text-[#6B7C8D]"
                    }`}
                  >
                    {q.status.toUpperCase()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#6B7C8D]">Assigned Operator / AI Lead:</span>
                    <span className="text-[#2ED8B6] font-bold">{q.assignedOperator}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--line)]">
                    <span className="text-[#6B7C8D]">SLA Target Response:</span>
                    <span className="text-[#EAF1F8] font-bold">{q.slaTargetMinutes} Minutes</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--line)]">
                    <span className="text-[#6B7C8D]">Priority Weight:</span>
                    <span className="text-[#4D9FFF] font-bold">{q.priorityWeight}x Ingress Multiplier</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--line)]">
                    <span className="text-[#6B7C8D]">Auto-Escalate Frustrated:</span>
                    <span className={q.autoEscalateFrustrated ? "text-[#2ED8B6] font-bold" : "text-[#6B7C8D]"}>
                      {q.autoEscalateFrustrated ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => {
                      setQueues((prev) =>
                        prev.map((item) =>
                          item.id === q.id
                            ? { ...item, status: item.status === "active" ? "paused" : "active" }
                            : item
                        )
                      );
                      onNotify(`Toggled queue ${q.name} status`, "info");
                    }}
                    className="btn btn-secondary py-1 px-3 text-xs font-mono cursor-pointer"
                  >
                    {q.status === "active" ? "Pause Routing" : "Activate Queue"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQueues((prev) => prev.filter((item) => item.id !== q.id));
                      onNotify(`Deleted ingest queue ${q.name}`, "info");
                    }}
                    className="p-1 text-[#6B7C8D] hover:text-[#E5484D] transition-colors cursor-pointer"
                    title="Delete Ingest Queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 5: AUTOMATION ACTION SCHEDULERS (CRON ENGINE) */}
      {/* ========================================================================= */}
      {activeSubTab === "scheduler" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#EAF1F8] font-mono flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#2ED8B6]" />
                <span>Automation Action Schedulers &amp; Cron Triggers</span>
              </h3>
              <p className="text-xs text-[#8E9AA8]">
                Recurring autonomous worker triggers (Stale sweeps, SLA pre-breach alerts, knowledge vector syncs) bound to workforce employee packages.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="btn btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Cron Schedule</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            {schedules.map((sched) => (
              <div
                key={sched.id}
                className="card p-5 rounded-2xl border border-[var(--line)] bg-[#121A24] space-y-4 hover:border-[#2ED8B6]/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <span className="px-2 py-0.5 rounded-lg bg-[#2ED8B6]/15 text-[#2ED8B6] font-bold text-[10px]">
                      {sched.cronExpression}
                    </span>
                    <span
                      className={`pill text-[9px] ${
                        sched.status === "active" ? "ok" : "border-[#6B7C8D]/40 text-[#6B7C8D]"
                      }`}
                    >
                      {sched.status.toUpperCase()}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#EAF1F8] font-sans">{sched.name}</h4>
                    <p className="text-[11px] text-[#6B7C8D] mt-0.5">{sched.humanSchedule}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#18222E] border border-[var(--line)] space-y-1.5 text-[11px]">
                    <div>
                      <span className="text-[#6B7C8D] block text-[9.5px]">TARGET EMPLOYEE PACKAGE</span>
                      <strong className="text-[#B4C2D0]">{sched.targetPackage}</strong>
                    </div>
                    <div className="pt-1 border-t border-[var(--line)]">
                      <span className="text-[#6B7C8D] block text-[9.5px]">LAST EXECUTION</span>
                      <strong className="text-[#2ED8B6]">{sched.lastRun}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]">
                  <button
                    type="button"
                    onClick={() => onNotify(`Dispatched instant manual trigger for ${sched.name}!`, "success")}
                    className="btn btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 cursor-pointer text-[#2ED8B6]"
                  >
                    <Play className="w-3 h-3" />
                    <span>Run Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSchedules((prev) =>
                        prev.map((s) =>
                          s.id === sched.id
                            ? { ...s, status: s.status === "active" ? "paused" : "active" }
                            : s
                        )
                      );
                      onNotify(`Updated schedule ${sched.name} status`, "info");
                    }}
                    className="text-xs text-[#8E9AA8] hover:text-[#EAF1F8] cursor-pointer"
                  >
                    {sched.status === "active" ? "Pause" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT POLICY RULE MODAL */}
      {/* ========================================================================= */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl card shadow-2xl p-6 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">
                  {editingRule ? `Edit Policy Rule (${editingRule.id})` : "Create New Policy Rule"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRuleModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} className="space-y-3.5 text-xs font-mono">
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. VIP Instant Refund Auto-Approval"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Policy Category</label>
                  <select
                    value={ruleCategory}
                    onChange={(e) => setRuleCategory(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="financial_refund">Financial &amp; Refunds</option>
                    <option value="autonomy_risk">Autonomy &amp; Risk</option>
                    <option value="safety_pii">Safety &amp; PII</option>
                    <option value="sla_escalation">SLA &amp; Escalations</option>
                    <option value="voice_telephony">Voice Telephony</option>
                    <option value="security_rbac">Security &amp; RBAC</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Risk Level</label>
                  <select
                    value={ruleRiskLevel}
                    onChange={(e) => setRuleRiskLevel(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="low">Low Risk</option>
                    <option value="medium">Medium Risk</option>
                    <option value="high">High Risk</option>
                    <option value="critical">Critical Risk</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Description</label>
                <input
                  type="text"
                  value={ruleDescription}
                  onChange={(e) => setRuleDescription(e.target.value)}
                  placeholder="Explain why this rule exists and when it triggers..."
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Trigger Condition Expression</label>
                <input
                  type="text"
                  value={ruleCondition}
                  onChange={(e) => setRuleCondition(e.target.value)}
                  placeholder="customerTier == 'vip' AND intent == 'refund' AND amount <= 150"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs font-mono focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Action Decision</label>
                  <select
                    value={ruleActionType}
                    onChange={(e) => setRuleActionType(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="auto_execute">Auto-Execute (No gate)</option>
                    <option value="require_approval">Require Approval Gate</option>
                    <option value="escalate_to_lead">Escalate to CX Lead</option>
                    <option value="block_and_log">Block &amp; Log Security Audit</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Priority (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={rulePriority}
                    onChange={(e) => setRulePriority(Number(e.target.value))}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Action Execution Details</label>
                <input
                  type="text"
                  value={ruleActionDetails}
                  onChange={(e) => setRuleActionDetails(e.target.value)}
                  placeholder="e.g. Dispatch orderv8.order.refund without human gate"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsRuleModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs font-bold shadow-md"
                >
                  {editingRule ? "Save Changes" : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* APPLY PRESET PROFILE MODAL */}
      {/* ========================================================================= */}
      {isPresetModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg card shadow-2xl p-6 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">Apply Governance Preset Profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPresetModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div
                onClick={() => handleApplyPreset("balanced_enterprise")}
                className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] hover:border-[#2ED8B6] cursor-pointer transition-all space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#EAF1F8]">Balanced Enterprise (Recommended)</span>
                  <span className="pill ok text-[9px] font-mono">AUTONOMOUS</span>
                </div>
                <p className="text-[11px] text-[#B4C2D0]">
                  Medium-risk threshold, 85% confidence floor, auto-refunds up to $150, sentiment auto-escalation enabled.
                </p>
              </div>

              <div
                onClick={() => handleApplyPreset("strict_governance")}
                className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] hover:border-[#2ED8B6] cursor-pointer transition-all space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#EAF1F8]">Strict Governance / Human in Loop</span>
                  <span className="pill warn text-[9px] font-mono">HUMAN GATED</span>
                </div>
                <p className="text-[11px] text-[#B4C2D0]">
                  95% confidence floor, all financial refunds require human approval, proactive communications gated.
                </p>
              </div>

              <div
                onClick={() => handleApplyPreset("high_velocity")}
                className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] hover:border-[#2ED8B6] cursor-pointer transition-all space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#EAF1F8]">High-Velocity Autonomous</span>
                  <span className="pill ok text-[9px] font-mono">FULL AUTONOMY</span>
                </div>
                <p className="text-[11px] text-[#B4C2D0]">
                  High risk limit, 75% confidence floor, maximal multi-agent self-resolution across all channels.
                </p>
              </div>

              <div
                onClick={() => handleApplyPreset("hipaa_healthcare")}
                className="p-4 rounded-xl bg-[#18222E] border border-[var(--line)] hover:border-[#2ED8B6] cursor-pointer transition-all space-y-1"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#EAF1F8]">Healthcare / HIPAA Strict</span>
                  <span className="pill text-[9px] font-mono text-[#4D9FFF] border-[#4D9FFF]/40 bg-[#4D9FFF]/10">COMPLIANT</span>
                </div>
                <p className="text-[11px] text-[#B4C2D0]">
                  98% confidence floor, read-only autonomy, 1-hour raw context retention limit, mandatory PII redaction.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE INGEST QUEUE */}
      {/* ========================================================================= */}
      {isQueueModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg card shadow-2xl p-6 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">Create Custom Ingest Queue</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQueueModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newQueueName.trim()) return;
                const newQ = {
                  id: `q_${Date.now().toString().slice(-4)}`,
                  name: newQueueName.trim(),
                  ingestType: newQueueIngestType,
                  assignedOperator: newQueueOperator,
                  slaTargetMinutes: newQueueSla,
                  priorityWeight: 10,
                  autoEscalateFrustrated: true,
                  status: "active" as const,
                };
                setQueues((prev) => [newQ, ...prev]);
                setIsQueueModalOpen(false);
                setNewQueueName("");
                onNotify(`Created ingest queue "${newQ.name}"!`, "success");
              }}
              className="space-y-3.5 text-xs font-mono"
            >
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Queue Name</label>
                <input
                  type="text"
                  required
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  placeholder="e.g. VIP Priority Escrow Voice Queue"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Ingest Stream Channel</label>
                  <select
                    value={newQueueIngestType}
                    onChange={(e) => setNewQueueIngestType(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="chat">Omnichannel Chat Widget</option>
                    <option value="voice">Telephony Voice / SIP</option>
                    <option value="email">Asynchronous Email</option>
                    <option value="contractor_sms">Contractor SMS / Dispatch</option>
                    <option value="api_webhook">External API Webhook</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Target SLA Response (Min)</label>
                  <input
                    type="number"
                    value={newQueueSla}
                    onChange={(e) => setNewQueueSla(Number(e.target.value))}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Assigned Operator / AI Workforce</label>
                <select
                  value={newQueueOperator}
                  onChange={(e) => setNewQueueOperator(e.target.value)}
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                >
                  <option value="Alex — Support Intelligence Lead (AI)">Alex — Support Intelligence Lead (AI)</option>
                  <option value="Sophia — Enterprise Relationship Manager (AI)">Sophia — Enterprise Relationship Manager (AI)</option>
                  <option value="Barnaby — Knowledge & Runbook Lead (AI)">Barnaby — Knowledge & Runbook Lead (AI)</option>
                  <option value="Ini Godwin (Escalated Lead)">Ini Godwin (Escalated Lead)</option>
                  <option value="Marcus Vance (Tier 2 Lead)">Marcus Vance (Tier 2 Lead)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsQueueModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs font-bold"
                >
                  Save Ingest Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD CRON AUTOMATION SCHEDULE */}
      {/* ========================================================================= */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1017]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg card shadow-2xl p-6 space-y-4 border-[var(--line)] bg-[#0C121A] rounded-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#2ED8B6]" />
                <h3 className="text-sm font-bold text-[#EAF1F8]">Add Cron Automation Schedule</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1 text-[#6B7C8D] hover:text-[#EAF1F8] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newSchedName.trim()) return;
                const newS = {
                  id: `sched_${Date.now().toString().slice(-4)}`,
                  name: newSchedName.trim(),
                  cronExpression: newSchedCron.trim(),
                  humanSchedule: `Cron schedule: ${newSchedCron}`,
                  actionType: newSchedAction,
                  targetPackage: newSchedPackage,
                  lastRun: "Scheduled for next trigger",
                  status: "active" as const,
                };
                setSchedules((prev) => [newS, ...prev]);
                setIsScheduleModalOpen(false);
                setNewSchedName("");
                onNotify(`Created cron trigger "${newS.name}"!`, "success");
              }}
              className="space-y-3.5 text-xs font-mono"
            >
              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Schedule Job Name</label>
                <input
                  type="text"
                  required
                  value={newSchedName}
                  onChange={(e) => setNewSchedName(e.target.value)}
                  placeholder="e.g. 15-Minute VIP Retention Sync"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Cron Expression</label>
                  <input
                    type="text"
                    required
                    value={newSchedCron}
                    onChange={(e) => setNewSchedCron(e.target.value)}
                    placeholder="*/15 * * * *"
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                  />
                </div>

                <div>
                  <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Action Type</label>
                  <select
                    value={newSchedAction}
                    onChange={(e) => setNewSchedAction(e.target.value as any)}
                    className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="stale_work_sweep">Stale Work Sweep</option>
                    <option value="sla_breach_triage">SLA Pre-Breach Triage</option>
                    <option value="kb_pgvector_reindex">pgvector RAG Re-index</option>
                    <option value="vip_retention_sync">VIP Retention Sync</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[#6B7C8D] block mb-1 uppercase text-[10px] font-bold">Target Workforce Package</label>
                <input
                  type="text"
                  value={newSchedPackage}
                  onChange={(e) => setNewSchedPackage(e.target.value)}
                  placeholder="e.g. VIP Sentinel & Escalation Engine"
                  className="w-full bg-[#18222E] text-[#EAF1F8] p-2.5 rounded-xl border border-[var(--line-2)] text-xs focus:outline-none focus:border-[#2ED8B6]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="btn btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs font-bold"
                >
                  Save Schedule Trigger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * supportV8 Policy Engine & Sandbox Simulator
 * Basis: EP20 (SV8-190 to SV8-194)
 */

import { db } from "../db/mock-data";
import type { SupportPolicy, OperatingMode, PolicyRule } from "../types";
import { triageEngine } from "./triage-engine";
import { rankRisk, rankThreshold } from "@servicev8/agentic-runtime";

export interface PolicySimulationResult {
  message: string;
  category: string;
  sentiment: string;
  confidence: number;
  resolutionRiskScore: number;
  operatingMode: OperatingMode;
  autonomyDecision: "allowed_autonomous" | "held_for_approval" | "escalate_to_human" | "observe_only" | "blocked";
  matchedRules: Array<{
    id: string;
    name: string;
    priority: number;
    actionType: string;
    actionDetails: string;
    riskLevel: string;
  }>;
  allowedOperations: Array<{
    id: string;
    risk: string;
    autoExecutable: boolean;
    reason: string;
  }>;
  explanation: string;
}

export class PolicyEngine {
  private initialRules: PolicyRule[] = [
    {
      id: "POL-001",
      name: "VIP Instant Refund Autonomous Resolution",
      category: "financial_refund",
      description: "Auto-executes order refund up to $150 via OrderV8 for Enterprise VIP customers when confidence is above 90%.",
      riskLevel: "medium",
      priority: 1,
      condition: "customerTier == 'enterprise' AND intent == 'refund' AND amount <= 150 AND confidence >= 0.90",
      actionType: "auto_execute",
      actionDetails: "Dispatch orderv8.order.refund without human gate",
      enabled: true,
      matchCount: 142,
      lastTriggeredAt: "10 mins ago",
    },
    {
      id: "POL-002",
      name: "Hostile / Angry Sentiment SRE Escalation Gate",
      category: "sla_escalation",
      description: "Immediately interrupts autonomous resolution and escalates to human team lead if customer exhibits angry or hostile sentiment.",
      riskLevel: "high",
      priority: 2,
      condition: "sentiment == 'angry' OR sentiment == 'hostile' OR sentiment == 'urgent'",
      actionType: "escalate_to_lead",
      actionDetails: "Escalate ticket to CX Lead (Alex / Sophia) with emergency priority",
      enabled: true,
      matchCount: 89,
      lastTriggeredAt: "25 mins ago",
    },
    {
      id: "POL-003",
      name: "Autonomous Low-Risk Ticket Categorization & Tagging",
      category: "autonomy_risk",
      description: "Allows sub-agents (Chip / Maya) to assign tags, update priority, and categorize inbound tickets without approval.",
      riskLevel: "low",
      priority: 3,
      condition: "riskLevel == 'low' AND confidence >= 0.85",
      actionType: "auto_execute",
      actionDetails: "Apply tags and routing metadata automatically",
      enabled: true,
      matchCount: 1240,
      lastTriggeredAt: "1 min ago",
    },
    {
      id: "POL-004",
      name: "PII, SSN & Cardholder Data Auto-Redaction Guardrail",
      category: "safety_pii",
      description: "Automatically sanitizes customer SSNs, credit card numbers, and API tokens before RAG chunking and LLM inference.",
      riskLevel: "critical",
      priority: 1,
      condition: "contains_pattern(SSN, CreditCard, JWT_Token, BearerToken)",
      actionType: "auto_execute",
      actionDetails: "Mask sensitive fields with [REDACTED_PII] token in real time",
      enabled: true,
      matchCount: 312,
      lastTriggeredAt: "4 mins ago",
    },
    {
      id: "POL-005",
      name: "Prompt Injection & Jailbreak Adversarial Shield",
      category: "safety_pii",
      description: "Detects prompt injection, system prompt leakage requests, and adversarial jailbreak attempts, blocking action immediately.",
      riskLevel: "critical",
      priority: 1,
      condition: "matches_adversarial_pattern(ignore_previous_instructions, system_override)",
      actionType: "block_and_log",
      actionDetails: "Block generation, log security audit event, notify Security Lead",
      enabled: true,
      matchCount: 18,
      lastTriggeredAt: "2 hours ago",
    },
    {
      id: "POL-006",
      name: "Voice Telephony High Latency Queue Overflow",
      category: "voice_telephony",
      description: "Re-routes incoming voice caller to human backup SIP bridge when voice assistant latency exceeds 1200ms.",
      riskLevel: "medium",
      priority: 4,
      condition: "channel == 'voice' AND stream_latency_ms > 1200",
      actionType: "escalate_to_lead",
      actionDetails: "Hand off voice session to live telecom operator",
      enabled: true,
      matchCount: 7,
      lastTriggeredAt: "Yesterday",
    },
    {
      id: "POL-007",
      name: "High Financial Movement Human Approval Gate",
      category: "financial_refund",
      description: "Requires explicit dual-signature authorization from CX Lead for refunds or invoice write-offs exceeding $500.",
      riskLevel: "critical",
      priority: 2,
      condition: "intent == 'refund' AND amount > 500",
      actionType: "require_approval",
      actionDetails: "Hold action in Action Gateway approval queue until Lead signs",
      enabled: true,
      matchCount: 34,
      lastTriggeredAt: "3 hours ago",
    },
    {
      id: "POL-008",
      name: "SLA Imminent Breach (<= 15 mins) Autonomous Outreach",
      category: "sla_escalation",
      description: "Generates draft proactive communication and updates ticket status to priority urgent when SLA countdown is <= 15m.",
      riskLevel: "high",
      priority: 3,
      condition: "sla_remaining_minutes <= 15 AND ticket_status != 'resolved'",
      actionType: "require_approval",
      actionDetails: "Draft customer update and flag in Triage Cockpit",
      enabled: true,
      matchCount: 51,
      lastTriggeredAt: "12 mins ago",
    },
  ];

  public getPolicy(): SupportPolicy {
    return {
      ...db.policy,
      rules: this.initialRules,
    };
  }

  public getRules(): PolicyRule[] {
    return [...this.initialRules];
  }

  public addRule(rule: Omit<PolicyRule, "id" | "matchCount">): PolicyRule {
    const newRule: PolicyRule = {
      ...rule,
      id: `POL-${String(this.initialRules.length + 1).padStart(3, "0")}`,
      matchCount: 0,
      lastTriggeredAt: "Just created",
    };
    this.initialRules.unshift(newRule);
    return newRule;
  }

  public updateRule(id: string, updates: Partial<PolicyRule>): PolicyRule {
    const idx = this.initialRules.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Rule ${id} not found`);
    this.initialRules[idx] = { ...this.initialRules[idx], ...updates };
    return this.initialRules[idx];
  }

  public deleteRule(id: string): boolean {
    const before = this.initialRules.length;
    this.initialRules = this.initialRules.filter((r) => r.id !== id);
    return this.initialRules.length < before;
  }

  public updatePolicy(partial: Partial<SupportPolicy>): SupportPolicy {
    Object.assign(db.policy, partial);
    return {
      ...db.policy,
      rules: this.initialRules,
    };
  }

  public applyPresetProfile(preset: "strict_governance" | "balanced_enterprise" | "high_velocity" | "hipaa_healthcare"): SupportPolicy {
    if (preset === "strict_governance") {
      db.policy.operatingMode = "human_in_loop";
      db.policy.autonomyThreshold = "low";
      db.policy.confidenceMin = 0.95;
      db.policy.sentimentEscalationEnabled = true;
      db.policy.proactiveCommsApprovalRequired = true;
      this.initialRules.forEach((r) => {
        if (r.category === "financial_refund") r.actionType = "require_approval";
      });
    } else if (preset === "balanced_enterprise") {
      db.policy.operatingMode = "autonomous";
      db.policy.autonomyThreshold = "medium";
      db.policy.confidenceMin = 0.85;
      db.policy.sentimentEscalationEnabled = true;
      db.policy.proactiveCommsApprovalRequired = false;
    } else if (preset === "high_velocity") {
      db.policy.operatingMode = "autonomous";
      db.policy.autonomyThreshold = "high";
      db.policy.confidenceMin = 0.75;
      db.policy.sentimentEscalationEnabled = false;
      db.policy.proactiveCommsApprovalRequired = false;
    } else if (preset === "hipaa_healthcare") {
      db.policy.operatingMode = "human_in_loop";
      db.policy.autonomyThreshold = "read";
      db.policy.confidenceMin = 0.98;
      db.policy.sentimentEscalationEnabled = true;
      db.policy.proactiveCommsApprovalRequired = true;
      db.policy.retentionRawContextHours = 1;
    }
    return this.getPolicy();
  }

  public simulate(sampleMessage: string, customerTier: "standard" | "pro" | "enterprise" = "standard"): PolicySimulationResult {
    const policy = db.policy;
    const triage = triageEngine.classify(sampleMessage, customerTier);

    // Evaluate against active policy rules
    const matchedRules: PolicySimulationResult["matchedRules"] = [];
    const lower = sampleMessage.toLowerCase();

    for (const rule of this.initialRules.filter((r) => r.enabled)) {
      let isMatch = false;
      if (rule.category === "financial_refund" && (lower.includes("refund") || lower.includes("charge") || lower.includes("money") || lower.includes("billing"))) {
        isMatch = true;
      } else if (rule.category === "sla_escalation" && (triage.sentiment === "angry" || triage.sentiment === "urgent" || lower.includes("escalate") || lower.includes("manager") || lower.includes("demand"))) {
        isMatch = true;
      } else if (rule.category === "safety_pii" && (lower.includes("ssn") || lower.includes("password") || lower.includes("secret") || lower.includes("token") || lower.includes("card"))) {
        isMatch = true;
      } else if (rule.category === "autonomy_risk" && triage.confidence >= policy.confidenceMin) {
        isMatch = true;
      }

      if (isMatch) {
        matchedRules.push({
          id: rule.id,
          name: rule.name,
          priority: rule.priority,
          actionType: rule.actionType,
          actionDetails: rule.actionDetails,
          riskLevel: rule.riskLevel,
        });
      }
    }

    // Sample operations list
    const sampleOps = [
      { id: "zendesk.ticket.add_tag", risk: "low" as const },
      { id: "zendesk.ticket.update_priority", risk: "low" as const },
      { id: "zendesk.ticket.close", risk: "medium" as const },
      { id: "account.unlock", risk: "high" as const },
      { id: "orderv8.order.refund", risk: "critical" as const },
    ];

    const rankedThreshold = rankThreshold(policy.autonomyThreshold);

    const allowedOperations = sampleOps.map((op) => {
      const opRiskRank = rankRisk(op.risk);

      if (op.risk === "critical") {
        return {
          id: op.id,
          risk: op.risk,
          autoExecutable: false,
          reason: "Critical risk operations (e.g. moving money/refunds) ALWAYS require human approval gate under active tenant policies.",
        };
      }

      if (policy.operatingMode === "observe") {
        return {
          id: op.id,
          risk: op.risk,
          autoExecutable: false,
          reason: "Tenant is in Observe mode. State mutations are disabled.",
        };
      }

      const isAllowed = opRiskRank !== null && opRiskRank <= rankedThreshold && triage.confidence >= policy.confidenceMin;
      return {
        id: op.id,
        risk: op.risk,
        autoExecutable: isAllowed,
        reason: isAllowed
          ? `Operation risk (${op.risk}) is within tenant threshold (${policy.autonomyThreshold}) and confidence (${(triage.confidence * 100).toFixed(0)}% >= ${(policy.confidenceMin * 100).toFixed(0)}%).`
          : `Denied auto-execution: Risk (${op.risk}) exceeds threshold (${policy.autonomyThreshold}) or confidence below minimum.`,
      };
    });

    let autonomyDecision: PolicySimulationResult["autonomyDecision"] = "observe_only";
    if (policy.operatingMode === "observe") {
      autonomyDecision = "observe_only";
    } else if (matchedRules.some((r) => r.actionType === "block_and_log")) {
      autonomyDecision = "blocked";
    } else if (matchedRules.some((r) => r.actionType === "escalate_to_lead") || (policy.sentimentEscalationEnabled && (triage.sentiment === "angry" || triage.sentiment === "urgent"))) {
      autonomyDecision = "escalate_to_human";
    } else if (triage.resolutionRiskScore > 0.8) {
      autonomyDecision = "escalate_to_human";
    } else if (matchedRules.some((r) => r.actionType === "auto_execute") && allowedOperations.some((op) => op.autoExecutable)) {
      autonomyDecision = "allowed_autonomous";
    } else {
      autonomyDecision = "held_for_approval";
    }

    return {
      message: sampleMessage,
      category: triage.category,
      sentiment: triage.sentiment,
      confidence: triage.confidence,
      resolutionRiskScore: triage.resolutionRiskScore,
      operatingMode: policy.operatingMode,
      autonomyDecision,
      matchedRules,
      allowedOperations,
      explanation: `Evaluated ${matchedRules.length} matching policy rules against ${policy.operatingMode} mode. Triage sentiment: '${triage.sentiment}' with ${(triage.confidence * 100).toFixed(0)}% confidence score.`,
    };
  }
}

export const policyEngine = new PolicyEngine();

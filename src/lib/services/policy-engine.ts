/**
 * supportV8 Policy Engine & Sandbox Simulator
 * Backed by durable PostgreSQL schema supportv8.tenant_policies and supportv8.action_receipts under forced RLS.
 */

import crypto from "node:crypto";
import { pgClient, PostgresClient } from "../db/pg-client";
import type { SupportPolicy, OperatingMode, PolicyRule } from "../types";
import { triageEngine } from "./triage-engine";
import { rankRisk, rankThreshold } from "@servicev8/agentic-runtime";

function normalizeTenantId(tenant?: string): string {
  if (!tenant) return "tenant_default";
  const clean = tenant.toLowerCase().trim();
  const slug = clean.startsWith("tenant_") ? clean.slice(7) : clean;
  return `tenant_${slug.replace(/[^a-z0-9_]/g, "_")}`;
}

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

let hasRulesColumnChecked: boolean | null = null;

async function checkRulesColumn(client: PostgresClient): Promise<boolean> {
  if (hasRulesColumnChecked !== null) return hasRulesColumnChecked;
  try {
    return await client.withSystemSession(async (session) => {
      const rows = await session.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'supportv8'
             AND table_name = 'tenant_policies'
             AND column_name = 'rules'
         ) as exists`
      );
      hasRulesColumnChecked = Boolean(rows[0]?.exists);
      return hasRulesColumnChecked;
    });
  } catch {
    return false;
  }
}

export class PolicyEngine {
  private client: PostgresClient;
  private tenantRules: Map<string, PolicyRule[]> = new Map();

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  public async getPolicy(tenantParam?: string): Promise<SupportPolicy> {
    const tenantId = normalizeTenantId(tenantParam);
    const hasRules = await checkRulesColumn(this.client);

    return this.client.withTenantSession(tenantId, async (session) => {
      const selectCols = hasRules
        ? "tenant_id, raw_context_retention_hours, mode, rules, updated_at"
        : "tenant_id, raw_context_retention_hours, mode, updated_at";

      const rows = await session.query<any>(
        `SELECT ${selectCols}
         FROM supportv8.tenant_policies
         WHERE tenant_id = $1`,
        [tenantId]
      );

      const dbRow = rows[0];
      if (dbRow?.rules && Array.isArray(dbRow.rules) && dbRow.rules.length > 0) {
        this.tenantRules.set(tenantId, dbRow.rules);
      }
      const mode: OperatingMode =
        dbRow?.mode === "autonomous"
          ? "autonomous"
          : dbRow?.mode === "copilot"
          ? "copilot"
          : "observe";

      const retentionHours = Number(dbRow?.raw_context_retention_hours || 72);
      const rules = this.tenantRules.get(tenantId) || [];

      return {
        tenantId,
        operatingMode: mode,
        autonomyThreshold: mode === "autonomous" ? "high" : mode === "copilot" ? "medium" : "read",
        confidenceMin: mode === "autonomous" ? 0.8 : 0.85,
        sentimentEscalationEnabled: true,
        sentimentThreshold: "frustrated",
        autoProblemLinkThreshold: 0.8,
        staleWorkAutoCloseDays: 7,
        proactiveCommsApprovalRequired: mode !== "autonomous",
        retentionRawContextHours: retentionHours,
        retentionDerivedMonths: 12,
        rules,
      };
    });
  }

  public async updatePolicy(
    tenantParam: string,
    partial: Partial<SupportPolicy>,
    actorId = "system"
  ): Promise<SupportPolicy> {
    const tenantId = normalizeTenantId(tenantParam);
    const retention = Math.min(168, Math.max(1, partial.retentionRawContextHours ?? 72));

    const mode: "observe" | "copilot" | "autonomous" =
      partial.operatingMode === "autonomous"
        ? "autonomous"
        : partial.operatingMode === "copilot"
        ? "copilot"
        : "observe";

    return this.client.withTenantSession(tenantId, async (session) => {
      // 1. Upsert into supportv8.tenant_policies
      const rows = await session.query<any>(
        `INSERT INTO supportv8.tenant_policies (
           tenant_id, raw_context_retention_hours, mode, updated_at
         ) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET
           raw_context_retention_hours = EXCLUDED.raw_context_retention_hours,
           mode = EXCLUDED.mode,
           updated_at = NOW()
         RETURNING *`,
        [tenantId, retention, mode]
      );

      const updatedRow = rows[0];

      // 2. Audit in supportv8.action_receipts
      const idempotencyKey = `policy_update_${tenantId}_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
      await session.query(
        `INSERT INTO supportv8.action_receipts (
           id, tenant_id, idempotency_key, action, capability, status,
           actor, payload, result, created_at
         ) VALUES ($1, $2, $3, 'policy_update', 'policy_engine', 'completed', $4, $5, $6, NOW())`,
        [
          `rcpt_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`,
          tenantId,
          idempotencyKey,
          JSON.stringify({ actorId, type: "operator" }),
          JSON.stringify({
            policyVersion: "v1",
            updates: partial,
            auditTimestamp: new Date().toISOString(),
          }),
          JSON.stringify({
            success: true,
            mode: updatedRow.mode,
            retention: updatedRow.raw_context_retention_hours,
          }),
        ]
      );

      const rules = this.tenantRules.get(tenantId) || [];

      return {
        tenantId,
        operatingMode: mode,
        autonomyThreshold: partial.autonomyThreshold ?? (mode === "autonomous" ? "high" : mode === "copilot" ? "medium" : "read"),
        confidenceMin: partial.confidenceMin ?? (mode === "autonomous" ? 0.8 : 0.85),
        sentimentEscalationEnabled: partial.sentimentEscalationEnabled ?? true,
        sentimentThreshold: partial.sentimentThreshold ?? "frustrated",
        autoProblemLinkThreshold: partial.autoProblemLinkThreshold ?? 0.8,
        staleWorkAutoCloseDays: partial.staleWorkAutoCloseDays ?? 7,
        proactiveCommsApprovalRequired: partial.proactiveCommsApprovalRequired ?? (mode !== "autonomous"),
        retentionRawContextHours: Number(updatedRow.raw_context_retention_hours),
        retentionDerivedMonths: partial.retentionDerivedMonths ?? 12,
        rules,
      };
    });
  }

  public async applyPresetProfile(
    tenantOrPreset:
      | string
      | "strict_governance"
      | "balanced_enterprise"
      | "high_velocity"
      | "hipaa_healthcare",
    maybePresetOrActor?: string,
    maybeActorId?: string
  ): Promise<SupportPolicy> {
    const isPresetFirst = [
      "strict_governance",
      "balanced_enterprise",
      "high_velocity",
      "hipaa_healthcare",
    ].includes(tenantOrPreset);

    const preset = (isPresetFirst ? tenantOrPreset : maybePresetOrActor) as
      | "strict_governance"
      | "balanced_enterprise"
      | "high_velocity"
      | "hipaa_healthcare";
    const tenantId = isPresetFirst ? "tenant_default" : normalizeTenantId(tenantOrPreset);
    const actorId = isPresetFirst ? maybePresetOrActor || "system" : maybeActorId || "system";

    const updates: Partial<SupportPolicy> = {};

    if (preset === "strict_governance") {
      updates.operatingMode = "observe";
      updates.autonomyThreshold = "low";
      updates.confidenceMin = 0.95;
      updates.sentimentEscalationEnabled = true;
      updates.proactiveCommsApprovalRequired = true;
      updates.retentionRawContextHours = 72;
    } else if (preset === "balanced_enterprise") {
      updates.operatingMode = "copilot";
      updates.autonomyThreshold = "medium";
      updates.confidenceMin = 0.85;
      updates.sentimentEscalationEnabled = true;
      updates.proactiveCommsApprovalRequired = false;
      updates.retentionRawContextHours = 72;
    } else if (preset === "high_velocity") {
      updates.operatingMode = "autonomous";
      updates.autonomyThreshold = "high";
      updates.confidenceMin = 0.75;
      updates.sentimentEscalationEnabled = false;
      updates.proactiveCommsApprovalRequired = false;
      updates.retentionRawContextHours = 48;
    } else if (preset === "hipaa_healthcare") {
      updates.operatingMode = "observe";
      updates.autonomyThreshold = "read";
      updates.confidenceMin = 0.98;
      updates.sentimentEscalationEnabled = true;
      updates.proactiveCommsApprovalRequired = true;
      updates.retentionRawContextHours = 24;
    }

    return this.updatePolicy(tenantId, updates, actorId);
  }

  public addRule(
    tenantOrRule: string | Omit<PolicyRule, "id" | "matchCount">,
    maybeRule?: Omit<PolicyRule, "id" | "matchCount">
  ): PolicyRule & PromiseLike<PolicyRule> {
    const tenantId = typeof tenantOrRule === "string" ? normalizeTenantId(tenantOrRule) : "tenant_default";
    const rule = typeof tenantOrRule === "string" ? maybeRule! : tenantOrRule;
    const current = this.tenantRules.get(tenantId) || [];
    const newRule: PolicyRule = {
      ...rule,
      id: `POL-${String(current.length + 1).padStart(3, "0")}`,
      matchCount: 0,
      lastTriggeredAt: "Just created",
    };
    current.unshift(newRule);
    this.tenantRules.set(tenantId, current);
    const promise = (async () => {
      try {
        await this.persistTenantRules(tenantId, current);
      } catch (err) {
        current.shift();
        this.tenantRules.set(tenantId, current);
        throw err;
      }
      return newRule;
    })();
    return Object.assign(promise, newRule);
  }

  private async persistTenantRules(tenantId: string, rules: PolicyRule[]): Promise<void> {
    if (!PostgresClient.hasActiveClient()) return;
    await this.client.withTenantSession(tenantId, async (session) => {
      await session.query(
        `UPDATE supportv8.tenant_policies
         SET rules = $1::jsonb, updated_at = NOW()
         WHERE tenant_id = $2`,
        [JSON.stringify(rules), tenantId]
      );
    });
  }

  public getRules(tenantParam = "tenant_default"): PolicyRule[] {
    const tenantId = normalizeTenantId(tenantParam);
    return this.tenantRules.get(tenantId) || [];
  }

  public updateRule(
    tenantParam: string,
    id: string,
    updates: Partial<PolicyRule>
  ): PolicyRule & PromiseLike<PolicyRule> {
    const tenantId = normalizeTenantId(tenantParam);
    const current = this.tenantRules.get(tenantId) || [];
    const idx = current.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Rule ${id} not found`);
    const original = { ...current[idx] };
    current[idx] = { ...current[idx], ...updates };
    const promise = (async () => {
      try {
        await this.persistTenantRules(tenantId, current);
      } catch (err) {
        current[idx] = original;
        throw err;
      }
      return current[idx];
    })();
    return Object.assign(promise, current[idx]);
  }

  public async deleteRule(tenantParam: string, id: string): Promise<boolean> {
    const tenantId = normalizeTenantId(tenantParam);
    const current = this.tenantRules.get(tenantId) || [];
    const before = current.length;
    const filtered = current.filter((r) => r.id !== id);
    this.tenantRules.set(tenantId, filtered);
    try {
      await this.persistTenantRules(tenantId, filtered);
    } catch (err) {
      this.tenantRules.set(tenantId, current);
      throw err;
    }
    return filtered.length < before;
  }

  public simulate(
    sampleMessage: string,
    customerTier: "standard" | "pro" | "enterprise" = "standard",
    policyInput?: Partial<SupportPolicy>
  ): PolicySimulationResult {
    const triage = triageEngine.classify(sampleMessage, customerTier);
    const operatingMode = policyInput?.operatingMode || "observe";
    const autonomyThreshold = policyInput?.autonomyThreshold || "read";
    const confidenceMin = policyInput?.confidenceMin ?? 0.85;
    const sentimentEscalationEnabled = policyInput?.sentimentEscalationEnabled ?? true;

    const matchedRules: PolicySimulationResult["matchedRules"] = [];
    const lower = sampleMessage.toLowerCase();

    for (const rule of (policyInput?.rules || []).filter((r) => r.enabled)) {
      let isMatch = false;
      if (
        rule.category === "financial_refund" &&
        (lower.includes("refund") || lower.includes("charge") || lower.includes("money") || lower.includes("billing"))
      ) {
        isMatch = true;
      } else if (
        rule.category === "sla_escalation" &&
        (triage.sentiment === "angry" || triage.sentiment === "urgent" || lower.includes("escalate") || lower.includes("manager"))
      ) {
        isMatch = true;
      } else if (
        rule.category === "safety_pii" &&
        (lower.includes("ssn") || lower.includes("password") || lower.includes("secret") || lower.includes("token"))
      ) {
        isMatch = true;
      } else if (rule.category === "autonomy_risk" && triage.confidence >= confidenceMin) {
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

    const sampleOps = [
      { id: "zendesk.ticket.add_tag", risk: "low" as const },
      { id: "zendesk.ticket.update_priority", risk: "low" as const },
      { id: "zendesk.ticket.close", risk: "medium" as const },
      { id: "account.unlock", risk: "high" as const },
      { id: "orderv8.order.refund", risk: "critical" as const },
    ];

    const rankedThreshold = rankThreshold(autonomyThreshold);

    const allowedOperations = sampleOps.map((op) => {
      const opRiskRank = rankRisk(op.risk);

      if (op.risk === "critical") {
        return {
          id: op.id,
          risk: op.risk,
          autoExecutable: false,
          reason: "Critical risk operations (e.g. moving money/refunds) ALWAYS require human approval gate.",
        };
      }

      if (operatingMode === "observe") {
        return {
          id: op.id,
          risk: op.risk,
          autoExecutable: false,
          reason: "Tenant is in Observe mode. State mutations are disabled.",
        };
      }

      const isAllowed = opRiskRank !== null && opRiskRank <= rankedThreshold && triage.confidence >= confidenceMin;
      return {
        id: op.id,
        risk: op.risk,
        autoExecutable: isAllowed,
        reason: isAllowed
          ? `Operation risk (${op.risk}) is within tenant threshold (${autonomyThreshold}) and confidence (${(triage.confidence * 100).toFixed(0)}% >= ${(confidenceMin * 100).toFixed(0)}%).`
          : `Denied auto-execution: Risk (${op.risk}) exceeds threshold (${autonomyThreshold}) or confidence below minimum.`,
      };
    });

    let autonomyDecision: PolicySimulationResult["autonomyDecision"] = "observe_only";
    if (operatingMode === "observe") {
      autonomyDecision = "observe_only";
    } else if (matchedRules.some((r) => r.actionType === "block_and_log")) {
      autonomyDecision = "blocked";
    } else if (
      matchedRules.some((r) => r.actionType === "escalate_to_lead") ||
      (sentimentEscalationEnabled && (triage.sentiment === "angry" || triage.sentiment === "urgent"))
    ) {
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
      operatingMode,
      autonomyDecision,
      matchedRules,
      allowedOperations,
      explanation: `Evaluated ${matchedRules.length} matching policy rules against ${operatingMode} mode. Triage sentiment: '${triage.sentiment}' with ${(triage.confidence * 100).toFixed(0)}% confidence score.`,
    };
  }
}

export const policyEngine = new PolicyEngine();

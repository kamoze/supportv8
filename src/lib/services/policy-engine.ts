/**
 * supportV8 Policy Engine & Sandbox Simulator
 * Basis: EP20 (SV8-190 to SV8-194)
 */

import { db } from "../db/mock-data";
import type { SupportPolicy, OperatingMode } from "../types";
import { triageEngine } from "./triage-engine";
import { rankRisk, rankThreshold } from "@servicev8/agentic-runtime";

export interface PolicySimulationResult {
  message: string;
  category: string;
  sentiment: string;
  confidence: number;
  resolutionRiskScore: number;
  operatingMode: OperatingMode;
  autonomyDecision: "allowed_autonomous" | "held_for_approval" | "escalate_to_human" | "observe_only";
  allowedOperations: Array<{
    id: string;
    risk: string;
    autoExecutable: boolean;
    reason: string;
  }>;
  explanation: string;
}

export class PolicyEngine {
  public getPolicy(): SupportPolicy {
    return { ...db.policy };
  }

  public updatePolicy(partial: Partial<SupportPolicy>): SupportPolicy {
    Object.assign(db.policy, partial);
    return { ...db.policy };
  }

  public simulate(sampleMessage: string, customerTier: "standard" | "pro" | "enterprise" = "standard"): PolicySimulationResult {
    const policy = db.policy;
    const triage = triageEngine.classify(sampleMessage, customerTier);

    // Evaluate against policy autonomy threshold
    const sampleOps = [
      { id: "zendesk.ticket.add_tag", risk: "low" as const },
      { id: "zendesk.ticket.update_priority", risk: "low" as const },
      { id: "zendesk.ticket.close", risk: "medium" as const },
      { id: "account.unlock", risk: "high" as const },
      { id: "customer.refund", risk: "critical" as const },
    ];

    const rankedThreshold = rankThreshold(policy.autonomyThreshold);

    const allowedOperations = sampleOps.map((op) => {
      const opRiskRank = rankRisk(op.risk);
      // Critical risk operations NEVER auto execute
      if (op.risk === "critical") {
        return {
          id: op.id,
          risk: op.risk,
          autoExecutable: false,
          reason: "Critical risk operations (e.g. moving money/refunds) ALWAYS require human approval gate.",
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
    } else if (policy.sentimentEscalationEnabled && (triage.sentiment === "angry" || triage.sentiment === "urgent")) {
      autonomyDecision = "escalate_to_human";
    } else if (triage.resolutionRiskScore > 0.8) {
      autonomyDecision = "escalate_to_human";
    } else if (allowedOperations.some((op) => op.autoExecutable)) {
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
      allowedOperations,
      explanation: `Policy Simulation for ${customerTier.toUpperCase()} tier: Mode is ${policy.operatingMode.toUpperCase()}. Autonomy Threshold: ${policy.autonomyThreshold.toUpperCase()}. Resolution Risk: ${triage.resolutionRiskScore}. Decision: ${autonomyDecision}.`,
    };
  }
}

export const policyEngine = new PolicyEngine();

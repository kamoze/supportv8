import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { policyEngine } from "../src/lib/services/policy-engine";
import { PostgresClient } from "@/lib/db/pg-client";
import { MockPostgresClient } from "./fixtures/mock-db-client";

describe("Policies & Rules Engine - Expanded Governance Suite", () => {
  let mockClient: MockPostgresClient;

  beforeEach(() => {
    mockClient = new MockPostgresClient();
    PostgresClient.setTestClient(mockClient);

    // Seed 8 initial rules for tenant_default
    const initialRules = [
      {
        id: "POL-001",
        name: "VIP Instant Refund Autonomous Resolution",
        category: "financial_refund" as const,
        description: "Auto-executes order refund up to $150",
        riskLevel: "medium" as const,
        priority: 1,
        condition: "customerTier == 'enterprise'",
        actionType: "auto_execute" as const,
        actionDetails: "Dispatch refund",
        enabled: true,
      },
      { id: "POL-002", name: "R2", category: "safety_pii" as const, description: "d", riskLevel: "high" as const, priority: 2, condition: "c", actionType: "block_and_log" as const, actionDetails: "a", enabled: true },
      { id: "POL-003", name: "R3", category: "autonomy_risk" as const, description: "d", riskLevel: "low" as const, priority: 3, condition: "c", actionType: "auto_execute" as const, actionDetails: "a", enabled: true },
      { id: "POL-004", name: "R4", category: "safety_pii" as const, description: "d", riskLevel: "critical" as const, priority: 1, condition: "c", actionType: "auto_execute" as const, actionDetails: "a", enabled: true },
      { id: "POL-005", name: "R5", category: "safety_pii" as const, description: "d", riskLevel: "critical" as const, priority: 1, condition: "c", actionType: "block_and_log" as const, actionDetails: "a", enabled: true },
      { id: "POL-006", name: "R6", category: "voice_telephony" as const, description: "d", riskLevel: "medium" as const, priority: 4, condition: "c", actionType: "escalate_to_lead" as const, actionDetails: "a", enabled: true },
      { id: "POL-007", name: "R7", category: "financial_refund" as const, description: "d", riskLevel: "critical" as const, priority: 2, condition: "c", actionType: "require_approval" as const, actionDetails: "a", enabled: true },
      { id: "POL-008", name: "R8", category: "sla_escalation" as const, description: "d", riskLevel: "high" as const, priority: 3, condition: "c", actionType: "require_approval" as const, actionDetails: "a", enabled: true },
    ];

    for (const r of initialRules) {
      policyEngine.addRule("tenant_default", r);
    }
  });

  afterEach(() => {
    PostgresClient.setTestClient(null);
  });

  it("should return active policy rules with categories and risk levels", async () => {
    const policy = await policyEngine.getPolicy("tenant_default");
    expect(policy.rules).toBeDefined();
    expect(policy.rules!.length).toBeGreaterThanOrEqual(8);

    const vipRefundRule = policy.rules!.find((r) => r.id === "POL-001");
    expect(vipRefundRule).toBeDefined();
    expect(vipRefundRule!.category).toBe("financial_refund");
    expect(vipRefundRule!.actionType).toBe("auto_execute");
  });

  it("should add a new policy rule and assign next rule ID", () => {
    const newRule = policyEngine.addRule("tenant_default", {
      name: "Custom Carrier Delay Auto-Extend SLA",
      category: "sla_escalation",
      description: "Auto-extends customer SLA when carrier reports transit exception.",
      riskLevel: "low",
      priority: 5,
      condition: "event == 'carrier_delay' AND exception_code == 'WEATHER'",
      actionType: "auto_execute",
      actionDetails: "Extend SLA by 24h",
      enabled: true,
    });

    expect(newRule.id).toMatch(/^POL-\d{3}$/);
    expect(newRule.matchCount).toBe(0);

    const rules = policyEngine.getRules("tenant_default");
    expect(rules.some((r) => r.id === newRule.id)).toBe(true);
  });

  it("should apply preset profiles and adjust operating modes and thresholds", async () => {
    const strictPolicy = await policyEngine.applyPresetProfile("strict_governance");
    expect(strictPolicy.operatingMode).toBe("observe");
    expect(strictPolicy.autonomyThreshold).toBe("low");
    expect(strictPolicy.confidenceMin).toBe(0.95);

    const balancedPolicy = await policyEngine.applyPresetProfile("balanced_enterprise");
    expect(balancedPolicy.operatingMode).toBe("copilot");
    expect(balancedPolicy.autonomyThreshold).toBe("medium");
    expect(balancedPolicy.confidenceMin).toBe(0.85);
  });

  it("should simulate matching rules and evaluate autonomy decision", async () => {
    const policy = { ...(await policyEngine.getPolicy("tenant_default")), operatingMode: "autonomous" as const };
    const simRefund = policyEngine.simulate("I need a refund for my order #12345 please", "enterprise", policy);
    expect(simRefund.category).toBeDefined();
    expect(simRefund.matchedRules.length).toBeGreaterThan(0);
    expect(simRefund.allowedOperations).toBeDefined();

    const simAngry = policyEngine.simulate("I am furious, get me a human supervisor immediately!", "standard", policy);
    expect(["angry", "urgent", "frustrated"]).toContain(simAngry.sentiment);
    expect(simAngry.autonomyDecision).toBe("escalate_to_human");
  });
});

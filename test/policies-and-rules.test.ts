import { describe, it, expect } from "vitest";
import { policyEngine } from "../src/lib/services/policy-engine";

describe("Policies & Rules Engine - Expanded Governance Suite", () => {
  it("should return active policy rules with categories and risk levels", () => {
    const policy = policyEngine.getPolicy();
    expect(policy.rules).toBeDefined();
    expect(policy.rules!.length).toBeGreaterThanOrEqual(8);

    const vipRefundRule = policy.rules!.find((r) => r.id === "POL-001");
    expect(vipRefundRule).toBeDefined();
    expect(vipRefundRule!.category).toBe("financial_refund");
    expect(vipRefundRule!.actionType).toBe("auto_execute");
  });

  it("should add a new policy rule and assign next rule ID", () => {
    const newRule = policyEngine.addRule({
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

    const rules = policyEngine.getRules();
    expect(rules.some((r) => r.id === newRule.id)).toBe(true);
  });

  it("should apply preset profiles and adjust operating modes and thresholds", () => {
    const strictPolicy = policyEngine.applyPresetProfile("strict_governance");
    expect(strictPolicy.operatingMode).toBe("human_in_loop");
    expect(strictPolicy.autonomyThreshold).toBe("low");
    expect(strictPolicy.confidenceMin).toBe(0.95);

    const balancedPolicy = policyEngine.applyPresetProfile("balanced_enterprise");
    expect(balancedPolicy.operatingMode).toBe("autonomous");
    expect(balancedPolicy.autonomyThreshold).toBe("medium");
    expect(balancedPolicy.confidenceMin).toBe(0.85);
  });

  it("should simulate matching rules and evaluate autonomy decision", () => {
    const simRefund = policyEngine.simulate("I need a refund for my order #12345 please", "enterprise");
    expect(simRefund.category).toBeDefined();
    expect(simRefund.matchedRules.length).toBeGreaterThan(0);
    expect(simRefund.allowedOperations).toBeDefined();

    const simAngry = policyEngine.simulate("I am furious, get me a human supervisor immediately!", "standard");
    expect(["angry", "urgent", "frustrated"]).toContain(simAngry.sentiment);
    expect(simAngry.autonomyDecision).toBe("escalate_to_human");
  });
});

import { describe, it, expect } from "vitest";
import { triageEngine } from "@/lib/services/triage-engine";

describe("supportV8 Triage & Sentiment Engine", () => {
  it("classifies angry checkout failures as urgent priority with high risk score", () => {
    const result = triageEngine.classify(
      "Payment keeps freezing on checkout submit! This is ridiculous, fix this immediately!",
      "enterprise"
    );

    expect(result.category).toBe("checkout_failure");
    expect(result.sentiment).toBe("urgent");
    expect(result.priority).toBe("urgent");
    expect(result.businessImpact).toBe("critical");
    expect(result.resolutionRiskScore).toBeGreaterThanOrEqual(0.7);
    expect(result.routingRecommendation).toBe("human_escalation");
  });

  it("classifies standard inquiries as low risk autonomous candidates", () => {
    const result = triageEngine.classify(
      "How do I update my notification settings for email receipts? Thanks!",
      "standard"
    );

    expect(result.sentiment).toBe("positive");
    expect(result.priority).toBe("normal");
    expect(result.resolutionRiskScore).toBeLessThanOrEqual(0.4);
    expect(result.routingRecommendation).toBe("autonomous");
  });

  it("correctly flags billing disputes requiring approval", () => {
    const result = triageEngine.classify(
      "I was double charged on my invoice and need a refund for the extra charge.",
      "pro"
    );

    expect(result.category).toBe("billing_dispute");
    expect(result.routingRecommendation).toBe("approval_required");
  });
});

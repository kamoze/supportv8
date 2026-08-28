import type { GuardrailEvaluation, AgentContext } from "../types";

export class Guardrails {
  private static readonly MAX_AUTONOMOUS_REFUND = 500;
  private static readonly SENTIMENT_ESCALATION_FLOOR = 0.45;

  private static readonly ESCALATION_KEYWORDS = [
    "lawyer",
    "attorney",
    "sue",
    "lawsuit",
    "fraud",
    "supervisor",
    "manager",
    "human agent",
    "representative",
    "dispute charge",
  ];

  private static readonly BANNED_TOPICS = [
    "internal employee salary",
    "zero-day exploit",
    "database master password",
    "aws secret access key",
  ];

  /**
   * Evaluates inbound message and agent context against safety guardrails
   */
  static evaluateInbound(text: string, context: AgentContext): GuardrailEvaluation {
    const reasons: string[] = [];
    let action: GuardrailEvaluation["action"] = "proceed";

    // 1. Check for banned confidential topics
    const lower = text.toLowerCase();
    for (const topic of this.BANNED_TOPICS) {
      if (lower.includes(topic)) {
        return {
          passed: false,
          action: "block",
          reasons: [`Inquiry contains policy-banned topic: ${topic}`],
        };
      }
    }

    // 2. Check for explicit escalation keywords using word-boundary regex
    for (const kw of this.ESCALATION_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(text)) {
        reasons.push(`Escalation keyword detected: "${kw}"`);
        action = "escalate_to_human";
      }
    }

    // 3. Check customer sentiment floor
    if (context.customer.sentimentScore < this.SENTIMENT_ESCALATION_FLOOR) {
      reasons.push(
        `Customer sentiment score (${context.customer.sentimentScore}) dropped below minimum floor (${this.SENTIMENT_ESCALATION_FLOOR})`
      );
      action = "escalate_to_human";
    }

    // 4. Redact potential PII (e.g. Credit Card numbers)
    const piiRedacted = text.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "[REDACTED_CC]");
    if (piiRedacted !== text) {
      reasons.push("Redacted sensitive 16-digit payment card number");
      if (action === "proceed") action = "redact_pii";
    }

    return {
      passed: action === "proceed" || action === "redact_pii",
      action,
      reasons,
      sanitizedContent: piiRedacted,
    };
  }

  /**
   * Enforces financial transaction limits
   */
  static validateFinancialAction(amountUsd: number): { allowed: boolean; reason?: string } {
    if (amountUsd > this.MAX_AUTONOMOUS_REFUND) {
      return {
        allowed: false,
        reason: `Requested refund amount ($${amountUsd}) exceeds maximum autonomous limit ($${this.MAX_AUTONOMOUS_REFUND}). Requires Human Supervisor approval.`,
      };
    }
    return { allowed: true };
  }
}

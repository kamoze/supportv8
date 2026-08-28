import type { AgentContext, LlmRoutingDecision, LlmModelTier } from "../types";

export class LlmRouter {
  /**
   * Intelligently selects the optimal LLM provider, tier, and budget based on context complexity
   */
  static selectModel(context: AgentContext): LlmRoutingDecision {
    const lastMsg = context.conversationHistory[context.conversationHistory.length - 1]?.content || "";
    const lower = lastMsg.toLowerCase();

    // 1. Reasoning Tier: Complex multi-step reasoning, architectural evaluation, or financial dispute
    if (
      lower.includes("architecture") ||
      lower.includes("dispute") ||
      lower.includes("policy compliance") ||
      context.customer.arrValueUsd! > 250000
    ) {
      return {
        modelName: "claude-3-5-sonnet-20241022",
        provider: "forge_gateway",
        tier: "reasoning",
        estimatedCostUsd: 0.0035,
        maxTokens: 2048,
      };
    }

    // 2. Balanced Tier: Standard customer & contractor support queries
    if (
      lower.includes("refund") ||
      lower.includes("work order") ||
      lower.includes("lockbox") ||
      lower.includes("invoice")
    ) {
      return {
        modelName: "gpt-4o-mini-2024-07-18",
        provider: "forge_gateway",
        tier: "balanced",
        estimatedCostUsd: 0.0006,
        maxTokens: 1024,
      };
    }

    // 3. Fast Tier: General FAQs, greetings, status queries
    return {
      modelName: "deepseek-v3-fast",
      provider: "ollama",
      tier: "fast",
      estimatedCostUsd: 0.0001,
      maxTokens: 512,
    };
  }
}

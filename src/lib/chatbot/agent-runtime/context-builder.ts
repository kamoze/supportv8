import type { AgentContext, InboundMessagePayload } from "../types";
import { KnowledgeV8Client } from "@/lib/services/interservice-client";

export class ContextBuilder {
  /**
   * Assembles rich agent context including multi-turn history, customer profile, and KnowledgeV8 vector citations
   */
  static async buildContext(payload: InboundMessagePayload, rawHistory: Array<{ role: any; content: string; name?: string }> = []): Promise<AgentContext> {
    // 1. Query KnowledgeV8 Vector Database for grounded RAG context
    const ragRes = await KnowledgeV8Client.searchEmbeddings({
      tenantId: payload.tenantId,
      query: payload.content,
      stream: payload.stream,
      topK: 3,
    });

    const citations = ragRes.data?.citations || [];

    // 2. Derive customer sentiment and account metadata
    const lowerContent = payload.content.toLowerCase();
    let sentimentScore = 0.85;
    if (lowerContent.includes("broken") || lowerContent.includes("failed") || lowerContent.includes("angry")) {
      sentimentScore = 0.38;
    } else if (lowerContent.includes("urgent") || lowerContent.includes("critical")) {
      sentimentScore = 0.52;
    }

    // 3. Construct clean conversation history window (last 10 turns)
    const conversationHistory: AgentContext["conversationHistory"] = [
      ...rawHistory.slice(-10),
      { role: "user", content: payload.content, name: payload.senderName },
    ];

    return {
      tenantId: payload.tenantId,
      sessionId: payload.sessionId,
      stream: payload.stream,
      customer: {
        name: payload.senderName,
        email: payload.senderEmail,
        phone: payload.senderPhone,
        arrValueUsd: 420000,
        accountTier: "Enterprise VIP",
        sentimentScore,
      },
      intakeData: payload.metadata as Record<string, string>,
      conversationHistory,
      retrievedCitations: citations,
    };
  }
}

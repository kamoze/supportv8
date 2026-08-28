import type { ChatStreamType } from "@/lib/types";
import { AgentRuntimeCore } from "../agent-runtime/agent-runtime-core";
import { ChannelAdapters } from "../experience/channel-adapters";
import { KnowledgeV8Client } from "@/lib/services/interservice-client";
import { AGENT_REGISTRY } from "./agent-platform";

export interface CopilotSuggestionResult {
  suggestedDraft: string;
  sentimentAssessment: {
    score: number;
    tone: string;
    churnRisk: "low" | "medium" | "high";
  };
  recommendedActions: Array<{
    actionId: string;
    label: string;
    toolName: string;
    payload: Record<string, unknown>;
  }>;
  relevantCitations: Array<{
    title: string;
    similarity: number;
    url?: string;
  }>;
}

export class InteractiveRunner {
  /**
   * Executes Interactive Chatbot request
   */
  static async runChatbot(params: {
    sessionId: string;
    stream: ChatStreamType;
    customerName: string;
    customerEmail?: string;
    content: string;
    tenantId?: string;
  }) {
    const payload = ChannelAdapters.normalizeWebChat(params);
    return AgentRuntimeCore.processMessage(payload);
  }

  /**
   * Generates real-time Copilot assistance for support staff working a ticket or chat
   */
  static async runCopilot(params: {
    sessionId: string;
    stream: ChatStreamType;
    customerName: string;
    latestCustomerMessage: string;
    tenantId?: string;
  }): Promise<CopilotSuggestionResult> {
    const tenantId = params.tenantId || "tenant_default";

    // 1. Search KnowledgeV8 pgvector embeddings for relevant articles
    const ragRes = await KnowledgeV8Client.searchEmbeddings({
      tenantId,
      query: params.latestCustomerMessage,
      stream: params.stream,
      topK: 2,
    });
    const citations = (ragRes.data?.citations || []).map((c) => ({
      title: c.title,
      similarity: c.similarity,
    }));

    // 2. Assess sentiment & churn risk
    const lower = params.latestCustomerMessage.toLowerCase();
    let score = 0.82;
    let tone = "Calm / Inquisitive";
    let churnRisk: "low" | "medium" | "high" = "low";

    if (lower.includes("cancel") || lower.includes("terrible") || lower.includes("disappointed")) {
      score = 0.28;
      tone = "Frustrated / At-Risk";
      churnRisk = "high";
    } else if (
      lower.includes("urgent") ||
      lower.includes("broken") ||
      lower.includes("failed") ||
      lower.includes("refund") ||
      lower.includes("charged twice")
    ) {
      score = 0.49;
      tone = "Urgent / Impatient";
      churnRisk = "medium";
    }

    // 3. Formulate suggested draft reply
    let suggestedDraft = `Hi ${params.customerName}, thanks for getting in touch. I'm looking into this right now for you.`;
    const recommendedActions: CopilotSuggestionResult["recommendedActions"] = [];

    if (lower.includes("refund") || lower.includes("credit")) {
      suggestedDraft = `Hi ${params.customerName}, I've reviewed your request. Under our customer satisfaction guarantee, I can issue an instant $150 credit voucher directly to your account. Would you like me to apply that now?`;
      recommendedActions.push({
        actionId: "act_issue_refund",
        label: "Issue $150 Instant Credit",
        toolName: "order_refund",
        payload: { amountUsd: 150.0, customerName: params.customerName },
      });
    } else if (lower.includes("lockbox") || lower.includes("gate") || lower.includes("pin")) {
      suggestedDraft = `Hi ${params.customerName}, I have verified your contractor credentials. Here is your emergency one-time site access PIN for gate controller SITE-MAIN-ENTRANCE.`;
      recommendedActions.push({
        actionId: "act_gen_pin",
        label: "Generate 6-Digit Lockbox PIN",
        toolName: "site_access_pin",
        payload: { siteId: "SITE-MAIN-ENTRANCE" },
      });
    } else if (citations.length > 0) {
      suggestedDraft = `Hi ${params.customerName}, based on our documentation for "${citations[0].title}", you can resolve this by checking your integration settings. Let me know if you'd like me to walk you through it!`;
    }

    return {
      suggestedDraft,
      sentimentAssessment: { score, tone, churnRisk },
      recommendedActions,
      relevantCitations: citations,
    };
  }

  /**
   * Executes Interactive Portal Assistant for self-service lookups
   */
  static async runAssistant(params: {
    query: string;
    tenantId?: string;
    customerEmail?: string;
  }) {
    const tenantId = params.tenantId || "tenant_default";
    const ragRes = await KnowledgeV8Client.searchEmbeddings({
      tenantId,
      query: params.query,
      stream: "customers",
      topK: 3,
    });

    return {
      assistantReply: `Here are the matching self-service resources from our knowledge base:`,
      citations: ragRes.data?.citations || [],
      quickLinks: [
        { label: "Download Latest Invoice", href: "/billing/invoices" },
        { label: "Check Work Order Status", href: "/orders/status" },
      ],
    };
  }
}

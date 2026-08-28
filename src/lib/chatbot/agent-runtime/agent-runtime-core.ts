import type { InboundMessagePayload, SseEventType } from "../types";
import { PromptManager } from "./prompt-manager";
import { ContextBuilder } from "./context-builder";
import { LlmRouter } from "./llm-router";
import { ToolPlanner } from "./tool-planner";
import { Guardrails } from "./guardrails";
import { ConversationManager } from "./conversation-manager";
import { ChatbotTelemetry } from "../observability/telemetry";

export class AgentRuntimeCore {
  /**
   * Main Agentic Loop Orchestrator.
   * Executes the full pipeline:
   * Experience -> API Edge -> Context Builder -> LLM Router -> Tool Planner -> Guardrails -> Response Streaming -> Observability
   */
  static async processMessage(
    payload: InboundMessagePayload,
    onStreamEvent?: (event: SseEventType, data: Record<string, unknown>) => void
  ): Promise<{
    responseContent: string;
    citations: Array<{ id: string; title: string; snippet: string; similarity: number }>;
    toolsExecuted: string[];
    isEscalated: boolean;
  }> {
    const startTime = Date.now();
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    onStreamEvent?.("start", { traceId, sessionId: payload.sessionId, stream: payload.stream });

    // 1. Conversation Manager: Get/Create Session & Record User Message
    const session = ConversationManager.getOrCreateSession(payload);
    ConversationManager.appendMessage(payload.sessionId, {
      sender: "customer",
      senderName: payload.senderName,
      content: payload.content,
    });

    // 2. Context Builder: Assemble history, customer metadata, and KnowledgeV8 RAG citations
    const rawHistory = session.messages.map((m) => ({
      role: m.sender === "customer" ? ("user" as const) : ("assistant" as const),
      content: m.content,
      name: m.senderName,
    }));
    const context = await ContextBuilder.buildContext(payload, rawHistory);

    if (context.retrievedCitations.length > 0) {
      onStreamEvent?.("citation", { citations: context.retrievedCitations });
    }

    // 3. Guardrails Check: Inbound evaluation
    const guardrailResult = Guardrails.evaluateInbound(payload.content, context);

    if (!guardrailResult.passed && guardrailResult.action === "block") {
      const blockMsg = "⚠️ This inquiry cannot be processed as it touches prohibited compliance topics.";
      ConversationManager.appendMessage(payload.sessionId, {
        sender: "system",
        senderName: "Safety Guardrail",
        content: blockMsg,
      });
      onStreamEvent?.("guardrail_alert", { action: "block", reasons: guardrailResult.reasons });
      onStreamEvent?.("done", { status: "blocked" });
      return { responseContent: blockMsg, citations: [], toolsExecuted: [], isEscalated: false };
    }

    if (guardrailResult.action === "escalate_to_human") {
      ConversationManager.updateSessionStatus(payload.sessionId, "escalated", "human", "Ini Godwin (Senior Lead)", "urgent");
      const escMsg = "🚨 This conversation has been escalated to a live Senior Human Support Lead based on safety guardrails. A team member is joining now.";
      ConversationManager.appendMessage(payload.sessionId, {
        sender: "system",
        senderName: "Supervisor Escalation",
        content: escMsg,
      });
      onStreamEvent?.("escalation", { reasons: guardrailResult.reasons, priority: "urgent" });
      onStreamEvent?.("done", { status: "escalated" });
      return { responseContent: escMsg, citations: context.retrievedCitations, toolsExecuted: ["human_escalate"], isEscalated: true };
    }

    // 4. LLM Router: Select model provider and budget
    const routingDecision = LlmRouter.selectModel(context);
    onStreamEvent?.("trace", { model: routingDecision.modelName, provider: routingDecision.provider, tier: routingDecision.tier });

    // 5. Tool Planner: Plan & execute microservice tools via Action Gateway / Temporal
    const plannedTools = ToolPlanner.planTools(context);
    const executedTools: string[] = [];

    for (const tool of plannedTools) {
      onStreamEvent?.("tool_call", { tool: tool.name, arguments: tool.arguments });
      const execResult = await ToolPlanner.executeTool(tool, context);
      executedTools.push(tool.name);
      onStreamEvent?.("tool_result", { tool: tool.name, success: execResult.success, result: execResult.result });
    }

    // 6. Prompt Management & Grounded Response Synthesis
    const systemPrompt = PromptManager.buildSystemPrompt(payload.stream, session.assignedName);
    
    // Synthesize token-by-token response stream
    let responseText = "";
    if (executedTools.includes("order_refund")) {
      responseText = `I have verified your account transaction records. Under our automated policy, transactions qualify for an instant $150 refund credit voucher, which has been dispatched to your billing account via ForgeGW.`;
    } else if (executedTools.includes("site_access_pin")) {
      responseText = `Your contractor credentials have been verified. An active emergency lockbox PIN has been generated and synchronized with the on-site gate controller.`;
    } else if (context.retrievedCitations.length > 0) {
      const topCitation = context.retrievedCitations[0];
      responseText = `Based on our verified Knowledge Base (${topCitation.title}), ${topCitation.snippet.slice(0, 140)}. Let me know if you would like me to process any automated actions.`;
    } else {
      responseText = `Thank you for reaching out regarding ${payload.stream}. I am reviewing your request and will provide the relevant documentation and resolution steps immediately.`;
    }

    // Simulate token streaming
    const words = responseText.split(" ");
    for (const word of words) {
      onStreamEvent?.("token", { text: `${word} ` });
    }

    // 7. Record AI Assistant message in Conversation Manager
    ConversationManager.appendMessage(payload.sessionId, {
      sender: "ai_employee",
      senderName: session.assignedName,
      senderAvatar: session.assignedAvatar,
      content: responseText,
      citations: context.retrievedCitations,
    });

    onStreamEvent?.("done", { status: "completed", latencyMs: Date.now() - startTime });

    // 8. Observability & Telemetry Recording
    ChatbotTelemetry.recordTrace({
      traceId,
      spanId: `span_${Date.now()}`,
      sessionId: payload.sessionId,
      tenantId: payload.tenantId,
      channel: payload.channel,
      model: routingDecision.modelName,
      promptTokens: systemPrompt.length / 4 + payload.content.length / 4,
      completionTokens: responseText.length / 4,
      totalTokens: (systemPrompt.length + payload.content.length + responseText.length) / 4,
      costUsd: routingDecision.estimatedCostUsd,
      latencyMs: Date.now() - startTime,
      guardrailTriggered: guardrailResult.action !== "proceed",
      toolsInvoked: executedTools,
      timestamp: new Date().toISOString(),
    });

    return {
      responseContent: responseText,
      citations: context.retrievedCitations,
      toolsExecuted: executedTools,
      isEscalated: false,
    };
  }
}

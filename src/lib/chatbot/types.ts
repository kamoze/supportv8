import type { ChatStreamType, PriorityLevel } from "@/lib/types";

// =============================================================================
// Experience Layer Types
// =============================================================================
export type ChannelType = "web_chat" | "mobile" | "voice" | "whatsapp" | "email";

export interface InboundMessagePayload {
  channel: ChannelType;
  tenantId: string;
  sessionId: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderPhone?: string;
  content: string;
  stream: ChatStreamType;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// API Edge Types
// =============================================================================
export interface EdgeAuthContext {
  tenantId: string;
  userId?: string;
  role?: string;
  isAuthorized: boolean;
  rateLimitRemaining: number;
}

export type SseEventType =
  | "start"
  | "token"
  | "citation"
  | "tool_call"
  | "tool_result"
  | "guardrail_alert"
  | "escalation"
  | "trace"
  | "done"
  | "error";

export interface SseStreamEvent {
  type: SseEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

// =============================================================================
// Agent Runtime Layer Types
// =============================================================================
export type LlmModelTier = "fast" | "balanced" | "reasoning";

export interface LlmRoutingDecision {
  modelName: string;
  provider: "forge_gateway" | "openai" | "anthropic" | "ollama" | "deepseek";
  tier: LlmModelTier;
  estimatedCostUsd: number;
  maxTokens: number;
}

export interface AgentContext {
  tenantId: string;
  sessionId: string;
  stream: ChatStreamType;
  customer: {
    name: string;
    email?: string;
    phone?: string;
    arrValueUsd?: number;
    accountTier?: string;
    sentimentScore: number;
  };
  intakeData?: Record<string, string>;
  conversationHistory: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
  }>;
  retrievedCitations: Array<{
    id: string;
    title: string;
    snippet: string;
    similarity: number;
  }>;
}

export interface ToolCallDefinition {
  name: "knowledge_search" | "order_refund" | "site_access_pin" | "human_escalate" | "schedule_task";
  arguments: Record<string, unknown>;
}

export interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result: Record<string, unknown>;
  executionTimeMs: number;
}

export interface GuardrailEvaluation {
  passed: boolean;
  action: "proceed" | "redact_pii" | "escalate_to_human" | "block";
  reasons: string[];
  sanitizedContent?: string;
}

// =============================================================================
// Observability Layer Types
// =============================================================================
export interface LlmTraceRecord {
  traceId: string;
  spanId: string;
  sessionId: string;
  tenantId: string;
  channel: ChannelType;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  guardrailTriggered: boolean;
  toolsInvoked: string[];
  temporalWorkflowId?: string;
  timestamp: string;
}

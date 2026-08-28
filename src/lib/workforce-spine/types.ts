import type { ChatStreamType, PriorityLevel } from "@/lib/types";

export type AutonomyTier = "auto_allowed" | "requires_supervisor_approval" | "prohibited";

export interface WorkforceEmployeeIdentity {
  id: string;
  name: string;
  role: string;
  avatar: string;
  supervisorName: string;
  supervisorEmail: string;
  tokenMonthlyQuota: number;
  tokensConsumed: number;
  maxAutonomousRefundUsd: number;
  voiceGender: "female" | "male" | "neutral";
  acousticPitchShift: number;
}

export interface WorkforceActionRequest {
  actionId: string;
  tenantId: string;
  employeeId: string;
  stream: ChatStreamType;
  operation: string;
  payload: Record<string, unknown>;
  estimatedCostUsd?: number;
  promptTokens?: number;
  completionTokens?: number;
  sessionId?: string;
  callerPhone?: string;
}

export interface WorkforceActionResult {
  actionId: string;
  success: boolean;
  status: "executed_autonomously" | "held_for_human_approval" | "blocked_by_governance";
  autonomyTier: AutonomyTier;
  output: Record<string, unknown>;
  workflowId?: string;
  tokensDeducted: number;
  remainingTokenBudget: number;
  knowledgeV8SummaryLogged: boolean;
  executionTimeMs: number;
  timestamp: string;
}

export interface WarmVoiceTransferPacket {
  callSid: string;
  callerNumber: string;
  customerName: string;
  sentimentScore: number;
  summaryWhisper: string;
  suggestedAction: string;
  supervisorExtension: string;
  sipHeaders: Record<string, string>;
}

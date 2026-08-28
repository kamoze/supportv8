import type {
  QueryKnowledgeInput,
  QueryKnowledgeOutput,
  EmitDominionInput,
  SyncGrowthV8Input,
  ExecuteForgeActionInput,
  ExecuteForgeActionOutput,
} from "./activities";
import type { ChatStreamType, PriorityLevel } from "@/lib/types";

export interface SupportTriageWorkflowInput {
  tenantId: string;
  sessionId: string;
  stream: ChatStreamType;
  customerName: string;
  customerEmail: string;
  query: string;
  priority: PriorityLevel;
}

export interface SupportTriageWorkflowResult {
  sessionId: string;
  workflowId?: string;
  triageStatus: "autonomous_resolved" | "escalated_to_human" | "routed_to_group";
  assignedTarget: string;
  ragCitations: QueryKnowledgeOutput["citations"];
  dominionEventId?: string;
  growthV8Synced: boolean;
}

export interface StaleWorkSweepWorkflowInput {
  tenantId: string;
  staleThresholdHours: number;
  autoCloseDays: number;
}

export interface ProactiveBroadcastWorkflowInput {
  tenantId: string;
  problemId: string;
  affectedAccountsCount: number;
  subject: string;
  body: string;
}

export interface InterServiceDispatchWorkflowInput {
  tenantId: string;
  triggerApp: "supportv8" | "growthv8" | "dominion" | "knowledgev8";
  operation: string;
  payload: Record<string, unknown>;
}

// In Temporal sandbox, activities are imported through proxyActivities
// For pure workflow definitions, we type-check signatures
export type WorkflowFunction<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

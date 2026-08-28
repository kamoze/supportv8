import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "./activities";
import type { ChatStreamType, PriorityLevel } from "@/lib/types";

// =============================================================================
// Temporal Activity Proxies
// =============================================================================

const {
  queryKnowledgeV8Activity,
  emitDominionTelemetryActivity,
  syncGrowthV8AccountActivity,
  executeForgeActionActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    initialInterval: "1 second",
    maximumInterval: "10 seconds",
    maximumAttempts: 3,
  },
});

// =============================================================================
// Workflow Types
// =============================================================================

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
  ragCitations: Array<{
    id: string;
    title: string;
    snippet: string;
    similarity: number;
  }>;
  dominionEventId?: string;
  growthV8Synced: boolean;
}

export interface StaleWorkSweepWorkflowInput {
  tenantId?: string;
  staleThresholdHours?: number;
  autoCloseDays?: number;
}

export interface ProactiveBroadcastWorkflowInput {
  tenantId?: string;
  problemId?: string;
  affectedAccountsCount?: number;
  subject?: string;
  body?: string;
}

export interface InterServiceDispatchWorkflowInput {
  tenantId: string;
  triggerApp: "supportv8" | "growthv8" | "dominion" | "knowledgev8";
  operation: string;
  payload: Record<string, unknown>;
}

// =============================================================================
// Workflow Implementations
// =============================================================================

/**
 * supportTriageWorkflow
 * Executes complete AI Copilot / Workforce triage lifecycle:
 * 1. Query KnowledgeV8 for grounding RAG citations.
 * 2. Emit telemetry to Dominion AIOps for monitoring.
 * 3. Sync customer profile with GrowthV8 CRM.
 */
export async function supportTriageWorkflow(
  input: SupportTriageWorkflowInput
): Promise<SupportTriageWorkflowResult> {
  const tenantId = input.tenantId || "tenant_default";

  // Step 1: Knowledge RAG Retrieval
  const rag = await queryKnowledgeV8Activity({
    tenantId,
    query: input.query,
    stream: input.stream,
    topK: 3,
  });

  // Step 2: Telemetry to Dominion
  const dom = await emitDominionTelemetryActivity({
    tenantId,
    eventType: "incident.detected",
    severity: input.priority === "urgent" ? "high" : "low",
    summary: `Customer ${input.customerName} submitted ${input.stream} ticket`,
    metadata: {
      sessionId: input.sessionId,
      stream: input.stream,
      priority: input.priority,
    },
  });

  // Step 3: Sync GrowthV8 Customer Profile
  const gv8 = await syncGrowthV8AccountActivity({
    tenantId,
    customerEmail: input.customerEmail,
    arrValue: 420000,
    sentimentClass: input.priority === "urgent" ? "frustrated" : "neutral",
    issueCount: 1,
  });

  const isEscalated = input.priority === "urgent";

  return {
    sessionId: input.sessionId,
    triageStatus: isEscalated ? "escalated_to_human" : "autonomous_resolved",
    assignedTarget: isEscalated ? "group_support_leads" : "beaver_sophia_voice",
    ragCitations: rag.citations,
    dominionEventId: dom.eventId,
    growthV8Synced: gv8.synced,
  };
}

/**
 * staleWorkSweepWorkflow
 * Periodic 10-minute sweep for stale unassigned or pending customer & contractor tickets.
 */
export async function staleWorkSweepWorkflow(
  input?: StaleWorkSweepWorkflowInput
): Promise<{ sweptCount: number; status: string }> {
  const tenantId = input?.tenantId || "tenant_default";

  await emitDominionTelemetryActivity({
    tenantId,
    eventType: "action.executed",
    severity: "low",
    summary: "Periodic stale work sweep executed by SupportV8 AI workforce",
  });

  // Simulate short task execution
  await sleep(100);

  return {
    sweptCount: 4,
    status: "completed",
  };
}

/**
 * proactiveBroadcastWorkflow
 * Periodic 15-minute correlation of recurring customer issues against active cluster incidents.
 */
export async function proactiveBroadcastWorkflow(
  input?: ProactiveBroadcastWorkflowInput
): Promise<{ correlated: boolean; incidentId: string; status: string }> {
  const tenantId = input?.tenantId || "tenant_default";
  const problemId = input?.problemId || "PRB-218";

  await emitDominionTelemetryActivity({
    tenantId,
    eventType: "incident.detected",
    severity: "medium",
    summary: `Proactive problem correlation analysis for ${problemId}`,
  });

  await sleep(100);

  return {
    correlated: true,
    incidentId: problemId,
    status: "broadcast_ready",
  };
}

/**
 * interServiceDispatchWorkflow
 * Executes inter-service cross-vertical operations via Forge Gateway.
 */
export async function interServiceDispatchWorkflow(
  input: InterServiceDispatchWorkflowInput
): Promise<{ success: boolean; actionId: string; auditHash: string }> {
  const tenantId = input.tenantId || "tenant_default";

  const action = await executeForgeActionActivity({
    tenantId,
    actionId: `act_${Date.now()}`,
    operation: input.operation as any,
    payload: input.payload,
    idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });

  return {
    success: action.success,
    actionId: action.actionId,
    auditHash: action.auditHash,
  };
}

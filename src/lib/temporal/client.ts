import {
  TEMPORAL_ADDRESS,
  TEMPORAL_NAMESPACE,
  TASK_QUEUE,
  isTemporalEnabled,
} from "./config";
import {
  queryKnowledgeV8Activity,
  emitDominionTelemetryActivity,
  syncGrowthV8AccountActivity,
  executeForgeActionActivity,
} from "./activities";
import type {
  SupportTriageWorkflowInput,
  SupportTriageWorkflowResult,
  StaleWorkSweepWorkflowInput,
  ProactiveBroadcastWorkflowInput,
  InterServiceDispatchWorkflowInput,
} from "./workflows";

let clientPromise: Promise<any> | null = null;

async function getTemporalClient(): Promise<any> {
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const { Connection, Client } = await import("@temporalio/client");
        const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
        return new Client({ connection, namespace: TEMPORAL_NAMESPACE });
      } catch (err) {
        console.warn("[supportV8] Temporal connection failed, using inline execution:", err);
        return null;
      }
    })();
  }
  return clientPromise;
}

/**
 * Enqueue support triage workflow.
 * When Temporal is not configured, executes activities inline synchronously.
 */
export async function enqueueSupportTriage(
  input: SupportTriageWorkflowInput
): Promise<SupportTriageWorkflowResult> {
  if (isTemporalEnabled()) {
    try {
      const client = await getTemporalClient();
      if (client) {
        const handle = await client.workflow.start("supportTriageWorkflow", {
          taskQueue: TASK_QUEUE,
          workflowId: `triage:${input.tenantId}:${input.sessionId}`,
          workflowIdReusePolicy: "ALLOW_DUPLICATE_FAILED_ONLY",
          args: [input],
        });
        return {
          sessionId: input.sessionId,
          triageStatus: "autonomous_resolved",
          assignedTarget: `temporal-workflow-${handle.workflowId}`,
          ragCitations: [],
          growthV8Synced: true,
        };
      }
    } catch (err) {
      console.warn("[supportV8] Temporal dispatch failed, falling back to inline:", err);
    }
  }

  // Synchronous Inline Execution Fallback (parallel execution)
  const [rag, dom, gv8] = await Promise.all([
    queryKnowledgeV8Activity({
      tenantId: input.tenantId,
      query: input.query,
      stream: input.stream,
    }),
    emitDominionTelemetryActivity({
      tenantId: input.tenantId,
      eventType: "incident.detected",
      severity: input.priority === "urgent" ? "high" : "low",
      summary: `Customer ${input.customerName} submitted ${input.stream} ticket`,
    }),
    syncGrowthV8AccountActivity({
      tenantId: input.tenantId,
      customerEmail: input.customerEmail,
      arrValue: 420000,
      sentimentClass: input.priority === "urgent" ? "frustrated" : "neutral",
      issueCount: 1,
    }),
  ]);

  return {
    sessionId: input.sessionId,
    triageStatus: input.priority === "urgent" ? "escalated_to_human" : "autonomous_resolved",
    assignedTarget: input.priority === "urgent" ? "group_support" : "beaver-sophia",
    ragCitations: rag.citations,
    dominionEventId: dom.eventId,
    growthV8Synced: gv8.synced,
  };
}

/**
 * Enqueue proactive broadcast workflow
 */
export async function enqueueProactiveBroadcast(
  input: ProactiveBroadcastWorkflowInput
): Promise<{ success: boolean; broadcastId: string }> {
  if (isTemporalEnabled()) {
    try {
      const client = await getTemporalClient();
      if (client) {
        await client.workflow.start("proactiveBroadcastWorkflow", {
          taskQueue: TASK_QUEUE,
          workflowId: `broadcast:${input.tenantId}:${input.problemId}:${Date.now()}`,
          args: [input],
        });
      }
    } catch (err) {
      console.warn("[supportV8] Temporal broadcast failed, running inline:", err);
    }
  }

  // Inline emit
  await emitDominionTelemetryActivity({
    tenantId: input.tenantId,
    eventType: "incident.detected",
    severity: "critical",
    summary: `Proactive mitigation dispatched for ${input.problemId}: ${input.subject}`,
  });

  return {
    success: true,
    broadcastId: `bcast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
}

/**
 * Enqueue cross-service dispatch workflow across KnowledgeV8, GrowthV8, Dominion & ForgeGW
 */
export async function enqueueInterServiceDispatch(
  input: InterServiceDispatchWorkflowInput
): Promise<{ success: boolean; results: Record<string, unknown> }> {
  const results: Record<string, unknown> = {};

  // 1. ForgeGW execution if operation requested
  if (input.operation.startsWith("forge.")) {
    const forgeRes = await executeForgeActionActivity({
      tenantId: input.tenantId,
      actionId: `act_${Date.now()}`,
      operation: (input.payload.actionName as any) || "orderv8.refund",
      payload: input.payload,
      idempotencyKey: `idemp_${Date.now()}`,
    });
    results.forge = forgeRes;
  }

  // 2. Dominion telemetry
  const domRes = await emitDominionTelemetryActivity({
    tenantId: input.tenantId,
    eventType: "action.executed",
    severity: "medium",
    summary: `Inter-service action ${input.operation} triggered by ${input.triggerApp}`,
    metadata: input.payload,
  });
  results.dominion = domRes;

  return {
    success: true,
    results,
  };
}

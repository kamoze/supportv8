import { Client, ScheduleAlreadyRunning } from "@temporalio/client";
import { TASK_QUEUE } from "./config";

export type ScheduledEventConfig = {
  scheduleId: string;
  workflowType: string;
  spec: {
    intervals?: Array<{ every: string }>;
    cronExpressions?: string[];
  };
  description: string;
  defaultWorkflowId: string;
  args?: unknown[];
};

export const SUPPORT_SCHEDULED_EVENTS: ScheduledEventConfig[] = [
  {
    scheduleId: "stale-work-sweep",
    workflowType: "staleWorkSweepWorkflow",
    spec: { intervals: [{ every: "10 minutes" }] },
    description: "Continuous 10-minute sweep for stale unassigned or pending customer & contractor tickets.",
    defaultWorkflowId: "support-stale-work-sweep-run",
    args: [{ tenantId: "tenant_default", staleThresholdHours: 24 }],
  },
  {
    scheduleId: "proactive-problem-correlation",
    workflowType: "proactiveBroadcastWorkflow",
    spec: { intervals: [{ every: "15 minutes" }] },
    description: "Periodic 15-minute correlation of recurring customer issues against active cluster incidents.",
    defaultWorkflowId: "support-problem-correlation-run",
    args: [{ tenantId: "tenant_default", problemId: "PRB-218" }],
  },
  {
    scheduleId: "daily-knowledge-rag-sync",
    workflowType: "dailyKnowledgeRagSyncWorkflow",
    spec: { cronExpressions: ["0 0 * * *"] }, // Daily at Midnight UTC
    description: "Daily midnight synchronization of 1536-dim vector embeddings and KnowledgeV8 graph nodes.",
    defaultWorkflowId: "support-daily-rag-sync-run",
    args: [{ tenantId: "tenant_default", stream: "customers" }],
  },
];

export async function ensureTemporalSchedules(
  client: Client
): Promise<{ created: string[]; existing: string[]; updated: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];
  const updated: string[] = [];

  for (const event of SUPPORT_SCHEDULED_EVENTS) {
    try {
      await client.schedule.create({
        scheduleId: event.scheduleId,
        spec: event.spec,
        action: {
          type: "startWorkflow",
          workflowType: event.workflowType,
          taskQueue: TASK_QUEUE,
          workflowId: event.defaultWorkflowId,
          args: event.args || [{ tenantId: "tenant_default" }],
        },
      });
      created.push(event.scheduleId);
    } catch (err: any) {
      if (err instanceof ScheduleAlreadyRunning || err?.name === "ScheduleAlreadyRunning") {
        existing.push(event.scheduleId);
        // Attempt to update the existing schedule action to match new workflowType and args
        try {
          const handle = client.schedule.getHandle(event.scheduleId);
          await handle.update((prev) => ({
            ...prev,
            spec: event.spec,
            action: {
              type: "startWorkflow",
              workflowType: event.workflowType,
              taskQueue: TASK_QUEUE,
              workflowId: event.defaultWorkflowId,
              args: event.args || [{ tenantId: "tenant_default" }],
            },
          }));
          updated.push(event.scheduleId);
        } catch {
          // Non-blocking if update fails
        }
        continue;
      }
      console.warn(`[supportv8-worker] failed to register schedule ${event.scheduleId}:`, err);
    }
  }

  return { created, existing, updated };
}

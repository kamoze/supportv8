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
};

export const SUPPORT_SCHEDULED_EVENTS: ScheduledEventConfig[] = [
  {
    scheduleId: "stale-work-sweep",
    workflowType: "staleWorkSweepWorkflow",
    spec: { intervals: [{ every: "10 minutes" }] },
    description: "Continuous 10-minute sweep for stale unassigned or pending customer & contractor tickets.",
    defaultWorkflowId: "support-stale-work-sweep-run",
  },
  {
    scheduleId: "proactive-problem-correlation",
    workflowType: "proactiveBroadcastWorkflow",
    spec: { intervals: [{ every: "15 minutes" }] },
    description: "Periodic 15-minute correlation of recurring customer issues against active cluster incidents.",
    defaultWorkflowId: "support-problem-correlation-run",
  },
  {
    scheduleId: "daily-knowledge-rag-sync",
    workflowType: "supportTriageWorkflow",
    spec: { cronExpressions: ["0 0 * * *"] }, // Daily at Midnight UTC
    description: "Daily midnight synchronization of 1536-dim vector embeddings and KnowledgeV8 graph nodes.",
    defaultWorkflowId: "support-daily-rag-sync-run",
  },
];

export async function ensureTemporalSchedules(
  client: Client
): Promise<{ created: string[]; existing: string[] }> {
  const created: string[] = [];
  const existing: string[] = [];

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
        },
      });
      created.push(event.scheduleId);
    } catch (err: any) {
      if (err instanceof ScheduleAlreadyRunning || err?.name === "ScheduleAlreadyRunning") {
        existing.push(event.scheduleId);
        continue;
      }
      console.warn(`[supportv8-worker] failed to register schedule ${event.scheduleId}:`, err);
    }
  }

  return { created, existing };
}

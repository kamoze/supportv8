/**
 * supportV8 Temporal Workflows
 */

import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";

const { sweepStaleTicketsActivity, scanKnowledgeGapsActivity, dispatchGovernedActionActivity } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "2 minutes",
    retry: {
      maximumAttempts: 3,
    },
  });

/**
 * Recurring Stale Work Sweep Workflow (Cron: 0 2 * * *)
 */
export async function staleWorkSweepWorkflow(): Promise<{ closedCount: number; scannedCount: number }> {
  return await sweepStaleTicketsActivity();
}

/**
 * Knowledge Refresh Employee Workflow (Cron: 0 4 * * *)
 */
export async function knowledgeRefreshWorkflow(): Promise<{ gapsFound: number }> {
  return await scanKnowledgeGapsActivity();
}

/**
 * Proactive Problem Mitigation Broadcast Workflow
 */
export async function proactiveBroadcastWorkflow(params: {
  tenantId: string;
  problemId: string;
  message: string;
}): Promise<{ success: boolean; auditId: string }> {
  return await dispatchGovernedActionActivity({
    tenantId: params.tenantId,
    operationId: "problem.notify_customers",
    input: {
      problem_id: params.problemId,
      message: params.message,
    },
    actorId: "proactive_comms_workflow",
  });
}

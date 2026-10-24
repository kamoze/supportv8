/**
 * Temporal Workflow for Periodic Context Retention Purge
 */

import { proxyActivities } from "@temporalio/workflow";
import type { RetentionPurgeWorkflowResult, purgeExpiredRawContextActivity } from "./activities";

export type { RetentionPurgeWorkflowResult };

const activities = proxyActivities<{
  purgeExpiredRawContextActivity: typeof purgeExpiredRawContextActivity;
}>({
  startToCloseTimeout: "5 minutes",
  retry: {
    maximumAttempts: 3,
    initialInterval: "5s",
  },
});

export async function runRetentionPurgeWorkflow(
  asOfIso?: string
): Promise<RetentionPurgeWorkflowResult> {
  return await activities.purgeExpiredRawContextActivity(asOfIso);
}

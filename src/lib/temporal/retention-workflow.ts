/**
 * Temporal Workflow & Activities for Periodic Context Retention Purge
 */

import { proxyActivities } from "@temporalio/workflow";
import { retentionService, PurgeResult } from "../retention/retention-service";

export interface RetentionPurgeWorkflowResult extends PurgeResult {
  timestamp: string;
}

export async function purgeExpiredRawContextActivity(
  asOfIso?: string
): Promise<RetentionPurgeWorkflowResult> {
  const asOf = asOfIso ? new Date(asOfIso) : new Date();
  const result = await retentionService.purgeExpiredRawContext(asOf);
  return {
    ...result,
    timestamp: new Date().toISOString(),
  };
}

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

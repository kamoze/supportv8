/**
 * supportV8 Temporal Activities
 */

import { staleWorkSweeper } from "../services/stale-work-sweeper";
import { problemService } from "../services/problem-service";
import { knowledgeService } from "../services/knowledge-service";
import { globalActionGateway } from "../runtime/action-gateway-client";

export async function sweepStaleTicketsActivity(): Promise<{ closedCount: number; scannedCount: number }> {
  const result = await staleWorkSweeper.executeAllSafeToClose();
  return {
    closedCount: result.executedCount,
    scannedCount: 1420,
  };
}

export async function scanKnowledgeGapsActivity(): Promise<{ gapsFound: number }> {
  const gaps = knowledgeService.getGaps();
  return {
    gapsFound: gaps.length,
  };
}

export async function dispatchGovernedActionActivity(params: {
  tenantId: string;
  operationId: string;
  input: Record<string, unknown>;
  actorId: string;
}): Promise<{ success: boolean; auditId: string }> {
  const res = await globalActionGateway.requestAction({
    tenantId: params.tenantId,
    actor: {
      id: params.actorId,
      type: "automation",
      name: "Temporal Workflow Worker",
    },
    operationId: params.operationId,
    input: params.input,
  });

  return {
    success: res.success,
    auditId: res.auditId,
  };
}

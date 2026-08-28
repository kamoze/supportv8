/**
 * supportV8 Stale Work Sweeper Service
 * Basis: EP16 (SV8-150 to SV8-154)
 */

import { db } from "../db/mock-data";
import type { StaleWorkCandidate } from "../types";
import { globalActionGateway } from "../runtime/action-gateway-client";
import { OP_ZD_CLOSE } from "../runtime/operations";

export interface SweepDryRunResult {
  totalScanned: number;
  candidatesFound: number;
  safeToCloseCount: number;
  remindCustomerCount: number;
  linkToProblemCount: number;
  candidates: StaleWorkCandidate[];
}

export class StaleWorkSweeper {
  public getCandidates(): StaleWorkCandidate[] {
    return [...db.staleWork];
  }

  public runDryRun(): SweepDryRunResult {
    const candidates = db.staleWork.filter((c) => c.status !== "executed" && c.status !== "dismissed");
    const safeToClose = candidates.filter((c) => c.recommendedAction === "close").length;
    const remind = candidates.filter((c) => c.recommendedAction === "remind_customer" || c.recommendedAction === "remind_agent").length;
    const linkProblem = candidates.filter((c) => c.recommendedAction === "link_to_problem").length;

    return {
      totalScanned: 1420,
      candidatesFound: candidates.length,
      safeToCloseCount: safeToClose,
      remindCustomerCount: remind,
      linkToProblemCount: linkProblem,
      candidates,
    };
  }

  public async executeCandidateAction(candidateId: string, actorId = "sweeper_automation"): Promise<{ success: boolean; message: string; auditId?: string }> {
    const candidate = db.staleWork.find((c) => c.id === candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }

    if (candidate.recommendedAction === "close") {
      const result = await globalActionGateway.requestAction({
        tenantId: db.tenant.tenantId,
        actor: {
          id: actorId,
          type: "automation",
          name: "Work Sweep Worker",
        },
        operationId: OP_ZD_CLOSE,
        input: {
          ticket_id: candidate.externalId,
        },
      });

      if (result.success) {
        candidate.status = "executed";
        return {
          success: true,
          message: `Closed stale ticket ${candidate.externalId} on ${candidate.source} via Action Gateway.`,
          auditId: result.auditId,
        };
      } else {
        return {
          success: false,
          message: `Failed to close ticket: ${result.error}`,
          auditId: result.auditId,
        };
      }
    } else {
      candidate.status = "executed";
      return {
        success: true,
        message: `Action '${candidate.recommendedAction}' performed for candidate ${candidate.id}.`,
      };
    }
  }

  public async executeAllSafeToClose(): Promise<{ executedCount: number; results: Array<{ id: string; success: boolean }> }> {
    const candidates = db.staleWork.filter((c) => c.recommendedAction === "close" && c.status === "detected");
    const results: Array<{ id: string; success: boolean }> = [];
    let count = 0;

    for (const c of candidates) {
      const res = await this.executeCandidateAction(c.id);
      results.push({ id: c.id, success: res.success });
      if (res.success) count++;
    }

    return {
      executedCount: count,
      results,
    };
  }
}

export const staleWorkSweeper = new StaleWorkSweeper();

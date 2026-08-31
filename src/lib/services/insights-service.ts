/**
 * supportV8 Actionable Insights Service
 * Basis: EP14 (SV8-130 to SV8-133)
 */

import { db } from "../db/mock-data";
import type { Insight } from "../types";
import { globalActionGateway } from "../runtime/action-gateway-client";

export class InsightsService {
  public getAll(tenantSlug?: string): Insight[] {
    if (!tenantSlug) return [...db.insights];
    return db.getTenantData(tenantSlug).insights;
  }

  public getById(id: string): Insight | undefined {
    return db.insights.find((ins) => ins.id === id);
  }

  public updateStatus(id: string, status: "new" | "reviewed" | "actioned" | "dismissed"): Insight | undefined {
    const insight = db.insights.find((ins) => ins.id === id);
    if (!insight) return undefined;
    insight.status = status;
    return insight;
  }

  public async executeInsightAction(id: string, actorId = "analyst_1"): Promise<{ success: boolean; message: string; auditId?: string }> {
    const insight = db.insights.find((ins) => ins.id === id);
    if (!insight) {
      throw new Error(`Insight ${id} not found`);
    }

    if (!insight.recommendedOperation) {
      insight.status = "actioned";
      return { success: true, message: `Insight ${id} marked as actioned.` };
    }

    // Dispatch through Action Gateway
    const result = await globalActionGateway.requestAction({
      tenantId: db.tenant.tenantId,
      actor: {
        id: actorId,
        type: "human",
        name: "Support Analyst",
      },
      operationId: insight.recommendedOperation,
      input: insight.actionPayload || {
        ticket_id: "ZD-884233",
        note: `Action executed from Insight ${insight.id}: ${insight.title}`,
      },
    });

    if (result.success) {
      insight.status = "actioned";
      return {
        success: true,
        message: `Action '${insight.recommendedOperation}' ${result.status === "awaiting_approval" ? "submitted for human approval" : "executed successfully"} via Action Gateway.`,
        auditId: result.auditId,
      };
    } else {
      return {
        success: false,
        message: `Action execution failed: ${result.error}`,
        auditId: result.auditId,
      };
    }
  }
}

export const insightsService = new InsightsService();

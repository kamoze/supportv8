/**
 * supportV8 Actionable Insights Service
 * Backed by durable PostgreSQL schema under forced RLS.
 */

import { pgClient, PostgresClient } from "../db/pg-client";
import type { Insight } from "../types";
import { globalActionGateway } from "../runtime/action-gateway-client";

function normalizeTenantId(tenant?: string): string {
  if (!tenant) return "tenant_default";
  const clean = tenant.toLowerCase().trim();
  const slug = clean.startsWith("tenant_") ? clean.slice(7) : clean;
  return `tenant_${slug.replace(/[^a-z0-9_]/g, "_")}`;
}

export class InsightsService {
  private client: PostgresClient;

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  public async getAll(tenantParam?: string): Promise<Insight[]> {
    if (!tenantParam) return [];
    const tenantId = normalizeTenantId(tenantParam);

    return this.client.withTenantSession(tenantId, async (session) => {
      // 1. Fetch active problems
      const problems = await session.query<any>(
        `SELECT id, title, summary, suspected_cause, impact, confidence,
                affected_customer_count, estimated_revenue_exposure, created_at
         FROM supportv8.problems
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [tenantId]
      );

      if (!problems || problems.length === 0) {
        return [];
      }

      const insights: Insight[] = [];
      for (const p of problems) {
        insights.push({
          id: `ins_${p.id}`,
          tenantId,
          title: `Correlated Incident Pattern: ${p.title}`,
          finding: p.summary,
          evidence: [
            `${p.affected_customer_count} customers affected`,
            `Estimated revenue exposure: $${Number(p.estimated_revenue_exposure).toLocaleString()}`,
          ],
          confidence: Number(p.confidence || 0.9),
          affectedSegment: p.affected_customer_count > 5 ? "Enterprise & High-Volume" : "Standard",
          businessImpact: p.impact,
          likelyDriver: p.suspected_cause || "System degradation",
          recommendation: "Investigate root cause and apply infrastructure mitigation",
          status: "new",
          createdAt: p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at),
        });
      }

      return insights;
    });
  }

  public async getById(id: string, tenantParam?: string): Promise<Insight | undefined> {
    const all = await this.getAll(tenantParam);
    return all.find((ins) => ins.id === id);
  }

  public async updateStatus(
    id: string,
    status: "new" | "reviewed" | "actioned" | "dismissed",
    tenantParam?: string
  ): Promise<Insight | undefined> {
    const insight = await this.getById(id, tenantParam);
    if (!insight) return undefined;
    insight.status = status;
    return insight;
  }

  public async executeInsightAction(
    id: string,
    tenantParam?: string,
    actorId = "analyst_1"
  ): Promise<{ success: boolean; message: string; auditId?: string }> {
    const tenantId = normalizeTenantId(tenantParam);
    const insight = await this.getById(id, tenantId);
    if (!insight) {
      throw new Error(`Insight ${id} not found`);
    }

    if (!insight.recommendedOperation) {
      insight.status = "actioned";
      return { success: true, message: `Insight ${id} marked as actioned.` };
    }

    // Dispatch through Action Gateway
    const result = await globalActionGateway.requestAction({
      tenantId,
      actor: {
        id: actorId,
        type: "human",
        name: "Support Analyst",
      },
      operationId: insight.recommendedOperation,
      input: insight.actionPayload || {
        ticket_id: id,
        note: `Action executed from Insight ${insight.id}: ${insight.title}`,
      },
    });

    if (result.success) {
      insight.status = "actioned";
      return {
        success: true,
        message: `Action '${insight.recommendedOperation}' ${
          result.status === "awaiting_approval"
            ? "submitted for human approval"
            : "executed successfully"
        } via Action Gateway.`,
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

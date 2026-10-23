import type { LlmTraceRecord } from "../types";
import crypto from "node:crypto";
import { pgClient, PostgresClient } from "@/lib/db/pg-client";

/**
 * Tenant-partitioned trace buffer (exported to Langfuse / OpenTelemetry in cluster).
 * Strictly enforces per-tenant isolation so Tenant A telemetry can never leak to Tenant B.
 */
const tracesByTenant: Map<string, LlmTraceRecord[]> = new Map();
const MAX_BUFFER_PER_TENANT = 500;

const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/gi, // email
  /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // phone number
  /(?:api[_-]?key|secret|token|password|auth)['"]?\s*[:=]\s*['"]?[a-zA-Z0-9_\-.]+/gi,
];

function sanitizeString(val: string): string {
  let cleaned = val;
  for (const pattern of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "[REDACTED]");
  }
  return cleaned;
}

export class ChatbotTelemetry {
  /**
   * Records an OpenTelemetry / Langfuse compliant LLM trace span.
   * Enforces tenant partitioning and redacts any sensitive prompt text, tokens, or PII.
   */
  static recordTrace(record: LlmTraceRecord): void {
    if (!record || !record.tenantId) {
      return;
    }

    const tenantId = record.tenantId;

    // Sanitize any extra fields that might carry prompts, credentials, or PII
    const sanitizedRecord: LlmTraceRecord = {
      traceId: sanitizeString(record.traceId),
      spanId: sanitizeString(record.spanId),
      sessionId: sanitizeString(record.sessionId),
      tenantId: record.tenantId,
      channel: record.channel,
      model: record.model,
      promptTokens: Number(record.promptTokens) || 0,
      completionTokens: Number(record.completionTokens) || 0,
      totalTokens: Number(record.totalTokens) || 0,
      costUsd: Number(record.costUsd) || 0,
      latencyMs: Number(record.latencyMs) || 0,
      guardrailTriggered: Boolean(record.guardrailTriggered),
      toolsInvoked: Array.isArray(record.toolsInvoked)
        ? record.toolsInvoked.map((t) => sanitizeString(String(t)))
        : [],
      temporalWorkflowId: record.temporalWorkflowId ? sanitizeString(record.temporalWorkflowId) : undefined,
      timestamp: record.timestamp || new Date().toISOString(),
      correlationId: record.correlationId ? sanitizeString(record.correlationId) : undefined,
      operation: record.operation ? sanitizeString(record.operation) : "chat_completion",
      durationMs: record.durationMs !== undefined ? Number(record.durationMs) : Number(record.latencyMs) || 0,
      outcome: record.outcome ?? (record.errorCode ? "error" : "success"),
      errorCode: record.errorCode ? sanitizeString(record.errorCode) : undefined,
    };

    let tenantTraces = tracesByTenant.get(tenantId);
    if (!tenantTraces) {
      tenantTraces = [];
      tracesByTenant.set(tenantId, tenantTraces);
    }

    tenantTraces.unshift(sanitizedRecord);
    if (tenantTraces.length > MAX_BUFFER_PER_TENANT) {
      tenantTraces.pop();
    }

    // Persist durable trace to PostgreSQL under forced tenant RLS (non-blocking)
    try {
      if (PostgresClient.hasActiveClient()) {
        pgClient.withTenantSession(tenantId, async (session) => {
          await session.query(
            `INSERT INTO supportv8.llm_traces (
               id, tenant_id, trace_id, span_id, session_id, channel, model,
               prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms,
               guardrail_triggered, tools_invoked, created_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7,
               $8, $9, $10, $11, $12,
               $13, $14, $15
             )`,
            [
              `tr_${crypto.randomUUID().slice(0, 16)}`,
              tenantId,
              sanitizedRecord.traceId,
              sanitizedRecord.spanId,
              sanitizedRecord.sessionId || "",
              sanitizedRecord.channel || "web_chat",
              sanitizedRecord.model || "unknown",
              sanitizedRecord.promptTokens || 0,
              sanitizedRecord.completionTokens || 0,
              sanitizedRecord.totalTokens || 0,
              sanitizedRecord.costUsd || 0,
              sanitizedRecord.latencyMs || 0,
              sanitizedRecord.guardrailTriggered || false,
              JSON.stringify(sanitizedRecord.toolsInvoked || []),
              sanitizedRecord.timestamp || new Date().toISOString(),
            ]
          );
        }).catch(() => {});
      }
    } catch {}
  }

  /**
   * Retrieves recorded LLM traces strictly for the requested tenant from in-memory buffer.
   * If tenantId is omitted, returns an empty array to prevent cross-tenant exposure.
   */
  static getTraces(filters?: { tenantId?: string; sessionId?: string; correlationId?: string }): LlmTraceRecord[] {
    if (!filters?.tenantId) {
      return [];
    }

    const tenantTraces = tracesByTenant.get(filters.tenantId) || [];
    return tenantTraces.filter((t) => {
      if (filters.sessionId && t.sessionId !== filters.sessionId) return false;
      if (filters.correlationId && t.correlationId !== filters.correlationId) return false;
      return true;
    });
  }

  /**
   * Retrieves recorded LLM traces querying PostgreSQL under tenant RLS when active,
   * falling back to in-memory buffer.
   */
  static async getTracesAsync(filters?: { tenantId?: string; sessionId?: string; correlationId?: string }): Promise<LlmTraceRecord[]> {
    if (!filters?.tenantId) {
      return [];
    }

    const tenantId = filters.tenantId;
    if (PostgresClient.hasActiveClient()) {
      try {
        const rows = await pgClient.withTenantSession(tenantId, async (session) => {
          let sql = `
            SELECT id, tenant_id, trace_id, span_id, session_id, channel, model,
                   prompt_tokens, completion_tokens, total_tokens, cost_usd, latency_ms,
                   guardrail_triggered, tools_invoked, created_at
            FROM supportv8.llm_traces
            WHERE tenant_id = $1
          `;
          const params: unknown[] = [tenantId];
          if (filters.sessionId) {
            params.push(filters.sessionId);
            sql += ` AND session_id = $${params.length}`;
          }
          sql += ` ORDER BY created_at DESC LIMIT 50`;
          return await session.query<any>(sql, params);
        });

        if (rows && rows.length > 0) {
          return rows.map((r) => ({
            id: r.id,
            tenantId: r.tenant_id,
            traceId: r.trace_id,
            spanId: r.span_id,
            sessionId: r.session_id,
            channel: r.channel,
            model: r.model,
            promptTokens: Number(r.prompt_tokens || 0),
            completionTokens: Number(r.completion_tokens || 0),
            totalTokens: Number(r.total_tokens || 0),
            costUsd: Number(r.cost_usd || 0),
            latencyMs: Number(r.latency_ms || 0),
            guardrailTriggered: Boolean(r.guardrail_triggered),
            toolsInvoked: r.tools_invoked || [],
            timestamp: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
          }));
        }
      } catch {
        // fallback to in-memory traces
      }
    }

    return this.getTraces(filters);
  }

  /**
   * Aggregates token consumption and cost telemetry metrics.
   * If tenantId is provided, computes metrics strictly for that tenant.
   * If tenantId is omitted, computes metrics across all tenant traces.
   */
  static getMetricsSummary(tenantId?: string): {
    totalTraces: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    guardrailTriggerRate: number;
  } {
    const tracesToAggregate = tenantId
      ? tracesByTenant.get(tenantId) || []
      : Array.from(tracesByTenant.values()).flat();

    if (tracesToAggregate.length === 0) {
      return {
        totalTraces: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        avgLatencyMs: 0,
        guardrailTriggerRate: 0,
      };
    }

    const totalTokens = tracesToAggregate.reduce((acc, t) => acc + t.totalTokens, 0);
    const totalCostUsd = tracesToAggregate.reduce((acc, t) => acc + t.costUsd, 0);
    const totalLatency = tracesToAggregate.reduce((acc, t) => acc + t.latencyMs, 0);
    const guardrailTriggers = tracesToAggregate.filter((t) => t.guardrailTriggered).length;

    return {
      totalTraces: tracesToAggregate.length,
      totalTokens,
      totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
      avgLatencyMs: Math.round(totalLatency / tracesToAggregate.length),
      guardrailTriggerRate: parseFloat(((guardrailTriggers / tracesToAggregate.length) * 100).toFixed(1)),
    };
  }

  /**
   * Computes telemetry metrics querying PostgreSQL under tenant RLS when active,
   * falling back to in-memory aggregation.
   */
  static async getMetricsSummaryAsync(tenantId?: string): Promise<{
    totalTraces: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    guardrailTriggerRate: number;
  }> {
    if (tenantId && PostgresClient.hasActiveClient()) {
      try {
        const rows = await pgClient.withTenantSession(tenantId, async (session) => {
          return await session.query<any>(
            `SELECT
               COUNT(*)::int as total_traces,
               COALESCE(SUM(total_tokens), 0)::int as total_tokens,
               COALESCE(SUM(cost_usd), 0)::numeric as total_cost_usd,
               COALESCE(AVG(latency_ms), 0)::numeric as avg_latency_ms,
               COALESCE(COUNT(*) FILTER (WHERE guardrail_triggered), 0)::int as guardrail_triggers
             FROM supportv8.llm_traces
             WHERE tenant_id = $1`,
            [tenantId]
          );
        });

        if (rows && rows.length > 0 && Number(rows[0].total_traces) > 0) {
          const row = rows[0];
          const totalTraces = Number(row.total_traces || 0);
          const guardrailTriggers = Number(row.guardrail_triggers || 0);
          return {
            totalTraces,
            totalTokens: Number(row.total_tokens || 0),
            totalCostUsd: parseFloat(Number(row.total_cost_usd || 0).toFixed(4)),
            avgLatencyMs: Math.round(Number(row.avg_latency_ms || 0)),
            guardrailTriggerRate: totalTraces > 0 ? parseFloat(((guardrailTriggers / totalTraces) * 100).toFixed(1)) : 0,
          };
        }
      } catch {
        // fallback to in-memory summary
      }
    }

    return this.getMetricsSummary(tenantId);
  }

  /**
   * Clears telemetry buffer for a specific tenant or all tenants (test fixture reset).
   */
  static clear(tenantId?: string): void {
    if (tenantId) {
      tracesByTenant.delete(tenantId);
    } else {
      tracesByTenant.clear();
    }
  }
}

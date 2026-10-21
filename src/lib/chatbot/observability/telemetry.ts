import type { LlmTraceRecord } from "../types";

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
  }

  /**
   * Retrieves recorded LLM traces strictly for the requested tenant.
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

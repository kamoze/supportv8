import type { LlmTraceRecord } from "../types";

// In-memory trace buffer (exported to Langfuse / OpenTelemetry in cluster)
const tracesBuffer: LlmTraceRecord[] = [];
const MAX_BUFFER_SIZE = 1000;

export class ChatbotTelemetry {
  /**
   * Records an OpenTelemetry / Langfuse compliant LLM trace span
   */
  static recordTrace(record: LlmTraceRecord): void {
    tracesBuffer.unshift(record);
    if (tracesBuffer.length > MAX_BUFFER_SIZE) {
      tracesBuffer.pop();
    }
  }

  /**
   * Retrieves recorded LLM traces with optional tenant / channel filter
   */
  static getTraces(filters?: { tenantId?: string; sessionId?: string }): LlmTraceRecord[] {
    return tracesBuffer.filter((t) => {
      if (filters?.tenantId && t.tenantId !== filters.tenantId) return false;
      if (filters?.sessionId && t.sessionId !== filters.sessionId) return false;
      return true;
    });
  }

  /**
   * Aggregates token consumption and cost telemetry metrics
   */
  static getMetricsSummary(): {
    totalTraces: number;
    totalTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
    guardrailTriggerRate: number;
  } {
    if (tracesBuffer.length === 0) {
      return {
        totalTraces: 0,
        totalTokens: 0,
        totalCostUsd: 0,
        avgLatencyMs: 0,
        guardrailTriggerRate: 0,
      };
    }

    const totalTokens = tracesBuffer.reduce((acc, t) => acc + t.totalTokens, 0);
    const totalCostUsd = tracesBuffer.reduce((acc, t) => acc + t.costUsd, 0);
    const totalLatency = tracesBuffer.reduce((acc, t) => acc + t.latencyMs, 0);
    const guardrailTriggers = tracesBuffer.filter((t) => t.guardrailTriggered).length;

    return {
      totalTraces: tracesBuffer.length,
      totalTokens,
      totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
      avgLatencyMs: Math.round(totalLatency / tracesBuffer.length),
      guardrailTriggerRate: parseFloat(((guardrailTriggers / tracesBuffer.length) * 100).toFixed(1)),
    };
  }
}

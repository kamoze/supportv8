/**
 * SupportV8 Operational Learning Graph (OLG) Consumer
 *
 * Implements the Consume aspect of the Four-Part Service App Contract.
 * Connects SupportV8 to the centralized Operational Learning Graph in
 * servicev8-agentic-runtime, pulling active situation intelligence,
 * SLA risk alerts, and cross-vertical order/patient context into support views.
 */

import { getAgenticRuntimeBaseUrl, getAgenticRuntimeToken } from "@/lib/chat/agenticos-chat-client";
import { getSignalsSecret } from "./signal-agent";

export type OlgSituation = {
  id: string;
  tenantId: string;
  accountId?: string;
  title: string;
  summary: string;
  severity: "info" | "warning" | "critical";
  state: "open" | "investigating" | "mitigating" | "resolved" | "suppressed";
  category: string;
  entityRefs: string[];
  mitigationPlan?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type OlgContextResult = {
  ok: boolean;
  situations: OlgSituation[];
  totalSignals: number;
  verifiedReceiptRatio: number;
  error?: string;
};

export type OlgFetchOptions = {
  limit?: number;
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
};

export async function fetchOlgContextForTenant(
  tenantId: string,
  options: OlgFetchOptions = {}
): Promise<OlgContextResult> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchImpl ?? fetch;
  const baseUrl = getAgenticRuntimeBaseUrl(env);
  const secret = getSignalsSecret(env);
  const limit = options.limit ?? 100;
  const timeoutMs = options.timeoutMs ?? 4000;

  try {
    const url = new URL("/api/signals/query", baseUrl);
    url.searchParams.set("limit", String(limit));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        "x-servicev8-signal-secret": secret,
        "x-servicev8-tenant-id": tenantId,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timer);

    if (!response || !response.ok) {
      const errText = response ? await response.text().catch(() => "") : "no_response";
      console.warn(`[olg-consumer] Support OLG query returned ${response?.status ?? "none"}: ${errText}`);
      return {
        ok: false,
        situations: [],
        totalSignals: 0,
        verifiedReceiptRatio: 0,
        error: `HTTP ${response?.status ?? "none"}: ${errText}`,
      };
    }

    const payload = (await response.json()) as {
      ok: boolean;
      data?: {
        situations?: OlgSituation[];
        stats?: {
          totalSignals?: number;
          verifiedReceiptRatio?: number;
        };
      };
    };

    const situations = payload.data?.situations || [];
    const totalSignals = payload.data?.stats?.totalSignals || 0;
    const verifiedReceiptRatio = payload.data?.stats?.verifiedReceiptRatio || 0;

    return {
      ok: true,
      situations,
      totalSignals,
      verifiedReceiptRatio,
    };
  } catch (err) {
    console.warn("[olg-consumer] Support failed to fetch OLG context softly:", err);
    return {
      ok: false,
      situations: [],
      totalSignals: 0,
      verifiedReceiptRatio: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchOlgSituationsForTenant(
  tenantId: string,
  options: OlgFetchOptions = {}
): Promise<OlgSituation[]> {
  const result = await fetchOlgContextForTenant(tenantId, options);
  if (!result.ok) return [];

  // Filter only active, unresolved situations
  return result.situations.filter(
    (s) => s.state === "open" || s.state === "investigating" || s.state === "mitigating"
  );
}

export function findSituationsForTicket(
  situations: OlgSituation[],
  target: {
    ticketId: string;
    ticketRef?: string;
    customerRef?: string;
    summary?: string;
  }
): OlgSituation[] {
  const tokens: string[] = [
    `ticket:${target.ticketId}`,
    target.ticketId,
  ];

  if (target.ticketRef) {
    tokens.push(`ticket:${target.ticketRef}`, target.ticketRef);
  }
  if (target.customerRef) {
    tokens.push(`customer:${target.customerRef}`, target.customerRef);
  }

  // Cross-reference any order references mentioned in summary (e.g. ORD-101 or ord_101)
  if (target.summary) {
    const orderMatches = target.summary.match(/(?:ORD|ord)[-_a-zA-Z0-9]+/g);
    if (orderMatches) {
      for (const m of orderMatches) {
        tokens.push(`order:${m}`, m);
      }
    }
  }

  return situations.filter((sit) =>
    sit.entityRefs.some((ref) =>
      tokens.some((token) => ref === token || ref.includes(token) || (target.summary && target.summary.includes(ref.replace(/^order:/, ""))))
    )
  );
}

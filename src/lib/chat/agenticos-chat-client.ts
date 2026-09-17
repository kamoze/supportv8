/**
 * Centralized AgenticOS Chat Client for SupportV8.
 *
 * Connects SupportV8's customer chat and AI employee operations directly
 * to the centralized servicev8-agentic-runtime, executing turns on the cluster's
 * unified Temporal orchestration workflows and shared Redis delivery streams.
 */

export type AgenticDomainContext = {
  sourceApp: "supportv8";
  tenantId: string;
  tenantSlug: string;
  stream?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

export type CentralTurnAdmission = {
  admitted: boolean;
  turnId: string;
  threadId: string;
  state: "pending" | "running" | "completed" | "failed";
  lastRecipientId: string;
  streamUrl: string;
};

export type CentralTurnResult = {
  turnId: string;
  threadId: string;
  state: "completed" | "failed" | "running" | "pending";
  replyContent?: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    senderName?: string;
    createdAt?: string;
  }>;
  error?: string;
};

export function isCentralAgenticChatEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.SUPPORTV8_CENTRAL_CHAT_ENABLED === "true" ||
    env.SERVICEV8_CENTRAL_CHAT_ENABLED === "true"
  );
}

export function getAgenticRuntimeBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const url =
    env.SERVICEV8_RUNTIME_URL ||
    env.SUPPORT_RUNTIME_URL ||
    env.RUNTIME_URL ||
    "https://runtime.servicev8.com";
  return url.replace(/\/+$/, "");
}

export function getAgenticRuntimeToken(env: Record<string, string | undefined> = process.env): string {
  return (
    env.SERVICEV8_RUNTIME_TOKEN ||
    env.SUPPORTV8_SERVICE_APP_RUNTIME_SECRET ||
    env.SUPPORTV8_RUNTIME_SESSION_SECRET ||
    env.FORGE_GATEWAY_MODEL_TOKEN ||
    env.FORGE_GATEWAY_TOKEN ||
    env.SERVICEV8_GATEWAY_TOKEN ||
    ""
  );
}

export async function dispatchAgenticTurn(
  input: {
    tenantSlug: string;
    tenantId: string;
    prompt: string;
    stream?: string;
    recipientId?: string;
    actorEmail?: string | null;
    metadata?: Record<string, unknown>;
  },
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<CentralTurnAdmission | null> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchImpl ?? fetch;
  const baseUrl = getAgenticRuntimeBaseUrl(env);
  const token = getAgenticRuntimeToken(env);

  const domainContext: AgenticDomainContext = {
    sourceApp: "supportv8",
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    stream: input.stream || "customers",
    entityType: "support_session",
    entityId: input.tenantSlug,
    metadata: {
      actorEmail: input.actorEmail,
      ...input.metadata,
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-servicev8-tenant-domain": input.tenantSlug,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const url = new URL("/api/agenticos/turns", baseUrl);
    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        slug: input.tenantSlug,
        prompt: input.prompt,
        recipientId: input.recipientId || "support_lead",
        domainContext,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn(`[supportv8-agenticos-chat] dispatch failed: ${res.status} ${await res.text().catch(() => "")}`);
      return null;
    }

    const data = (await res.json()) as CentralTurnAdmission;
    if (!data || !data.turnId || !data.threadId) {
      return null;
    }
    return data;
  } catch (err) {
    console.error("[supportv8-agenticos-chat] dispatch error:", err);
    return null;
  }
}

export async function pollAgenticTurnCompletion(
  input: {
    tenantSlug: string;
    threadId: string;
    turnId: string;
    timeoutMs?: number;
    initialIntervalMs?: number;
  },
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<CentralTurnResult | null> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchImpl ?? fetch;
  const baseUrl = getAgenticRuntimeBaseUrl(env);
  const token = getAgenticRuntimeToken(env);
  const timeoutMs = input.timeoutMs ?? 12_000;
  let intervalMs = input.initialIntervalMs ?? 200;
  const deadline = Date.now() + timeoutMs;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-servicev8-tenant-domain": input.tenantSlug,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  while (Date.now() < deadline) {
    try {
      const url = new URL(
        `/api/workspace/${encodeURIComponent(input.tenantSlug)}/chat/changes?threadId=${encodeURIComponent(
          input.threadId
        )}&after=0`,
        baseUrl
      );
      const res = await fetchFn(url, {
        method: "GET",
        headers,
        cache: "no-store",
      });

      if (res.ok) {
        const page = (await res.json()) as {
          turns?: Array<{ id: string; state: string; error?: string }>;
          messages?: Array<{ id: string; role: "user" | "assistant"; content: string; senderName?: string; createdAt?: string }>;
        };

        const targetTurn = page.turns?.find((t) => t.id === input.turnId);
        if (targetTurn) {
          if (targetTurn.state === "completed") {
            const assistantMsgs = (page.messages || []).filter((m) => m.role === "assistant");
            const lastMsg = assistantMsgs.at(-1);
            return {
              turnId: input.turnId,
              threadId: input.threadId,
              state: "completed",
              replyContent: lastMsg?.content || "",
              messages: page.messages || [],
            };
          }
          if (targetTurn.state === "failed") {
            return {
              turnId: input.turnId,
              threadId: input.threadId,
              state: "failed",
              error: targetTurn.error || "Turn execution failed in AgenticOS runtime",
              messages: page.messages || [],
            };
          }
        }
      }
    } catch (err) {
      console.warn("[supportv8-agenticos-chat] poll iteration error:", err);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, remaining)));
    intervalMs = Math.min(intervalMs * 1.5, 1000);
  }

  return null;
}

export async function executeAgenticChatAsk(
  input: {
    tenantSlug: string;
    tenantId: string;
    employeeId: string;
    employeeRole: string;
    query: string;
    contextPrompt?: string;
    stream?: string;
    timeoutMs?: number;
  },
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<{ answer: string; turnId: string; threadId: string } | null> {
  const prompt = input.contextPrompt
    ? `${input.contextPrompt}\n\nUser Question:\n${input.query}`
    : input.query;

  const admission = await dispatchAgenticTurn(
    {
      tenantSlug: input.tenantSlug,
      tenantId: input.tenantId,
      prompt,
      stream: input.stream,
      recipientId: input.employeeId,
      metadata: {
        employeeId: input.employeeId,
        employeeRole: input.employeeRole,
      },
    },
    options
  );

  if (!admission) return null;

  const result = await pollAgenticTurnCompletion(
    {
      tenantSlug: input.tenantSlug,
      threadId: admission.threadId,
      turnId: admission.turnId,
      timeoutMs: input.timeoutMs,
    },
    options
  );

  if (!result || result.state !== "completed" || !result.replyContent?.trim()) {
    return null;
  }

  return {
    answer: result.replyContent.trim(),
    turnId: admission.turnId,
    threadId: admission.threadId,
  };
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomerChatMessage, CustomerChatSession } from "@/lib/types";

export type ChatConnectionState = "connecting" | "live" | "reconnecting" | "offline";

const CHAT_SESSION_STORAGE_PREFIX = "supportv8:chat:session:v1";

export function isNearLiveChatEdge(
  viewport: Pick<HTMLElement, "scrollTop" | "clientHeight" | "scrollHeight">,
  thresholdPx = 72,
): boolean {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= thresholdPx;
}

function normalizedTenantKey(value: string | undefined): string {
  const normalized = (value || "default")
    .trim()
    .toLowerCase()
    .replace(/^tenant_/, "")
    .replace(/\.support\.servicev8\.(?:com|internal)$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "default";
}

export function chatSessionStorageKey(tenant: string | undefined): string {
  return `${CHAT_SESSION_STORAGE_PREFIX}:${normalizedTenantKey(tenant)}`;
}

export function readStoredChatSessionId(storage: Pick<Storage, "getItem">, tenant: string | undefined): string | null {
  const value = storage.getItem(chatSessionStorageKey(tenant));
  return value && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : null;
}

export function storeChatSessionId(
  storage: Pick<Storage, "setItem">,
  tenant: string | undefined,
  sessionId: string,
): void {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) return;
  storage.setItem(chatSessionStorageKey(tenant), sessionId);
}

export function clearStoredChatSessionId(storage: Pick<Storage, "removeItem">, tenant: string | undefined): void {
  storage.removeItem(chatSessionStorageKey(tenant));
}

export type StoredChatRecovery =
  | { state: "empty" | "discarded" | "retry" }
  | { state: "restored"; session: CustomerChatSession };

export async function recoverStoredChatSession(
  storage: Pick<Storage, "getItem" | "removeItem">,
  tenant: string | undefined,
  loadSession: (sessionId: string) => Promise<{
    status: number;
    session?: CustomerChatSession;
  }>,
): Promise<StoredChatRecovery> {
  const sessionId = readStoredChatSessionId(storage, tenant);
  if (!sessionId) return { state: "empty" };

  let response: Awaited<ReturnType<typeof loadSession>>;
  try {
    response = await loadSession(sessionId);
  } catch {
    return { state: "retry" };
  }

  if (response.status === 403 || response.status === 404) {
    clearStoredChatSessionId(storage, tenant);
    return { state: "discarded" };
  }
  if (!response.session || response.status < 200 || response.status >= 300) {
    return { state: "retry" };
  }
  if (chatSessionStorageKey(response.session.tenantDomain) !== chatSessionStorageKey(tenant)) {
    clearStoredChatSessionId(storage, tenant);
    return { state: "discarded" };
  }
  return { state: "restored", session: response.session };
}

export function mergeChatSession(
  current: CustomerChatSession | null,
  incoming: CustomerChatSession,
): CustomerChatSession {
  if (!current || current.id !== incoming.id) return incoming;
  const messages = new Map<string, CustomerChatMessage>();
  for (const message of current.messages) messages.set(message.id, message);
  for (const message of incoming.messages) {
    messages.set(message.id, { ...messages.get(message.id), ...message, deliveryState: "delivered" });
  }
  const orderedMessages = [...messages.values()].sort((a, b) => {
    const byTime = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return byTime || a.id.localeCompare(b.id);
  });
  return {
    ...current,
    ...incoming,
    messages: orderedMessages.slice(-500),
    hasEarlierMessages: Boolean(current.hasEarlierMessages || incoming.hasEarlierMessages || orderedMessages.length > 500),
  };
}

export function createOptimisticChatMessage(input: {
  id: string;
  sender: "customer" | "agent";
  senderName: string;
  content: string;
}): CustomerChatMessage {
  return {
    ...input,
    timestamp: new Date().toISOString(),
    deliveryState: "sending",
  };
}

export function useChatRealtimeSession(
  sessionId: string | undefined,
  onSession: (session: CustomerChatSession) => void,
): ChatConnectionState {
  const [state, setState] = useState<ChatConnectionState>(sessionId ? "connecting" : "offline");
  const callbackRef = useRef(onSession);
  callbackRef.current = onSession;

  useEffect(() => {
    if (!sessionId) {
      setState("offline");
      return;
    }

    let stopped = false;
    let cursor: string | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let refreshInFlight = false;

    const refresh = async (incremental = true) => {
      if (stopped || refreshInFlight) return;
      refreshInFlight = true;
      try {
        let hasMore = false;
        do {
          const params = new URLSearchParams({ sessionId, limit: "100" });
          if (incremental && cursor) params.set("after", cursor);
          const response = await fetch(`/api/chat/session?${params.toString()}`, {
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.timeout(10_000),
          });
          const result = await response.json();
          if (!response.ok || !result?.session) throw new Error(result?.error || "Unable to refresh chat");
          cursor = result.nextCursor || result.session.nextCursor || cursor;
          callbackRef.current(result.session as CustomerChatSession);
          hasMore = Boolean(result.hasMoreMessages);
        } while (!stopped && incremental && hasMore);
      } catch {
        if (!stopped) setState(navigator.onLine ? "reconnecting" : "offline");
      } finally {
        refreshInFlight = false;
      }
    };

    const startFallbackPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => void refresh(true), 5_000);
    };
    const stopFallbackPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = undefined;
    };

    setState("connecting");
    void refresh(false);
    const events = new EventSource(`/api/chat/events?sessionId=${encodeURIComponent(sessionId)}`);
    events.onopen = () => {
      if (stopped) return;
      setState("live");
      stopFallbackPolling();
      void refresh(true);
    };
    events.addEventListener("chat", () => void refresh(true));
    events.addEventListener("degraded", () => {
      if (stopped) return;
      setState("reconnecting");
      startFallbackPolling();
    });
    events.onerror = () => {
      if (stopped) return;
      setState(navigator.onLine ? "reconnecting" : "offline");
      startFallbackPolling();
    };

    const online = () => {
      if (!stopped) {
        setState("reconnecting");
        void refresh(true);
      }
    };
    const offline = () => !stopped && setState("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    return () => {
      stopped = true;
      events.close();
      stopFallbackPolling();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [sessionId]);

  return state;
}

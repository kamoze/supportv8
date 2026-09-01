"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomerChatMessage, CustomerChatSession } from "@/lib/types";

export type ChatConnectionState = "connecting" | "live" | "reconnecting" | "offline";

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

import { randomUUID } from "node:crypto";
import type { ChatOutboxStore, ClaimedChatOutboxEvent } from "./outbox-store";
import type { ChatRealtimeEvent } from "./realtime";

export interface ChatEventPublisher {
  publish(event: ChatRealtimeEvent): Promise<ChatRealtimeEvent>;
}

function messageIds(event: ClaimedChatOutboxEvent): string[] {
  const value = event.payload.messageIds;
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string").slice(0, 100);
}

export async function processChatOutboxBatch(
  store: ChatOutboxStore,
  publisher: ChatEventPublisher,
  workerId: string,
  limit = 100,
): Promise<{ claimed: number; delivered: number; failed: number }> {
  const events = await store.claim(workerId, limit);
  let delivered = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await publisher.publish({
        eventId: event.eventId,
        tenantId: event.tenantId,
        sessionId: event.sessionId,
        eventType: event.eventType,
        messageIds: messageIds(event),
        occurredAt: event.createdAt,
      });
      await store.complete(event.eventId, workerId);
      delivered += 1;
    } catch (error) {
      await store.fail(
        event.eventId,
        workerId,
        error instanceof Error ? error.message : "Unknown chat relay failure",
      );
      failed += 1;
    }
  }

  return { claimed: events.length, delivered, failed };
}

export function createChatRelayWorkerId(): string {
  return `relay_${process.pid}_${randomUUID().slice(0, 8)}`;
}

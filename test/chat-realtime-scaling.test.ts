import { describe, expect, it } from "vitest";
import {
  decodeChatMessageCursor,
  encodeChatMessageCursor,
} from "@/lib/chat/message-cursor";
import {
  chatRealtimeChannel,
  chatRealtimeStream,
  RedisChatRealtime,
  type ChatRealtimeEvent,
} from "@/lib/chat/realtime";
import { processChatOutboxBatch } from "@/lib/chat/relay";
import type {
  ChatOutboxStore,
  ClaimedChatOutboxEvent,
} from "@/lib/chat/outbox-store";
import { mergeChatSession } from "@/lib/chat/use-chat-realtime";
import type { CustomerChatSession } from "@/lib/types";

function session(messages: CustomerChatSession["messages"]): CustomerChatSession {
  return {
    id: "chat_scale_1",
    tenantDomain: "acme",
    stream: "customers",
    customerName: "Scale Tester",
    customerEmail: "scale@example.com",
    intakeData: {},
    assignedType: "human",
    assignedId: "support_queue",
    assignedName: "Support team",
    status: "active",
    priority: "normal",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    messages,
  };
}

class FakeStore implements ChatOutboxStore {
  completed: string[] = [];
  failed: string[] = [];

  constructor(private readonly events: ClaimedChatOutboxEvent[]) {}

  async claim(): Promise<ClaimedChatOutboxEvent[]> {
    return this.events;
  }
  async complete(eventId: string): Promise<void> {
    this.completed.push(eventId);
  }
  async fail(eventId: string): Promise<void> {
    this.failed.push(eventId);
  }
  async close(): Promise<void> {}
}

describe("scalable chat realtime delivery", () => {
  it("uses tenant- and session-specific Redis channels", () => {
    expect(chatRealtimeChannel("tenant_acme", "chat_123")).toBe(
      "supportv8:chat:live:v1:tenant_acme:chat_123",
    );
    expect(chatRealtimeStream("tenant_beta", "chat_123")).not.toBe(
      chatRealtimeStream("tenant_acme", "chat_123"),
    );
    expect(() => chatRealtimeChannel("tenant_acme", "../other")).toThrow("Invalid chat realtime channel");
  });

  it("round-trips stable message cursors and rejects malformed values", () => {
    const cursor = encodeChatMessageCursor("2026-09-01T01:02:03.000Z", "msg_abc12345");
    expect(decodeChatMessageCursor(cursor)).toEqual({
      createdAt: "2026-09-01T01:02:03.000Z",
      messageId: "msg_abc12345",
    });
    expect(() => decodeChatMessageCursor("not-a-cursor")).toThrow("Invalid chat message cursor");
  });

  it("shares one Redis subscription across simultaneous listeners", async () => {
    const realtime = new RedisChatRealtime("redis://test");
    const subscribed: string[] = [];
    const unsubscribed: string[] = [];
    const fakeSubscriber = {
      status: "ready",
      async subscribe(channel: string) {
        subscribed.push(channel);
      },
      async unsubscribe(channel: string) {
        unsubscribed.push(channel);
      },
    };
    Object.defineProperty(realtime, "subscriptionClient", {
      value: async () => fakeSubscriber,
    });
    Object.defineProperty(realtime, "subscriber", {
      value: fakeSubscriber,
      writable: true,
    });

    const [stopFirst, stopSecond] = await Promise.all([
      realtime.subscribe("tenant_acme", "chat_shared", () => undefined),
      realtime.subscribe("tenant_acme", "chat_shared", () => undefined),
    ]);

    expect(subscribed).toEqual(["supportv8:chat:live:v1:tenant_acme:chat_shared"]);
    await stopFirst();
    expect(unsubscribed).toEqual([]);
    await stopSecond();
    expect(unsubscribed).toEqual(["supportv8:chat:live:v1:tenant_acme:chat_shared"]);
  });

  it("reconciles optimistic messages without duplicates when the server acknowledges them", () => {
    const optimistic = session([
      {
        id: "msg_client_12345678",
        sender: "customer",
        senderName: "Scale Tester",
        content: "Hello",
        timestamp: "2026-09-01T01:00:00.000Z",
        deliveryState: "sending",
      },
    ]);
    const acknowledged = session([
      {
        id: "msg_client_12345678",
        sender: "customer",
        senderName: "Scale Tester",
        content: "Hello",
        timestamp: "2026-09-01T01:00:00.000Z",
        cursor: "2026-09-01T01:00:00.000Z|msg_client_12345678",
      },
    ]);

    const merged = mergeChatSession(optimistic, acknowledged);
    expect(merged.messages).toHaveLength(1);
    expect(merged.messages[0].deliveryState).toBe("delivered");
    expect(merged.messages[0].cursor).toContain("msg_client_12345678");
  });

  it("delivers each claimed outbox event and records isolated failures", async () => {
    const events: ClaimedChatOutboxEvent[] = [
      {
        eventId: "event-ok",
        tenantId: "tenant_acme",
        sessionId: "chat_ok",
        eventType: "chat.message.appended",
        payload: { messageIds: ["msg_ok"] },
        createdAt: "2026-09-01T01:00:00.000Z",
      },
      {
        eventId: "event-fail",
        tenantId: "tenant_beta",
        sessionId: "chat_fail",
        eventType: "chat.message.appended",
        payload: { messageIds: ["msg_fail"] },
        createdAt: "2026-09-01T01:00:01.000Z",
      },
    ];
    const store = new FakeStore(events);
    const published: ChatRealtimeEvent[] = [];
    const publisher = {
      async publish(event: ChatRealtimeEvent) {
        if (event.eventId === "event-fail") throw new Error("Redis unavailable");
        published.push(event);
        return event;
      },
    };

    const result = await processChatOutboxBatch(store, publisher, "relay_test", 100);
    expect(result).toEqual({ claimed: 2, delivered: 1, failed: 1 });
    expect(store.completed).toEqual(["event-ok"]);
    expect(store.failed).toEqual(["event-fail"]);
    expect(published[0]).toMatchObject({
      tenantId: "tenant_acme",
      sessionId: "chat_ok",
      messageIds: ["msg_ok"],
    });
    expect(published[0]).not.toHaveProperty("content");
  });
});

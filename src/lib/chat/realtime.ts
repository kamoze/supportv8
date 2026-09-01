import Redis from "ioredis";

const TENANT_ID_PATTERN = /^tenant_[a-z0-9_]{1,56}$/;
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const STREAM_MAX_LENGTH = 1_000;

export interface ChatRealtimeEvent {
  eventId: string;
  tenantId: string;
  sessionId: string;
  eventType: string;
  messageIds: string[];
  occurredAt: string;
  streamId?: string;
}

export class ChatRealtimeUnavailableError extends Error {
  constructor() {
    super("Live chat updates are temporarily unavailable");
    this.name = "ChatRealtimeUnavailableError";
  }
}

function assertIdentifiers(tenantId: string, sessionId: string) {
  if (!TENANT_ID_PATTERN.test(tenantId) || !SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("Invalid chat realtime channel");
  }
}

export function chatRealtimeChannel(tenantId: string, sessionId: string): string {
  assertIdentifiers(tenantId, sessionId);
  return `supportv8:chat:live:v1:${tenantId}:${sessionId}`;
}

export function chatRealtimeStream(tenantId: string, sessionId: string): string {
  assertIdentifiers(tenantId, sessionId);
  return `supportv8:chat:stream:v1:${tenantId}:${sessionId}`;
}

type Listener = (event: ChatRealtimeEvent) => void;

export class RedisChatRealtime {
  private publisher?: Redis;
  private subscriber?: Redis;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(private readonly redisUrl: string | undefined = process.env.CHAT_REDIS_URL) {}

  private createClient(): Redis {
    if (!this.redisUrl) throw new ChatRealtimeUnavailableError();
    return new Redis(this.redisUrl, {
      lazyConnect: true,
      enableReadyCheck: true,
      maxRetriesPerRequest: 2,
      connectTimeout: 5_000,
      retryStrategy: (attempt) => Math.min(attempt * 250, 3_000),
    });
  }

  private async commandClient(): Promise<Redis> {
    if (!this.publisher) this.publisher = this.createClient();
    if (this.publisher.status === "wait") await this.publisher.connect();
    return this.publisher;
  }

  private async subscriptionClient(): Promise<Redis> {
    if (!this.subscriber) {
      this.subscriber = this.createClient();
      this.subscriber.on("message", (channel, raw) => {
        const channelListeners = this.listeners.get(channel);
        if (!channelListeners?.size) return;
        try {
          const event = JSON.parse(raw) as ChatRealtimeEvent;
          for (const listener of channelListeners) listener(event);
        } catch {
          // Ignore malformed relay events; Postgres cursor recovery remains authoritative.
        }
      });
    }
    if (this.subscriber.status === "wait") await this.subscriber.connect();
    return this.subscriber;
  }

  async publish(event: ChatRealtimeEvent): Promise<ChatRealtimeEvent> {
    const client = await this.commandClient();
    const stream = chatRealtimeStream(event.tenantId, event.sessionId);
    const channel = chatRealtimeChannel(event.tenantId, event.sessionId);
    const serialized = JSON.stringify(event);
    const streamId = await client.xadd(
      stream,
      "MAXLEN",
      "~",
      STREAM_MAX_LENGTH,
      "*",
      "event",
      serialized,
    );
    if (!streamId) throw new Error("Redis did not acknowledge the chat event");
    const published = { ...event, streamId };
    await client.publish(channel, JSON.stringify(published));
    return published;
  }

  async replay(tenantId: string, sessionId: string, afterStreamId?: string | null): Promise<ChatRealtimeEvent[]> {
    const client = await this.commandClient();
    const rows = await client.xrange(
      chatRealtimeStream(tenantId, sessionId),
      afterStreamId && /^\d+-\d+$/.test(afterStreamId) ? `(${afterStreamId}` : "-",
      "+",
      "COUNT",
      100,
    );
    const events: ChatRealtimeEvent[] = [];
    for (const [streamId, fields] of rows) {
      const eventIndex = fields.findIndex((field) => field === "event");
      const raw = eventIndex >= 0 ? fields[eventIndex + 1] : undefined;
      if (!raw) continue;
      try {
        events.push({ ...(JSON.parse(raw) as ChatRealtimeEvent), streamId });
      } catch {
        // Ignore malformed retained events and continue cursor recovery from Postgres.
      }
    }
    return events;
  }

  async subscribe(tenantId: string, sessionId: string, listener: Listener): Promise<() => Promise<void>> {
    const channel = chatRealtimeChannel(tenantId, sessionId);
    const existing = this.listeners.get(channel);
    if (existing) {
      existing.add(listener);
    } else {
      this.listeners.set(channel, new Set([listener]));
      const subscriber = await this.subscriptionClient();
      await subscriber.subscribe(channel);
    }

    return async () => {
      const channelListeners = this.listeners.get(channel);
      if (!channelListeners) return;
      channelListeners.delete(listener);
      if (channelListeners.size > 0) return;
      this.listeners.delete(channel);
      if (this.subscriber?.status === "ready") await this.subscriber.unsubscribe(channel);
    };
  }

  async close(): Promise<void> {
    await Promise.allSettled([
      this.publisher?.quit(),
      this.subscriber?.quit(),
    ]);
    this.publisher = undefined;
    this.subscriber = undefined;
    this.listeners.clear();
  }
}

const globalForChatRealtime = globalThis as unknown as {
  __supportv8ChatRealtime?: RedisChatRealtime;
};

export const chatRealtime =
  globalForChatRealtime.__supportv8ChatRealtime ?? new RedisChatRealtime();

if (process.env.NODE_ENV !== "production") {
  globalForChatRealtime.__supportv8ChatRealtime = chatRealtime;
}

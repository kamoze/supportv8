import Redis, { type RedisOptions } from "ioredis";
import { validateRuntimeDeliveryEvent, type RuntimeDeliveryEvent } from "./runtime-outbox-store";

export interface RuntimeEventPublisher { publish(event: RuntimeDeliveryEvent): Promise<void> }
export function validateRuntimeRedisUrl(value: string): void {
  try {
    const url = new URL(value);
    // Query parameters can override ioredis options, including the selected DB.
    if (!["redis:", "rediss:"].includes(url.protocol) || !url.hostname || url.search || url.hash
      || !["", "/", "/0"].includes(url.pathname)) throw new Error();
  } catch { throw new Error("Invalid Runtime Redis configuration"); }
}
export class RedisRuntimePublisher implements RuntimeEventPublisher {
  private readonly client: Redis;
  constructor(url: string, factory: (url: string, options: RedisOptions) => Redis = (value, options) => new Redis(value, options),
    log: (category: string) => void = category => console.warn(`[agenticos-chat-relay] ${category}`)) {
    validateRuntimeRedisUrl(url);
    this.client = factory(url, {
      lazyConnect: true, enableReadyCheck: false, disableClientInfo: true, db: 0, enableOfflineQueue: false,
      connectTimeout: 5_000, commandTimeout: 5_000, maxRetriesPerRequest: 1,
      retryStrategy: attempt => Math.min(attempt * 250, 1_000),
    });
    this.client.on("error", () => log("redis_unavailable"));
  }
  async publish(event: RuntimeDeliveryEvent): Promise<void> {
    validateRuntimeDeliveryEvent(event);
    const stream = `sv8:chat:stream:v1:agenticos:${event.scopeHash}`;
    const channel = `sv8:chat:live:v1:agenticos:${event.scopeHash}`;
    const payload = JSON.stringify({ eventId: event.eventId, threadId: event.threadId,
      sequence: event.sequence, eventType: event.eventType });
    try {
      if (this.client.status === "wait") await this.client.connect();
      const replies = await this.client.multi().xadd(stream, "MAXLEN", "~", 1_000, "*", "event", payload)
        .expire(stream, 86_400).publish(channel, payload).exec();
      if (!replies || replies.length !== 3 || replies.some(reply => !Array.isArray(reply) || reply.length !== 2 || reply[0] !== null)
        || typeof replies[0][1] !== "string" || !/^[0-9]+-[0-9]+$/.test(replies[0][1])
        || replies[1][1] !== 1 || !Number.isSafeInteger(replies[2][1]) || (replies[2][1] as number) < 0) {
        throw new Error();
      }
    } catch { throw new Error("Runtime Redis publication failed"); }
  }
  async close(): Promise<void> {
    try { if (this.client.status === "ready") await this.client.quit(); }
    catch { /* Closing transport below also handles an unavailable Redis. */ }
    finally { this.forceClose(); }
  }
  forceClose(): void { this.client.disconnect(); }
}

import { randomBytes, randomUUID } from "node:crypto";
import Redis from "ioredis";
import { describe, expect, it } from "vitest";
import { RedisRuntimePublisher } from "@/lib/chat/runtime-realtime";

// Deliberately never read CHAT_REDIS_URL or any deployed Runtime credential.
const testUrl = process.env.TEST_RUNTIME_CHAT_REDIS_URL;
describe.skipIf(!testUrl)("Runtime publication against isolated Redis", () => {
  it("publishes live and replayable exact references using the restricted publisher ACL", async () => {
    const url = new URL(testUrl!);
    if (url.protocol !== "redis:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || !url.port || !["", "/0"].includes(url.pathname) || url.search || url.hash) {
      throw new Error("TEST_RUNTIME_CHAT_REDIS_URL must explicitly select an isolated loopback Redis DB 0");
    }
    const admin = new Redis(testUrl!, { maxRetriesPerRequest: 1, commandTimeout: 2000 });
    const subscriber = new Redis(testUrl!, { maxRetriesPerRequest: 1, commandTimeout: 2000 });
    const scopeHash = randomBytes(32).toString("hex");
    const stream = `sv8:chat:stream:v1:agenticos:${scopeHash}`;
    const channel = `sv8:chat:live:v1:agenticos:${scopeHash}`;
    const username = `relay_test_${randomBytes(8).toString("hex")}`;
    const password = randomBytes(32).toString("hex");
    let publisher: RedisRuntimePublisher | undefined;
    let restricted: Redis | undefined;
    try {
      await admin.acl("SETUSER", username, "reset", "on", `>${password}`, "~sv8:chat:stream:v1:agenticos:*", "&sv8:chat:live:v1:agenticos:*",
        "+ping", "+quit", "+xadd", "+expire", "+publish", "+multi", "+exec");
      url.username = username; url.password = password;
      publisher = new RedisRuntimePublisher(url.toString());
      restricted = new Redis(url.toString(), { enableReadyCheck: false, disableClientInfo: true, maxRetriesPerRequest: 1 });
      await expect(restricted.publish("supportv8:chat:live:v1:tenant_test:chat_test", "forbidden")).rejects.toThrow(/NOPERM/);
      await expect(restricted.xadd("supportv8:chat:stream:v1:tenant_test:chat_test", "*", "event", "forbidden")).rejects.toThrow(/NOPERM/);
      const live: unknown[] = [];
      const received = new Promise<void>(resolve => subscriber.on("message", (_channel, raw) => {
        live.push(JSON.parse(raw)); if (live.length === 2) resolve();
      }));
      await subscriber.subscribe(channel);
      const event = { eventId: randomUUID(), threadId: randomUUID(), sequence: "9007199254740993",
        eventType: "message.created", scopeHash, leaseId: randomUUID() };
      const expected = { eventId: event.eventId, threadId: event.threadId, sequence: "9007199254740993", eventType: "message.created" };
      await publisher.publish(event);
      // Crash-before-ack simulation: the same durable event returns with a new lease.
      await publisher.publish({ ...event, leaseId: randomUUID() });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([received, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Live notifications timed out")), 2000); })]);
      } finally { if (timer) clearTimeout(timer); }
      expect(live).toEqual([expected, expected]);
      const rows = await admin.xrange(stream, "-", "+");
      expect(rows).toHaveLength(2);
      expect(rows.map(([, fields]) => { expect(fields[0]).toBe("event"); expect(fields).toHaveLength(2); return JSON.parse(fields[1]); })).toEqual([expected, expected]);
      expect(new Set(rows.map(([, fields]) => JSON.parse(fields[1]).eventId)).size).toBe(1);
      expect(await admin.ttl(stream)).toBeGreaterThan(86390);
      expect(await admin.ttl(stream)).toBeLessThanOrEqual(86400);
    } finally {
      await publisher?.close(); restricted?.disconnect(); subscriber.disconnect();
      await admin.del(stream);
      await admin.acl("DELUSER", username);
      admin.disconnect();
    }
  }, 10000);
});

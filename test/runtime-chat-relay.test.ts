import { describe, expect, it, vi } from "vitest";
import { PostgresRuntimeDeliveryStore, validateRuntimeDeliveryEvent, type RuntimeDeliveryEvent } from "@/lib/chat/runtime-outbox-store";
import { RedisRuntimePublisher } from "@/lib/chat/runtime-realtime";
import { processRuntimeDeliveryBatch } from "@/lib/chat/runtime-relay";

const event: RuntimeDeliveryEvent = {
  eventId: "11111111-1111-4111-8111-111111111111", threadId: "22222222-2222-4222-8222-222222222222",
  sequence: "9007199254740993", eventType: "message.created", scopeHash: "a".repeat(64),
  leaseId: "33333333-3333-4333-8333-333333333333",
};
function redisFixture(replies: unknown = [[null, "123-0"], [null, 1], [null, 0]]) {
  const transaction = { xadd: vi.fn().mockReturnThis(), expire: vi.fn().mockReturnThis(), publish: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue(replies) };
  const client = { status: "ready", connect: vi.fn(), multi: vi.fn(() => transaction), on: vi.fn(), quit: vi.fn().mockResolvedValue("OK"), disconnect: vi.fn() };
  const factory = vi.fn((..._args: unknown[]) => client);
  const log = vi.fn();
  const publisher = new RedisRuntimePublisher("redis://runtime:secret@localhost:6379/0", factory as never, log);
  return { publisher, client, factory, transaction, log };
}
function sqlPool(query: ReturnType<typeof vi.fn>) {
  const client = { query: vi.fn((sql: string, values?: unknown[]) => sql.startsWith("SELECT") ? query(sql, values) : Promise.resolve({ rows: [] })), release: vi.fn() };
  return { query, connect: vi.fn(async () => client), on: vi.fn(), end: vi.fn() };
}
function storeFixture(events = [event]) {
  return { claim: vi.fn().mockResolvedValue(events), complete: vi.fn().mockResolvedValue(true), fail: vi.fn().mockResolvedValue(true), close: vi.fn() };
}

describe("Runtime delivery contract", () => {
  it("maps only the fixed SQL interface and preserves bigint precision", async () => {
    const row = { event_id: event.eventId, thread_id: event.threadId, sequence: event.sequence, event_type: event.eventType, scope_hash: event.scopeHash, lease_id: event.leaseId, transcript: "must not escape" };
    const pool = sqlPool(vi.fn().mockResolvedValueOnce({ rows: [row] }).mockResolvedValueOnce({ rows: [{ completed: false }] }).mockResolvedValueOnce({ rows: [{ failed: true }] }));
    const factory = vi.fn((..._args: unknown[]) => pool);
    const store = new PostgresRuntimeDeliveryStore("postgres://runtime:secret@localhost/runtime", factory as never, vi.fn());
    expect(await store.claim(25)).toEqual([event]);
    expect(await store.complete(event.eventId, event.leaseId)).toBe(false);
    expect(await store.fail(event.eventId, event.leaseId)).toBe(true);
    expect(pool.query.mock.calls).toEqual([
      ["SELECT * FROM runtime_chat.claim_delivery($1)", [25]],
      ["SELECT runtime_chat.complete_delivery($1,$2) AS completed", [event.eventId, event.leaseId]],
      ["SELECT runtime_chat.fail_delivery($1,$2) AS failed", [event.eventId, event.leaseId]],
    ]);
    expect(factory.mock.calls[0][0]).toMatchObject({ max: 1, connectionTimeoutMillis: 5000, query_timeout: 6000, application_name: "agenticos-chat-relay" });
    expect(factory.mock.calls[0][0]).not.toHaveProperty("statement_timeout");
  });
  it.each([0, 101, 1.5, NaN])("rejects invalid claim limit %s before SQL", async limit => {
    const pool = { query: vi.fn(), on: vi.fn(), end: vi.fn() };
    const store = new PostgresRuntimeDeliveryStore("postgres://localhost/runtime", (() => pool) as never, vi.fn());
    await expect(store.claim(limit)).rejects.toThrow("Invalid Runtime relay batch size");
    expect(pool.query).not.toHaveBeenCalled();
  });
  it.each([
    { eventId: "bad" }, { threadId: "bad" }, { leaseId: "bad" }, { scopeHash: "A".repeat(64) },
    { sequence: 9007199254740992 }, { sequence: "01" }, { sequence: "0" }, { sequence: "-1" },
    { sequence: "9223372036854775808" }, { sequence: "1e3" }, { sequence: "1\n" }, { eventType: "assistant.created" },
  ])("rejects malformed references without exposing input: %j", async patch => {
    const invalid = { ...event, ...patch } as RuntimeDeliveryEvent;
    expect(() => validateRuntimeDeliveryEvent(invalid)).toThrow("Invalid Runtime delivery event");
    const { publisher, client } = redisFixture();
    await expect(publisher.publish(invalid)).rejects.toThrow("Invalid Runtime delivery event");
    expect(client.multi).not.toHaveBeenCalled();
  });
  it("publishes only four references atomically with expiry and scoped channels", async () => {
    const { publisher, transaction, factory } = redisFixture();
    await publisher.publish({ ...event, content: "private", accountId: "private" } as RuntimeDeliveryEvent);
    const payload = JSON.stringify({ eventId: event.eventId, threadId: event.threadId, sequence: "9007199254740993", eventType: "message.created" });
    expect(transaction.xadd).toHaveBeenCalledWith(`sv8:chat:stream:v1:agenticos:${"a".repeat(64)}`, "MAXLEN", "~", 1000, "*", "event", payload);
    expect(transaction.expire).toHaveBeenCalledWith(`sv8:chat:stream:v1:agenticos:${"a".repeat(64)}`, 86400);
    expect(transaction.publish).toHaveBeenCalledWith(`sv8:chat:live:v1:agenticos:${"a".repeat(64)}`, payload);
    expect(factory.mock.calls[0][1]).toMatchObject({ lazyConnect: true, enableReadyCheck: false, disableClientInfo: true, db: 0, enableOfflineQueue: false, connectTimeout: 5000, commandTimeout: 5000, maxRetriesPerRequest: 1 });
  });
  it.each([null, [], [[null, "123-0"], [new Error("private"), null], [null, 0]], [[null, null], [null, 1], [null, 0]], [[null, "123-0"], [null, 0], [null, 0]], [[null, "123-0"], [null, 1], [null, -1]], [[null, "123-0"], [null, 1]]])("does not complete ambiguous or failed Redis transactions: %j", async replies => {
    const { publisher } = redisFixture(replies);
    const store = storeFixture();
    expect(await processRuntimeDeliveryBatch(store, publisher)).toEqual({ claimed: 1, delivered: 0, failed: 1 });
    expect(store.complete).not.toHaveBeenCalled();
    expect(store.fail).toHaveBeenCalledWith(event.eventId, event.leaseId);
  });
  it("does not count stale completion as delivered", async () => {
    const store = storeFixture(); store.complete.mockResolvedValue(false);
    expect(await processRuntimeDeliveryBatch(store, redisFixture().publisher)).toEqual({ claimed: 1, delivered: 0, failed: 1 });
  });
  it.each([false, new Error("secret")])("continues after guarded fail cannot release a record", async failure => {
    const store = storeFixture([event, event]);
    if (failure instanceof Error) store.fail.mockRejectedValue(failure); else store.fail.mockResolvedValue(failure);
    const publisher = { publish: vi.fn().mockRejectedValueOnce(new Error("secret")).mockResolvedValue(undefined) };
    expect(await processRuntimeDeliveryBatch(store, publisher)).toEqual({ claimed: 2, delivered: 1, failed: 1 });
    expect(store.complete).toHaveBeenCalledTimes(1);
  });
  it("sanitizes provider errors and disconnects even when quit rejects", async () => {
    const { publisher, client } = redisFixture();
    client.quit.mockRejectedValue(new Error("secret"));
    await publisher.close();
    expect(client.disconnect).toHaveBeenCalled();
  });
});

describe("Runtime boundary failure isolation", () => {
  it("rejects numeric sequences returned by the actual SQL mapper", async () => {
    const pool = sqlPool(vi.fn().mockResolvedValue({ rows: [{ event_id: event.eventId, thread_id: event.threadId,
      event_type: event.eventType, scope_hash: event.scopeHash, lease_id: event.leaseId, sequence: 9007199254740992 }] }));
    const store = new PostgresRuntimeDeliveryStore("postgres://localhost/runtime", (() => pool) as never, vi.fn());
    await expect(store.claim(25)).rejects.toThrow("Invalid Runtime delivery event");
  });
  it("accepts all storage event types and the greatest PostgreSQL sequence", () => {
    for (const eventType of ["message.created", "message.updated", "message.deleted", "turn.created", "turn.updated", "turn.deleted",
      "recipient.created", "recipient.updated", "recipient.deleted", "recipient_link.created", "recipient_link.updated", "recipient_link.deleted",
      "assistant.waiting", "assistant.updated", "assistant.settled"]) {
      expect(() => validateRuntimeDeliveryEvent({ ...event, eventType, sequence: "9223372036854775807" })).not.toThrow();
    }
  });
  it("does not acknowledge a rejected EXEC and attempts the following record", async () => {
    const { publisher, transaction } = redisFixture();
    transaction.exec.mockRejectedValueOnce(new Error("credential-secret"));
    const store = storeFixture([event, event]);
    expect(await processRuntimeDeliveryBatch(store, publisher)).toEqual({ claimed: 2, delivered: 1, failed: 1 });
    expect(store.complete).toHaveBeenCalledTimes(1);
  });
  it("sanitizes asynchronous Redis and idle-pool errors", () => {
    const redis = redisFixture();
    const redisHandler = redis.client.on.mock.calls[0][1] as (error: Error) => void;
    expect(() => redisHandler(new Error("credential-secret"))).not.toThrow();
    expect(redis.log).toHaveBeenCalledWith("redis_unavailable");
    expect(JSON.stringify(redis.log.mock.calls)).not.toContain("credential-secret");
    const pool = { on: vi.fn(), end: vi.fn(), query: vi.fn() };
    const log = vi.fn();
    new PostgresRuntimeDeliveryStore("postgres://localhost/runtime", (() => pool) as never, log);
    const handler = pool.on.mock.calls.find(([name]) => name === "error")![1];
    handler(new Error("credential-secret"));
    expect(log).toHaveBeenCalledWith("database_unavailable");
    expect(JSON.stringify(log.mock.calls)).not.toContain("credential-secret");
  });
});

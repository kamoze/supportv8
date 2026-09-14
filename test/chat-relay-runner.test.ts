import { afterEach, describe, expect, it, vi } from "vitest";
import { readRelayConfig, createRelayAdapters, RelayRunner, type RelayAdapter } from "@/lib/chat/relay-runner";
const empty = { claimed: 0, delivered: 0, failed: 0 };
function adapter(name: RelayAdapter["name"]): RelayAdapter {
  return { name, process: vi.fn().mockResolvedValue(empty), close: vi.fn().mockResolvedValue(undefined), forceClose: vi.fn() };
}
afterEach(() => vi.useRealTimers());

describe("shared relay configuration", () => {
  it("does not construct or require Runtime clients when disabled", () => {
    const runtime = vi.fn(); const support = vi.fn(() => adapter("supportv8"));
    const config = readRelayConfig({ DATABASE_URL: "postgres://support", CHAT_REDIS_URL: "redis://support" });
    expect(createRelayAdapters(config, { support, runtime })).toHaveLength(1);
    expect(runtime).not.toHaveBeenCalled();
  });
  it.each([
    { RUNTIME_CHAT_RELAY_ENABLED: "true" },
    { RUNTIME_CHAT_RELAY_ENABLED: "maybe" },
    { RUNTIME_CHAT_RELAY_ENABLED: "true", RUNTIME_CHAT_RELAY_DATABASE_URL: "postgres://runtime", RUNTIME_CHAT_REDIS_PUBLISH_URL: "redis://runtime/1" },
    { RUNTIME_CHAT_RELAY_ENABLED: "true", RUNTIME_CHAT_RELAY_DATABASE_URL: "secret", RUNTIME_CHAT_REDIS_PUBLISH_URL: "redis://runtime" },
    { RUNTIME_CHAT_RELAY_ENABLED: "true", RUNTIME_CHAT_RELAY_DATABASE_URL: "postgres://runtime", RUNTIME_CHAT_REDIS_PUBLISH_URL: "redis://runtime?db=1" },
    { CHAT_RELAY_BATCH_SIZE: "0" }, { RUNTIME_CHAT_RELAY_BATCH_SIZE: "101", RUNTIME_CHAT_RELAY_ENABLED: "true" },
  ])("fails closed on invalid configuration without exposing credentials: %j", env => {
    expect(() => readRelayConfig(env)).toThrow("Invalid chat relay configuration");
  });
  it("passes dedicated credentials and bounded defaults to Runtime only", () => {
    const config = readRelayConfig({ RUNTIME_CHAT_RELAY_ENABLED: "true", RUNTIME_CHAT_RELAY_DATABASE_URL: "postgres://runtime", RUNTIME_CHAT_REDIS_PUBLISH_URL: "rediss://runtime/0" });
    const runtime = vi.fn(() => adapter("agenticos"));
    expect(createRelayAdapters(config, { support: () => adapter("supportv8"), runtime })).toHaveLength(2);
    expect(runtime).toHaveBeenCalledWith({ databaseUrl: "postgres://runtime", redisUrl: "rediss://runtime/0", batchSize: 25 });
  });
});

describe("independent relay lifecycle", () => {
  it("advances a healthy source while another has one unresolved batch", async () => {
    vi.useFakeTimers();
    const stuck = adapter("supportv8"); vi.mocked(stuck.process).mockReturnValue(new Promise(() => {}));
    const healthy = adapter("agenticos");
    const runner = new RelayRunner([stuck, healthy]);
    expect(runner.health().ready).toBe(false);
    runner.start(); await vi.advanceTimersByTimeAsync(500);
    expect(stuck.process).toHaveBeenCalledTimes(1); expect(healthy.process).toHaveBeenCalledTimes(3);
    expect(runner.health()).toMatchObject({ live: true, ready: true, sources: { supportv8: { ready: false }, agenticos: { ready: true, attempts: 3 } } });
    const stopped = runner.stop();
    expect(runner.health()).toMatchObject({ live: false, ready: false });
    await vi.advanceTimersByTimeAsync(10000); await stopped;
    expect(stuck.forceClose).toHaveBeenCalled(); expect(healthy.close).toHaveBeenCalled();
    expect(healthy.process).toHaveBeenCalledTimes(3);
  });
  it("backs off failures independently and expires readiness after 30 seconds", async () => {
    vi.useFakeTimers();
    const failed = adapter("agenticos"); vi.mocked(failed.process).mockRejectedValue(new Error("secret"));
    const support = adapter("supportv8");
    vi.mocked(support.process).mockResolvedValueOnce(empty).mockReturnValue(new Promise(() => {}));
    const log = vi.fn(); const runner = new RelayRunner([support, failed], { log });
    runner.start(); await vi.advanceTimersByTimeAsync(1000);
    expect(failed.process).toHaveBeenCalledTimes(2); expect(runner.health().ready).toBe(true);
    await vi.advanceTimersByTimeAsync(30001); expect(runner.health().ready).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    const stopped = runner.stop(); await vi.advanceTimersByTimeAsync(10000); await stopped;
  });
  it("treats only empty claims or confirmed deliveries as successful and backs off failed batches", async () => {
    vi.useFakeTimers(); const source = adapter("agenticos");
    vi.mocked(source.process).mockResolvedValue({ claimed: 1, delivered: 0, failed: 1 });
    const runner = new RelayRunner([source]); runner.start(); await vi.advanceTimersByTimeAsync(999);
    expect(source.process).toHaveBeenCalledTimes(1); expect(runner.health().ready).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(source.process).toHaveBeenCalledTimes(2);
    await runner.stop();
  });
  it("bounds resource closure to the same shutdown deadline", async () => {
    vi.useFakeTimers(); const source = adapter("supportv8");
    vi.mocked(source.close).mockReturnValue(new Promise(() => {}));
    const runner = new RelayRunner([source]); runner.start(); await vi.advanceTimersByTimeAsync(1);
    const stopped = runner.stop(); await vi.advanceTimersByTimeAsync(10000); await stopped;
    expect(source.forceClose).toHaveBeenCalledTimes(1);
    await runner.stop(); expect(source.close).toHaveBeenCalledTimes(1);
  });
});

describe("Support transport shutdown compatibility", () => {
  it("force-closes a pending Support Redis quit without changing publication", async () => {
    const { RedisChatRealtime } = await import("@/lib/chat/realtime");
    const realtime = new RedisChatRealtime("redis://localhost");
    const client = { quit: vi.fn().mockReturnValue(new Promise(() => {})), disconnect: vi.fn() };
    Object.defineProperty(realtime, "publisher", { value: client, writable: true });
    void realtime.close(); realtime.forceClose();
    expect(client.disconnect).toHaveBeenCalled();
  });
  it("terminates active Support PostgreSQL clients during the shutdown deadline", async () => {
    const { PostgresChatOutboxStore } = await import("@/lib/chat/outbox-store");
    const store = new PostgresChatOutboxStore("postgres://localhost/unused");
    const client = { end: vi.fn().mockResolvedValue(undefined) };
    const pool = (store as unknown as { pool: { emit: (event: string, client: unknown) => void } }).pool;
    pool.emit("connect", client); store.forceClose();
    expect(client.end).toHaveBeenCalled(); await store.close();
  });
});

describe("Runtime SQL timeout configuration", () => {
  it.each(["statement_timeout=0", "query_timeout=0", "application_name=other", "options=-c%20statement_timeout%3D0", "connect_timeout=0"])("rejects URL options that override the private pool bounds: %s", query => {
    expect(() => readRelayConfig({ RUNTIME_CHAT_RELAY_ENABLED: "true", RUNTIME_CHAT_RELAY_DATABASE_URL: `postgres://runtime/db?${query}`,
      RUNTIME_CHAT_REDIS_PUBLISH_URL: "redis://runtime/0" })).toThrow("Invalid chat relay configuration");
  });
  it("allows transport security settings in the database URL", () => {
    expect(readRelayConfig({ RUNTIME_CHAT_RELAY_ENABLED: "true", RUNTIME_CHAT_RELAY_DATABASE_URL: "postgres://runtime/db?sslmode=require",
      RUNTIME_CHAT_REDIS_PUBLISH_URL: "rediss://runtime/0" }).runtime?.databaseUrl).toContain("sslmode=require");
  });
});

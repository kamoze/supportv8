import { validateRuntimeBatchSize, validateRuntimeDatabaseUrl } from "./runtime-outbox-store";
import { validateRuntimeRedisUrl } from "./runtime-realtime";

export interface RelayBatchResult { claimed: number; delivered: number; failed: number }
export interface RelayAdapter {
  name: "supportv8" | "agenticos";
  process(): Promise<RelayBatchResult>;
  close(): Promise<void>;
  forceClose(): void;
}
export interface RuntimeRelayConfig { databaseUrl: string; redisUrl: string; batchSize: number }
export interface RelayConfig { healthPort: number; supportBatchSize: number; runtime?: RuntimeRelayConfig }
export function readRelayConfig(env: Record<string, string | undefined> = process.env): RelayConfig {
  try {
    const healthPort = Number(env.HEALTH_PORT ?? 8081);
    const supportBatchSize = Number(env.CHAT_RELAY_BATCH_SIZE ?? 100);
    if (!Number.isInteger(healthPort) || healthPort < 1 || healthPort > 65535
      || !Number.isInteger(supportBatchSize) || supportBatchSize < 1 || supportBatchSize > 200
      || ![undefined, "false", "true"].includes(env.RUNTIME_CHAT_RELAY_ENABLED)) throw new Error();
    const config: RelayConfig = { healthPort, supportBatchSize };
    if (env.RUNTIME_CHAT_RELAY_ENABLED === "true") {
      const databaseUrl = env.RUNTIME_CHAT_RELAY_DATABASE_URL ?? "";
      const redisUrl = env.RUNTIME_CHAT_REDIS_PUBLISH_URL ?? "";
      const batchSize = Number(env.RUNTIME_CHAT_RELAY_BATCH_SIZE ?? 25);
      validateRuntimeDatabaseUrl(databaseUrl); validateRuntimeRedisUrl(redisUrl); validateRuntimeBatchSize(batchSize);
      config.runtime = { databaseUrl, redisUrl, batchSize };
    }
    return config;
  } catch { throw new Error("Invalid chat relay configuration"); }
}
export function createRelayAdapters(config: RelayConfig, factories: {
  support: (batchSize: number) => RelayAdapter;
  runtime: (config: RuntimeRelayConfig) => RelayAdapter;
}): RelayAdapter[] {
  return [factories.support(config.supportBatchSize), ...(config.runtime ? [factories.runtime(config.runtime)] : [])];
}
interface SourceState extends RelayBatchResult { attempts: number; lastSuccess: number | null }
interface RunnerOptions {
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  log?: (source: RelayAdapter["name"], category: "batch_failed" | "polling_failed", counts?: RelayBatchResult) => void;
}
export class RelayRunner {
  private readonly abort = new AbortController();
  private readonly states = new Map<RelayAdapter["name"], SourceState>();
  private readonly now: () => number;
  private readonly sleep: NonNullable<RunnerOptions["sleep"]>;
  private readonly log: NonNullable<RunnerOptions["log"]>;
  private loops?: Promise<void>[];
  private stopping?: Promise<void>;

  constructor(private readonly adapters: RelayAdapter[], options: RunnerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? ((ms, signal) => new Promise<void>(resolve => {
      if (signal.aborted) { resolve(); return; }
      const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
      const timer = setTimeout(finish, ms);
      signal.addEventListener("abort", finish, { once: true });
    }));
    this.log = options.log ?? (() => undefined);
    for (const adapter of adapters) this.states.set(adapter.name, { attempts: 0, claimed: 0, delivered: 0, failed: 0, lastSuccess: null });
  }
  start(): void {
    if (!this.loops && !this.abort.signal.aborted) this.loops = this.adapters.map(adapter => this.run(adapter));
  }
  private async run(adapter: RelayAdapter): Promise<void> {
    const state = this.states.get(adapter.name)!;
    while (!this.abort.signal.aborted) {
      let waitMs = 0;
      state.attempts += 1;
      try {
        const result = await adapter.process();
        state.claimed += result.claimed; state.delivered += result.delivered; state.failed += result.failed;
        if (result.claimed === 0 || result.delivered > 0) state.lastSuccess = this.now();
        if (result.failed > 0) { this.log(adapter.name, "batch_failed", result); waitMs = 1_000; }
        else if (result.claimed === 0) waitMs = 250;
      } catch { this.log(adapter.name, "polling_failed"); waitMs = 1_000; }
      if (!this.abort.signal.aborted) {
        // Even a continually full source yields to I/O, health requests and signals.
        try { await this.sleep(waitMs, this.abort.signal); } catch { if (!this.abort.signal.aborted) throw new Error("Relay sleep failed"); }
      }
    }
  }
  health() {
    const live = !this.abort.signal.aborted;
    const sources = Object.fromEntries([...this.states].map(([name, state]) => [name, {
      ready: live && state.lastSuccess !== null && this.now() - state.lastSuccess <= 30_000,
      attempts: state.attempts, claimed: state.claimed, delivered: state.delivered, failed: state.failed,
    }]));
    return { live, ready: live && Object.values(sources).some(source => source.ready), sources };
  }
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.abort.abort();
    this.stopping = this.drain();
    return this.stopping;
  }
  private async drain(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const closes = new Map<RelayAdapter, Promise<void>>();
    const close = (adapter: RelayAdapter) => {
      if (!closes.has(adapter)) closes.set(adapter, Promise.resolve().then(() => adapter.close()).catch(() => undefined));
      return closes.get(adapter)!;
    };
    const drained = Promise.allSettled(this.adapters.map(async (adapter, index) => {
      await this.loops?.[index]?.catch(() => undefined);
      await close(adapter);
    }));
    const deadline = new Promise<void>(resolve => { timer = setTimeout(resolve, 10_000); });
    await Promise.race([drained, deadline]);
    if (timer) clearTimeout(timer);
    // Always force-close transports, including clients whose close/claim never resolved.
    for (const adapter of this.adapters) {
      try { adapter.forceClose(); } catch { /* Continue closing independent sources. */ }
      void close(adapter);
    }
  }
}

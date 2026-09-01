import { createHash } from "node:crypto";
import Redis from "ioredis";

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * 60;

export interface DemoRateLimitBackend {
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export class InMemoryDemoRateLimitBackend implements DemoRateLimitBackend {
  private readonly counters = new Map<string, { count: number; expiresAt: number }>();

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const current = this.counters.get(key);
    if (!current || current.expiresAt <= now) {
      this.counters.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    current.count += 1;
    return current.count;
  }
}

class RedisDemoRateLimitBackend implements DemoRateLimitBackend {
  constructor(private readonly client: Redis) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.eval(
      `local count = redis.call('INCR', KEYS[1])
       if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       return count`,
      1,
      key,
      ttlSeconds
    );
    return Number(result);
  }
}

export class DemoRateLimitError extends Error {
  readonly status = 429;

  constructor(readonly retryAfterSeconds: number) {
    super("Demo usage limit reached. Please wait before trying again.");
    this.name = "DemoRateLimitError";
  }
}

export class DemoRateLimitUnavailableError extends Error {
  readonly status = 503;

  constructor() {
    super("Demo usage controls are temporarily unavailable. Please try again.");
    this.name = "DemoRateLimitUnavailableError";
  }
}

function privacyKey(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function buildBackend(): DemoRateLimitBackend | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return process.env.NODE_ENV === "production" ? null : new InMemoryDemoRateLimitBackend();
  }

  const globalForDemoLimits = globalThis as typeof globalThis & {
    __supportv8DemoRateRedis?: Redis;
  };
  const client =
    globalForDemoLimits.__supportv8DemoRateRedis ??
    new Redis(redisUrl, {
      connectTimeout: 2_000,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
    });
  client.on("error", () => undefined);
  globalForDemoLimits.__supportv8DemoRateRedis = client;
  return new RedisDemoRateLimitBackend(client);
}

export class DemoRateLimiter {
  constructor(private readonly backend: DemoRateLimitBackend | null = buildBackend()) {}

  async enforce(input: {
    action: "access" | "ask";
    tenantId: string;
    clientIdentity: string;
    perMinute: number;
    perHour: number;
  }): Promise<void> {
    if (!this.backend) throw new DemoRateLimitUnavailableError();
    const identity = privacyKey(`${input.tenantId}\0${input.clientIdentity}`);
    const prefix = `supportv8:demo-rate:v1:${input.action}:${identity}`;

    try {
      const minuteCount = await this.backend.increment(`${prefix}:minute`, MINUTE_SECONDS);
      if (minuteCount > input.perMinute) throw new DemoRateLimitError(MINUTE_SECONDS);

      const hourCount = await this.backend.increment(`${prefix}:hour`, HOUR_SECONDS);
      if (hourCount > input.perHour) throw new DemoRateLimitError(HOUR_SECONDS);
    } catch (error) {
      if (error instanceof DemoRateLimitError) throw error;
      throw new DemoRateLimitUnavailableError();
    }
  }
}

export function requestClientIdentity(request: Request): string {
  // The ingress-owned real IP is preferred. If only a proxy chain is
  // available, use its final hop instead of the client-controlled first item.
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwardedChain = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return realIp || forwardedChain?.at(-1) || "unknown";
}

export const demoRateLimiter = new DemoRateLimiter();

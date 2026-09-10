import { createHash } from "node:crypto";
import Redis from "ioredis";

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * 60;

export interface PortalRateLimitBackend {
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export class InMemoryPortalRateLimitBackend implements PortalRateLimitBackend {
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

class RedisPortalRateLimitBackend implements PortalRateLimitBackend {
  constructor(private readonly client: Redis) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.eval(
      `local count = redis.call('INCR', KEYS[1])
       if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       return count`,
      1,
      key,
      ttlSeconds,
    );
    return Number(result);
  }
}

export class PortalRateLimitError extends Error {
  readonly status = 429;

  constructor(readonly retryAfterSeconds: number) {
    super("Too many support searches. Wait a moment and try again.");
    this.name = "PortalRateLimitError";
  }
}

export class PortalRateLimitUnavailableError extends Error {
  readonly status = 503;

  constructor() {
    super("Support search is temporarily unavailable. Start a chat for help.");
    this.name = "PortalRateLimitUnavailableError";
  }
}

function backendFromEnvironment(): PortalRateLimitBackend | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return process.env.NODE_ENV === "production" ? null : new InMemoryPortalRateLimitBackend();

  const globalForPortalLimit = globalThis as typeof globalThis & { __supportv8PortalRateRedis?: Redis };
  const client = globalForPortalLimit.__supportv8PortalRateRedis ?? new Redis(redisUrl, {
    connectTimeout: 2_000,
    enableReadyCheck: true,
    maxRetriesPerRequest: 1,
  });
  client.on("error", () => undefined);
  globalForPortalLimit.__supportv8PortalRateRedis = client;
  return new RedisPortalRateLimitBackend(client);
}

function privateIdentity(tenantId: string, identity: string): string {
  return createHash("sha256").update(`${tenantId}\0${identity.trim().toLowerCase()}`).digest("hex");
}

export class PortalRateLimiter {
  constructor(private readonly backend: PortalRateLimitBackend | null = backendFromEnvironment()) {}

  async enforce(input: {
    tenantId: string;
    clientIdentity: string;
    perMinute?: number;
    perHour?: number;
  }): Promise<void> {
    if (!this.backend) throw new PortalRateLimitUnavailableError();
    const key = `supportv8:portal-rag:v1:${privateIdentity(input.tenantId, input.clientIdentity)}`;
    try {
      const minute = await this.backend.increment(`${key}:minute`, MINUTE_SECONDS);
      if (minute > (input.perMinute ?? 12)) throw new PortalRateLimitError(MINUTE_SECONDS);
      const hour = await this.backend.increment(`${key}:hour`, HOUR_SECONDS);
      if (hour > (input.perHour ?? 120)) throw new PortalRateLimitError(HOUR_SECONDS);
    } catch (error) {
      if (error instanceof PortalRateLimitError) throw error;
      throw new PortalRateLimitUnavailableError();
    }
  }
}

export function portalClientIdentity(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return realIp || forwarded?.at(-1) || "unknown";
}

export const portalRateLimiter = new PortalRateLimiter();

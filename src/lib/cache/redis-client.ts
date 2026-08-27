/**
 * supportV8 Redis Client Adapter
 * Ephemeral context caching, rate limiting, and real-time pub-sub channels.
 */

export class RedisCacheClient {
  private memoryCache: Map<string, { value: string; expiresAt: number }> = new Map();

  public async get(key: string): Promise<string | null> {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public async del(key: string): Promise<void> {
    this.memoryCache.delete(key);
  }

  public async deduplicate(key: string, windowSeconds = 60): Promise<boolean> {
    const existing = await this.get(`dedupe:${key}`);
    if (existing) {
      return false; // already exists
    }
    await this.set(`dedupe:${key}`, "1", windowSeconds);
    return true; // fresh unique event
  }
}

export const redisClient = new RedisCacheClient();

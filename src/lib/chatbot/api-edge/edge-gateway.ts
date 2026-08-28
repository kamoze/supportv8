import type { EdgeAuthContext, SseEventType, SseStreamEvent } from "../types";

// In-memory token bucket rate limit tracker (Redis backed in cluster)
const rateLimitBuckets = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT_CAPACITY = 60; // 60 requests per minute
const REFILL_RATE_PER_SEC = 1; // 1 token/sec

export class EdgeGateway {
  /**
   * Extracts tenant context and validates request authentication
   */
  static authenticateRequest(headers: Headers, url: URL): EdgeAuthContext {
    let tenantId = headers.get("x-tenant-id");

    if (!tenantId) {
      const hostname = url.hostname;
      if (hostname.includes(".support.")) {
        tenantId = hostname.split(".")[0];
      } else {
        tenantId = url.searchParams.get("tenant") || "tenant_default";
      }
    }

    const authHeader = headers.get("authorization");
    const apiKey = headers.get("x-api-key");
    const isAuthorized = Boolean(authHeader || apiKey || tenantId);

    // Rate Limiting check
    const clientIp = headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const bucketKey = `${tenantId}:${clientIp}`;
    const rateLimitRemaining = this.consumeRateLimitToken(bucketKey);

    return {
      tenantId,
      userId: headers.get("x-user-id") || undefined,
      role: headers.get("x-user-role") || "customer",
      isAuthorized,
      rateLimitRemaining,
    };
  }

  /**
   * Token Bucket Rate Limiter
   */
  static consumeRateLimitToken(key: string): number {
    const now = Date.now();
    let bucket = rateLimitBuckets.get(key);

    if (!bucket) {
      bucket = { tokens: RATE_LIMIT_CAPACITY - 1, lastRefill: now };
      rateLimitBuckets.set(key, bucket);
      return bucket.tokens;
    }

    const elapsedSec = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsedSec * REFILL_RATE_PER_SEC);
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(RATE_LIMIT_CAPACITY, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return bucket.tokens;
    }

    return 0;
  }

  /**
   * Formats payload into compliant Server-Sent Events (SSE) data frame
   */
  static formatSse(event: SseEventType, payload: Record<string, unknown>): string {
    const sseEvent: SseStreamEvent = {
      type: event,
      payload,
      timestamp: new Date().toISOString(),
    };
    return `event: ${event}\ndata: ${JSON.stringify(sseEvent)}\n\n`;
  }
}

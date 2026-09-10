import { describe, expect, it } from "vitest";
import {
  InMemoryPortalRateLimitBackend,
  PortalRateLimiter,
  PortalRateLimitError,
} from "@/lib/portal/rate-limit";

describe("public portal RAG rate limits", () => {
  it("limits repeated requests within one tenant", async () => {
    const limiter = new PortalRateLimiter(new InMemoryPortalRateLimitBackend());
    await limiter.enforce({ tenantId: "tenant_acme", clientIdentity: "203.0.113.8", perMinute: 1, perHour: 5 });
    await expect(limiter.enforce({ tenantId: "tenant_acme", clientIdentity: "203.0.113.8", perMinute: 1, perHour: 5 }))
      .rejects.toBeInstanceOf(PortalRateLimitError);
  });

  it("does not share counters between tenants", async () => {
    const limiter = new PortalRateLimiter(new InMemoryPortalRateLimitBackend());
    await limiter.enforce({ tenantId: "tenant_acme", clientIdentity: "203.0.113.8", perMinute: 1, perHour: 5 });
    await expect(limiter.enforce({ tenantId: "tenant_meridian", clientIdentity: "203.0.113.8", perMinute: 1, perHour: 5 }))
      .resolves.toBeUndefined();
  });
});

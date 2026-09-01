import { describe, expect, it } from "vitest";
import {
  DemoRateLimitError,
  DemoRateLimitUnavailableError,
  DemoRateLimiter,
  InMemoryDemoRateLimitBackend,
  requestClientIdentity,
} from "../src/lib/auth/demo-rate-limit";

describe("demo usage limits", () => {
  it("enforces both burst and hourly limits per tenant and client", async () => {
    const limiter = new DemoRateLimiter(new InMemoryDemoRateLimitBackend());
    const input = {
      action: "ask" as const,
      tenantId: "tenant_acme",
      clientIdentity: "203.0.113.20",
      perMinute: 2,
      perHour: 5,
    };

    await limiter.enforce(input);
    await limiter.enforce(input);
    await expect(limiter.enforce(input)).rejects.toBeInstanceOf(DemoRateLimitError);

    await expect(limiter.enforce({ ...input, tenantId: "tenant_meridian" })).resolves.toBeUndefined();
    await expect(limiter.enforce({ ...input, clientIdentity: "203.0.113.21" })).resolves.toBeUndefined();
  });

  it("enforces the hourly limit independently of the minute limit", async () => {
    const limiter = new DemoRateLimiter(new InMemoryDemoRateLimitBackend());
    const input = {
      action: "ask" as const,
      tenantId: "tenant_acme",
      clientIdentity: "203.0.113.20",
      perMinute: 10,
      perHour: 2,
    };

    await limiter.enforce(input);
    await limiter.enforce(input);
    await expect(limiter.enforce(input)).rejects.toMatchObject({ retryAfterSeconds: 3600 });
  });

  it("isolates access and Ask counters", async () => {
    const limiter = new DemoRateLimiter(new InMemoryDemoRateLimitBackend());
    const common = {
      tenantId: "tenant_acme",
      clientIdentity: "203.0.113.20",
      perMinute: 1,
      perHour: 1,
    };

    await limiter.enforce({ ...common, action: "access" });
    await expect(limiter.enforce({ ...common, action: "ask" })).resolves.toBeUndefined();
  });

  it("fails closed when its shared backend fails", async () => {
    const limiter = new DemoRateLimiter({
      increment: async () => {
        throw new Error("redis unavailable");
      },
    });

    await expect(limiter.enforce({
      action: "ask",
      tenantId: "tenant_acme",
      clientIdentity: "203.0.113.20",
      perMinute: 1,
      perHour: 1,
    })).rejects.toBeInstanceOf(DemoRateLimitUnavailableError);
  });

  it("uses the ingress-owned IP instead of a spoofable first forwarded hop", () => {
    const request = new Request("https://support.servicev8.com", {
      headers: {
        "x-real-ip": "198.51.100.8",
        "x-forwarded-for": "6.6.6.6, 10.0.0.4",
      },
    });
    const fallback = new Request("https://support.servicev8.com", {
      headers: { "x-forwarded-for": "6.6.6.6, 10.0.0.4" },
    });

    expect(requestClientIdentity(request)).toBe("198.51.100.8");
    expect(requestClientIdentity(fallback)).toBe("10.0.0.4");
  });
});

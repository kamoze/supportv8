import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Redis from "ioredis";
import {
  OtpRateLimitError,
  OtpStore,
  RedisOtpBackend,
} from "../src/lib/auth/otp-store";

const enabled = process.env.SUPPORTV8_RUN_REDIS_INTEGRATION === "true";
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const senderClient = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
const verifierClient = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

describe.runIf(enabled)("Redis-backed cross-instance OTP integration", () => {
  beforeAll(async () => {
    await Promise.all([senderClient.connect(), verifierClient.connect()]);
  });

  afterAll(async () => {
    await Promise.all([senderClient.quit(), verifierClient.quit()]);
  });

  it("issues, verifies, creates a receipt, and consumes it across distinct clients", async () => {
    const sender = new OtpStore(new RedisOtpBackend(senderClient));
    const verifier = new OtpStore(new RedisOtpBackend(verifierClient));
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `redis-${unique}@example.com`;
    const tenantSlug = `redis-${unique}`;

    const code = await sender.issue("signup", email, tenantSlug);
    const receipt = await verifier.verifySignupAndIssueReceipt(email, code, tenantSlug);
    expect(receipt).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(sender.consumeSignupReceipt(receipt!, email, tenantSlug)).resolves.toBe(true);
    await expect(verifier.consumeSignupReceipt(receipt!, email, tenantSlug)).resolves.toBe(false);
  });

  it("atomically locks a code after five wrong attempts across clients", async () => {
    const sender = new OtpStore(new RedisOtpBackend(senderClient));
    const verifier = new OtpStore(new RedisOtpBackend(verifierClient));
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `lockout-${unique}@example.com`;
    const code = await sender.issue("signup", email, "redis-lockout");
    const wrongCode = code === "000000" ? "000001" : "000000";

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        (index % 2 === 0 ? sender : verifier).verify(
          "signup",
          email,
          wrongCode,
          "redis-lockout"
        )
      )
    );
    await expect(verifier.verify("signup", email, code, "redis-lockout"))
      .resolves.toBe(false);
  });

  it("shares issuance rate limits across clients and workspace variants", async () => {
    const sender = new OtpStore(new RedisOtpBackend(senderClient));
    const verifier = new OtpStore(new RedisOtpBackend(verifierClient));
    const email = `rate-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;

    await sender.enforceIssueRateLimit("signup", email, "alpha");
    await verifier.enforceIssueRateLimit("signup", email, "beta");
    await sender.enforceIssueRateLimit("signup", email, "gamma");
    await expect(
      verifier.enforceIssueRateLimit("signup", email, "delta")
    ).rejects.toBeInstanceOf(OtpRateLimitError);
  });
});

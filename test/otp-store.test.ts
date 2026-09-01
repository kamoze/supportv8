import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryOtpBackend,
  OtpRateLimitError,
  OtpStore,
  OtpStoreUnavailableError,
  type OtpBackend,
} from "../src/lib/auth/otp-store";

class PausingBackend implements OtpBackend {
  readonly inner = new InMemoryOtpBackend();
  private pause = false;
  private enteredResolve?: () => void;
  private releaseResolve?: () => void;
  private entered = Promise.resolve();
  private release = Promise.resolve();

  pauseNextGet(): { entered: Promise<void>; release: () => void } {
    this.pause = true;
    this.entered = new Promise((resolve) => { this.enteredResolve = resolve; });
    this.release = new Promise((resolve) => { this.releaseResolve = resolve; });
    return { entered: this.entered, release: () => this.releaseResolve?.() };
  }

  async get(key: string): Promise<string | null> {
    const value = await this.inner.get(key);
    if (this.pause) {
      this.pause = false;
      this.enteredResolve?.();
      await this.release;
    }
    return value;
  }
  set(key: string, value: string, ttlSeconds: number) { return this.inner.set(key, value, ttlSeconds); }
  del(key: string) { return this.inner.del(key); }
  increment(key: string, ttlSeconds: number) { return this.inner.increment(key, ttlSeconds); }
  incrementIfValue(valueKey: string, expected: string, counterKey: string, maxAttempts: number, ttlSeconds: number) {
    return this.inner.incrementIfValue(valueKey, expected, counterKey, maxAttempts, ttlSeconds);
  }
  compareAndDelete(key: string, expected: string) { return this.inner.compareAndDelete(key, expected); }
  consume(key: string, expected: string, cleanupKey: string, replacement?: { key: string; value: string; ttlSeconds: number }) {
    return this.inner.consume(key, expected, cleanupKey, replacement);
  }
}

describe("shared OTP store hardening", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies a code from another application instance sharing the backend", async () => {
    const backend = new InMemoryOtpBackend();
    const senderInstance = new OtpStore(backend);
    const verifierInstance = new OtpStore(backend);
    const code = await senderInstance.issue("signup", "admin@example.com", "alpha");

    await expect(
      verifierInstance.verify("signup", "admin@example.com", code, "alpha")
    ).resolves.toBe(true);
  });

  it("consumes codes once and isolates purpose and workspace", async () => {
    const store = new OtpStore(new InMemoryOtpBackend());
    const code = await store.issue("signup", "admin@example.com", "alpha");

    await expect(store.verify("password-recovery", "admin@example.com", code, "alpha"))
      .resolves.toBe(false);
    await expect(store.verify("signup", "admin@example.com", code, "beta"))
      .resolves.toBe(false);
    await expect(store.verify("signup", "admin@example.com", code, "alpha"))
      .resolves.toBe(true);
    await expect(store.verify("signup", "admin@example.com", code, "alpha"))
      .resolves.toBe(false);
  });

  it("locks the code after five unsuccessful attempts", async () => {
    const store = new OtpStore(new InMemoryOtpBackend());
    const code = await store.issue("signup", "locked@example.com", "alpha");

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(store.verify("signup", "locked@example.com", "000000", "alpha"))
        .resolves.toBe(false);
    }
    await expect(store.verify("signup", "locked@example.com", code, "alpha"))
      .resolves.toBe(false);
  });

  it("binds a one-time signup receipt to the verified email and workspace", async () => {
    const store = new OtpStore(new InMemoryOtpBackend());
    const code = await store.issue("signup", "admin@example.com", "alpha");
    const receipt = await store.verifySignupAndIssueReceipt(
      "admin@example.com",
      code,
      "alpha"
    );

    expect(receipt).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(
      store.consumeSignupReceipt(receipt!, "admin@example.com", "beta")
    ).resolves.toBe(false);
    await expect(
      store.consumeSignupReceipt(receipt!, "other@example.com", "alpha")
    ).resolves.toBe(false);
    await expect(
      store.consumeSignupReceipt(receipt!, "admin@example.com", "alpha")
    ).resolves.toBe(true);
    await expect(
      store.consumeSignupReceipt(receipt!, "admin@example.com", "alpha")
    ).resolves.toBe(false);
  });

  it("rejects an expired OTP", async () => {
    const store = new OtpStore(new InMemoryOtpBackend());
    const code = await store.issue("signup", "expired@example.com", "alpha");
    const afterIssue = Date.now();

    vi.useFakeTimers();
    vi.setSystemTime(afterIssue + 10 * 60 * 1000 + 1);
    await expect(store.verify("signup", "expired@example.com", code, "alpha"))
      .resolves.toBe(false);
  });

  it("does not let a stale verification race invalidate a newly resent code", async () => {
    const backend = new PausingBackend();
    const store = new OtpStore(backend);
    const oldCode = await store.issue("signup", "race@example.com", "alpha");
    const wrongCode = oldCode === "000000" ? "000001" : "000000";
    const gate = backend.pauseNextGet();
    const staleVerification = store.verify("signup", "race@example.com", wrongCode, "alpha");

    await gate.entered;
    const newCode = await store.issue("signup", "race@example.com", "alpha");
    gate.release();

    await expect(staleVerification).resolves.toBe(false);
    await expect(store.verify("signup", "race@example.com", newCode, "alpha"))
      .resolves.toBe(true);
  });

  it("rate limits repeated code issuance by email and workspace", async () => {
    const store = new OtpStore(new InMemoryOtpBackend());
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        store.enforceIssueRateLimit("signup", "flood@example.com", "alpha")
      ).resolves.toBeUndefined();
    }
    await expect(
      store.enforceIssueRateLimit("signup", "flood@example.com", "alpha")
    ).rejects.toBeInstanceOf(OtpRateLimitError);
    await expect(
      store.enforceIssueRateLimit("signup", "flood@example.com", "beta")
    ).rejects.toBeInstanceOf(OtpRateLimitError);
    await expect(
      store.enforceIssueRateLimit("signup", "other@example.com", "beta")
    ).resolves.toBeUndefined();
  });

  it("applies a service-wide issuance backstop independent of email and IP", async () => {
    const store = new OtpStore(new InMemoryOtpBackend());
    for (let attempt = 0; attempt < 300; attempt += 1) {
      await expect(
        store.enforceIssueRateLimit(
          "signup",
          `global-${attempt}@example.com`,
          `workspace-${attempt}`
        )
      ).resolves.toBeUndefined();
    }
    await expect(
      store.enforceIssueRateLimit("signup", "global-overflow@example.com", "overflow")
    ).rejects.toBeInstanceOf(OtpRateLimitError);
  });

  it("does not burn a valid code when atomic receipt issuance fails", async () => {
    const backend = new InMemoryOtpBackend();
    const failingBackend: OtpBackend = {
      get: (key) => backend.get(key),
      set: (key, value, ttl) => backend.set(key, value, ttl),
      del: (key) => backend.del(key),
      increment: (key, ttl) => backend.increment(key, ttl),
      incrementIfValue: (valueKey, expected, counterKey, max, ttl) =>
        backend.incrementIfValue(valueKey, expected, counterKey, max, ttl),
      compareAndDelete: (key, expected) => backend.compareAndDelete(key, expected),
      consume: async () => { throw new Error("backend unavailable"); },
    };
    const store = new OtpStore(failingBackend);
    const code = await store.issue("signup", "atomic@example.com", "alpha");

    await expect(
      store.verifySignupAndIssueReceipt("atomic@example.com", code, "alpha")
    ).rejects.toBeInstanceOf(OtpStoreUnavailableError);
    await expect(
      new OtpStore(backend).verify("signup", "atomic@example.com", code, "alpha")
    ).resolves.toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { InMemoryOtpBackend } from "../src/lib/auth/otp-store";
import { BotTransactionStore } from "../src/lib/auth/bot-transaction";

const binding = { hostname: "alpha.support.servicev8.com", action: "signin" as const, email: "lead@example.com", tenantSlug: "alpha" };
describe("one-use browser bot transactions", () => {
  it("binds browser cookie, action, host, email and workspace across instances", async () => {
    const backend = new InMemoryOtpBackend(), first = new BotTransactionStore(backend), second = new BotTransactionStore(backend);
    const challenge = await first.issue(binding);
    expect(challenge.id).toMatch(/^[a-f0-9]{64}$/);
    for (const patch of [{ hostname: "beta.support.servicev8.com" }, { action: "signup" as const }, { email: "other@example.com" }, { tenantSlug: "beta" }]) {
      await expect(second.consume(challenge.id, challenge.cookieSecret, { ...binding, ...patch })).resolves.toBe(false);
    }
    await expect(second.consume(challenge.id, "wrong", binding)).resolves.toBe(false);
    const outcomes = await Promise.all([first.consume(challenge.id, challenge.cookieSecret, binding), second.consume(challenge.id, challenge.cookieSecret, binding)]);
    expect(outcomes.sort()).toEqual([false, true]);
    await expect(first.consume(challenge.id, challenge.cookieSecret, binding)).resolves.toBe(false);
  });
  it("rejects expired transactions using stored time even when backend retains an expired row", async () => {
    const backend = new InMemoryOtpBackend(); let now = Date.now();
    const first = new BotTransactionStore(backend, () => now), challenge = await first.issue(binding);
    now += 300_001;
    await expect(first.consume(challenge.id, challenge.cookieSecret, binding)).resolves.toBe(false);
  });
  it("bounds issuance and never stores raw email or cookie secret", async () => {
    const backend = new InMemoryOtpBackend(); const writes: string[] = [];
    const original = backend.set.bind(backend); backend.set = async (k,v,t) => { writes.push(k,v); await original(k,v,t); };
    const store = new BotTransactionStore(backend), challenge = await store.issue(binding);
    expect(writes.join(" ")).not.toContain(binding.email); expect(writes.join(" ")).not.toContain(challenge.cookieSecret);
    for (let i = 1; i < 10; i++) await store.issue(binding);
    await expect(store.issue(binding)).rejects.toMatchObject({ status: 429 });
  });
  it("fails closed when the durable store is unavailable", async () => {
    const backend = new InMemoryOtpBackend(); backend.increment = async () => { throw new Error("private connection detail"); };
    await expect(new BotTransactionStore(backend).issue(binding)).rejects.toMatchObject({ status: 503, message: "Security verification is temporarily unavailable. Please try again." });
  });
});

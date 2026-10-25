import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Redis from "ioredis";
import { RedisOtpBackend } from "../src/lib/auth/otp-store";
import { BotTransactionStore } from "../src/lib/auth/bot-transaction";
const enabled = process.env.SUPPORTV8_RUN_REDIS_INTEGRATION === "true";
if (enabled && !process.env.REDIS_URL) throw new Error("Redis bot proof gate requires its disposable fixture");
const clients: Redis[] = [];
const connect = async () => { const client = new Redis(process.env.REDIS_URL!, { lazyConnect: true, maxRetriesPerRequest: 1 }); clients.push(client); await client.connect(); return client; };
describe.runIf(enabled)("mandatory Redis one-use bot transaction", () => {
  let first: Redis, second: Redis;
  beforeAll(async () => { first = await connect(); second = await connect(); });
  afterAll(async () => { await Promise.all(clients.filter(client => client.status !== "end").map(client => client.quit())); });
  it("survives issuer process replacement and admits exactly one concurrent consumption across independent clients", async () => {
    const binding = { hostname: "alpha.support.servicev8.com", action: "signin" as const, tenantSlug: "alpha", email: `bot-${crypto.randomUUID()}@example.test` };
    const transaction = await new BotTransactionStore(new RedisOtpBackend(first)).issue(binding);
    await first.quit();
    const replacement = await connect();
    const consumers = [new BotTransactionStore(new RedisOtpBackend(second)), new BotTransactionStore(new RedisOtpBackend(replacement))];
    expect((await Promise.all(consumers.map(store => store.consume(transaction.id, transaction.cookieSecret, binding)))).sort()).toEqual([false, true]);
    expect(await consumers[0].consume(transaction.id, transaction.cookieSecret, binding)).toBe(false);
  });
});

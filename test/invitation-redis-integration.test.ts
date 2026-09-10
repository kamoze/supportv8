import { randomUUID, createHash } from "node:crypto";
import Redis from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvitationStore } from "@/lib/auth/invitation-store";
const enabled = process.env.SUPPORTV8_RUN_REDIS_INTEGRATION === "true";
describe.skipIf(!enabled)("single-use invitation Redis integration", () => {
  let redis: Redis;
  let other: Redis;
  const tenant = `tenant_${randomUUID().replaceAll("-", "")}`;
  const invitation = (id = randomUUID()) => ({ tenantId: tenant, userId: id, email: "test@example.test" });
  beforeAll(() => { redis = new Redis(process.env.REDIS_URL!); other = new Redis(process.env.REDIS_URL!); });
  afterAll(async () => {
    // Only this test's unique tenant namespace is removed.
    const keys = await redis.keys(`supportv8:auth:invitation:{${tenant}}:*`);
    if (keys.length) await redis.del(...keys);
    await Promise.all([redis.quit(), other.quit()]);
  });
  it("shares state across replicas and consumes exactly once under concurrent submissions", async () => {
    const one = new InvitationStore(() => redis); const two = new InvitationStore(() => other);
    const invited = invitation(); const token = await one.issue(invited);
    const results = await Promise.allSettled([one.consume(tenant, token, "ip1"), two.consume(tenant, token, "ip2")]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const winner = results.find(r => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof one.consume>>>;
    expect(winner.value.invitation).toMatchObject(invited);
    await winner.value.release();
    await expect(two.consume(tenant, token, "ip3")).rejects.toThrow(/already used/);
  });
  it("stores only a token digest and applies expiry", async () => {
    const store = new InvitationStore(() => redis); const token = await store.issue(invitation());
    const key = `supportv8:auth:invitation:{${tenant}}:${token.split(".")[0]}`;
    const raw = await redis.get(key);
    expect(raw).not.toContain(token);
    expect(raw).toContain(createHash("sha256").update(token).digest("hex"));
    expect(await redis.ttl(key)).toBeGreaterThan(86_390);
    await redis.pexpire(key, 1);
    await new Promise(resolve => setTimeout(resolve, 10));
    await expect(store.consume(tenant, token, "expiry-ip")).rejects.toThrow(/expired/);
  });
  it("invalidates replaced links and throttles resends", async () => {
    const store = new InvitationStore(() => redis); const invited = invitation(); const first = await store.issue(invited);
    await expect(store.issue(invited)).rejects.toMatchObject({ status: 429 });
    await redis.del(`supportv8:auth:invitation:{${tenant}}:${first.split(".")[0]}:rate`);
    const second = await store.issue(invited);
    await expect(store.consume(tenant, first, "old-ip")).rejects.toThrow();
    const claimed = await store.consume(tenant, second, "new-ip");
    await expect(store.issue(invited)).rejects.toMatchObject({ status: 409 });
    await claimed.release();
  });
  it("does not consume a link presented to another tenant", async () => {
    const store = new InvitationStore(() => redis); const token = await store.issue(invitation());
    const different = `tenant_${randomUUID().replaceAll("-", "")}`;
    await expect(store.consume(different, token, "cross-ip")).rejects.toThrow();
    const claim = await store.consume(tenant, token, "same-ip"); await claim.release();
    const keys = await redis.keys(`supportv8:auth:invitation:{${different}}:*`); if (keys.length) await redis.del(...keys);
  });
});

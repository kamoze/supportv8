import { afterAll, describe, expect, it } from "vitest";
import Redis from "ioredis";
import { StaffPresenceStore, presenceKeys } from "@/lib/chat/staff-presence";
const enabled = process.env.SUPPORTV8_RUN_REDIS_INTEGRATION === "true";
const client = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { lazyConnect: true, maxRetriesPerRequest: 1 });
const second = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379", { lazyConnect: true, maxRetriesPerRequest: 1 });
const tenantId = `tenant_presence_${Date.now()}`;
describe.runIf(enabled)("shared Redis staff presence", () => {
  afterAll(async () => { await client.del(...presenceKeys(tenantId)); await Promise.all([client.quit(), second.quit()]); });
  it("shares staff across replicas, isolates tenants, updates names, and expires abandoned sessions", async () => {
    let now = Date.now();
    const a = new StaffPresenceStore(() => client, () => now);
    const b = new StaffPresenceStore(() => second, () => now);
    const ctx = { tenantId, tenantSlug: tenantId.slice(7).replace(/_/g, "-"), userId: "operator", username: "operator@example.test", displayName: "Jordan", authenticated: true, roles: ["support_operator"] };
    expect(await a.list(tenantId)).toEqual([]);
    await a.heartbeat(ctx);
    expect(await b.list(tenantId)).toMatchObject([{ id: "operator", name: "Jordan" }]);
    expect(await b.list("tenant_unrelated")).toEqual([]);
    await b.heartbeat({ ...ctx, displayName: "Jo" });
    expect(await a.list(tenantId)).toMatchObject([{ id: "operator", name: "Jo" }]);
    now += 90_001;
    expect(await b.list(tenantId)).toEqual([]);
    await a.heartbeat(ctx); await b.remove(ctx);
    expect(await a.list(tenantId)).toEqual([]);
  });
});

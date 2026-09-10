import Redis from "ioredis";
import { createHash } from "node:crypto";
import type { RequestTenantContext } from "@/lib/auth/request-tenant";
import { requireAccountIdentity, AccountError } from "@/lib/auth/account-members";

export interface StaffPresence { id: string; name: string; email: string; kind: "human"; lastSeenAt: string }
const TTL_SECONDS = 90;
let redis: Redis | undefined;
function client() {
  if (!process.env.REDIS_URL) throw new AccountError("Live presence is unavailable. Please retry.", 503);
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, { connectTimeout: 2000, maxRetriesPerRequest: 1 });
    redis.on("error", () => undefined);
  }
  return redis;
}

export function presenceKeys(tenantId: string) {
  if (!/^tenant_[a-z0-9_]{1,56}$/.test(tenantId)) throw new AccountError("Invalid workspace.", 403);
  return [`supportv8:presence:{${tenantId}}:expiry`, `supportv8:presence:{${tenantId}}:staff`];
}

export class StaffPresenceStore {
  constructor(private readonly getClient = client, private readonly now = Date.now) {}
  async heartbeat(ctx: RequestTenantContext) {
    requireAccountIdentity(ctx);
    if (!ctx.roles.some(r => ["support_superadmin", "support_cx_lead", "support_operator", "support_contractor_lead", "support_technician"].includes(r))) throw new AccountError("A staff role is required.", 403);
    const keys = presenceKeys(ctx.tenantId);
    const id = createHash("sha256").update(ctx.userId!).digest("hex");
    const record: StaffPresence = { id: ctx.userId!, name: ctx.displayName || "Support operator", email: ctx.username || "", kind: "human", lastSeenAt: new Date(this.now()).toISOString() };
    await this.getClient().eval(`redis.call('HSET', KEYS[2], ARGV[1], ARGV[2])
      redis.call('ZADD', KEYS[1], ARGV[3], ARGV[1])
      redis.call('EXPIRE', KEYS[1], ARGV[4]); redis.call('EXPIRE', KEYS[2], ARGV[4]); return 1`,
    2, ...keys, id, JSON.stringify(record), this.now() + TTL_SECONDS * 1000, TTL_SECONDS * 2);
  }
  async remove(ctx: RequestTenantContext) {
    if (!ctx.userId) return;
    const id = createHash("sha256").update(ctx.userId).digest("hex");
    await this.getClient().eval(`redis.call('ZREM', KEYS[1], ARGV[1]); redis.call('HDEL', KEYS[2], ARGV[1]); return 1`, 2, ...presenceKeys(ctx.tenantId), id);
  }
  async list(tenantId: string): Promise<StaffPresence[]> {
    const rows = await this.getClient().eval(`local expired = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
      for _, id in ipairs(expired) do redis.call('HDEL', KEYS[2], id) end
      redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
      local ids = redis.call('ZRANGE', KEYS[1], 0, 499)
      local result = {}
      for _, id in ipairs(ids) do local record = redis.call('HGET', KEYS[2], id); if record then table.insert(result, record) end end
      return result`, 2, ...presenceKeys(tenantId), this.now()) as string[];
    return rows.map(row => JSON.parse(row) as StaffPresence);
  }
}
export const staffPresence = new StaffPresenceStore();

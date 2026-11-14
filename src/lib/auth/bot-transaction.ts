import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import Redis from "ioredis";
import { RedisOtpBackend, type OtpBackend } from "./otp-store";

export type BotAction = "signup" | "signin" | "forgot_password" | "invitation_accept" | "sso";
export type BotBinding = { hostname: string; action: BotAction; email: string; tenantSlug: string };
export class BotProofError extends Error {
  constructor(public readonly status = 400, message = "Complete a new security check and try again.") { super(message); }
}
export const unavailableBotProof = () => new BotProofError(503, "Security verification is temporarily unavailable. Please try again.");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const bindingDigest = (binding: BotBinding) => digest(JSON.stringify([binding.hostname, binding.action, binding.email, binding.tenantSlug]));
const prefix = "supportv8:auth:bot:v1:";
const ttl = 300;

export class BotTransactionStore {
  constructor(private readonly backend: OtpBackend, private readonly now = Date.now) {}
  async issue(binding: BotBinding): Promise<{ id: string; cookieSecret: string; expiresAt: number }> {
    try {
      const globalCount = await this.backend.increment(`${prefix}rate:global`, 60);
      const scopedCount = await this.backend.increment(`${prefix}rate:${digest(binding.email)}`, ttl);
      if (globalCount > 600 || scopedCount > 10) throw new BotProofError(429, "Too many security checks. Please wait before trying again.");
      const id = randomBytes(32).toString("hex"), cookieSecret = randomBytes(32).toString("base64url"), expiresAt = this.now() + ttl * 1000;
      await this.backend.set(`${prefix}${id}`, JSON.stringify({ binding: bindingDigest(binding), secret: digest(cookieSecret), expiresAt }), ttl);
      return { id, cookieSecret, expiresAt };
    } catch (error) { if (error instanceof BotProofError) throw error; throw unavailableBotProof(); }
  }
  async consume(id: string, cookieSecret: string, binding: BotBinding): Promise<boolean> {
    if (!/^[a-f0-9]{64}$/.test(id) || !/^[A-Za-z0-9_-]{43}$/.test(cookieSecret)) return false;
    try {
      const key = `${prefix}${id}`, raw = await this.backend.get(key);
      if (!raw) return false;
      const value = JSON.parse(raw) as Record<string, unknown>;
      if (value.binding !== bindingDigest(binding) || typeof value.secret !== "string" || !/^[a-f0-9]{64}$/.test(value.secret)
        || !Number.isSafeInteger(value.expiresAt) || Number(value.expiresAt) <= this.now()
        || !timingSafeEqual(Buffer.from(value.secret, "hex"), Buffer.from(digest(cookieSecret), "hex"))) return false;
      // Consume once before any remote verification. Unknown provider outcomes
      // require a new transaction, never a retry that reuses an accepted proof.
      return await this.backend.compareAndDelete(key, raw);
    } catch { throw unavailableBotProof(); }
  }
}

let cached: { url: string; backend: RedisOtpBackend } | undefined;
export function durableBotBackend(): OtpBackend {
  const url = process.env.REDIS_URL;
  if (!url) throw unavailableBotProof();
  if (cached?.url === url) return cached.backend;
  const client = new Redis(url, { connectTimeout: 2000, commandTimeout: 3000, maxRetriesPerRequest: 1 });
  client.on("error", () => undefined);
  const backend = new RedisOtpBackend(client); cached = { url, backend };
  return backend;
}

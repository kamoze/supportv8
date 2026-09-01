import {
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import Redis from "ioredis";

export type OtpPurpose = "signup" | "password-recovery";

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_KEY_PREFIX = "supportv8:auth:otp:v1";
const SIGNUP_RECEIPT_TTL_SECONDS = 10 * 60;
const SIGNUP_RECEIPT_KEY_PREFIX = "supportv8:auth:signup-receipt:v1";
const OTP_RATE_WINDOW_SECONDS = 10 * 60;
const OTP_RATE_EMAIL_MAX = 3;
const OTP_RATE_IP_MAX = 10;
const OTP_RATE_GLOBAL_MAX = 300;
const OTP_RATE_KEY_PREFIX = "supportv8:auth:otp-rate:v1";

export interface OtpBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  increment(key: string, ttlSeconds: number): Promise<number>;
  incrementIfValue(
    valueKey: string,
    expected: string,
    counterKey: string,
    maxAttempts: number,
    ttlSeconds: number
  ): Promise<number>;
  compareAndDelete(key: string, expected: string): Promise<boolean>;
  consume(
    key: string,
    expected: string,
    cleanupKey: string,
    replacement?: { key: string; value: string; ttlSeconds: number }
  ): Promise<boolean>;
}

interface StoredValue {
  value: string;
  expiresAt: number;
}

export class InMemoryOtpBackend implements OtpBackend {
  private readonly values = new Map<string, StoredValue>();

  private currentValue(key: string): string | null {
    const record = this.values.get(key);
    if (!record) return null;
    if (record.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return record.value;
  }

  async get(key: string): Promise<string | null> {
    return this.currentValue(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.values.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.values.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const current = this.currentValue(key);
    const next = (current ? Number(current) : 0) + 1;
    const existing = this.values.get(key);
    this.values.set(key, {
      value: String(next),
      expiresAt: existing?.expiresAt ?? Date.now() + ttlSeconds * 1000,
    });
    return next;
  }

  async incrementIfValue(
    valueKey: string,
    expected: string,
    counterKey: string,
    maxAttempts: number,
    ttlSeconds: number
  ): Promise<number> {
    if (this.currentValue(valueKey) !== expected) return -1;
    const current = this.currentValue(counterKey);
    const next = (current ? Number(current) : 0) + 1;
    const sourceExpiry = this.values.get(valueKey)?.expiresAt;
    this.values.set(counterKey, {
      value: String(next),
      expiresAt: sourceExpiry ?? Date.now() + ttlSeconds * 1000,
    });
    if (next >= maxAttempts && this.currentValue(valueKey) === expected) {
      this.values.delete(valueKey);
      this.values.delete(counterKey);
    }
    return next;
  }

  async compareAndDelete(key: string, expected: string): Promise<boolean> {
    const current = this.currentValue(key);
    if (current !== expected) return false;
    this.values.delete(key);
    return true;
  }

  async consume(
    key: string,
    expected: string,
    cleanupKey: string,
    replacement?: { key: string; value: string; ttlSeconds: number }
  ): Promise<boolean> {
    if (this.currentValue(key) !== expected) return false;
    this.values.delete(key);
    this.values.delete(cleanupKey);
    if (replacement) {
      this.values.set(replacement.key, {
        value: replacement.value,
        expiresAt: Date.now() + replacement.ttlSeconds * 1000,
      });
    }
    return true;
  }
}

export class RedisOtpBackend implements OtpBackend {
  constructor(private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.client.set(key, value, "EX", ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const result = await this.client.eval(
      `local count = redis.call('INCR', KEYS[1])
       if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
       return count`,
      1,
      key,
      ttlSeconds
    );
    return Number(result);
  }

  async incrementIfValue(
    valueKey: string,
    expected: string,
    counterKey: string,
    maxAttempts: number,
    ttlSeconds: number
  ): Promise<number> {
    const result = await this.client.eval(
      `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return -1 end
       local count = redis.call('INCR', KEYS[2])
       if count == 1 then
         local source_ttl = redis.call('TTL', KEYS[1])
         if source_ttl > 0 then redis.call('EXPIRE', KEYS[2], source_ttl)
         else redis.call('EXPIRE', KEYS[2], ARGV[3]) end
       end
       if count >= tonumber(ARGV[2]) and redis.call('GET', KEYS[1]) == ARGV[1] then
         redis.call('DEL', KEYS[1], KEYS[2])
       end
       return count`,
      2,
      valueKey,
      counterKey,
      expected,
      maxAttempts,
      ttlSeconds
    );
    return Number(result);
  }

  async compareAndDelete(key: string, expected: string): Promise<boolean> {
    const result = await this.client.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then
         return redis.call('DEL', KEYS[1])
       end
       return 0`,
      1,
      key,
      expected
    );
    return Number(result) === 1;
  }

  async consume(
    key: string,
    expected: string,
    cleanupKey: string,
    replacement?: { key: string; value: string; ttlSeconds: number }
  ): Promise<boolean> {
    const replacementKey = replacement?.key || key;
    const result = await this.client.eval(
      `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
       redis.call('DEL', KEYS[1], KEYS[2])
       if ARGV[2] == '1' then
         redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4])
       end
       return 1`,
      3,
      key,
      cleanupKey,
      replacementKey,
      expected,
      replacement ? "1" : "0",
      replacement?.value || "",
      replacement?.ttlSeconds || 1
    );
    return Number(result) === 1;
  }
}

class UnavailableOtpBackend implements OtpBackend {
  private unavailable(): never {
    throw new OtpStoreUnavailableError();
  }

  async get(): Promise<string | null> {
    return this.unavailable();
  }
  async set(): Promise<void> {
    return this.unavailable();
  }
  async del(): Promise<void> {
    return this.unavailable();
  }
  async increment(): Promise<number> {
    return this.unavailable();
  }
  async incrementIfValue(): Promise<number> {
    return this.unavailable();
  }
  async compareAndDelete(): Promise<boolean> {
    return this.unavailable();
  }
  async consume(): Promise<boolean> {
    return this.unavailable();
  }
}

export class OtpStoreUnavailableError extends Error {
  readonly status = 503;

  constructor() {
    super("Verification service is temporarily unavailable. Please try again.");
    this.name = "OtpStoreUnavailableError";
  }
}

export class OtpRateLimitError extends Error {
  readonly status = 429;
  readonly retryAfterSeconds = OTP_RATE_WINDOW_SECONDS;

  constructor() {
    super("Too many verification codes requested. Please wait before trying again.");
    this.name = "OtpRateLimitError";
  }
}

function deriveCode(code: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, 32, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function otpKey(purpose: OtpPurpose, email: string, scope = ""): string {
  const identity = createHash("sha256")
    .update(`${normalize(email)}\0${normalize(scope)}`)
    .digest("hex");
  return `${OTP_KEY_PREFIX}:${purpose}:${identity}`;
}

function signupReceiptKey(receipt: string): string {
  const digest = createHash("sha256").update(receipt).digest("hex");
  return `${SIGNUP_RECEIPT_KEY_PREFIX}:${digest}`;
}

function signupReceiptBinding(email: string, tenantSlug: string): string {
  return JSON.stringify({ email: normalize(email), tenantSlug: normalize(tenantSlug) });
}

function privacyDigest(...parts: string[]): string {
  return createHash("sha256")
    .update(parts.map(normalize).join("\0"))
    .digest("hex");
}

function buildDefaultBackend(): OtpBackend {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return process.env.NODE_ENV === "production"
      ? new UnavailableOtpBackend()
      : new InMemoryOtpBackend();
  }

  const globalForOtp = globalThis as typeof globalThis & { __supportv8OtpRedis?: Redis };
  const client =
    globalForOtp.__supportv8OtpRedis ??
    new Redis(redisUrl, {
      connectTimeout: 2_000,
      enableReadyCheck: true,
      maxRetriesPerRequest: 1,
    });
  client.on("error", () => undefined);
  globalForOtp.__supportv8OtpRedis = client;
  return new RedisOtpBackend(client);
}

export class OtpStore {
  constructor(private readonly backend: OtpBackend = buildDefaultBackend()) {}

  private async callBackend<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof OtpStoreUnavailableError) throw error;
      throw new OtpStoreUnavailableError();
    }
  }

  async issue(purpose: OtpPurpose, email: string, scope = ""): Promise<string> {
    const code = randomInt(100_000, 1_000_000).toString();
    const salt = randomBytes(16).toString("hex");
    const hash = (await deriveCode(code, salt)).toString("hex");
    const key = otpKey(purpose, email, scope);
    await this.callBackend(() =>
      this.backend.set(key, JSON.stringify({ salt, hash }), OTP_TTL_SECONDS)
    );
    await this.callBackend(() => this.backend.del(`${key}:attempts`));
    return code;
  }

  async enforceIssueRateLimit(
    purpose: OtpPurpose,
    email: string,
    scope = "",
    clientIp?: string
  ): Promise<void> {
    const globalKey = `${OTP_RATE_KEY_PREFIX}:global:${purpose}`;
    const globalCount = await this.callBackend(() =>
      this.backend.increment(globalKey, OTP_RATE_WINDOW_SECONDS)
    );
    if (globalCount > OTP_RATE_GLOBAL_MAX) throw new OtpRateLimitError();

    const emailKey = `${OTP_RATE_KEY_PREFIX}:email:${privacyDigest(purpose, email)}`;
    const emailCount = await this.callBackend(() =>
      this.backend.increment(emailKey, OTP_RATE_WINDOW_SECONDS)
    );
    if (emailCount > OTP_RATE_EMAIL_MAX) throw new OtpRateLimitError();

    if (scope.trim()) {
      const scopedKey = `${OTP_RATE_KEY_PREFIX}:scope:${privacyDigest(purpose, email, scope)}`;
      const scopedCount = await this.callBackend(() =>
        this.backend.increment(scopedKey, OTP_RATE_WINDOW_SECONDS)
      );
      if (scopedCount > OTP_RATE_EMAIL_MAX) throw new OtpRateLimitError();
    }

    const cleanIp = clientIp?.trim();
    if (cleanIp) {
      const ipKey = `${OTP_RATE_KEY_PREFIX}:ip:${privacyDigest(purpose, cleanIp)}`;
      const ipCount = await this.callBackend(() =>
        this.backend.increment(ipKey, OTP_RATE_WINDOW_SECONDS)
      );
      if (ipCount > OTP_RATE_IP_MAX) throw new OtpRateLimitError();
    }
  }

  private async verifyAndConsume(
    purpose: OtpPurpose,
    email: string,
    code: string,
    scope: string,
    replacement?: { key: string; value: string; ttlSeconds: number }
  ): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) return false;
    const key = otpKey(purpose, email, scope);
    const stored = await this.callBackend(() => this.backend.get(key));
    if (!stored) return false;

    let record: { salt: string; hash: string };
    try {
      record = JSON.parse(stored) as { salt: string; hash: string };
    } catch {
      await this.callBackend(() => this.backend.compareAndDelete(key, stored));
      return false;
    }

    if (
      typeof record.salt !== "string" ||
      !/^[a-f0-9]{32}$/i.test(record.salt) ||
      typeof record.hash !== "string" ||
      !/^[a-f0-9]{64}$/i.test(record.hash)
    ) {
      await this.callBackend(() => this.backend.compareAndDelete(key, stored));
      return false;
    }

    const expected = Buffer.from(record.hash, "hex");
    const received = await deriveCode(code, record.salt);
    const attemptsKey = `${key}:attempts`;
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      await this.callBackend(() =>
        this.backend.incrementIfValue(
          key,
          stored,
          attemptsKey,
          OTP_MAX_ATTEMPTS,
          OTP_TTL_SECONDS
        )
      );
      return false;
    }

    return this.callBackend(() =>
      this.backend.consume(key, stored, attemptsKey, replacement)
    );
  }

  async verify(purpose: OtpPurpose, email: string, code: string, scope = ""): Promise<boolean> {
    return this.verifyAndConsume(purpose, email, code, scope);
  }

  async verifySignupAndIssueReceipt(
    email: string,
    code: string,
    tenantSlug: string
  ): Promise<string | null> {
    const receipt = randomBytes(32).toString("base64url");
    const verified = await this.verifyAndConsume("signup", email, code, tenantSlug, {
      key: signupReceiptKey(receipt),
      value: signupReceiptBinding(email, tenantSlug),
      ttlSeconds: SIGNUP_RECEIPT_TTL_SECONDS,
    });
    return verified ? receipt : null;
  }

  async consumeSignupReceipt(
    receipt: string,
    email: string,
    tenantSlug: string
  ): Promise<boolean> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(receipt)) return false;
    const key = signupReceiptKey(receipt);
    const expected = signupReceiptBinding(email, tenantSlug);
    return this.callBackend(() => this.backend.compareAndDelete(key, expected));
  }

  async revoke(purpose: OtpPurpose, email: string, scope = ""): Promise<void> {
    const key = otpKey(purpose, email, scope);
    await this.callBackend(() =>
      Promise.all([this.backend.del(key), this.backend.del(`${key}:attempts`)]).then(
        () => undefined
      )
    );
  }
}

export const otpStore = new OtpStore();

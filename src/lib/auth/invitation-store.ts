import { createHash, randomBytes } from "node:crypto";
import Redis from "ioredis";

export class InvitationError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
export interface Invitation {
  tenantId: string;
  userId: string;
  email: string;
}
export const INVITATION_TTL_SECONDS = 86_400;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
let redis: Redis | undefined;
function client() {
  if (!process.env.REDIS_URL) throw new InvitationError("Invitation service is unavailable. Please try again later.", 503);
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, { connectTimeout: 2000, commandTimeout: 3000, maxRetriesPerRequest: 1 });
    redis.on("error", () => undefined);
  }
  return redis;
}
function prefix(tenantId: string) {
  if (!/^tenant_[a-z0-9_]{1,56}$/.test(tenantId)) throw new InvitationError("Invalid workspace.", 403);
  return `supportv8:auth:invitation:{${tenantId}}`;
}
export class InvitationStore {
  constructor(private readonly getClient = client) {}

  async issue(invitation: Invitation): Promise<string> {
    const subject = digest(invitation.userId);
    const key = `${prefix(invitation.tenantId)}:${subject}`;
    const token = `${subject}.${randomBytes(32).toString("hex")}`;
    const result = Number(await this.getClient().eval(`
      if redis.call('EXISTS', KEYS[2]) == 1 then return -1 end
      if redis.call('EXISTS', KEYS[3]) == 1 then return -2 end
      redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
      redis.call('SET', KEYS[3], '1', 'EX', 60)
      return 1`, 3, key, `${key}:busy`, `${key}:rate`,
    JSON.stringify({ ...invitation, tokenHash: digest(token) }), INVITATION_TTL_SECONDS));
    if (result === -1) throw new InvitationError("Account setup is in progress. Please wait before resending.", 409);
    if (result === -2) throw new InvitationError("Please wait one minute before resending an invitation.", 429);
    return token;
  }

  async consume(tenantId: string, token: string, ip: string): Promise<{ invitation: Invitation; release: () => Promise<void> }> {
    const scope = prefix(tenantId);
    const count = Number(await this.getClient().eval(`local n = redis.call('INCR', KEYS[1])
      if n == 1 then redis.call('EXPIRE', KEYS[1], 60) end
      return n`, 1, `${scope}:attempt:${digest(ip)}`));
    if (count > 30) throw new InvitationError("Too many attempts. Please wait one minute and try again.", 429);
    if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) throw new InvitationError("This invitation is invalid or expired. Ask your administrator for a new invitation.");
    const key = `${scope}:${token.split(".")[0]}`;
    const lockId = randomBytes(16).toString("hex");
    // Consume before any credential write. An ambiguous identity-provider failure
    // requires a new invitation; replay can never reset an activated account.
    const result = await this.getClient().eval(`
      local raw = redis.call('GET', KEYS[1])
      if not raw then return nil end
      local record = cjson.decode(raw)
      if record.tokenHash ~= ARGV[1] then return nil end
      if not redis.call('SET', KEYS[2], ARGV[2], 'NX', 'EX', 120) then return nil end
      redis.call('DEL', KEYS[1])
      return raw`, 2, key, `${key}:busy`, digest(token), lockId);
    if (!result) throw new InvitationError("This invitation is invalid, expired, or already used. Ask your administrator for a new invitation.");
    const invitation = JSON.parse(String(result)) as Invitation;
    if (invitation.tenantId !== tenantId || digest(invitation.userId) !== token.split(".")[0]) throw new InvitationError("Invalid invitation.", 403);
    return { invitation, release: async () => {
      await this.getClient().eval(`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
        return 0`, 1, `${key}:busy`, lockId);
    } };
  }
}
export const invitationStore = new InvitationStore();

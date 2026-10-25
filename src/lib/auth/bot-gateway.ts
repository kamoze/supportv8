import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { authDeadline, readAuthJson } from "./bounded-http";
import { type BotAction, unavailableBotProof } from "./bot-transaction";

export type BoundBotProof = { token: string; hostname: string; action: BotAction; cdata: string };
export type BotVerifier = (proof: BoundBotProof, signal: AbortSignal) => Promise<boolean>;

export async function withinBotDeadline<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted(); let abort!: () => void;
  const stopped = new Promise<never>((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort(); });
  try { const result = await Promise.race([operation, stopped]); signal.throwIfAborted(); return result; }
  finally { signal.removeEventListener("abort", abort); }
}

function endpoint(value: string, gateway: boolean): URL {
  const url = new URL(value);
  const internalGateway = gateway && url.protocol === "http:" && ["action-gateway", "action-gateway.default.svc.cluster.local"].includes(url.hostname);
  if ((url.protocol !== "https:" && !internalGateway) || url.username || url.password || url.search || url.hash || (gateway && url.pathname !== "/")) throw unavailableBotProof();
  return url;
}
export function createGatewayBotVerifier(config: { gatewayUrl: string; tokenUrl: string; clientId: string; readSecret: () => Promise<string>; request?: typeof fetch }): BotVerifier {
  const gateway = endpoint(config.gatewayUrl, true), issuer = endpoint(config.tokenUrl, false), request = config.request ?? fetch;
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(config.clientId)) throw unavailableBotProof();
  return async (proof, parent) => {
    const deadline = authDeadline(8000, parent), signal = deadline.signal;
    try {
      const secret = await deadline.wait(() => config.readSecret());
      if (!secret || secret.length > 4096) throw unavailableBotProof();
      const credential = await deadline.wait(() => request(issuer, {
        method: "POST", redirect: "error", cache: "no-store", signal,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: config.clientId, client_secret: secret, audience: "servicev8-action-gateway", scope: "bot:verify" }),
      }));
      if (credential.status !== 200 || credential.redirected) { void credential.body?.cancel().catch(() => {}); throw unavailableBotProof(); }
      const token = await deadline.wait(() => readAuthJson(credential, signal, 32768, deadline.check)) as Record<string, unknown>;
      if (!token || typeof token.access_token !== "string" || !token.access_token || token.access_token.length > 16_384 || token.token_type !== "Bearer"
        || !Number.isSafeInteger(token.expires_in) || Number(token.expires_in) < 1 || Number(token.expires_in) > 300) throw unavailableBotProof();
      const response = await deadline.wait(() => request(new URL("/v1/security/bot/verify", gateway), {
        method: "POST", redirect: "error", cache: "no-store", signal,
        headers: { authorization: `Bearer ${token.access_token}`, "content-type": "application/json" }, body: JSON.stringify({ schemaVersion: 1, ...proof }),
      }));
      if (response.status !== 200 || response.redirected) { void response.body?.cancel().catch(() => {}); throw unavailableBotProof(); }
      const result = await deadline.wait(() => readAuthJson(response, signal, 4096, deadline.check)) as Record<string, unknown>;
      if (!result || Array.isArray(result) || Object.keys(result).sort().join(",") !== "schemaVersion,success" || result.schemaVersion !== 1 || typeof result.success !== "boolean") throw unavailableBotProof();
      deadline.check(); return result.success;
    } catch { throw unavailableBotProof(); } finally { deadline.close(); }
  };
}

export function configuredGatewayBotVerifier(): BotVerifier {
  const gatewayUrl = process.env.SUPPORT_AUTH_BOT_GATEWAY_URL, tokenUrl = process.env.SUPPORT_AUTH_BOT_TOKEN_URL,
    clientId = process.env.SUPPORT_AUTH_BOT_CLIENT_ID, secretFile = process.env.SUPPORT_AUTH_BOT_CLIENT_SECRET_FILE;
  if (!gatewayUrl || !tokenUrl || !clientId || !secretFile || !isAbsolute(secretFile)) throw unavailableBotProof();
  return createGatewayBotVerifier({ gatewayUrl, tokenUrl, clientId, readSecret: async () => {
    const value = await readFile(secretFile, "utf8"); if (Buffer.byteLength(value) > 4096) throw unavailableBotProof(); return value.trim();
  } });
}

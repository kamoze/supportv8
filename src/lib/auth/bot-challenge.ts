import { discoverWorkspace } from "./workspace-discovery";
import { NextResponse } from "next/server";
import { browserTenantSlugFromHostname, RESERVED_SLUGS, TENANT_SLUG_PATTERN } from "../tenant-host";
import { type TenantWorkspaceRecord } from "../tenant-resolver";
import { configuredGatewayBotVerifier, withinBotDeadline, type BotVerifier } from "./bot-gateway";
import { BotProofError, BotTransactionStore, durableBotBackend, type BotAction, type BotBinding, unavailableBotProof } from "./bot-transaction";
import { boundedJson } from "../tasksv8/http";

const actions = new Set<BotAction>(["signup", "signin", "forgot_password"]);
const siteTestKeys = new Set(["1x00000000000000000000AA", "2x00000000000000000000AB", "1x00000000000000000000BB", "2x00000000000000000000BB", "3x00000000000000000000FF"]);
const cookieName = (action: BotAction) => `__Host-support_auth_${action}`;
const securityHeaders = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
export function botProofFailure(error: unknown): NextResponse {
  const failure = error instanceof BotProofError ? error : unavailableBotProof();
  return NextResponse.json({ success: false, error: failure.message }, { status: failure.status, headers: securityHeaders });
}
export async function authJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json") throw new BotProofError();
  try {
    const body = await boundedJson(request, 16_384);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new BotProofError();
    return body as Record<string, unknown>;
  } catch { throw new BotProofError(); }
}
function host(request: Request): string {
  const url = new URL(request.url), rawHost = request.headers.get("host"), forwarded = request.headers.get("x-forwarded-host");
  if (url.protocol !== "https:" || url.port || rawHost !== url.hostname || (forwarded !== null && forwarded !== rawHost)
    || request.headers.get("origin") !== url.origin || (url.hostname !== "support.servicev8.com" && !browserTenantSlugFromHostname(url.hostname))
    || !url.hostname.endsWith(".servicev8.com")) throw new BotProofError(403, "Use this workspace's secure sign-in page and try again.");
  return url.hostname;
}
function inputBinding(request: Request, action: BotAction, input: Record<string, unknown>): BotBinding {
  const hostname = host(request);
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const tenantSlug = typeof input.tenantSlug === "string" ? input.tenantSlug.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !TENANT_SLUG_PATTERN.test(tenantSlug) || RESERVED_SLUGS.has(tenantSlug)) throw new BotProofError();
  if (action === "signup" ? hostname !== "support.servicev8.com" : browserTenantSlugFromHostname(hostname) !== tenantSlug)
    throw new BotProofError(403, "Open the correct workspace before signing in.");
  return { hostname, action, email, tenantSlug };
}

export class AuthBotChallengeService {
  constructor(private readonly dependencies: { store: BotTransactionStore; verify: BotVerifier; siteKey: string; workspace: (slug: string) => Promise<TenantWorkspaceRecord | null> }) {
    if (!/^[A-Za-z0-9_-]{20,128}$/.test(dependencies.siteKey) || siteTestKeys.has(dependencies.siteKey)) throw unavailableBotProof();
  }
  private async binding(request: Request, action: BotAction, input: Record<string, unknown>, signal: AbortSignal) {
    const binding = inputBinding(request, action, input);
    let workspace: TenantWorkspaceRecord | null = null;
    if (action !== "signup") {
      workspace = await withinBotDeadline(this.dependencies.workspace(binding.tenantSlug), signal);
      if (!workspace || workspace.status !== "active" || workspace.slug !== binding.tenantSlug || new URL(workspace.url).origin !== `https://${binding.hostname}`)
        throw new BotProofError(403, "This workspace is not available for sign-in.");
    }
    return { binding, workspace };
  }
  async start(request: Request, body: Record<string, unknown>): Promise<NextResponse> {
    if (Object.keys(body).some(key => !["action", "email", "tenantSlug"].includes(key)) || !actions.has(body.action as BotAction)) throw new BotProofError();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]);
    const { binding } = await this.binding(request, body.action as BotAction, body, signal);
    const transaction = await withinBotDeadline(this.dependencies.store.issue(binding), signal);
    const response = NextResponse.json({ success: true, challengeId: transaction.id, siteKey: this.dependencies.siteKey, action: binding.action, cdata: transaction.id, expiresAt: transaction.expiresAt }, { headers: securityHeaders });
    response.cookies.set(cookieName(binding.action), `${transaction.id}.${transaction.cookieSecret}`, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 300 });
    return response;
  }
  async consume(request: Request, action: BotAction, body: Record<string, unknown>): Promise<TenantWorkspaceRecord | null> {
    if (typeof body.challengeId !== "string" || !/^[a-f0-9]{64}$/.test(body.challengeId)
      || typeof body.botToken !== "string" || !body.botToken || body.botToken.length > 2048) throw new BotProofError();
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
    const { binding, workspace } = await this.binding(request, action, body, signal);
    const cookies = (request.headers.get("cookie") ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(`${cookieName(action)}=`));
    if (cookies.length !== 1) throw new BotProofError();
    const [id, secret, extra] = cookies[0].slice(cookieName(action).length + 1).split(".");
    if (id !== body.challengeId || !secret || extra !== undefined) throw new BotProofError();
    if (!await withinBotDeadline(this.dependencies.store.consume(id, secret, binding), signal)) throw new BotProofError();
    if (!await this.dependencies.verify({ token: body.botToken, hostname: binding.hostname, action, cdata: id }, signal)) throw new BotProofError();
    signal.throwIfAborted();
    return workspace;
  }
}
function configured() {
  return new AuthBotChallengeService({ store: new BotTransactionStore(durableBotBackend()), verify: configuredGatewayBotVerifier(), siteKey: process.env.SUPPORT_AUTH_BOT_SITE_KEY ?? "", workspace: discoverWorkspace });
}
export const authBotChallenge = {
  start: (request: Request, body: Record<string, unknown>) => configured().start(request, body),
  consume: (request: Request, action: BotAction, body: Record<string, unknown>) => {
    // Missing proof is a request error even while dependencies are unavailable.
    if (typeof body.challengeId !== "string" || !/^[a-f0-9]{64}$/.test(body.challengeId) || typeof body.botToken !== "string" || !body.botToken || body.botToken.length > 2048) throw new BotProofError();
    return configured().consume(request, action, body);
  },
};

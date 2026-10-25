import { boundedJson } from "../tasksv8/http";
import { withinBotDeadline } from "./bot-gateway";
import { WorkspaceLookupError, type TenantWorkspaceRecord } from "../tenant-resolver";
import { TENANT_SLUG_PATTERN, RESERVED_SLUGS, browserTenantSlugFromHostname } from "../tenant-host";

type Environment = Readonly<Record<string, string | undefined>>;
const unavailable = () => new WorkspaceLookupError("Workspace lookup is temporarily unavailable.", "workspace_lookup_unavailable", 503);
export function createRegistryReader(env: Environment = process.env, request: typeof fetch = fetch) {
  return async (path: string, query: Record<string, string>, signal: AbortSignal): Promise<Response> => {
    try {
      const registry = new URL(env.REGISTRY_URL ?? ""), issuer = new URL(env.SERVICEV8_OIDC_ISSUER ?? "");
      const internal = registry.protocol === "http:" && ["registry", "registry.default.svc.cluster.local", "registry-service", "registry-service.default.svc.cluster.local"].includes(registry.hostname);
      if ((registry.protocol !== "https:" && !internal) || registry.username || registry.password || registry.pathname !== "/" || registry.search || registry.hash
        || issuer.protocol !== "https:" || issuer.username || issuer.password || issuer.search || issuer.hash) throw unavailable();
      const clientId = env.SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID?.trim(), secret = env.SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET?.trim();
      if (!clientId || !secret) throw unavailable();
      const tokenResponse = await withinBotDeadline(request(new URL(`${issuer.pathname.replace(/\/$/, "")}/protocol/openid-connect/token`, issuer), {
        method: "POST", redirect: "error", cache: "no-store", signal, headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: secret, audience: "servicev8-registry", scope: "registry:memberships:read" }),
      }), signal);
      if (tokenResponse.status !== 200 || tokenResponse.redirected) { void tokenResponse.body?.cancel().catch(() => {}); throw unavailable(); }
      const token = await boundedJson(tokenResponse, 32_768, signal) as Record<string, unknown>;
      if (!token || typeof token.access_token !== "string" || !token.access_token || token.access_token.length > 16_384 || token.token_type !== "Bearer"
        || !Number.isSafeInteger(token.expires_in) || Number(token.expires_in) < 1 || Number(token.expires_in) > 300) throw unavailable();
      const url = new URL(path, registry); for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
      return await withinBotDeadline(request(url, { headers: { authorization: `Bearer ${token.access_token}`, accept: "application/json" }, cache: "no-store", redirect: "error", signal }), signal);
    } catch { throw unavailable(); }
  };
}
export function createWorkspaceDiscovery(env: Environment = process.env, request: typeof fetch = fetch) {
  return async (slug: string): Promise<TenantWorkspaceRecord | null> => {
    const clean = typeof slug === "string" ? slug.trim().toLowerCase() : "";
    if (!TENANT_SLUG_PATTERN.test(clean) || RESERVED_SLUGS.has(clean)) throw new WorkspaceLookupError("Invalid workspace address.", "invalid_workspace_slug", 400);
    const signal = AbortSignal.timeout(8_000);
    try {
      const response = await createRegistryReader(env, request)("/v1/workspace-hosts/resolve", { productAppKey: "support", slug: clean }, signal);
      if (response.status === 404) { void response.body?.cancel().catch(() => {}); return null; }
      if (response.status !== 200 || response.redirected) { void response.body?.cancel().catch(() => {}); throw unavailable(); }
      const record = await boundedJson(response, 8192, signal) as Record<string, unknown>;
      if (!record || Array.isArray(record) || Object.keys(record).sort().join(",") !== "accountId,companyName,origin,productAppKey,schemaVersion,slug,tenantId"
        || record.schemaVersion !== 1 || record.productAppKey !== "support" || record.slug !== clean
        || typeof record.tenantId !== "string" || !/^[A-Za-z0-9_:@.-]{1,192}$/.test(record.tenantId)
        || typeof record.accountId !== "string" || !/^[A-Za-z0-9_:@.-]{1,192}$/.test(record.accountId)
        || typeof record.companyName !== "string" || !record.companyName.trim() || record.companyName.length > 256 || typeof record.origin !== "string") throw unavailable();
      const origin = new URL(record.origin);
      if (origin.protocol !== "https:" || origin.port || origin.username || origin.password || record.origin !== origin.origin || browserTenantSlugFromHostname(origin.hostname) !== clean) throw unavailable();
      signal.throwIfAborted();
      return { id: record.tenantId, accountId: record.accountId, slug: clean, name: record.companyName, status: "active", url: `${origin.origin}/` };
    } catch (error) { if (error instanceof WorkspaceLookupError) throw error; throw unavailable(); }
  };
}
export const discoverWorkspace = (slug: string) => createWorkspaceDiscovery()(slug);

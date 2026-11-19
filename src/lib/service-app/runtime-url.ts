// The tenant's Runtime workspace URL, carried in a Runtime hand-off
// (servicev8.support-handoff.v2, claim `runtimeUrl`) so an embedded SupportV8
// can show "Back to Runtime" and link Runtime-run pages (Marketplace, Plan) to
// the right place. Mirrors KnowledgeV8's receiver (kamoze/knowledgev8#191).
//
// It is only ever accepted from a signed hand-off, and only when it points at
// the Runtime this deployment trusts: SUPPORTV8_RUNTIME_ORIGIN
// (default https://runtime.servicev8.com). Accepted shapes:
//   https://<runtime host>/workspace/<slug>
//   https://<slug>.<runtime host>/workspace/<slug>   (tenant hosts)
// and <slug> must be the hand-off's tenantDomain. Presentation only: the URL
// grants no access.

export const DEFAULT_RUNTIME_ORIGIN = "https://runtime.servicev8.com";

/** Runtime's tenant slug rule. */
const RUNTIME_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/;

type Env = Readonly<Record<string, string | undefined>>;

/** The trusted Runtime host, or null when SUPPORTV8_RUNTIME_ORIGIN is not a bare https origin. */
export function trustedRuntimeHost(env: Env = process.env): string | null {
  const raw = (env.SUPPORTV8_RUNTIME_ORIGIN ?? "").trim() || DEFAULT_RUNTIME_ORIGIN;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash ||
        (url.pathname !== "/" && url.pathname !== "") || raw.replace(/\/$/, "") !== url.origin) return null;
    return url.hostname;
  } catch { return null; }
}

/**
 * True only for a Runtime workspace URL on the trusted Runtime host, in
 * canonical form, whose slug is `tenantDomain`.
 */
export function isTrustedRuntimeWorkspaceUrl(value: unknown, tenantDomain: unknown, env: Env = process.env): value is string {
  if (typeof value !== "string" || value.length > 512 || typeof tenantDomain !== "string") return false;
  const host = trustedRuntimeHost(env);
  if (!host) return false;
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  // Canonical form only: rejects case tricks, default ports, "?" or "#" with empty values, dot segments.
  if (url.href !== value || url.protocol !== "https:" || url.username || url.password || url.port ||
      value.includes("?") || value.includes("#")) return false;
  const match = /^\/workspace\/([^/]+)$/.exec(url.pathname);
  const slug = match?.[1];
  if (!slug || !RUNTIME_SLUG.test(slug) || slug !== tenantDomain) return false;
  return url.hostname === host || url.hostname === `${slug}.${host}`;
}

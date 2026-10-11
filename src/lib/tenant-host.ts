const TENANT_HOST_SUFFIXES = [".support.servicev8.com", ".support.servicev8.internal"];
const TRUSTED_ROOT_HOSTS = new Set([
  "support.servicev8.com",
  "support.servicev8.internal",
  "localhost",
  "127.0.0.1",
]);
export const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const RESERVED_SLUGS = new Set([
  "www",
  "support",
  "localhost",
  "api",
  "admin",
  "auth",
  "login",
  "portal",
  "workspace",
  "status",
]);

/** Authentication navigation is constructed locally, never from a provider URL. */
export function supportWorkspaceUrl(tenantSlug: string, path: string = "/") {
  if (!TENANT_SLUG_PATTERN.test(tenantSlug) || RESERVED_SLUGS.has(tenantSlug)) {
    throw new Error("Invalid workspace address.");
  }
  const cleanPath = safeNextPath(path);
  return new URL(cleanPath, `https://${tenantSlug}.support.servicev8.com`);
}

function hostnameWithoutPort(rawHostname: string): string {
  return rawHostname.trim().toLowerCase().replace(/:\d+$/, "");
}

export function isTrustedServiceV8Hostname(rawHostname: string): boolean {
  const hostname = hostnameWithoutPort(rawHostname);
  if (TRUSTED_ROOT_HOSTS.has(hostname)) return true;
  return TENANT_HOST_SUFFIXES.some((suffix) => {
    if (!hostname.endsWith(suffix)) return false;
    const slug = hostname.slice(0, -suffix.length);
    return TENANT_SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
  });
}

export function validateIngressHost(
  rawHost?: string | null,
  rawForwardedHost?: string | null
): {
  valid: boolean;
  hostname?: string;
  error?: string;
  status?: number;
} {
  if (!rawHost) return { valid: false, error: "missing_host_header", status: 400 };
  const host = hostnameWithoutPort(rawHost);

  // Check X-Forwarded-Host mismatch
  if (rawForwardedHost) {
    const fwdHost = hostnameWithoutPort(rawForwardedHost);
    if (fwdHost !== host) {
      return { valid: false, error: "host_mismatch", status: 400 };
    }
  }

  // Check foreign product host (e.g. *.care.servicev8.com, *.voice.servicev8.com, evil.com)
  if (
    host.includes(".care.servicev8.") ||
    host.includes(".voice.servicev8.") ||
    host.includes(".orderv8.") ||
    host.includes(".growthv8.")
  ) {
    return { valid: false, error: "foreign_product_host", status: 400 };
  }

  if (!isTrustedServiceV8Hostname(host)) {
    return { valid: false, error: "untrusted_host", status: 400 };
  }

  return { valid: true, hostname: host };
}

export function safeNextPath(nextParam?: string | null): string {
  if (!nextParam || typeof nextParam !== "string") return "/";
  const trimmed = nextParam.trim();
  // Neutralize protocol-relative URLs (//evil.com), schemes (http:, https:, javascript:), or backslashes
  if (trimmed.startsWith("//") || trimmed.includes(":") || trimmed.includes("\\")) {
    return "/";
  }
  // Must be an absolute in-app path starting with single /
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  return "/";
}

export function browserTenantSlugFromHostname(rawHostname: string): string | null {
  const hostname = hostnameWithoutPort(rawHostname);
  for (const suffix of TENANT_HOST_SUFFIXES) {
    if (!hostname.endsWith(suffix)) continue;
    const slug = hostname.slice(0, -suffix.length);
    if (["", ...RESERVED_SLUGS].includes(slug)) return null;
    return TENANT_SLUG_PATTERN.test(slug) ? slug : null;
  }
  return null;
}


export type BrowserWorkspaceView = "cockpit" | "global_landing" | "tenant_landing";

export function resolveBrowserWorkspace(input: {
  hostname: string;
  tenantParam?: string | null;
  activeTenant?: string | null;
  forceCockpit?: boolean;
  viewParam?: string | null;
  landingParam?: string | null;
  fallbackTenant?: string;
}): { tenantSlug: string; viewMode: BrowserWorkspaceView } {
  const hostedTenant = browserTenantSlugFromHostname(input.hostname);
  const tenantSlug =
    hostedTenant || input.tenantParam || input.activeTenant || input.fallbackTenant || "acme";

  if (input.forceCockpit || input.viewParam === "cockpit") {
    return { tenantSlug, viewMode: "cockpit" };
  }
  if (input.landingParam === "global" || input.viewParam === "global") {
    return { tenantSlug, viewMode: "global_landing" };
  }
  if (input.activeTenant && (!hostedTenant || input.activeTenant === hostedTenant)) {
    return { tenantSlug, viewMode: "cockpit" };
  }
  if (input.tenantParam || input.viewParam === "tenant" || hostedTenant || tenantSlug !== "acme") {
    return { tenantSlug, viewMode: "tenant_landing" };
  }
  return { tenantSlug, viewMode: "global_landing" };
}

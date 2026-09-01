const TENANT_HOST_SUFFIXES = [".support.servicev8.com", ".support.servicev8.internal"];
const TRUSTED_ROOT_HOSTS = new Set([
  "support.servicev8.com",
  "support.servicev8.internal",
  "localhost",
  "127.0.0.1",
]);
const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function hostnameWithoutPort(rawHostname: string): string {
  return rawHostname.trim().toLowerCase().replace(/:\d+$/, "");
}

export function isTrustedServiceV8Hostname(rawHostname: string): boolean {
  const hostname = hostnameWithoutPort(rawHostname);
  if (TRUSTED_ROOT_HOSTS.has(hostname)) return true;
  return TENANT_HOST_SUFFIXES.some((suffix) => {
    if (!hostname.endsWith(suffix)) return false;
    const slug = hostname.slice(0, -suffix.length);
    return TENANT_SLUG_PATTERN.test(slug) && !["www", "support", "localhost"].includes(slug);
  });
}

export function browserTenantSlugFromHostname(rawHostname: string): string | null {
  const hostname = hostnameWithoutPort(rawHostname);
  for (const suffix of TENANT_HOST_SUFFIXES) {
    if (!hostname.endsWith(suffix)) continue;
    const slug = hostname.slice(0, -suffix.length);
    if (["", "www", "support", "localhost"].includes(slug)) return null;
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

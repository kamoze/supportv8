import type { NextRequest } from "next/server";
import { verifySupportAccessToken, type VerifiedSupportToken } from "./keycloak";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PUBLIC_ROOT_HOSTS = new Set([
  "support.servicev8.com",
  "support.servicev8.internal",
  "localhost",
  "127.0.0.1",
]);

export class RequestAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 401
  ) {
    super(message);
    this.name = "RequestAuthError";
  }
}

export interface RequestTenantContext {
  tenantId: string;
  tenantSlug: string;
  authenticated: boolean;
  userId?: string;
  username?: string;
  roles: string[];
}

export function normalizeTenantSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^tenant_/, "")
    .replace(/\.support\.servicev8\.(?:com|internal)$/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!SLUG_PATTERN.test(normalized)) {
    throw new RequestAuthError("Invalid tenant domain", 403);
  }
  return normalized;
}

export function tenantIdFromSlug(slug: string): string {
  return `tenant_${normalizeTenantSlug(slug).replace(/-/g, "_")}`;
}

export function tenantSlugFromId(tenantId: string): string {
  if (!/^tenant_[a-z0-9_]{1,56}$/.test(tenantId)) {
    throw new RequestAuthError("Token does not contain a valid tenant claim", 403);
  }
  return tenantId.slice("tenant_".length).replace(/_/g, "-");
}

export function tenantSlugFromHostname(rawHost: string | null): string | null {
  const hostname = (rawHost || "").split(":")[0].toLowerCase();
  if (!hostname || PUBLIC_ROOT_HOSTS.has(hostname)) return null;

  for (const suffix of [".support.servicev8.com", ".support.servicev8.internal"]) {
    if (hostname.endsWith(suffix)) {
      return normalizeTenantSlug(hostname.slice(0, -suffix.length));
    }
  }
  return null;
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(";")) {
    const [key, ...value] = pair.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

function bearerToken(request: NextRequest | Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7).trim();
  return readCookie(request.headers.get("cookie"), "sv8_access_token");
}

function tenantFromClaims(claims: VerifiedSupportToken): string {
  const claim = claims.tenant_id;
  if (typeof claim !== "string" || !claim) {
    throw new RequestAuthError("Verified token is missing the tenant_id claim", 403);
  }
  return claim;
}

export async function resolveRequestTenant(
  request: NextRequest | Request,
  options: { requireAuthentication?: boolean } = {}
): Promise<RequestTenantContext> {
  const hostTenant =
    request.headers.get("x-servicev8-tenant-domain") ||
    tenantSlugFromHostname(request.headers.get("host"));
  const normalizedHostTenant = hostTenant ? normalizeTenantSlug(hostTenant) : null;
  const token = bearerToken(request);

  if (token) {
    let claims: VerifiedSupportToken;
    try {
      claims = await verifySupportAccessToken(token);
    } catch {
      throw new RequestAuthError("Invalid or expired SupportV8 access token");
    }

    const tenantId = tenantFromClaims(claims);
    const tenantSlug = tenantSlugFromId(tenantId);
    if (normalizedHostTenant && normalizedHostTenant !== "default" && normalizedHostTenant !== tenantSlug) {
      throw new RequestAuthError("Authenticated tenant does not match the hosted workspace", 403);
    }

    return {
      tenantId,
      tenantSlug,
      authenticated: true,
      userId: typeof claims.sub === "string" ? claims.sub : undefined,
      username: typeof claims.preferred_username === "string" ? claims.preferred_username : undefined,
      roles: claims.realm_access?.roles || [],
    };
  }

  // Unit tests and local development do not run through Next middleware. This
  // compatibility path is deliberately unavailable in production.
  const localTenant =
    process.env.NODE_ENV !== "production"
      ? request.headers.get("x-tenant-id") || request.headers.get("x-tenant-slug")
      : null;
  const tenantSlug =
    normalizedHostTenant ||
    (localTenant ? normalizeTenantSlug(localTenant) : process.env.NODE_ENV === "production" ? "default" : "acme");

  if (options.requireAuthentication && process.env.NODE_ENV === "production") {
    throw new RequestAuthError("Operator authentication is required");
  }

  return {
    tenantId: tenantIdFromSlug(tenantSlug),
    tenantSlug,
    authenticated: false,
    roles: [],
  };
}

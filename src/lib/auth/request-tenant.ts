import { authorizeRuntimeSupportRequest } from "../service-app/runtime-session";
import type { NextRequest } from "next/server";
import {
  supportOperatorDisplayName,
  supportRolesFromClaims,
  verifySupportAccessToken,
  type VerifiedSupportToken,
} from "./keycloak";

import { marketplaceService } from "../services/marketplace-service";

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
  displayName?: string;
  roles: string[];
  runtimeLinked?: boolean;
  accountId?: string;
  sourceHandoff?: string;
  boundApps?: string[];
}

const RESTRICTED_DEMO_MUTATION_PATHS = new Set([
  "/api/chat",
  "/api/chat/draft",
  "/api/chat/message",
  "/api/chat/session",
]);

function enforceRestrictedDemoMutation(request: NextRequest | Request, roles: string[]): void {
  if (!roles.includes("support_demo_operator")) return;
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return;
  const pathname = new URL(request.url).pathname;
  if (RESTRICTED_DEMO_MUTATION_PATHS.has(pathname)) return;
  throw new RequestAuthError("Demo operators cannot change shared workspace data", 403);
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
  // The first-party handoff is a native session, with live membership and installation checks.
  // Prefer an explicitly presented handoff cookie over any older Keycloak browser session.
  const hasRuntimeCookie = (request.headers.get("cookie") ?? "").split(";").some(p => p.trim().startsWith("__Host-sv8_runtime_support="));
  if (hasRuntimeCookie) {
    const authorized = await authorizeRuntimeSupportRequest(request);
    if (!authorized) throw new RequestAuthError("Invalid or revoked workspace session");
    const {session, role, access} = authorized;
    if (normalizedHostTenant && normalizedHostTenant !== session.tenantDomain) throw new RequestAuthError("Workspace host mismatch", 403);
    const path = new URL(request.url).pathname;
    const isCustomerChatIntake =
      path === "/api/chat/session" || (path === "/api/chat/message" && !options.requireAuthentication);
    if (role === "support:read" && (path === "/api/voice/sophia/launch" || (!["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()) && path !== "/api/auth/logout" && !isCustomerChatIntake))) {
      throw new RequestAuthError("This workspace role is read only", 403);
    }

    const headerPlanId =
      request.headers.get("x-servicev8-plan-id") ||
      request.headers.get("x-plan-id");
    const headerCreditsRaw =
      request.headers.get("x-servicev8-credits") ||
      request.headers.get("x-credits");
    const headerCredits = headerCreditsRaw ? Number(headerCreditsRaw) : undefined;

    const poolAccountId = access.poolAccountId || session.accountId;
    const effectivePlanId =
      access.planId ||
      headerPlanId ||
      marketplaceService.getAccountPlan(poolAccountId);
    const effectiveCredits =
      access.credits !== undefined
        ? access.credits
        : headerCredits !== undefined && Number.isFinite(headerCredits)
        ? headerCredits
        : undefined;

    marketplaceService.registerSourceHandoff({
      sourceVertical: "servicev8-runtime",
      sourceApp: "runtime",
      targetVertical: "supportv8",
      targetApp: "supportv8",
      accountId: poolAccountId,
      workspaceId: session.workspaceId,
      tenantSlug: session.tenantDomain,
      boundApps: ["servicev8-runtime", "runtime", "supportv8"],
      planId: effectivePlanId,
      credits: effectiveCredits,
    });
    return {
      runtimeLinked: true,
      accountId: poolAccountId,
      tenantId: session.workspaceId,
      tenantSlug: session.tenantDomain,
      authenticated: true,
      userId: session.sub,
      username: access.email,
      roles: role === "support:manage" ? ["support_cx_lead"] : ["support_operator", "support_observer"],
      sourceHandoff: "servicev8-runtime",
      boundApps: ["servicev8-runtime", "runtime", "supportv8"],
    };
  }
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

    const roles = supportRolesFromClaims(claims);
    enforceRestrictedDemoMutation(request, roles);
    return {
      tenantId,
      tenantSlug,
      authenticated: true,
      userId: typeof claims.sub === "string" ? claims.sub : undefined,
      username: typeof claims.preferred_username === "string" ? claims.preferred_username : undefined,
      displayName: supportOperatorDisplayName(claims, tenantSlug),
      roles,
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

  const sourceHandoffHeader =
    request.headers.get("x-servicev8-source") ||
    request.headers.get("x-source-vertical") ||
    request.headers.get("x-servicev8-vertical");
  const boundAppHeader =
    request.headers.get("x-servicev8-bound-app") ||
    request.headers.get("x-servicev8-app-key");
  const accountIdHeader =
    request.headers.get("x-servicev8-account-id") ||
    request.headers.get("x-account-id");
  const planIdHeader =
    request.headers.get("x-servicev8-plan-id") ||
    request.headers.get("x-plan-id");
  const creditsHeaderRaw =
    request.headers.get("x-servicev8-credits") ||
    request.headers.get("x-credits");
  const creditsHeader = creditsHeaderRaw ? Number(creditsHeaderRaw) : undefined;

  if (accountIdHeader || sourceHandoffHeader || boundAppHeader) {
    const accountId = accountIdHeader || (sourceHandoffHeader ? `acct_${sourceHandoffHeader}` : undefined);
    if (accountId) {
      const boundList = [
        ...(boundAppHeader ? [boundAppHeader] : []),
        ...(sourceHandoffHeader === "servicev8-runtime" || sourceHandoffHeader === "runtime"
          ? ["servicev8-runtime", "runtime", "supportv8"]
          : []),
      ];
      marketplaceService.registerSourceHandoff({
        sourceVertical: sourceHandoffHeader || undefined,
        targetVertical: "supportv8",
        accountId,
        tenantSlug,
        boundApps: boundList.length > 0 ? boundList : undefined,
        planId: planIdHeader || undefined,
        credits: creditsHeader !== undefined && Number.isFinite(creditsHeader) ? creditsHeader : undefined,
      });
      return {
        tenantId: tenantIdFromSlug(tenantSlug),
        tenantSlug,
        authenticated: true,
        runtimeLinked: true,
        accountId,
        sourceHandoff: sourceHandoffHeader || undefined,
        boundApps: boundList.length > 0 ? boundList : undefined,
        roles: ["support_cx_lead"],
      };
    }
  }

  if (options.requireAuthentication && process.env.NODE_ENV === "production") {
    throw new RequestAuthError("Operator authentication is required");
  }

  const mappedAccountId = marketplaceService.resolveAccountId(tenantSlug, {
    sourceVertical: sourceHandoffHeader || undefined,
    boundApp: boundAppHeader || undefined,
  });

  return {
    tenantId: tenantIdFromSlug(tenantSlug),
    tenantSlug,
    authenticated: false,
    accountId: mappedAccountId,
    runtimeLinked: Boolean(mappedAccountId),
    sourceHandoff: sourceHandoffHeader || undefined,
    boundApps: boundAppHeader ? [boundAppHeader] : undefined,
    roles: [],
  };
}

/**
 * Scoped Studio & Marketplace Launch Helpers
 * Implements CON-03:
 * - Scoped setup launch to Studio/Gateway
 * - Enforces tenant isolation (caller tenant must match target tenant)
 * - Validates trusted return origins (anti-open-redirect)
 * - Zero provider secret leaks in URLs or component props
 */

const TRUSTED_DOMAINS = [
  ".support.servicev8.com",
  ".support.servicev8.internal",
  "localhost",
  "127.0.0.1",
];

export function isTrustedReturnOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    return TRUSTED_DOMAINS.some((trusted) => hostname === trusted || hostname.endsWith(trusted));
  } catch {
    return false;
  }
}

export function generateScopedStudioLaunch(options: {
  tenantSlug: string;
  accountId: string;
  resourceId?: string;
  returnOrigin: string;
}): { url: string } {
  const { tenantSlug, accountId, resourceId, returnOrigin } = options;
  const baseUrl = process.env.STUDIO_BASE_URL || "https://studio.servicev8.com";

  const searchParams = new URLSearchParams({
    tenant: tenantSlug,
    account: accountId,
    vertical: "support",
    return_url: returnOrigin,
  });

  if (resourceId) {
    searchParams.set("resource", resourceId);
  }

  return {
    url: `${baseUrl}/?${searchParams.toString()}`,
  };
}

export function validateStudioLaunchRequest(options: {
  callerTenantSlug: string;
  targetTenantSlug: string;
  returnOrigin: string;
}): { allowed: boolean; status: number; error?: string } {
  const { callerTenantSlug, targetTenantSlug, returnOrigin } = options;

  if (callerTenantSlug.toLowerCase() !== targetTenantSlug.toLowerCase()) {
    return {
      allowed: false,
      status: 403,
      error: "Cross-tenant Studio launch denied: caller tenant does not match target resource tenant.",
    };
  }

  if (!isTrustedReturnOrigin(returnOrigin)) {
    return {
      allowed: false,
      status: 403,
      error: "Invalid or untrusted return origin provided for Studio launch.",
    };
  }

  return { allowed: true, status: 200 };
}

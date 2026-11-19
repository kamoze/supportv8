/**
 * SupportV8's demo sandbox (the Acme and Meridian fixture tenants, their named
 * personas, seeded demo credentials and the demo access modal) exists only when
 * a deployment turns it on explicitly with `SUPPORTV8_DEMO_MODE=true`.
 *
 * Off by default and fail-closed: an unset, empty or mistyped value means no
 * demo. A real tenant, including a Runtime hand-off whose tenant domain happens
 * to be `acme` or `meridian`, never sees demo personas or fixture data unless
 * the operator of that deployment enabled the sandbox.
 */
export const SUPPORT_DEMO_TENANT_SLUGS = ["acme", "meridian"] as const;
export type SupportDemoTenantSlug = (typeof SUPPORT_DEMO_TENANT_SLUGS)[number];

type Env = Record<string, string | undefined>;

/** Server-side only: client bundles learn the flag from GET /api/demo/status. */
export function supportDemoEnabled(env: Env = process.env): boolean {
  return env.SUPPORTV8_DEMO_MODE?.trim().toLowerCase() === "true";
}

/** True only when the sandbox is enabled and the slug is one of its fixture tenants. */
export function isSupportDemoTenant(tenantSlug: string | null | undefined, env: Env = process.env): boolean {
  if (!supportDemoEnabled(env)) return false;
  return isSupportDemoTenantSlug(tenantSlug);
}

/** Slug check alone, for callers that already know the sandbox is enabled. */
export function isSupportDemoTenantSlug(tenantSlug: string | null | undefined): tenantSlug is SupportDemoTenantSlug {
  const clean = (tenantSlug ?? "").trim().toLowerCase();
  return (SUPPORT_DEMO_TENANT_SLUGS as readonly string[]).includes(clean);
}

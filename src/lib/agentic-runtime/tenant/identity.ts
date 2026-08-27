/**
 * ONE tenant identity for the whole estate.
 *
 * The audit found five incompatible shapes in production:
 *
 *   orderv8       tenantId: string  + tenantDomain: string
 *   propv8        workspaceId: number + tenantId + tenantDomain
 *   estatev8      estateId: number
 *   eventsv8      orgId: string
 *   workerv8      organizationId: number
 *
 * Nothing shared could be built across those, which is the root reason each
 * vertical reimplemented the runtime locally — exactly what the master PRD
 * forbade ("no vertical-local reimplementation of shared runtime modules").
 *
 * ── Why TWO fields and not one ────────────────────────────────────────────
 *
 * This is not redundancy, and collapsing it to one id is the mistake to avoid:
 *
 *   tenantId     the vertical's OWN primary key. Scopes database queries.
 *   tenantDomain the platform's tenant key. Addresses the gateways.
 *
 * They are different namespaces owned by different systems. A vertical may
 * rename its domain without reissuing primary keys; the platform must not need
 * to know a vertical's key type. Both gateways key on the domain (the Forge
 * gateway via the `x-servicev8-tenant-domain` header, the Operation Gateway
 * via its trusted-proxy headers), while Prisma scoping needs the local id.
 *
 * A vertical whose local id is numeric maps it AT THE BOUNDARY — see
 * `defineTenantRef`. The numeric id never enters the kit.
 */

/** The single tenant identity every kit API accepts. */
export type TenantRef = {
  /** The vertical's own primary key, used to scope its data access. */
  readonly tenantId: string;
  /** The platform tenant key, used to address the gateways. */
  readonly tenantDomain: string;
};

/** Thrown when a tenant reference cannot be constructed. Never silently defaulted. */
export class InvalidTenantRef extends Error {
  constructor(message: string) {
    super(`invalid tenant reference: ${message}`);
    this.name = "InvalidTenantRef";
  }
}

/**
 * Build a TenantRef at the vertical's boundary.
 *
 * Accepts a numeric local id so verticals keyed on `estateId`/`workspaceId`/
 * `organizationId` can adopt the kit without a schema migration: convert here,
 * once, and pass `TenantRef` everywhere after.
 *
 * Fails loudly on empty input. An empty tenant id that reaches a query is a
 * cross-tenant read waiting to happen — every isolation defect the audit found
 * began with a scope that was absent rather than wrong.
 */
export function defineTenantRef(input: {
  tenantId: string | number;
  tenantDomain: string;
}): TenantRef {
  const tenantId = String(input.tenantId ?? "").trim();
  const tenantDomain = String(input.tenantDomain ?? "").trim().toLowerCase();

  if (!tenantId) throw new InvalidTenantRef("tenantId is empty");
  if (!tenantDomain) throw new InvalidTenantRef("tenantDomain is empty");

  // A domain carrying a path separator or whitespace is almost always a bug
  // at the call site (a URL or a path passed where a key belongs), and it
  // would be sent as a header value to both gateways.
  if (/[\s/\\]/.test(tenantDomain)) {
    throw new InvalidTenantRef(`tenantDomain contains a path separator or whitespace: ${tenantDomain}`);
  }

  return Object.freeze({ tenantId, tenantDomain });
}

import {
  TENANT_SLUG_PATTERN,
  RESERVED_SLUGS,
  supportWorkspaceUrl,
} from "./tenant-host";

export class WorkspaceLookupError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "WorkspaceLookupError";
  }
}

export interface TenantWorkspaceRecord {
  id: string;
  slug: string;
  name: string;
  accountId?: string;
  status: "active" | "suspended" | "pending";
  url: string;
}

const KNOWN_DEV_TENANTS = new Set([
  "acme",
  "meridian",
  "fixture-scope-a",
  "fixture-scope-b",
  "runtime-acceptance",
  "synthetic-support",
  "acme-corp",
  "beta-corp",
]);

let customTenantResolver: ((slug: string) => Promise<TenantWorkspaceRecord | null>) | null = null;

export function setCustomTenantResolver(
  resolver: ((slug: string) => Promise<TenantWorkspaceRecord | null>) | null
) {
  customTenantResolver = resolver;
}

export async function resolveTenantBySlug(slug: string): Promise<TenantWorkspaceRecord | null> {
  if (!slug || typeof slug !== "string") {
    throw new WorkspaceLookupError("Workspace address is required.", "missing_workspace_slug", 400);
  }
  const clean = slug.toLowerCase();
  if (!TENANT_SLUG_PATTERN.test(clean)) {
    throw new WorkspaceLookupError("Invalid workspace address format.", "invalid_workspace_slug", 400);
  }
  if (RESERVED_SLUGS.has(clean)) {
    throw new WorkspaceLookupError("Reserved workspace address.", "reserved_workspace_slug", 400);
  }

  if (customTenantResolver) {
    try {
      return await customTenantResolver(clean);
    } catch (err: any) {
      if (err instanceof WorkspaceLookupError) throw err;
      throw new WorkspaceLookupError(err?.message || "Temporarily unavailable", "workspace_lookup_unavailable", 503);
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = await import("pg");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 3000,
      });
      const client = await pool.connect();
      try {
        const res = await client.query(
          `SELECT id, domain, name, servicev8_account_id FROM supportv8.tenants WHERE domain = $1 LIMIT 1`,
          [clean]
        );
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
          id: row.id,
          slug: row.domain,
          name: row.name || row.domain,
          accountId: row.servicev8_account_id,
          status: "active",
          url: supportWorkspaceUrl(row.domain).toString(),
        };
      } finally {
        client.release();
        await pool.end().catch(() => {});
      }
    } catch {
      throw new WorkspaceLookupError("Temporarily unavailable", "workspace_lookup_unavailable", 503);
    }
  }

  // In production, when database/directory service is unconfigured, do not fall back to dev tenants
  if (process.env.NODE_ENV === "production") {
    if (KNOWN_DEV_TENANTS.has(clean)) {
      throw new WorkspaceLookupError("Directory service unavailable", "workspace_lookup_unavailable", 503);
    }
    return null;
  }

  if (KNOWN_DEV_TENANTS.has(clean)) {
    return {
      id: `tenant_${clean}`,
      slug: clean,
      name: clean.charAt(0).toUpperCase() + clean.slice(1),
      accountId: `acct_${clean}`,
      status: "active",
      url: supportWorkspaceUrl(clean).toString(),
    };
  }

  return null;
}

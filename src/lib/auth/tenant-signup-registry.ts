import { pgClient, type PostgresClient } from "@/lib/db/pg-client";

export interface TenantReservation {
  tenantId: string;
  tenantSlug: string;
  name: string;
  operatingMode: string;
}

export interface TenantReservationBackend {
  reserve(input: TenantReservation): Promise<boolean>;
  release(tenantId: string): Promise<void>;
}

export class InMemoryTenantReservationBackend implements TenantReservationBackend {
  private readonly tenantSlugsById = new Map<string, string>();
  private readonly tenantSlugs = new Set<string>();

  async reserve(input: TenantReservation): Promise<boolean> {
    if (this.tenantSlugsById.has(input.tenantId) || this.tenantSlugs.has(input.tenantSlug)) {
      return false;
    }
    this.tenantSlugsById.set(input.tenantId, input.tenantSlug);
    this.tenantSlugs.add(input.tenantSlug);
    return true;
  }

  async release(tenantId: string): Promise<void> {
    const tenantSlug = this.tenantSlugsById.get(tenantId);
    this.tenantSlugsById.delete(tenantId);
    if (tenantSlug) this.tenantSlugs.delete(tenantSlug);
  }
}

export class PostgresTenantReservationBackend implements TenantReservationBackend {
  constructor(private readonly client: PostgresClient = pgClient) {}

  async reserve(input: TenantReservation): Promise<boolean> {
    const rows = await this.client.withTenantSession(input.tenantId, (session) =>
      session.query<{ id: string }>(
        `INSERT INTO supportv8.tenants (id, domain, name, operating_mode)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [input.tenantId, input.tenantSlug, input.name, input.operatingMode]
      )
    );
    return rows.length === 1;
  }

  async release(tenantId: string): Promise<void> {
    await this.client.withTenantSession(tenantId, (session) =>
      session.query("DELETE FROM supportv8.tenants WHERE id = $1", [tenantId])
    );
  }
}

class UnavailableTenantReservationBackend implements TenantReservationBackend {
  async reserve(): Promise<boolean> {
    throw new TenantRegistryUnavailableError();
  }

  async release(): Promise<void> {
    throw new TenantRegistryUnavailableError();
  }
}

export class TenantRegistryUnavailableError extends Error {
  readonly status = 503;

  constructor() {
    super("Workspace registration is temporarily unavailable. Please try again.");
    this.name = "TenantRegistryUnavailableError";
  }
}

function buildDefaultBackend(): TenantReservationBackend {
  if (process.env.DATABASE_URL) return new PostgresTenantReservationBackend();
  return process.env.NODE_ENV === "production"
    ? new UnavailableTenantReservationBackend()
    : new InMemoryTenantReservationBackend();
}

export class TenantSignupRegistry {
  constructor(private readonly backend: TenantReservationBackend = buildDefaultBackend()) {}

  async reserve(input: TenantReservation): Promise<boolean> {
    try {
      return await this.backend.reserve(input);
    } catch (error) {
      if (error instanceof TenantRegistryUnavailableError) throw error;
      throw new TenantRegistryUnavailableError();
    }
  }

  async release(tenantId: string): Promise<void> {
    try {
      await this.backend.release(tenantId);
    } catch (error) {
      if (error instanceof TenantRegistryUnavailableError) throw error;
      throw new TenantRegistryUnavailableError();
    }
  }
}

export const tenantSignupRegistry = new TenantSignupRegistry();

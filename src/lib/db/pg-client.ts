/**
 * PostgreSQL adapter for SupportV8's strict tenant data plane.
 *
 * PgBouncer runs in transaction-pooling mode, so tenant context must be set
 * with SET LOCAL (via set_config) inside the same transaction as every query.
 */
import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

export interface DatabaseSession {
  readonly tenantId: string;
  query: <T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) => Promise<T[]>;
}

export interface DatabasePool {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
  end?(): Promise<void>;
}

const TENANT_ID_PATTERN = /^tenant_[a-z0-9_]{1,56}$/;

export class InvalidTenantContextError extends Error {
  constructor() {
    super("A canonical tenant context is required for database access");
    this.name = "InvalidTenantContextError";
  }
}

export class PostgresClient {
  private pool?: DatabasePool;
  private readonly connectionString?: string;

  constructor(connectionString = process.env.DATABASE_URL, pool?: DatabasePool) {
    this.connectionString = connectionString;
    this.pool = pool;
  }

  private getPool(): DatabasePool {
    if (this.pool) return this.pool;
    if (!this.connectionString) {
      throw new Error("DATABASE_URL is required for PostgreSQL-backed SupportV8 operations");
    }

    const config: PoolConfig = {
      connectionString: this.connectionString,
      max: Number(process.env.SUPPORTV8_DB_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: process.env.NODE_ENV === "test",
      application_name: "supportv8",
    };
    this.pool = new Pool(config);
    return this.pool;
  }

  /**
   * Run work on one checked-out connection and one transaction. RLS context is
   * transaction-local, so it cannot leak when PgBouncer reuses a connection.
   */
  public async withTenantSession<T>(
    tenantId: string,
    callback: (session: DatabaseSession) => Promise<T>
  ): Promise<T> {
    if (!TENANT_ID_PATTERN.test(tenantId)) {
      throw new InvalidTenantContextError();
    }

    const client = await this.getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
      await client.query("SELECT set_config('statement_timeout', $1, true)", [
        process.env.SUPPORTV8_DB_STATEMENT_TIMEOUT || "15s",
      ]);

      const session: DatabaseSession = {
        tenantId,
        query: async <R extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) => {
          const result = await client.query<R>(sql, params);
          return result.rows;
        },
      };

      const result = await callback(session);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool?.end?.();
    this.pool = undefined;
  }
}

const globalForPostgres = globalThis as unknown as { __supportv8Postgres?: PostgresClient };
export const pgClient = globalForPostgres.__supportv8Postgres ?? new PostgresClient();

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.__supportv8Postgres = pgClient;
}

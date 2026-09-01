import { describe, expect, it, vi } from "vitest";
import {
  InvalidTenantContextError,
  PostgresClient,
  type DatabasePool,
} from "@/lib/db/pg-client";

function fakePool() {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const release = vi.fn();
  const query = vi.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    return { rows: sql === "SELECT value FROM supportv8.test" ? [{ value: "ok" }] : [] };
  });
  const pool = {
    connect: vi.fn(async () => ({ query, release })),
    end: vi.fn(async () => undefined),
  } as unknown as DatabasePool;
  return { pool, calls, release };
}

describe("Postgres tenant transaction boundary", () => {
  it("sets transaction-local tenant context before application SQL and commits", async () => {
    const { pool, calls, release } = fakePool();
    const client = new PostgresClient(undefined, pool);

    const rows = await client.withTenantSession("tenant_acme", (session) =>
      session.query<{ value: string }>("SELECT value FROM supportv8.test")
    );

    expect(rows).toEqual([{ value: "ok" }]);
    expect(calls.map((call) => call.sql)).toEqual([
      "BEGIN",
      "SELECT set_config('app.current_tenant_id', $1, true)",
      "SELECT set_config('statement_timeout', $1, true)",
      "SELECT value FROM supportv8.test",
      "COMMIT",
    ]);
    expect(calls[1].params).toEqual(["tenant_acme"]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases the connection when tenant work fails", async () => {
    const { pool, calls, release } = fakePool();
    const client = new PostgresClient(undefined, pool);

    await expect(
      client.withTenantSession("tenant_acme", async () => {
        throw new Error("write failed");
      })
    ).rejects.toThrow("write failed");

    expect(calls.at(-1)?.sql).toBe("ROLLBACK");
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects missing or non-canonical tenant IDs before checking out a connection", async () => {
    const { pool } = fakePool();
    const client = new PostgresClient(undefined, pool);

    await expect(client.withTenantSession("acme", async () => undefined)).rejects.toBeInstanceOf(
      InvalidTenantContextError
    );
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

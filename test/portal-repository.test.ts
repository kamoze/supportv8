import { describe, expect, it, vi } from "vitest";
import { PortalRepository } from "@/lib/db/portal-repository";
import { PostgresClient, type DatabasePool } from "@/lib/db/pg-client";
import { emptyPortalConfig } from "@/lib/portal/config";

describe("portal repository tenant boundary", () => {
  it("resolves actions only from the published snapshot inside a tenant transaction", async () => {
    const config = emptyPortalConfig("acme");
    config.actions.push({
      id: "action_troubleshooting",
      slug: "troubleshooting",
      label: "Troubleshooting",
      description: "Find verified recovery steps.",
      prompt: "Find published troubleshooting guidance.",
      mode: "answer",
      icon: "tools",
      categories: ["troubleshooting"],
      enabled: true,
    });
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("FROM supportv8.portal_pages")) {
        return { rows: [{
          id: "page-id",
          slug: "home",
          draft_config: emptyPortalConfig("acme"),
          published_config: config,
          draft_revision: 2,
          published_revision: 1,
          published_at: "2026-09-04T12:00:00.000Z",
          updated_at: "2026-09-04T12:00:00.000Z",
        }] };
      }
      return { rows: [] };
    });
    const pool = {
      connect: vi.fn(async () => ({ query, release: vi.fn() })),
    } as unknown as DatabasePool;
    const repository = new PortalRepository(new PostgresClient(undefined, pool));

    const action = await repository.getPublishedAction("tenant_acme", "acme", "troubleshooting");

    expect(action?.prompt).toBe("Find published troubleshooting guidance.");
    expect(calls[1]).toEqual({
      sql: "SELECT set_config('app.current_tenant_id', $1, true)",
      params: ["tenant_acme"],
    });
    expect(calls.some((call) => call.sql.includes("published_config IS NOT NULL"))).toBe(true);
  });

  it("aggregates only the current tenant's portal events", async () => {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("GROUP BY action_slug")) {
        return { rows: [{
          action_slug: "__search__",
          total_requests: "8",
          successful_requests: "5",
          no_result_requests: "2",
          unavailable_requests: "1",
          rate_limited_requests: "0",
          average_duration_ms: "142",
          last_used_at: "2026-09-04T12:00:00.000Z",
        }] };
      }
      if (sql.includes("FROM supportv8.portal_action_events")) {
        return { rows: [{
          total_requests: "8",
          successful_requests: "5",
          no_result_requests: "2",
          unavailable_requests: "1",
          rate_limited_requests: "0",
          average_duration_ms: "142",
        }] };
      }
      return { rows: [] };
    });
    const pool = {
      connect: vi.fn(async () => ({ query, release: vi.fn() })),
    } as unknown as DatabasePool;
    const repository = new PortalRepository(new PostgresClient(undefined, pool));

    const analytics = await repository.getAnalytics("tenant_alpha", 30);

    expect(analytics.summary).toMatchObject({ totalRequests: 8, successfulRequests: 5, averageDurationMs: 142 });
    expect(analytics.actions[0]).toMatchObject({ actionSlug: "__search__", noResultRequests: 2 });
    expect(calls[1]).toEqual({
      sql: "SELECT set_config('app.current_tenant_id', $1, true)",
      params: ["tenant_alpha"],
    });
    expect(calls.filter((call) => call.sql.includes("created_at >=")).every((call) =>
      call.params?.[0] === 30 && call.params?.[1] === "home"
    )).toBe(true);
  });
});

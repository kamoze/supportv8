import type { QueryResultRow } from "pg";
import {
  emptyPortalConfig,
  parsePortalConfig,
  PORTAL_PAGE_SLUG,
  type PortalAction,
  type PortalConfig,
} from "@/lib/portal/config";
import { pgClient, type PostgresClient } from "./pg-client";

interface PortalPageRow extends QueryResultRow {
  id: string;
  slug: string;
  draft_config: unknown;
  published_config: unknown | null;
  draft_revision: number;
  published_revision: number | null;
  published_at: Date | string | null;
  updated_at: Date | string;
}

interface EventInput {
  tenantId: string;
  pageSlug?: string;
  actionSlug: string;
  outcome: "success" | "no_results" | "unavailable" | "rate_limited";
  durationMs: number;
}

export interface PortalDraft {
  config: PortalConfig;
  draftRevision: number;
  publishedRevision: number | null;
  publishedAt: string | null;
  hasStoredDraft: boolean;
}

export interface PublishedPortal {
  config: PortalConfig;
  revision: number | null;
  publishedAt: string | null;
}

export class PortalRevisionConflictError extends Error {
  readonly status = 409;

  constructor() {
    super("This portal was updated in another session. Reload before saving again.");
    this.name = "PortalRevisionConflictError";
  }
}

function iso(value: Date | string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function rowToDraft(row: PortalPageRow | undefined, tenantSlug: string): PortalDraft {
  if (!row) {
    return {
      config: emptyPortalConfig(tenantSlug),
      draftRevision: 0,
      publishedRevision: null,
      publishedAt: null,
      hasStoredDraft: false,
    };
  }
  return {
    config: parsePortalConfig(row.draft_config),
    draftRevision: Number(row.draft_revision),
    publishedRevision: row.published_revision === null ? null : Number(row.published_revision),
    publishedAt: iso(row.published_at),
    hasStoredDraft: true,
  };
}

export class PortalRepository {
  constructor(private readonly client: PostgresClient = pgClient) {}

  async getDraft(tenantId: string, tenantSlug: string): Promise<PortalDraft> {
    return this.client.withTenantSession(tenantId, async (db) => {
      const rows = await db.query<PortalPageRow>(
        `SELECT id, slug, draft_config, published_config, draft_revision,
                published_revision, published_at, updated_at
           FROM supportv8.portal_pages
          WHERE slug = $1`,
        [PORTAL_PAGE_SLUG],
      );
      return rowToDraft(rows[0], tenantSlug);
    });
  }

  async getPublished(tenantId: string, tenantSlug: string): Promise<PublishedPortal> {
    return this.client.withTenantSession(tenantId, async (db) => {
      const rows = await db.query<PortalPageRow>(
        `SELECT id, slug, draft_config, published_config, draft_revision,
                published_revision, published_at, updated_at
           FROM supportv8.portal_pages
          WHERE slug = $1
            AND published_config IS NOT NULL`,
        [PORTAL_PAGE_SLUG],
      );
      const row = rows[0];
      if (!row?.published_config) {
        return {
          config: emptyPortalConfig(tenantSlug),
          revision: null,
          publishedAt: null,
        };
      }
      return {
        config: parsePortalConfig(row.published_config),
        revision: row.published_revision === null ? null : Number(row.published_revision),
        publishedAt: iso(row.published_at),
      };
    });
  }

  async saveDraft(input: {
    tenantId: string;
    tenantSlug: string;
    actorId: string;
    expectedRevision: number;
    config: PortalConfig;
  }): Promise<PortalDraft> {
    const config = parsePortalConfig(input.config);
    return this.client.withTenantSession(input.tenantId, async (db) => {
      await db.query(
        `INSERT INTO supportv8.tenants (id, domain, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [input.tenantId, input.tenantSlug, config.supportName.replace(/\s+Support$/i, "") || input.tenantSlug],
      );
      const rows = await db.query<PortalPageRow>(
        `INSERT INTO supportv8.portal_pages
           (tenant_id, slug, draft_config, draft_revision, updated_by)
         SELECT $1, $2, $3::jsonb, 1, $4
          WHERE $5 = 0
         ON CONFLICT (tenant_id, slug) DO UPDATE
           SET draft_config = EXCLUDED.draft_config,
               draft_revision = supportv8.portal_pages.draft_revision + 1,
               updated_by = EXCLUDED.updated_by,
               updated_at = now()
         WHERE supportv8.portal_pages.draft_revision = $5
         RETURNING id, slug, draft_config, published_config, draft_revision,
                   published_revision, published_at, updated_at`,
        [
          input.tenantId,
          PORTAL_PAGE_SLUG,
          JSON.stringify(config),
          input.actorId,
          input.expectedRevision,
        ],
      );
      if (!rows[0]) throw new PortalRevisionConflictError();
      return rowToDraft(rows[0], input.tenantSlug);
    });
  }

  async publish(input: {
    tenantId: string;
    tenantSlug: string;
    actorId: string;
    expectedRevision: number;
  }): Promise<PortalDraft> {
    return this.client.withTenantSession(input.tenantId, async (db) => {
      const rows = await db.query<PortalPageRow>(
        `UPDATE supportv8.portal_pages
            SET published_config = draft_config,
                published_revision = draft_revision,
                published_by = $2,
                published_at = now(),
                updated_at = now()
          WHERE slug = $1
            AND draft_revision = $3
          RETURNING id, slug, draft_config, published_config, draft_revision,
                    published_revision, published_at, updated_at`,
        [PORTAL_PAGE_SLUG, input.actorId, input.expectedRevision],
      );
      const row = rows[0];
      if (!row) throw new PortalRevisionConflictError();
      await db.query(
        `INSERT INTO supportv8.portal_page_versions
           (tenant_id, page_id, version, config, published_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (tenant_id, page_id, version) DO NOTHING`,
        [input.tenantId, row.id, row.published_revision, JSON.stringify(row.published_config), input.actorId],
      );
      return rowToDraft(row, input.tenantSlug);
    });
  }

  async getPublishedAction(
    tenantId: string,
    tenantSlug: string,
    actionSlug: string,
  ): Promise<PortalAction | null> {
    const published = await this.getPublished(tenantId, tenantSlug);
    return published.config.actions.find((action) => action.enabled && action.slug === actionSlug) || null;
  }

  async recordActionEvent(input: EventInput): Promise<void> {
    await this.client.withTenantSession(input.tenantId, async (db) => {
      await db.query(
        `INSERT INTO supportv8.portal_action_events
           (tenant_id, page_slug, action_slug, outcome, duration_ms)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          input.tenantId,
          input.pageSlug || PORTAL_PAGE_SLUG,
          input.actionSlug,
          input.outcome,
          Math.max(0, Math.min(Math.round(input.durationMs), 120_000)),
        ],
      );
    });
  }
}

export const portalRepository = new PortalRepository();

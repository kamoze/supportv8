-- Support Portal Composer: tenant-scoped drafts, immutable published snapshots,
-- and aggregate action telemetry. Production applies the equivalent GitOps
-- bootstrap from servicev8-devops/apps/supportv8/database.yaml.

BEGIN;

CREATE TABLE IF NOT EXISTS supportv8.portal_pages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
  slug varchar(64) NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  draft_config jsonb NOT NULL CHECK (jsonb_typeof(draft_config) = 'object'),
  published_config jsonb CHECK (published_config IS NULL OR jsonb_typeof(published_config) = 'object'),
  draft_revision integer NOT NULL DEFAULT 1 CHECK (draft_revision > 0),
  published_revision integer CHECK (published_revision IS NULL OR published_revision > 0),
  updated_by varchar(128) NOT NULL,
  published_by varchar(128),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  UNIQUE (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS supportv8.portal_page_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
  page_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  config jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  published_by varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, page_id, version),
  CONSTRAINT portal_versions_tenant_page_fkey FOREIGN KEY (tenant_id, page_id)
    REFERENCES supportv8.portal_pages(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS supportv8.portal_action_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id) ON DELETE CASCADE,
  page_slug varchar(64) NOT NULL,
  action_slug varchar(64) NOT NULL,
  outcome varchar(32) NOT NULL CHECK (outcome IN ('success','no_results','unavailable','rate_limited')),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 0 AND 120000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supportv8_portal_pages_tenant
  ON supportv8.portal_pages(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_supportv8_portal_versions_tenant
  ON supportv8.portal_page_versions(tenant_id, page_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_supportv8_portal_events_tenant
  ON supportv8.portal_action_events(tenant_id, created_at DESC);

DROP TRIGGER IF EXISTS portal_pages_set_updated_at ON supportv8.portal_pages;
CREATE TRIGGER portal_pages_set_updated_at BEFORE UPDATE ON supportv8.portal_pages
  FOR EACH ROW EXECUTE FUNCTION supportv8.set_updated_at();

DO $policy$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['portal_pages', 'portal_page_versions', 'portal_action_events']
  LOOP
    EXECUTE format('ALTER TABLE supportv8.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE supportv8.%I FORCE ROW LEVEL SECURITY', table_name);
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'supportv8' AND tablename = table_name AND policyname = 'tenant_isolation'
    ) THEN
      EXECUTE format(
        'CREATE POLICY tenant_isolation ON supportv8.%I FOR ALL USING (tenant_id = supportv8.current_tenant_id()) WITH CHECK (tenant_id = supportv8.current_tenant_id())',
        table_name
      );
    END IF;
  END LOOP;
END
$policy$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  supportv8.portal_pages,
  supportv8.portal_page_versions,
  supportv8.portal_action_events
TO supportv8_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA supportv8 TO supportv8_app;

COMMIT;

CREATE INDEX IF NOT EXISTS idx_issues_tenant_updated_id
  ON supportv8.issues(tenant_id, updated_at DESC, id DESC);

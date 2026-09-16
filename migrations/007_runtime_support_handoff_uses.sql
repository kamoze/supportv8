CREATE TABLE IF NOT EXISTS supportv8.runtime_support_handoff_uses (
  jti_hash char(64) PRIMARY KEY,
  issuer varchar(32) NOT NULL CHECK (issuer = 'runtime'),
  account_id varchar(128) NOT NULL,
  registry_tenant_id varchar(128) NOT NULL,
  native_workspace_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runtime_support_handoff_expiry
  ON supportv8.runtime_support_handoff_uses(native_workspace_id, account_id, registry_tenant_id, expires_at);
ALTER TABLE supportv8.runtime_support_handoff_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.runtime_support_handoff_uses FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_support_handoff_exact_scope ON supportv8.runtime_support_handoff_uses FOR ALL
  USING (
    native_workspace_id = current_setting('app.current_tenant_id', true)
    AND account_id = current_setting('app.current_account_id', true)
    AND registry_tenant_id = current_setting('app.current_registry_tenant_id', true)
  )
  WITH CHECK (
    native_workspace_id = current_setting('app.current_tenant_id', true)
    AND account_id = current_setting('app.current_account_id', true)
    AND registry_tenant_id = current_setting('app.current_registry_tenant_id', true)
  );

DO $grants$
BEGIN
  IF to_regrole('supportv8_app') IS NOT NULL THEN
    EXECUTE 'REVOKE UPDATE ON supportv8.runtime_support_handoff_uses FROM supportv8_app';
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON supportv8.runtime_support_handoff_uses TO supportv8_app';
  END IF;
END
$grants$;

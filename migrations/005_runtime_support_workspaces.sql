DROP INDEX IF EXISTS supportv8.uq_supportv8_tenants_servicev8_account;
CREATE INDEX IF NOT EXISTS idx_supportv8_tenants_servicev8_account
  ON supportv8.tenants(servicev8_account_id) WHERE servicev8_account_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_supportv8_tenants_runtime_identity
  ON supportv8.tenants(id,domain,servicev8_account_id);

CREATE TABLE IF NOT EXISTS supportv8.runtime_support_workspaces (
  installation_id varchar(128) PRIMARY KEY,
  operation_id varchar(128) NOT NULL UNIQUE,
  account_id varchar(128) NOT NULL,
  registry_tenant_id varchar(128) NOT NULL,
  vertical_id varchar(32) NOT NULL CHECK (vertical_id = 'runtime'),
  tenant_domain varchar(128) NOT NULL,
  subject varchar(255) NOT NULL,
  company_display_name varchar(255),
  native_tenant_id varchar(64) NOT NULL UNIQUE REFERENCES supportv8.tenants(id) DEFERRABLE INITIALLY DEFERRED,
  native_domain varchar(128) NOT NULL UNIQUE,
  state varchar(32) NOT NULL CHECK (state IN ('reserved','workspace_created','tombstoned')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (native_domain = tenant_domain),
  CHECK ((state = 'tombstoned') = (deleted_at IS NOT NULL)),
  FOREIGN KEY (native_tenant_id,native_domain,account_id)
    REFERENCES supportv8.tenants(id,domain,servicev8_account_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE OR REPLACE FUNCTION supportv8.protect_runtime_support_workspace_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.installation_id,NEW.operation_id,NEW.account_id,NEW.registry_tenant_id,NEW.vertical_id,NEW.tenant_domain,NEW.subject,NEW.company_display_name,NEW.native_tenant_id,NEW.native_domain)
     IS DISTINCT FROM ROW(OLD.installation_id,OLD.operation_id,OLD.account_id,OLD.registry_tenant_id,OLD.vertical_id,OLD.tenant_domain,OLD.subject,OLD.company_display_name,OLD.native_tenant_id,OLD.native_domain) THEN
    RAISE EXCEPTION 'runtime support workspace identity is immutable' USING ERRCODE='23514';
  END IF;
  IF NOT ((OLD.state='reserved' AND NEW.state='workspace_created' AND NEW.deleted_at IS NULL)
       OR (OLD.state IN ('reserved','workspace_created') AND NEW.state='tombstoned' AND NEW.deleted_at IS NOT NULL)
       OR (OLD.state=NEW.state AND OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at)) THEN
    RAISE EXCEPTION 'invalid runtime support workspace state transition' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_runtime_support_workspace_identity ON supportv8.runtime_support_workspaces;
CREATE TRIGGER protect_runtime_support_workspace_identity BEFORE UPDATE ON supportv8.runtime_support_workspaces
FOR EACH ROW EXECUTE FUNCTION supportv8.protect_runtime_support_workspace_identity();

CREATE OR REPLACE FUNCTION supportv8.deny_runtime_support_workspace_delete() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'runtime support workspaces must be tombstoned' USING ERRCODE='23514'; END $$;
CREATE TRIGGER deny_runtime_support_workspace_delete BEFORE DELETE ON supportv8.runtime_support_workspaces
FOR EACH ROW EXECUTE FUNCTION supportv8.deny_runtime_support_workspace_delete();

ALTER TABLE supportv8.runtime_support_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.runtime_support_workspaces FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_support_workspace_exact_scope ON supportv8.runtime_support_workspaces FOR ALL
  USING (native_tenant_id=current_setting('app.current_tenant_id',true)
    AND account_id=current_setting('app.current_account_id',true)
    AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true))
  WITH CHECK (native_tenant_id=current_setting('app.current_tenant_id',true)
    AND account_id=current_setting('app.current_account_id',true)
    AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true));

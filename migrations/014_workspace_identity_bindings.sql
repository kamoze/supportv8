-- Explicit, migration-owned canonical/native identity crosswalk. No inferred IDs.
CREATE TABLE supportv8.workspace_identity_bindings (
  registry_tenant_id varchar(192) NOT NULL,
  account_id varchar(192) NOT NULL,
  native_tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id),
  slug varchar(63) NOT NULL,
  origin varchar(261) NOT NULL,
  state varchar(16) NOT NULL CHECK (state IN ('active','revoked')),
  provenance text NOT NULL CHECK (length(provenance) BETWEEN 1 AND 1024),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (registry_tenant_id,account_id),
  UNIQUE (registry_tenant_id), UNIQUE (native_tenant_id), UNIQUE (slug), UNIQUE (origin),
  FOREIGN KEY (native_tenant_id,slug,account_id)
    REFERENCES supportv8.tenants(id,domain,servicev8_account_id),
  CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  CHECK (origin = 'https://' || slug || '.support.servicev8.com')
);
CREATE FUNCTION supportv8.protect_workspace_identity_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'workspace bindings must be revoked' USING ERRCODE='23514'; END IF;
  IF (NEW.registry_tenant_id,NEW.account_id,NEW.native_tenant_id,NEW.slug,NEW.origin,NEW.provenance)
     IS DISTINCT FROM (OLD.registry_tenant_id,OLD.account_id,OLD.native_tenant_id,OLD.slug,OLD.origin,OLD.provenance)
     OR OLD.state='revoked' AND NEW.state<>'revoked' THEN
    RAISE EXCEPTION 'workspace binding identity is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_workspace_identity_binding BEFORE UPDATE OR DELETE ON supportv8.workspace_identity_bindings
  FOR EACH ROW EXECUTE FUNCTION supportv8.protect_workspace_identity_binding();
ALTER TABLE supportv8.workspace_identity_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.workspace_identity_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY workspace_identity_exact_canonical_read ON supportv8.workspace_identity_bindings FOR SELECT
  USING (registry_tenant_id=current_setting('app.current_registry_tenant_id',true)
    AND account_id=current_setting('app.current_account_id',true));
REVOKE ALL ON supportv8.workspace_identity_bindings FROM PUBLIC;
GRANT SELECT ON supportv8.workspace_identity_bindings TO supportv8_app;

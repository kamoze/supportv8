-- Additive cache/receipt only. Canonical authority remains Registry.
CREATE TABLE supportv8.runtime_access_projections (
 native_tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id),
 account_id varchar(128) NOT NULL, registry_tenant_id varchar(128) NOT NULL,
 installation_id varchar(128) NOT NULL REFERENCES supportv8.runtime_support_workspaces(installation_id),
 identity_subject varchar(255) NOT NULL, applied_revision bigint NOT NULL CHECK(applied_revision>0),
 mapping_version text NOT NULL, group_ids jsonb NOT NULL, capability text CHECK(capability IN ('support:read','support:manage')),
 status text NOT NULL CHECK(status IN ('synced','blocked','revoked')), receipt_id uuid NOT NULL,
 local_denied boolean NOT NULL DEFAULT false, local_capability text CHECK(local_capability IN ('support:read','support:manage')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(installation_id,identity_subject),
 CHECK((status='synced')=(capability IS NOT NULL))
);
CREATE TABLE supportv8.runtime_access_cursors (
 native_tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id),
 account_id varchar(128) NOT NULL, registry_tenant_id varchar(128) NOT NULL,
 installation_id varchar(128) PRIMARY KEY REFERENCES supportv8.runtime_support_workspaces(installation_id),
 after_subject text NOT NULL DEFAULT '', failure_count integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), last_error text, dead_letter boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE supportv8.runtime_access_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.runtime_access_projections FORCE ROW LEVEL SECURITY;
ALTER TABLE supportv8.runtime_access_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.runtime_access_cursors FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_access_projections_exact_scope ON supportv8.runtime_access_projections FOR ALL
 USING(native_tenant_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true))
 WITH CHECK(native_tenant_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true));
CREATE POLICY runtime_access_cursors_exact_scope ON supportv8.runtime_access_cursors FOR ALL
 USING(native_tenant_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true))
 WITH CHECK(native_tenant_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true));
-- Append-only accounting; contains scoped identifiers and decisions, no credentials.
CREATE TABLE supportv8.runtime_access_audit (
 receipt_id uuid PRIMARY KEY, native_tenant_id varchar(64) NOT NULL,
 account_id varchar(128) NOT NULL, registry_tenant_id varchar(128) NOT NULL,
 installation_id varchar(128) NOT NULL, identity_subject varchar(255) NOT NULL,
 applied_revision bigint NOT NULL, mapping_version text NOT NULL, status text NOT NULL,
 capability text, local_denied boolean NOT NULL, local_capability text,
 actor text NOT NULL DEFAULT 'supportv8-access-reconciler', recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE supportv8.runtime_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.runtime_access_audit FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_access_audit_scope ON supportv8.runtime_access_audit FOR ALL
 USING(native_tenant_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true))
 WITH CHECK(native_tenant_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true));
CREATE FUNCTION supportv8.capture_runtime_access_projection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
BEGIN
 IF current_setting('app.current_tenant_id',true) IS DISTINCT FROM NEW.native_tenant_id OR current_setting('app.current_account_id',true) IS DISTINCT FROM NEW.account_id OR current_setting('app.current_registry_tenant_id',true) IS DISTINCT FROM NEW.registry_tenant_id THEN RAISE EXCEPTION 'access projection scope required' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND NEW.applied_revision=OLD.applied_revision THEN RETURN NEW; END IF;
 INSERT INTO supportv8.runtime_access_audit(receipt_id,native_tenant_id,account_id,registry_tenant_id,installation_id,identity_subject,applied_revision,mapping_version,status,capability,local_denied,local_capability)
 VALUES(NEW.receipt_id,NEW.native_tenant_id,NEW.account_id,NEW.registry_tenant_id,NEW.installation_id,NEW.identity_subject,NEW.applied_revision,NEW.mapping_version,NEW.status,NEW.capability,NEW.local_denied,NEW.local_capability);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION supportv8.capture_runtime_access_projection() FROM PUBLIC;
CREATE TRIGGER capture_runtime_access_projection AFTER INSERT OR UPDATE ON supportv8.runtime_access_projections FOR EACH ROW EXECUTE FUNCTION supportv8.capture_runtime_access_projection();
CREATE FUNCTION supportv8.deny_runtime_access_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'access audit is immutable'; END $$;
CREATE TRIGGER immutable_runtime_access_audit BEFORE UPDATE OR DELETE ON supportv8.runtime_access_audit FOR EACH ROW EXECUTE FUNCTION supportv8.deny_runtime_access_audit_mutation();
-- Worker inventory exposes only immutable existing Runtime bindings. Registry
-- independently verifies current entitlement/product before every member read.
CREATE FUNCTION supportv8.list_runtime_access_targets(after_installation text,batch_limit integer)
 RETURNS TABLE(account_id varchar,registry_tenant_id varchar,installation_id varchar,native_tenant_id varchar)
 LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
 SELECT w.account_id,w.registry_tenant_id,w.installation_id,w.native_tenant_id
 FROM supportv8.runtime_support_workspaces w LEFT JOIN supportv8.runtime_access_cursors c ON c.installation_id=w.installation_id
 WHERE w.installation_id>after_installation AND w.vertical_id='runtime' AND w.state='workspace_created' AND w.deleted_at IS NULL
 AND (c.installation_id IS NULL OR (NOT c.dead_letter AND c.next_attempt_at<=now()))
 ORDER BY w.installation_id LIMIT greatest(1,least(batch_limit,4))
$$;
REVOKE ALL ON FUNCTION supportv8.list_runtime_access_targets(text,integer) FROM PUBLIC;
DO $grants$ BEGIN IF to_regrole('supportv8_app') IS NOT NULL THEN
 GRANT SELECT,INSERT,UPDATE ON supportv8.runtime_access_projections,supportv8.runtime_access_cursors TO supportv8_app;
 GRANT SELECT ON supportv8.runtime_access_audit TO supportv8_app;
 GRANT EXECUTE ON FUNCTION supportv8.list_runtime_access_targets(text,integer) TO supportv8_app;
END IF; END $grants$;
COMMENT ON FUNCTION supportv8.list_runtime_access_targets(text,integer) IS 'Bounded worker inventory; migration owner must have BYPASSRLS, consistent with existing worker functions. No membership or entitlement grant.';

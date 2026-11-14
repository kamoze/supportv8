-- Receiver receipts are independent of the canonical projection and local grants.
CREATE TABLE supportv8.runtime_access_receiver_receipts (
 native_tenant_id varchar(64) NOT NULL REFERENCES supportv8.tenants(id),
 account_id varchar(128) NOT NULL,
 registry_tenant_id varchar(128) NOT NULL,
 installation_id varchar(128) NOT NULL REFERENCES supportv8.runtime_support_workspaces(installation_id),
 identity_subject varchar(255) NOT NULL,
 desired_revision bigint NOT NULL CHECK(desired_revision>0),
 receiver_sequence bigint NOT NULL CHECK(receiver_sequence>0),
 receipt_id uuid NOT NULL UNIQUE,
 payload jsonb NOT NULL,
 policy_snapshot jsonb NOT NULL,
 delivery_pending boolean NOT NULL DEFAULT true,
 failure_count integer NOT NULL DEFAULT 0 CHECK(failure_count BETWEEN 0 AND 8),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 dead_letter boolean NOT NULL DEFAULT false,
 PRIMARY KEY(native_tenant_id,account_id,registry_tenant_id,installation_id,identity_subject)
);
ALTER TABLE supportv8.runtime_access_receiver_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.runtime_access_receiver_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY runtime_access_receiver_receipts_exact_scope ON supportv8.runtime_access_receiver_receipts FOR ALL
 USING(native_tenant_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true))
 WITH CHECK(native_tenant_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true));
DO $$ BEGIN IF to_regrole('supportv8_app') IS NOT NULL THEN
 GRANT SELECT,INSERT,UPDATE ON supportv8.runtime_access_receiver_receipts TO supportv8_app;
END IF; END $$;

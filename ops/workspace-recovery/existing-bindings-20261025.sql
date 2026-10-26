-- Apply only AFTER Support migration 014, with migration authority, in one
-- transaction after fresh Registry/identity qualification of this release.
-- Caller MUST use psql --single-transaction (or BEGIN/COMMIT around this file).
-- Does not create tenants, accounts, users, memberships, roles or grants.
SET LOCAL statement_timeout='10s';
LOCK TABLE supportv8.tenants IN SHARE MODE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM supportv8.tenants WHERE id='tenant_acme' AND domain='acme' AND servicev8_account_id='account-acme')
    OR NOT EXISTS(SELECT 1 FROM supportv8.tenants WHERE id='tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559' AND domain='runtime-acceptance' AND servicev8_account_id='acct_5c88ae327c3a') THEN
    RAISE EXCEPTION 'Reviewed native identity evidence has drifted; refuse recovery' USING ERRCODE='23514';
  END IF;
END $$;
INSERT INTO supportv8.workspace_identity_bindings(registry_tenant_id,account_id,native_tenant_id,slug,origin,state,provenance) VALUES
('tenant-acme','account-acme','tenant_acme','acme','https://acme.support.servicev8.com','active','2026-10-25 read-only primary DB comparison: canonical tenant/account/slug and exact native ID/account; no human identity mapping inferred'),
('tenant_5c88ae327c3a','acct_5c88ae327c3a','tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559','runtime-acceptance','https://runtime-acceptance.support.servicev8.com','active','2026-10-25 existing runtime_support_workspaces persisted exact account/canonical/native tuple, state workspace_created')
ON CONFLICT (registry_tenant_id,account_id) DO NOTHING;
-- Idempotent exact replay only. A pre-existing foreign/revoked binding fails.
DO $$ BEGIN
  IF (SELECT count(*) FROM supportv8.workspace_identity_bindings WHERE
    (registry_tenant_id='tenant-acme' AND account_id='account-acme' AND native_tenant_id='tenant_acme' AND slug='acme' AND origin='https://acme.support.servicev8.com' AND state='active') OR
    (registry_tenant_id='tenant_5c88ae327c3a' AND account_id='acct_5c88ae327c3a' AND native_tenant_id='tenant_rt_1503c79c0aa4ce249614a8911980eb3d20cf548baf036559' AND slug='runtime-acceptance' AND origin='https://runtime-acceptance.support.servicev8.com' AND state='active'))<>2 THEN
    RAISE EXCEPTION 'Reviewed canonical/native identity conflicts with persisted binding' USING ERRCODE='23514';
  END IF;
END $$;

-- Permanent lifecycle authority is only the exact local native workspace tombstone.
ALTER TABLE supportv8.managed_support_registration_jobs DROP CONSTRAINT managed_support_registration_jobs_state_check;
ALTER TABLE supportv8.managed_support_registration_jobs
 ADD COLUMN desired_state varchar(32) NOT NULL DEFAULT 'active' CHECK(desired_state IN('active','permanently_revoked')),
 ADD COLUMN observed_generation integer NOT NULL DEFAULT 0 CHECK(observed_generation>=0),
 ADD COLUMN applied_generation integer NOT NULL DEFAULT 0 CHECK(applied_generation>=0 AND applied_generation<=observed_generation),
 ADD COLUMN last_authority_observed_at timestamptz,
 ADD CHECK(state IN('pending','connected','ready','conflict','revocation_pending','revoked')),
 ADD CHECK((desired_state='active' AND observed_generation=0 AND applied_generation=0 AND state NOT IN('revocation_pending','revoked')) OR (desired_state='permanently_revoked' AND observed_generation=1 AND state IN('revocation_pending','revoked'))),
 ADD CHECK(state<>'revoked' OR applied_generation=observed_generation);
DROP INDEX supportv8.idx_managed_support_registration_due;
CREATE INDEX idx_managed_support_registration_due ON supportv8.managed_support_registration_jobs(next_attempt_at,account_id) WHERE state IN('pending','connected','ready','revocation_pending');
CREATE OR REPLACE FUNCTION supportv8.protect_managed_support_registration_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF ROW(NEW.installation_id,NEW.acquisition_id,NEW.account_id,NEW.registry_tenant_id,NEW.vertical_id,NEW.native_workspace_id) IS DISTINCT FROM ROW(OLD.installation_id,OLD.acquisition_id,OLD.account_id,OLD.registry_tenant_id,OLD.vertical_id,OLD.native_workspace_id) THEN RAISE EXCEPTION 'managed Support registration identity is immutable' USING ERRCODE='23514'; END IF;
 IF OLD.connection_id IS NOT NULL AND NEW.connection_id IS DISTINCT FROM OLD.connection_id THEN RAISE EXCEPTION 'managed Support connection identity is immutable' USING ERRCODE='23514'; END IF;
 IF OLD.state IN('revoked') AND NEW.state<>OLD.state THEN RAISE EXCEPTION 'managed Support registration terminal state is immutable' USING ERRCODE='23514'; END IF; 
 IF NEW.observed_generation < OLD.observed_generation OR NEW.applied_generation < OLD.applied_generation THEN RAISE EXCEPTION 'lifecycle generation cannot decrease' USING ERRCODE='23514'; END IF;
 IF OLD.desired_state='permanently_revoked' AND NEW.desired_state<>OLD.desired_state THEN RAISE EXCEPTION 'permanent revocation cannot recover' USING ERRCODE='23514'; END IF;
 IF NEW.observed_generation<>OLD.observed_generation AND NOT(OLD.desired_state='active' AND NEW.desired_state='permanently_revoked' AND NEW.observed_generation=OLD.observed_generation+1) THEN RAISE EXCEPTION 'invalid lifecycle generation transition' USING ERRCODE='23514'; END IF;
 RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION supportv8.claim_managed_support_registration_jobs(worker varchar,claim_limit integer) RETURNS SETOF supportv8.managed_support_registration_jobs LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
 WITH candidates AS(SELECT installation_id FROM(SELECT installation_id,next_attempt_at,account_id,row_number()OVER(PARTITION BY account_id ORDER BY next_attempt_at,installation_id) account_rank FROM supportv8.managed_support_registration_jobs WHERE state IN('pending','connected','ready','revocation_pending') AND next_attempt_at<=now() AND(lease_expires_at IS NULL OR lease_expires_at<now()))ranked WHERE account_rank<=2 ORDER BY next_attempt_at,account_id,installation_id LIMIT greatest(1,least(claim_limit,64))),locked AS(SELECT j.installation_id FROM supportv8.managed_support_registration_jobs j JOIN candidates c USING(installation_id) WHERE j.state IN('pending','connected','ready','revocation_pending') AND j.next_attempt_at<=now() AND(j.lease_expires_at IS NULL OR j.lease_expires_at<now()) FOR UPDATE OF j SKIP LOCKED)
 UPDATE supportv8.managed_support_registration_jobs j SET lease_owner=worker,lease_expires_at=now()+interval '2 minutes',updated_at=now() FROM locked WHERE j.installation_id=locked.installation_id AND j.state IN('pending','connected','ready','revocation_pending') AND j.next_attempt_at<=now() AND(j.lease_expires_at IS NULL OR j.lease_expires_at<now()) RETURNING j.* $$;
CREATE OR REPLACE FUNCTION supportv8.finish_managed_support_registration_job(worker varchar,target_installation varchar,target_state varchar,target_connection uuid,error_code varchar,retry_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$ BEGIN
 UPDATE supportv8.managed_support_registration_jobs SET state=CASE WHEN desired_state='permanently_revoked' THEN CASE WHEN target_state='revoked' THEN 'revoked' ELSE 'revocation_pending' END ELSE target_state END,
 applied_generation=CASE WHEN target_state='revoked' AND desired_state='permanently_revoked' THEN observed_generation ELSE applied_generation END,connection_id=COALESCE(target_connection,connection_id),attempt_count=attempt_count+1,next_attempt_at=COALESCE(retry_at,now()+interval '5 minutes'),last_error_code=error_code,lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE installation_id=target_installation AND lease_owner=worker AND lease_expires_at>=now();
 IF NOT FOUND THEN RAISE EXCEPTION 'managed Support registration lease lost' USING ERRCODE='40001'; END IF; END $$;

CREATE FUNCTION supportv8.observe_managed_support_lifecycle(worker varchar,target_installation varchar) RETURNS SETOF supportv8.managed_support_registration_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
DECLARE job supportv8.managed_support_registration_jobs; workspace supportv8.runtime_support_workspaces;
BEGIN
 SELECT * INTO job FROM supportv8.managed_support_registration_jobs WHERE installation_id=target_installation AND lease_owner=worker AND lease_expires_at>=now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'managed Support registration lease lost' USING ERRCODE='40001'; END IF;
 SELECT * INTO workspace FROM supportv8.runtime_support_workspaces WHERE installation_id=job.installation_id AND operation_id=job.acquisition_id AND account_id=job.account_id AND registry_tenant_id=job.registry_tenant_id AND vertical_id=job.vertical_id AND native_tenant_id=job.native_workspace_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'exact workspace authority unavailable'; END IF;
 IF workspace.state='tombstoned' AND workspace.deleted_at IS NOT NULL AND job.desired_state='active' THEN
   UPDATE supportv8.managed_support_registration_jobs SET desired_state='permanently_revoked',observed_generation=observed_generation+1,state='revocation_pending',last_authority_observed_at=now(),updated_at=now() WHERE installation_id=job.installation_id;
 ELSE
   UPDATE supportv8.managed_support_registration_jobs SET last_authority_observed_at=now() WHERE installation_id=job.installation_id;
 END IF;
 RETURN QUERY SELECT * FROM supportv8.managed_support_registration_jobs WHERE installation_id=job.installation_id;
END $$;
REVOKE ALL ON FUNCTION supportv8.observe_managed_support_lifecycle(varchar,varchar) FROM PUBLIC;
DO $grants$ BEGIN IF to_regrole('supportv8_app') IS NOT NULL THEN EXECUTE 'GRANT EXECUTE ON FUNCTION supportv8.observe_managed_support_lifecycle(varchar,varchar) TO supportv8_app'; END IF; END $grants$;

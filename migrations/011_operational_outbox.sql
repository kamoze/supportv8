-- Apply through the direct-Postgres migration owner before all producer images.
-- No historical issue backfill or pending_authority promotion is permitted.
CREATE UNIQUE INDEX uq_support_operational_permanent_tuple ON supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,native_tenant_id);
CREATE TABLE supportv8.operational_qualifications (
 installation_id varchar(128) PRIMARY KEY,
 acquisition_id varchar(128) NOT NULL, account_id varchar(128) NOT NULL,
 registry_tenant_id varchar(128) NOT NULL, native_workspace_id varchar(64) NOT NULL UNIQUE,
 pin jsonb NOT NULL CHECK(jsonb_typeof(pin)='object' AND octet_length(pin::text)<=4096),
 certificate jsonb NOT NULL CHECK(jsonb_typeof(certificate)='object' AND octet_length(certificate::text)<=32768),
 qualified_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(installation_id,acquisition_id,account_id,registry_tenant_id,native_workspace_id)
 REFERENCES supportv8.runtime_support_workspaces(installation_id,operation_id,account_id,registry_tenant_id,native_tenant_id)
);
ALTER TABLE supportv8.operational_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.operational_qualifications FORCE ROW LEVEL SECURITY;
CREATE POLICY operational_qualification_read ON supportv8.operational_qualifications FOR SELECT
 USING(native_workspace_id=current_setting('app.current_tenant_id',true));
CREATE FUNCTION supportv8.deny_operational_evidence_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'operational evidence is immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER immutable_operational_qualification BEFORE UPDATE OR DELETE ON supportv8.operational_qualifications
 FOR EACH ROW EXECUTE FUNCTION supportv8.deny_operational_evidence_mutation();

CREATE TABLE supportv8.operational_outbox (
 id uuid PRIMARY KEY, native_workspace_id varchar(64) NOT NULL,
 event jsonb NOT NULL CHECK(jsonb_typeof(event)='object' AND octet_length(event::text)<=16384),
 input_digest varchar(71) NOT NULL, provenance jsonb,
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 state varchar(32) NOT NULL CHECK(state IN('pending','pending_authority','delivered','quarantined')),
 attempt_count integer NOT NULL DEFAULT 0 CHECK(attempt_count>=0), next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_owner varchar(192), lease_generation bigint NOT NULL DEFAULT 0, lease_token uuid, lease_expires_at timestamptz,
 last_error_code varchar(64), receipt jsonb, receipt_http_status integer, delivered_at timestamptz,
 CHECK((provenance IS NULL)=(state='pending_authority')),
 CHECK((state='delivered')=(receipt IS NOT NULL AND delivered_at IS NOT NULL AND receipt_http_status IN(200,202))),
 CHECK(input_digest ~ '^sha256:[a-f0-9]{64}$')
);
ALTER TABLE supportv8.operational_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.operational_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY operational_outbox_tenant_read ON supportv8.operational_outbox FOR SELECT USING(native_workspace_id=current_setting('app.current_tenant_id',true));
CREATE INDEX operational_outbox_due ON supportv8.operational_outbox(next_attempt_at,id) WHERE state='pending';
CREATE FUNCTION supportv8.protect_operational_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'operational evidence is immutable'; END IF;
 IF ROW(NEW.id,NEW.native_workspace_id,NEW.event,NEW.input_digest,NEW.provenance,NEW.captured_at) IS DISTINCT FROM
    ROW(OLD.id,OLD.native_workspace_id,OLD.event,OLD.input_digest,OLD.provenance,OLD.captured_at)
    OR (OLD.state IN('pending_authority','delivered','quarantined') AND NEW IS DISTINCT FROM OLD)
 THEN RAISE EXCEPTION 'operational evidence is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER immutable_operational_outbox BEFORE UPDATE OR DELETE ON supportv8.operational_outbox FOR EACH ROW EXECUTE FUNCTION supportv8.protect_operational_outbox();
CREATE FUNCTION supportv8.operational_canonical_json(value jsonb) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,supportv8 AS $$
 SELECT CASE jsonb_typeof(value)
 WHEN 'object' THEN '{'||COALESCE((SELECT string_agg(to_jsonb(key)::text||':'||supportv8.operational_canonical_json(val),',' ORDER BY key COLLATE "C") FROM jsonb_each(value) AS x(key,val)),'')||'}'
 WHEN 'array' THEN '['||COALESCE((SELECT string_agg(supportv8.operational_canonical_json(val),',' ORDER BY ord) FROM jsonb_array_elements(value) WITH ORDINALITY AS x(val,ord)),'')||']'
 ELSE value::text END $$;
-- Trigger-only SECURITY DEFINER: tenant context must match NEW; permanent tuple
-- is derived from local owners, never a voice employee installation or caller pin.
CREATE FUNCTION supportv8.capture_operational_issue() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
DECLARE w supportv8.runtime_support_workspaces; q supportv8.operational_qualifications; pin jsonb; captured_pin jsonb; data jsonb; envelope jsonb; eid uuid; suffix text; transitions text[]:=ARRAY[]::text[]; occurred timestamptz; reason text;
BEGIN
 IF current_setting('app.current_tenant_id',true) IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'operational tenant context required' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.tenant_id) IS DISTINCT FROM ROW(OLD.id,OLD.tenant_id) THEN RAISE EXCEPTION 'native issue identity is immutable'; END IF;
 IF TG_OP='INSERT' THEN transitions:=array_append(transitions,'ticket-created'); occurred:=NEW.created_at;
 ELSE occurred:=statement_timestamp(); END IF;
 IF (TG_OP='INSERT' AND NEW.priority='urgent') OR (TG_OP='UPDATE' AND ((NEW.priority='urgent' AND OLD.priority IS DISTINCT FROM NEW.priority) OR (NEW.source_status='escalated' AND OLD.source_status IS DISTINCT FROM NEW.source_status))) THEN transitions:=array_append(transitions,'ticket-escalated'); END IF;
 IF TG_OP='UPDATE' AND NEW.source_status IN('resolved','closed') AND OLD.source_status NOT IN('resolved','closed') THEN transitions:=array_append(transitions,'ticket-resolved'); END IF;
 IF cardinality(transitions)=0 THEN RETURN NEW; END IF;
 -- Lock local lifecycle while capturing, without a network call. NOWAIT contention
 -- holds this fact rather than disrupting the already authorized business write.
 BEGIN
 SELECT m.* INTO w FROM supportv8.runtime_support_workspaces m JOIN supportv8.tenants t ON t.id=m.native_tenant_id AND t.domain=m.native_domain AND t.servicev8_account_id=m.account_id
 JOIN supportv8.managed_support_registration_jobs j ON j.installation_id=m.installation_id AND j.acquisition_id=m.operation_id AND j.account_id=m.account_id AND j.registry_tenant_id=m.registry_tenant_id AND j.native_workspace_id=m.native_tenant_id
 WHERE m.native_tenant_id=NEW.tenant_id AND m.state='workspace_created' AND m.deleted_at IS NULL AND j.state='ready' AND j.desired_state='active' AND j.observed_generation=0 FOR SHARE OF m,t,j NOWAIT;
 IF FOUND THEN
  SELECT * INTO q FROM supportv8.operational_qualifications WHERE installation_id=w.installation_id AND acquisition_id=w.operation_id AND account_id=w.account_id AND registry_tenant_id=w.registry_tenant_id AND native_workspace_id=w.native_tenant_id;
  IF FOUND THEN pin:=q.pin; ELSE reason:='qualification_absent'; END IF;
 ELSE reason:='native_binding_unavailable'; END IF;
 EXCEPTION WHEN lock_not_available THEN reason:='native_binding_busy'; pin:=NULL;
 END;
 captured_pin:=pin;
 FOREACH suffix IN ARRAY transitions LOOP
  pin:=captured_pin;
  reason:=CASE WHEN pin IS NOT NULL THEN NULL ELSE reason END;
  eid:=gen_random_uuid();
  data:=jsonb_build_object('ticketId',NEW.id,'ticketRef',NEW.external_id);
  IF suffix IN('ticket-created','ticket-escalated') THEN data:=data||jsonb_build_object('priority',NEW.priority); END IF;
  IF suffix IN('ticket-created','ticket-resolved') THEN data:=data||jsonb_build_object('status',NEW.source_status); END IF;
  IF pin IS NOT NULL THEN data:=data||jsonb_build_object('accountId',w.account_id,'tenantId',w.registry_tenant_id,'installationId',w.installation_id,'workspaceId',w.native_tenant_id); END IF;
  -- A certificate may deliberately cover only a subset. Missing declarations hold
  -- this exact scalar fact without assigning or later changing its provenance.
  IF pin IS NOT NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q.certificate->'descriptor'->'events') e WHERE e->>'type'='com.servicev8.business.support.'||suffix||'.v1') THEN pin:=NULL; reason:='event_unqualified'; END IF;
  envelope:=jsonb_build_object('specversion','1.0','id',eid::text,'source','urn:servicev8:app:supportv8','type','com.servicev8.business.support.'||suffix||'.v1','subject','ticket:'||NEW.id,'time',to_char(occurred AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'datacontenttype','application/json','data',data);
  INSERT INTO supportv8.operational_outbox(id,native_workspace_id,event,input_digest,provenance,state,last_error_code)
   VALUES(eid,NEW.tenant_id,envelope,'sha256:'||encode(sha256(convert_to(supportv8.operational_canonical_json(envelope),'UTF8')),'hex'),pin,CASE WHEN pin IS NULL THEN 'pending_authority' ELSE 'pending' END,reason);
 END LOOP;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION supportv8.capture_operational_issue() FROM PUBLIC;
CREATE TRIGGER capture_operational_issue AFTER INSERT OR UPDATE ON supportv8.issues FOR EACH ROW EXECUTE FUNCTION supportv8.capture_operational_issue();

CREATE FUNCTION supportv8.claim_operational_outbox(worker varchar,claim_limit integer) RETURNS SETOF supportv8.operational_outbox LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
 WITH candidates AS(SELECT id FROM(SELECT id,next_attempt_at,row_number()OVER(PARTITION BY provenance->>'accountId' ORDER BY next_attempt_at,id) rank FROM supportv8.operational_outbox WHERE state='pending' AND next_attempt_at<=now() AND(lease_expires_at IS NULL OR lease_expires_at<now())) ranked WHERE rank<=4 ORDER BY next_attempt_at,id LIMIT greatest(1,least(claim_limit,64))),locked AS(SELECT o.id FROM supportv8.operational_outbox o JOIN candidates c USING(id) WHERE state='pending' AND next_attempt_at<=now() AND(lease_expires_at IS NULL OR lease_expires_at<now()) FOR UPDATE OF o SKIP LOCKED)
 UPDATE supportv8.operational_outbox o SET lease_owner=worker,lease_generation=lease_generation+1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '30 seconds',attempt_count=attempt_count+1 FROM locked WHERE o.id=locked.id RETURNING o.* $$;
CREATE FUNCTION supportv8.finish_operational_outbox(target uuid,worker varchar,generation bigint,token uuid,result varchar,code varchar,ack jsonb,http_status integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
DECLARE o supportv8.operational_outbox;
BEGIN
 SELECT * INTO o FROM supportv8.operational_outbox WHERE id=target AND state='pending' AND lease_owner=worker AND lease_generation=generation AND lease_token=token AND lease_expires_at>=now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'operational outbox lease lost' USING ERRCODE='40001'; END IF;
 IF result NOT IN('retry','delivered','quarantined') OR (result='delivered') IS DISTINCT FROM (ack IS NOT NULL) THEN RAISE EXCEPTION 'invalid operational completion'; END IF;
 IF ack IS NOT NULL AND (http_status IS NULL OR NOT((http_status=202 AND ack->'duplicate'='false'::jsonb) OR(http_status=200 AND ack->'duplicate'='true'::jsonb)) OR octet_length(ack::text)>8192 OR EXISTS(SELECT 1 FROM jsonb_each(ack) x WHERE key IN('receiptId','inputDigest','tenantId','accountId','sourceBinding','sourceEventId','eventType','subject','receivedAt','status') AND jsonb_typeof(value)<>'string') OR jsonb_typeof(ack)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(ack))<>12 OR NOT(ack ?& ARRAY['ok','duplicate','receiptId','inputDigest','tenantId','accountId','sourceBinding','sourceEventId','eventType','subject','receivedAt','status']) OR ack->'ok'<>'true'::jsonb OR NOT((ack->'duplicate'='false'::jsonb AND ack->>'status'='accepted') OR (ack->'duplicate'='true'::jsonb AND ack->>'status'='duplicate')) OR jsonb_typeof(ack->'receiptId')<>'string' OR length(trim(ack->>'receiptId')) NOT BETWEEN 1 AND 512 OR (ack->>'receiptId')~'[[:cntrl:]]' OR ack->>'inputDigest' IS DISTINCT FROM o.input_digest OR ack->>'tenantId' IS DISTINCT FROM o.provenance->>'tenantId' OR ack->>'accountId' IS DISTINCT FROM o.provenance->>'accountId' OR ack->>'sourceBinding' IS DISTINCT FROM o.event->>'source' OR ack->>'sourceEventId' IS DISTINCT FROM o.event->>'id' OR ack->>'eventType' IS DISTINCT FROM o.event->>'type' OR ack->>'subject' IS DISTINCT FROM o.event->>'subject' OR jsonb_typeof(ack->'receivedAt')<>'string' OR (ack->>'receivedAt')!~'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{1,9})?(Z|[+-]\d\d:\d\d)$') THEN RAISE EXCEPTION 'invalid operational receipt'; END IF;
 IF ack IS NOT NULL THEN PERFORM (ack->>'receivedAt')::timestamptz; END IF;
 UPDATE supportv8.operational_outbox SET state=CASE WHEN result='retry' THEN 'pending' ELSE result END,last_error_code=code,receipt=ack,receipt_http_status=http_status,delivered_at=CASE WHEN ack IS NOT NULL THEN now() END,
 next_attempt_at=now()+make_interval(secs=>least(900,5*power(2,least(attempt_count,7)))::integer),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL WHERE id=target;
END $$;
REVOKE ALL ON FUNCTION supportv8.claim_operational_outbox(varchar,integer),supportv8.finish_operational_outbox(uuid,varchar,bigint,uuid,varchar,varchar,jsonb,integer) FROM PUBLIC;
DO $grants$ BEGIN IF to_regrole('supportv8_app') IS NOT NULL THEN
 GRANT SELECT ON supportv8.operational_outbox,supportv8.operational_qualifications TO supportv8_app;
 GRANT EXECUTE ON FUNCTION supportv8.claim_operational_outbox(varchar,integer),supportv8.finish_operational_outbox(uuid,varchar,bigint,uuid,varchar,varchar,jsonb,integer) TO supportv8_app;
END IF; END $grants$;
-- Only the existing registration worker's current lease may persist an owner-
-- observed capture snapshot. This snapshot cannot authorize an HTTP request.
CREATE FUNCTION supportv8.qualify_operational_source(worker varchar,installation varchar,expected_pin jsonb,observed_certificate jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
DECLARE w supportv8.runtime_support_workspaces; existing jsonb;
BEGIN
 SELECT m.* INTO w FROM supportv8.runtime_support_workspaces m
 JOIN supportv8.tenants t ON t.id=m.native_tenant_id AND t.domain=m.native_domain AND t.servicev8_account_id=m.account_id
 JOIN supportv8.managed_support_registration_jobs j ON j.installation_id=m.installation_id AND j.acquisition_id=m.operation_id AND j.account_id=m.account_id AND j.registry_tenant_id=m.registry_tenant_id AND j.native_workspace_id=m.native_tenant_id
 WHERE m.installation_id=installation AND m.state='workspace_created' AND m.deleted_at IS NULL AND j.state='ready' AND j.desired_state='active' AND j.observed_generation=0 AND j.lease_owner=worker AND j.lease_expires_at>=now() FOR SHARE OF m,t,j;
 IF NOT FOUND THEN RAISE EXCEPTION 'operational qualification lease or owner lost' USING ERRCODE='40001'; END IF;
 IF expected_pin IS DISTINCT FROM jsonb_build_object('contract','servicev8.operational-provenance.v1','accountId',w.account_id,'tenantId',w.registry_tenant_id,'installationId',w.installation_id,'productId','servicev8.service-app.supportv8','productVersion','1.0.0','target',jsonb_build_object('kind','service','targetAppId','runtime'),'sourceBinding','urn:servicev8:app:supportv8','workspaceId',w.native_tenant_id,'baseManifestDigest',observed_certificate->>'baseManifestDigest','descriptorDigest',observed_certificate->>'descriptorDigest','nativeBinding',jsonb_build_object('kind','support-permanent-tuple'))
 OR expected_pin->>'baseManifestDigest' !~ '^sha256:[a-f0-9]{64}$'
 OR expected_pin->>'descriptorDigest' IS DISTINCT FROM 'sha256:'||encode(sha256(convert_to(supportv8.operational_canonical_json(observed_certificate->'descriptor'),'UTF8')),'hex')
 OR observed_certificate->>'status' IS DISTINCT FROM 'supported'
 OR observed_certificate->'installation' IS DISTINCT FROM jsonb_build_object('accountId',w.account_id,'tenantId',w.registry_tenant_id,'installationId',w.installation_id,'productId','servicev8.service-app.supportv8','productVersion','1.0.0','target',jsonb_build_object('kind','service','targetAppId','runtime'))
 THEN RAISE EXCEPTION 'invalid operational qualification'; END IF;
 SELECT pin INTO existing FROM supportv8.operational_qualifications WHERE installation_id=installation;
 IF FOUND THEN
 IF existing IS DISTINCT FROM expected_pin THEN RAISE EXCEPTION 'immutable operational qualification conflict'; END IF;
 RETURN false; END IF;
 INSERT INTO supportv8.operational_qualifications(installation_id,acquisition_id,account_id,registry_tenant_id,native_workspace_id,pin,certificate) VALUES(w.installation_id,w.operation_id,w.account_id,w.registry_tenant_id,w.native_tenant_id,expected_pin,observed_certificate);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION supportv8.qualify_operational_source(varchar,varchar,jsonb,jsonb) FROM PUBLIC;
DO $grants$ BEGIN IF to_regrole('supportv8_app') IS NOT NULL THEN
 GRANT EXECUTE ON FUNCTION supportv8.qualify_operational_source(varchar,varchar,jsonb,jsonb) TO supportv8_app;
END IF; END $grants$;
COMMENT ON FUNCTION supportv8.capture_operational_issue() IS 'Trigger-only native transaction capture; definer must be migration owner with BYPASSRLS. Does not call network or trust request source IDs.';

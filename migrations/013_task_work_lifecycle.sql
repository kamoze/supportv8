-- Native task lifecycle facts. Apply with the migration owner before activation.
-- Captures explicit authenticated manager requests only; never promotes historical drafts.
CREATE TABLE supportv8.task_work_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), native_workspace_id varchar(64) NOT NULL,
 installation_id varchar(128) NOT NULL, account_id varchar(128) NOT NULL, registry_tenant_id varchar(128) NOT NULL,
 issue_id varchar(128) NOT NULL, requested_by varchar(192) NOT NULL, request jsonb NOT NULL, ticket_snapshot jsonb NOT NULL, source_updated_at timestamptz NOT NULL, source_revision bigint NOT NULL CHECK(source_revision>=0),
 event jsonb NOT NULL CHECK(jsonb_typeof(event)='object' AND octet_length(event::text)<=65536),
 payload_digest text NOT NULL CHECK(payload_digest~'^[a-f0-9]{64}$' AND payload_digest<>repeat('0',64)),
 captured_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','delivered')),
 work_id varchar(192), source_work_id varchar(192), receipt jsonb, lease_owner varchar(192), lease_token uuid,
 lease_generation bigint NOT NULL DEFAULT 0, lease_expires_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(), last_error text,
 UNIQUE(native_workspace_id,issue_id,source_revision),
 FOREIGN KEY(installation_id) REFERENCES supportv8.runtime_support_workspaces(installation_id),
 CHECK((state='delivered')=(receipt IS NOT NULL AND work_id IS NOT NULL))
);
CREATE TABLE supportv8.task_work_outcomes (
 receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), native_workspace_id varchar(64) NOT NULL,
 account_id varchar(128) NOT NULL, registry_tenant_id varchar(128) NOT NULL,
 intake_id uuid NOT NULL REFERENCES supportv8.task_work_outbox(id), event_id varchar(192) NOT NULL,
 work_id varchar(192) NOT NULL, binding jsonb NOT NULL, event jsonb NOT NULL,
 payload_digest text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(account_id,registry_tenant_id,event_id), UNIQUE(intake_id,work_id)
);
ALTER TABLE supportv8.task_work_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.task_work_outbox FORCE ROW LEVEL SECURITY;
ALTER TABLE supportv8.task_work_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE supportv8.task_work_outcomes FORCE ROW LEVEL SECURITY;
CREATE POLICY task_work_outbox_read ON supportv8.task_work_outbox FOR SELECT USING(native_workspace_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true));
CREATE POLICY task_work_outcome_read ON supportv8.task_work_outcomes FOR SELECT USING(native_workspace_id=current_setting('app.current_tenant_id',true) AND account_id=current_setting('app.current_account_id',true) AND registry_tenant_id=current_setting('app.current_registry_tenant_id',true));
CREATE FUNCTION supportv8.protect_task_work_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR ROW(NEW.id,NEW.native_workspace_id,NEW.installation_id,NEW.account_id,NEW.registry_tenant_id,NEW.issue_id,NEW.source_work_id,NEW.requested_by,NEW.request,NEW.ticket_snapshot,NEW.source_updated_at,NEW.source_revision,NEW.event,NEW.payload_digest,NEW.captured_at) IS DISTINCT FROM ROW(OLD.id,OLD.native_workspace_id,OLD.installation_id,OLD.account_id,OLD.registry_tenant_id,OLD.issue_id,OLD.source_work_id,OLD.requested_by,OLD.request,OLD.ticket_snapshot,OLD.source_updated_at,OLD.source_revision,OLD.event,OLD.payload_digest,OLD.captured_at) OR (OLD.state='delivered' AND NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'task work provenance is immutable'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER immutable_task_work_outbox BEFORE UPDATE OR DELETE ON supportv8.task_work_outbox FOR EACH ROW EXECUTE FUNCTION supportv8.protect_task_work_outbox();
CREATE TRIGGER immutable_task_work_outcomes BEFORE UPDATE OR DELETE ON supportv8.task_work_outcomes FOR EACH ROW EXECUTE FUNCTION supportv8.deny_operational_evidence_mutation();
CREATE FUNCTION supportv8.request_task_work(ref uuid,issue varchar,principal varchar,request_body jsonb) RETURNS SETOF supportv8.task_work_outbox LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
DECLARE w supportv8.runtime_support_workspaces; ticket supportv8.issues; previous supportv8.task_work_outbox; rev bigint; happened text; envelope jsonb; work jsonb;
BEGIN
 SELECT * INTO ticket FROM supportv8.issues WHERE id=issue AND tenant_id=current_setting('app.current_tenant_id',true) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'task work ticket denied' USING ERRCODE='42501'; END IF;
 SELECT m.* INTO w FROM supportv8.runtime_support_workspaces m JOIN supportv8.tenants t ON t.id=m.native_tenant_id AND t.domain=m.native_domain AND t.servicev8_account_id=m.account_id JOIN supportv8.managed_support_registration_jobs j ON j.installation_id=m.installation_id AND j.acquisition_id=m.operation_id AND j.account_id=m.account_id AND j.registry_tenant_id=m.registry_tenant_id AND j.native_workspace_id=m.native_tenant_id WHERE m.native_tenant_id=ticket.tenant_id AND m.account_id=current_setting('app.current_account_id',true) AND m.registry_tenant_id=current_setting('app.current_registry_tenant_id',true) AND m.state='workspace_created' AND m.deleted_at IS NULL AND j.state='ready' AND j.desired_state='active' AND j.observed_generation=0 FOR SHARE OF m,t,j;
 IF NOT FOUND OR principal IS NULL OR principal !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$' THEN RAISE EXCEPTION 'task work source denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO previous FROM supportv8.task_work_outbox WHERE id=ref;
 IF FOUND THEN
  IF previous.native_workspace_id IS DISTINCT FROM ticket.tenant_id OR previous.issue_id IS DISTINCT FROM ticket.id OR previous.account_id IS DISTINCT FROM w.account_id OR previous.registry_tenant_id IS DISTINCT FROM w.registry_tenant_id OR previous.requested_by IS DISTINCT FROM principal OR previous.request IS DISTINCT FROM request_body OR previous.source_updated_at IS DISTINCT FROM ticket.updated_at THEN RAISE EXCEPTION 'task work request conflict' USING ERRCODE='23505'; END IF;
  RETURN NEXT previous; RETURN;
 END IF;
 IF jsonb_typeof(request_body) IS DISTINCT FROM 'object' OR octet_length(request_body::text)>32768 OR (SELECT count(*) FROM jsonb_object_keys(request_body))<>3 OR NOT(request_body ?& ARRAY['idempotencyKey','expectedTicketDigest','work']) OR request_body->>'idempotencyKey' IS DISTINCT FROM ref::text OR request_body->>'expectedTicketDigest' IS DISTINCT FROM encode(sha256(convert_to(supportv8.operational_canonical_json(jsonb_build_object('id',ticket.id,'summary',ticket.summary,'status',ticket.source_status,'priority',ticket.priority,'updatedAt',ticket.updated_at)),'UTF8')),'hex') OR ticket.source_status IN('resolved','closed') THEN RAISE EXCEPTION 'task work ticket version conflict' USING ERRCODE='23505'; END IF;
 work:=request_body->'work';
 IF jsonb_typeof(work) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(work))<>13 OR NOT(work ?& ARRAY['projectRef','workKind','title','problemStatement','desiredOutcome','acceptanceCriteria','constraints','nonGoals','requiredDeliverables','verificationMethod','priority','severity','labels']) OR work->>'workKind' IS DISTINCT FROM 'support_escalation' OR jsonb_typeof(work->'projectRef') IS DISTINCT FROM 'string' OR coalesce(work->>'projectRef','')='' OR jsonb_typeof(work->'acceptanceCriteria') IS DISTINCT FROM 'array' OR jsonb_array_length(work->'acceptanceCriteria')<1 THEN RAISE EXCEPTION 'task work specification required'; END IF;
 SELECT * INTO previous FROM supportv8.task_work_outbox WHERE native_workspace_id=ticket.tenant_id AND issue_id=ticket.id ORDER BY source_revision DESC LIMIT 1;
 IF FOUND AND previous.state<>'delivered' THEN RAISE EXCEPTION 'prior task work request awaits receipt' USING ERRCODE='23505'; END IF;
 rev:=coalesce(previous.source_revision,-1)+1;
 happened:=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 -- Preserve the actual native ticket version; this request does not close or alter it.
 envelope:=jsonb_build_object('specversion','1.0','id',ref::text,'source','urn:servicev8:supportv8','type','servicev8.work-intake.v1','time',happened,'datacontenttype','application/json','data',jsonb_build_object('schema','servicev8.work-intake.v1','operation','upsert','source',jsonb_build_object('system','supportv8','recordId',ticket.id,'recordUri','urn:servicev8:supportv8:issue:'||ticket.id,'revision',rev,'occurredAt',happened),'work',work,'relationships',jsonb_build_array(jsonb_build_object('kind','requested_by','targetSystem','supportv8','targetId',ticket.id)),'correlationId',ref::text));
 INSERT INTO supportv8.task_work_outbox(id,native_workspace_id,installation_id,account_id,registry_tenant_id,issue_id,source_work_id,requested_by,request,ticket_snapshot,source_updated_at,source_revision,event,payload_digest)
 VALUES(ref,ticket.tenant_id,w.installation_id,w.account_id,w.registry_tenant_id,ticket.id,previous.work_id,principal,request_body,jsonb_build_object('id',ticket.id,'summary',ticket.summary,'status',ticket.source_status,'priority',ticket.priority,'updatedAt',ticket.updated_at),ticket.updated_at,rev,envelope,encode(sha256(convert_to(supportv8.operational_canonical_json(envelope),'UTF8')),'hex'));
 RETURN QUERY SELECT * FROM supportv8.task_work_outbox WHERE id=ref;
END $$;
-- Bounded opaque-reference lookup used only by authenticated Identity policy route.
CREATE FUNCTION supportv8.task_work_fact(ref uuid) RETURNS SETOF supportv8.task_work_outbox LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
 SELECT o.* FROM supportv8.task_work_outbox o JOIN supportv8.runtime_support_workspaces w ON w.installation_id=o.installation_id AND w.native_tenant_id=o.native_workspace_id AND w.account_id=o.account_id AND w.registry_tenant_id=o.registry_tenant_id JOIN supportv8.managed_support_registration_jobs j ON j.installation_id=w.installation_id AND j.acquisition_id=w.operation_id AND j.native_workspace_id=w.native_tenant_id AND j.account_id=w.account_id AND j.registry_tenant_id=w.registry_tenant_id JOIN supportv8.tenants t ON t.id=w.native_tenant_id AND t.domain=w.native_domain AND t.servicev8_account_id=w.account_id JOIN supportv8.issues i ON i.id=o.issue_id AND i.tenant_id=o.native_workspace_id AND i.updated_at=o.source_updated_at AND o.ticket_snapshot=jsonb_build_object('id',i.id,'summary',i.summary,'status',i.source_status,'priority',i.priority,'updatedAt',i.updated_at) WHERE o.id=ref AND w.state='workspace_created' AND w.deleted_at IS NULL AND j.state='ready' AND j.desired_state='active' AND j.observed_generation=0 AND NOT EXISTS(SELECT 1 FROM supportv8.task_work_outbox later WHERE later.native_workspace_id=o.native_workspace_id AND later.issue_id=o.issue_id AND later.source_revision>o.source_revision)
$$;
CREATE FUNCTION supportv8.claim_task_work(worker varchar, claim_limit integer) RETURNS SETOF supportv8.task_work_outbox LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
 WITH candidates AS(SELECT id FROM supportv8.task_work_outbox WHERE state='pending' AND next_attempt_at<=clock_timestamp() AND(lease_expires_at IS NULL OR lease_expires_at<clock_timestamp()) ORDER BY next_attempt_at,id LIMIT greatest(1,least(claim_limit,32)) FOR UPDATE SKIP LOCKED)
 UPDATE supportv8.task_work_outbox o SET lease_owner=worker,lease_token=gen_random_uuid(),lease_generation=lease_generation+1,lease_expires_at=clock_timestamp()+interval '30 seconds',attempts=attempts+1 FROM candidates c WHERE o.id=c.id RETURNING o.*
$$;
CREATE FUNCTION supportv8.finish_task_work(ref uuid,worker varchar,generation bigint,token uuid,ack jsonb,error_code varchar,authority_expires_at timestamptz) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
DECLARE o supportv8.task_work_outbox;
BEGIN
 -- Match request/outcome lock order: native ticket, then outbox, then lifecycle.
 SELECT * INTO o FROM supportv8.task_work_outbox WHERE id=ref;
 IF NOT FOUND THEN RAISE EXCEPTION 'task work lease lost' USING ERRCODE='40001'; END IF;
 PERFORM 1 FROM supportv8.issues WHERE id=o.issue_id AND tenant_id=o.native_workspace_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'task work source no longer current' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM supportv8.task_work_outbox WHERE id=ref AND state='pending' AND lease_owner=worker AND lease_generation=generation AND lease_token=token AND lease_expires_at>clock_timestamp() FOR UPDATE;
 IF NOT FOUND OR o.lease_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'task work lease lost' USING ERRCODE='40001'; END IF;
 IF ack IS NOT NULL THEN
  PERFORM 1 FROM supportv8.runtime_support_workspaces w JOIN supportv8.managed_support_registration_jobs j ON j.installation_id=w.installation_id AND j.acquisition_id=w.operation_id AND j.account_id=w.account_id AND j.registry_tenant_id=w.registry_tenant_id AND j.native_workspace_id=w.native_tenant_id JOIN supportv8.tenants t ON t.id=w.native_tenant_id AND t.domain=w.native_domain AND t.servicev8_account_id=w.account_id WHERE w.installation_id=o.installation_id AND w.native_tenant_id=o.native_workspace_id AND w.account_id=o.account_id AND w.registry_tenant_id=o.registry_tenant_id AND w.state='workspace_created' AND w.deleted_at IS NULL AND j.state='ready' AND j.desired_state='active' AND j.observed_generation=0 FOR SHARE OF w,j,t;
  IF NOT FOUND THEN RAISE EXCEPTION 'task work source no longer current' USING ERRCODE='42501'; END IF;
  IF authority_expires_at IS NULL OR authority_expires_at<=clock_timestamp() OR authority_expires_at>clock_timestamp()+interval '120 seconds' THEN RAISE EXCEPTION 'task work credential expired' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(ack)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(ack))<>7 OR NOT(ack ?& ARRAY['receiptId','eventId','state','scope','workId','payloadDigest','sourceRevision']) OR jsonb_typeof(ack->'receiptId') IS DISTINCT FROM 'string' OR ack->>'receiptId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR ack->>'eventId' IS DISTINCT FROM o.event->>'id' OR coalesce(ack->>'state','') NOT IN('recorded','duplicate') OR ack->'scope' IS DISTINCT FROM jsonb_build_object('accountId',o.account_id,'tenantId',o.registry_tenant_id) OR jsonb_typeof(ack->'workId') IS DISTINCT FROM 'string' OR ack->>'workId' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$' OR (o.source_work_id IS NOT NULL AND ack->>'workId' IS DISTINCT FROM o.source_work_id) OR ack->>'payloadDigest' IS DISTINCT FROM o.payload_digest OR ack->'sourceRevision' IS DISTINCT FROM to_jsonb(o.source_revision) THEN RAISE EXCEPTION 'task work receipt mismatch'; END IF;
  IF NOT EXISTS(SELECT 1 FROM supportv8.task_work_fact(ref)) THEN RAISE EXCEPTION 'task work source no longer current'; END IF;
 END IF;
 UPDATE supportv8.task_work_outbox SET state=CASE WHEN ack IS NULL THEN 'pending' ELSE 'delivered' END,work_id=ack->>'workId',receipt=ack,last_error=left(error_code,128),next_attempt_at=clock_timestamp()+interval '30 seconds',lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL WHERE id=ref AND lease_token=token AND lease_generation=generation AND lease_expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'task work lease lost' USING ERRCODE='40001'; END IF;
 IF ack IS NOT NULL AND authority_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'task work credential expired' USING ERRCODE='42501'; END IF;
END $$;
-- The signed tuple locates only a previously delivered native source link.
CREATE FUNCTION supportv8.task_work_link(account varchar,tenant varchar,issue varchar,revision bigint,work varchar) RETURNS SETOF supportv8.task_work_outbox LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$ SELECT o.* FROM supportv8.task_work_outbox o WHERE o.account_id=account AND o.registry_tenant_id=tenant AND o.issue_id=issue AND o.source_revision=revision AND o.work_id=work AND o.state='delivered' AND EXISTS(SELECT 1 FROM supportv8.task_work_fact(o.id)) $$;
CREATE FUNCTION supportv8.record_task_work_outcome(intake uuid,incoming_binding jsonb,incoming_event jsonb,authority_expires_at timestamptz) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,supportv8 AS $$
DECLARE o supportv8.task_work_outbox; prior supportv8.task_work_outcomes; receipt uuid; digest text;
BEGIN
 -- Acquire the native ticket before outbox/workspace locks, matching request capture.
 SELECT * INTO o FROM supportv8.task_work_outbox WHERE id=intake;
 IF NOT FOUND THEN RAISE EXCEPTION 'task work source denied' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM supportv8.issues WHERE id=o.issue_id AND tenant_id=o.native_workspace_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'task work source denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM supportv8.task_work_outbox WHERE id=intake FOR UPDATE;
 IF NOT FOUND OR o.state<>'delivered' OR o.native_workspace_id IS DISTINCT FROM current_setting('app.current_tenant_id',true) OR o.account_id IS DISTINCT FROM current_setting('app.current_account_id',true) OR o.registry_tenant_id IS DISTINCT FROM current_setting('app.current_registry_tenant_id',true) THEN RAISE EXCEPTION 'task work source denied' USING ERRCODE='42501'; END IF;
 -- Lifecycle locks fence local deactivation even on an immutable receipt replay.
 PERFORM 1 FROM supportv8.runtime_support_workspaces w JOIN supportv8.managed_support_registration_jobs j ON j.installation_id=w.installation_id AND j.acquisition_id=w.operation_id AND j.account_id=w.account_id AND j.registry_tenant_id=w.registry_tenant_id AND j.native_workspace_id=w.native_tenant_id WHERE w.installation_id=o.installation_id AND w.native_tenant_id=o.native_workspace_id AND w.account_id=o.account_id AND w.registry_tenant_id=o.registry_tenant_id AND w.state='workspace_created' AND w.deleted_at IS NULL AND j.state='ready' AND j.desired_state='active' AND j.observed_generation=0 FOR SHARE OF w,j;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM supportv8.task_work_fact(o.id)) THEN RAISE EXCEPTION 'task work source denied' USING ERRCODE='42501'; END IF;
 IF authority_expires_at IS NULL OR authority_expires_at<=clock_timestamp() OR authority_expires_at>clock_timestamp()+interval '120 seconds' THEN RAISE EXCEPTION 'task work credential expired' USING ERRCODE='42501'; END IF;
 digest:=encode(sha256(convert_to(supportv8.operational_canonical_json(incoming_event),'UTF8')),'hex');
 IF incoming_binding->>'profile' IS DISTINCT FROM 'servicev8.task-work.v1' OR incoming_binding->>'operation' IS DISTINCT FROM 'support_outcome' OR incoming_binding->>'accountId' IS DISTINCT FROM o.account_id OR incoming_binding->>'tenantId' IS DISTINCT FROM o.registry_tenant_id OR incoming_binding->>'sourceSystem' IS DISTINCT FROM 'supportv8' OR incoming_binding->>'sourceRecordId' IS DISTINCT FROM o.issue_id OR incoming_binding->'sourceRevision' IS DISTINCT FROM to_jsonb(o.source_revision) OR incoming_binding->>'workId' IS DISTINCT FROM o.work_id OR incoming_binding->>'eventId' IS DISTINCT FROM incoming_event->>'id' OR incoming_binding->>'payloadDigest' IS DISTINCT FROM digest OR incoming_event->'data'->>'workId' IS DISTINCT FROM o.work_id OR incoming_event->'data'->>'eventId' IS DISTINCT FROM incoming_event->>'id' THEN RAISE EXCEPTION 'task work outcome mismatch'; END IF;
 SELECT * INTO prior FROM supportv8.task_work_outcomes WHERE account_id=o.account_id AND registry_tenant_id=o.registry_tenant_id AND (event_id=incoming_event->>'id' OR intake_id=o.id);
 IF FOUND THEN
  IF prior.binding IS DISTINCT FROM incoming_binding OR prior.event IS DISTINCT FROM incoming_event OR prior.payload_digest IS DISTINCT FROM digest THEN RAISE EXCEPTION 'task work immutable outcome conflict' USING ERRCODE='23505'; END IF;
  receipt:=prior.receipt_id;
 ELSE
  INSERT INTO supportv8.task_work_outcomes(native_workspace_id,account_id,registry_tenant_id,intake_id,event_id,work_id,binding,event,payload_digest) VALUES(o.native_workspace_id,o.account_id,o.registry_tenant_id,o.id,incoming_event->>'id',o.work_id,incoming_binding,incoming_event,digest) RETURNING receipt_id INTO receipt;
 END IF;
 IF authority_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'task work credential expired' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('receiptId',receipt::text,'eventId',incoming_event->>'id','state',CASE WHEN prior.receipt_id IS NULL THEN 'recorded' ELSE 'duplicate' END,'scope',jsonb_build_object('accountId',o.account_id,'tenantId',o.registry_tenant_id),'workId',o.work_id,'payloadDigest',digest);
 -- Intentionally no issue status mutation. The operator owns ticket closure.
END $$;
REVOKE ALL ON supportv8.task_work_outbox,supportv8.task_work_outcomes FROM PUBLIC;
REVOKE ALL ON FUNCTION supportv8.request_task_work(uuid,varchar,varchar,jsonb),supportv8.task_work_fact(uuid),supportv8.claim_task_work(varchar,integer),supportv8.finish_task_work(uuid,varchar,bigint,uuid,jsonb,varchar,timestamptz),supportv8.task_work_link(varchar,varchar,varchar,bigint,varchar),supportv8.record_task_work_outcome(uuid,jsonb,jsonb,timestamptz) FROM PUBLIC;
DO $grants$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['supportv8_app','supportv8_relay','supportv8_scaler'] LOOP IF to_regrole(r) IS NOT NULL THEN EXECUTE format('REVOKE ALL ON supportv8.task_work_outbox,supportv8.task_work_outcomes FROM %I',r); END IF; END LOOP;
 IF to_regrole('supportv8_app') IS NOT NULL THEN
 GRANT SELECT ON supportv8.task_work_outbox,supportv8.task_work_outcomes TO supportv8_app;
 GRANT EXECUTE ON FUNCTION supportv8.request_task_work(uuid,varchar,varchar,jsonb),supportv8.task_work_fact(uuid),supportv8.claim_task_work(varchar,integer),supportv8.finish_task_work(uuid,varchar,bigint,uuid,jsonb,varchar,timestamptz),supportv8.task_work_link(varchar,varchar,varchar,bigint,varchar),supportv8.record_task_work_outcome(uuid,jsonb,jsonb,timestamptz) TO supportv8_app;
 END IF;
END $grants$;

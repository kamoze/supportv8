# Managed Support operational facts

Repository implementation only. Both `SUPPORT_OPERATIONAL_QUALIFICATION_ENABLED`
and `SUPPORT_OPERATIONAL_PUBLISHER_ENABLED` default closed and require literal
`true`. No certificate, credential, subject, allowlist, policy, installation,
manifest, acquisition or flag is activated by this change.

## Native capture and immutable evidence

Migration `011_operational_outbox.sql` installs an AFTER INSERT/UPDATE trigger on
`supportv8.issues`. Native issue mutation, voice tool effect, chat/session writes
and operational evidence share the caller's existing transaction. Rollback rolls
all of them back. Capture never calls Registry, Runtime, OAuth or another API.

The trigger emits the exact closed scalar descriptor projection:

| Native transition | Type suffix | Fields besides four verified scope fields |
|---|---|---|
| New native issue | `ticket-created.v1` | ticketId, ticketRef, status, priority |
| Initial urgent priority; priority enters urgent; status enters escalated | `ticket-escalated.v1` | ticketId, ticketRef, priority |
| Status enters resolved/closed from outside that group | `ticket-resolved.v1` | ticketId, ticketRef, status |

Types start `com.servicev8.business.support.`; subject is `ticket:<native id>`;
source is `urn:servicev8:app:supportv8`. Creation uses native `created_at`;
updates use the SQL statement timestamp. Repeated same-state updates emit
nothing; reopening then resolving yields another immutable event ID. An urgent
creation yields one created and one escalated fact. A voice retry yields no new
business effect or event of either type. IDs, times, envelope, canonical digest
and provenance never change during retry. No customer, summary, transcript,
reason, resolution text, category, severity or CSAT is exported in this contract.

The capture source is the actual permanent `runtime_support_workspaces` tuple:
installation_id, operation_id/acquisition_id, account_id, registry_tenant_id,
vertical_id=runtime, native_tenant_id, plus the matching tenant/domain/account
and registration owner. It requires active native workspace and ready, active,
nonrevoked registration. Voice hire/employee installation IDs remain tool effect
identity; they never select the Support app installation or destination.

The wire pin is exactly `servicev8.operational-provenance.v1`, product
`servicev8.service-app.supportv8@1.0.0`, Runtime service target, the four canonical
scope fields, two exact certificate digests and
`nativeBinding:{kind:'support-permanent-tuple'}`. Local acquisition and owner
columns are separate; no invented incarnation/epoch is added to the wire.

The existing shared registration activity observes the exact installed Registry
certificate twice between local owner checks, then persists a capture snapshot
through its current registration lease. SQL rechecks and locks the exact native
owner after the network observations. `operational_qualifications` has a permanent
FK and immutable contents. A certificate is metadata, never authorization.

Missing qualification, unsupported event declaration, unavailable/busy native
binding or standalone workspace preserves the business write and an immutable
`pending_authority` fact with a fixed reason. Such rows are never claimed or
promoted later. Qualification does not relabel history. Lifecycle lock contention
uses NOWAIT and holds the fact rather than delaying a native write on owner locks.
SQL/evidence storage failure still aborts the native transaction, as durability
requires. No historic backfill is performed.

## Shared worker and authority checks

The existing Temporal worker starts one global `support-operational-outbox-v1`
workflow on its existing task queue. It drains at most eight rows per activity,
with SQL claims capped at 64 and four rows per account per claim. Claims use
SKIP LOCKED, 30-second leases, increasing generation and fresh UUID tokens. Each
attempt has a 10-second abort deadline. Retry backoff grows from seconds to a
bounded maximum; no broker, Redis correctness dependency, cron or tenant worker
is introduced. The workflow sleeps five seconds and continues as new after 500
iterations.

Sender rechecks exact local owner, exact current installed Registry certificate
and local owner around the two observations; it compares the entire immutable
pin and validates the declared event schema. After minting the dedicated Runtime
workload token it rechecks local owner immediately before transport. Runtime
independently performs its reviewed fresh Registry/native-owner admission checks.
There is no distributed atomic revocation transaction: owner changes can race
last observation and network/receipt commit. Retained reads have separate current
source and human-policy checks; an outbox delivery status grants no human access.

Only HTTP202/accepted/nonduplicate or HTTP200/duplicate/duplicate can acknowledge.
The response must contain exactly `ok,duplicate,receiptId,inputDigest,tenantId,
accountId,sourceBinding,sourceEventId,eventType,subject,receivedAt,status`, with
matching digest/identity and valid receipt/time. SQL repeats full ACK checks and
HTTP pairing under the exact live owner/generation/token lease, and stores ACK
plus HTTP status. Partial, foreign, extra-key, invalid and stale-writer ACKs never
mark delivery. Unknown receipt outcome retries the same event and pin. Invalid
persisted facts/provenance conflicts are quarantined; owner unavailability or
revocation remains retryable without changing evidence.

## Configuration and normal provisioning

Worker-only purpose bootstrap prefixes (all suffixes required) are:

| Prefix | URL | Audience | Scope |
|---|---|---|---|
| `SUPPORT_OPERATIONAL_REGISTRY` | Trusted HTTPS Registry origin | servicev8-registry | registry:installations:read |
| `SUPPORT_OPERATIONAL_RUNTIME` | Trusted HTTPS Runtime origin | servicev8-runtime-operational-signals | runtime:operational-signals:write |

Each prefix requires `_URL`, `_WORKLOAD_ISSUER`, `_WORKLOAD_JWKS_URL`, `_CLIENT_ID`,
`_SUBJECT`, `_SECRET_FILE`. Origins permit no path/query/credentials/fragment;
issuer/JWKS use HTTPS. Secret files are absolute mounted paths. Use separate
purpose-specific client credentials mounted only into the shared worker. RS256
JWTs require exact issuer/audience/client/subject, service-account username, scope,
integer current iat/exp and lifetime <=120 seconds; tenant claims are rejected.
There is no legacy secret fallback or destination/tenant string rewrite.
Bootstrap clients/JWKS are process singletons; owner responses are never cached.
Configuration changes require normal rollout.

Provision the Registry reader in `REGISTRY_PROJECTION_WORKLOAD_CLIENT_IDS`, with
its existing `REGISTRY_WORKLOAD_OIDC_ISSUER`/`REGISTRY_WORKLOAD_JWKS_URL` verifier
and exact installed descriptor route allowlist. This is distinct from broad
Support control credentials and Runtime's own reader. Admit the separate Support
publisher client/subject/service mapping in Runtime's reviewed
`RUNTIME_OPERATIONAL_PUBLISHER_WORKLOAD_CLIENTS_JSON` and issuer/JWKS bootstrap.
Registry HTTPS nested route forwarding, Keycloak scopes, ESO/SSM purpose mounts
and owner allowlists remain controller Task3k/GitOps work.

Apply migration011 using the normal direct PostgreSQL migration owner, retaining
migrations005/008/009. Trigger and bounded worker functions are SECURITY DEFINER
with `search_path=pg_catalog,supportv8`; the definer must be the trusted migration
owner with BYPASSRLS/superuser as in the existing owner-worker pattern. PUBLIC
execution is revoked from capture/claim/finish/qualification functions. The app
has no direct evidence UPDATE or qualification INSERT grant. Tenant reads use
forced RLS. Existing `supportv8_app` gets only evidence SELECT and narrow worker
function execution; actual deployment SQL roles and least-privilege grants must
be reviewed by the migration/GitOps owner. Do not run the migration as the tenant
app role. Function execution remains a trusted backend boundary, not tenant API.

Ship one synchronized immutable image for web/API, shared worker and chat relay.
Migration comes first. Old binaries can continue native writes through the new
trigger but still contain overlapping legacy network emitters; keep publication
closed and roll every writer/worker before activation. New binaries require the
new schema for qualification/drain. Rollback to old producer images can reenable
legacy helper paths: do not do that while publisher authority is active. Preserve
new tables/trigger/evidence on rollback; never drop, rewrite or relabel facts.

Release gates: reviewed source/migration; all producer images converged; actual
exact-version certificate published/read back by its catalog owner; dedicated
credentials/allowlists/HTTPS forwarding ready; current exact local/native owner;
qualification tested on selected real installations; reviewed Runtime publisher
and retained-read lanes ready; controlled real native fact -> durable exact
Runtime receipt evidence. Activation and that acceptance proof are controller
work. No named subscriber, export grant or live source freshness is asserted here.

## Coverage and diagnostics

Every production issue SQL writer was inspected: Runtime ticket reader/writer;
chat startSession (manual web workdesk, chat/email intake), workspace/chat issue
updates and human escalation; voice create/escalate; Runtime order-handoff store;
and RAG ingestion's timeline-only update. They converge on the trigger table;
timeline/text-only writes yield no lifecycle fact. Native issue APIs retain
existing authorization/RBAC. Runtime-manager and actual voice SQL transactions
are directly tested. API/chat authorization and repository tests pass in the
existing suite; full chat/API journeys with this migration are source-inspected
capture coverage, not newly exercised end-to-end SQL/HTTP integrations.

In-memory IssueService paths do not create a durable native record and are
unsupported for operational publication. Its legacy helper calls are retired,
as are overlapping post-commit sends and the default/fabricated event script.
The separate relationship publisher can only publish its relationship type,
is not wired into this durable ticket lane and is explicitly unsupported here.
CSAT, relation assertions, external source subscriptions, solved aliases and
legacy in-memory/unbound workspaces are not certified. Native unbound writes
produce held facts; memory-only writes produce no durable event.

`operational_outbox` persists state, attempts, next attempt, fixed failure code,
lease generation and full validated receipt/HTTP status. Worker logs contain
batch counts and qualification fixed codes, never event payloads, transcripts,
secrets or raw remote errors. For authorized operator SQL diagnostics:

```sql
SELECT state,last_error_code,count(*),min(captured_at),max(attempt_count)
FROM supportv8.operational_outbox GROUP BY state,last_error_code;
```

Source qualification currently has worker fixed-code logs and an immutable
qualified_at snapshot, but no dedicated durable failed-qualification dashboard,
UI status, retention/archival job, alert rule or metrics dashboard is added.
Pending-authority facts require explicit owner review; there is deliberately no
historical requeue/promotion endpoint.

Tests use `npm test` / `node scripts/test-local-only.mjs`; CI uses that mandatory
wrapper. It strips inherited app credentials, activation, proxies and remote URLs,
allows only explicit loopback fixtures, preloads network protection into Node
children even if they try to clear NODE_OPTIONS, and rejects non-loopback fetch,
HTTP(S), sockets, shell/curl escapes. PG fixture tools and the locked esbuild
binary are the only non-Node child exceptions. This is test isolation, not an OS
security sandbox against malicious code. Remote UAT must be a separate explicitly
controlled workflow and cannot use this local-only runner.

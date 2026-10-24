# Task3c3 fix1 actual SQL resume candidate

2026-10-19. Candidate only: actual SQL GREEN and original independent review
remain pending. Parent owns the next immutable GitOps snapshot/Job. No local
Postgres/Docker, provider/API/live calls, push, merge, DevOps changes, credentials,
certificate or flag activation in this resume. Manual operator script still pins
b6 and old011: do not repurpose it to run this candidate or defeat its guards.

Source base: b6f23ec82013ed430ba731616385b1d481a8bf90
Branch: codex/support-operational-outbox-20261018
Candidate commit: recorded after commit below.
Candidate migration011 SHA256:
5d88cad8d8ac8f38dd31c2148c6c099587c6ebeac21613ca20c5277b2ec00b4b
Supersedes old011 a1d4c7b89c5278e0eab95e9cbe13d87aaf58711cde075ceaaf0de1a25b6d8dc2.

## Authoritative RED and seven-failure root causes

Parent supplied real PostgreSQL17.11 GitOps Job support-outbox-b6f23ec-red-v4,
UID488f042e-eb6c-41d0-a219-962e24f56e53, pod56cf756d-11fe-4896-9cae-a4aea8258913.
Exact b6 source31-file bundle edccded514b450acc511edcf9c7352bd68b5f7670e468a585d3e4c2e1ba66ab1:
23 cases completed,16 pass/7 fail/0 skip, exit1, no infrastructure/suite/unhandled
errors. Original evidence /tmp/olg-support-gitops-execution-20261019/actual-sql-v4-review.json
is copied into committed docs/verification/task-3c3-fix1-resume/. Runner/postgres
logs remain at the parent evidence path. This is SQL RED, never SQL success.
Parent supplied applied isolation and same-node before/after connectivity controls;
this implementer makes no new live isolation verification claim.

| Failure | Root cause and evidence | Candidate correction |
|---|---|---|
| Worker/evidence privilege restriction | postgres owner defaults grant app INSERT/UPDATE/DELETE on each new table;011 SELECT grant never subtracts inherited DML | Table-local REVOKE ALL from PUBLIC and optional app/relay/scaler before app SELECT; no default ACL changes |
| Bootstrap-inherited evidence DML | Same actual ACL result i/u/d=true against expected false | Same R2 correction; existing direct denied-write and unrelated-default probes retained |
| Unknown receipt retries leave3 facts | Concurrent retry/finish calls hit false pool-busy refusal. pg-pool queues idle checkout until nextTick; waitingCount alone does not imply exhausted capacity. Failed cleanup leaves live leases, so later valid drains show4,3,0,0 deliveries and3 still outstanding | Reserve against already-idle clients; retain deadline/abort and refuse future-release checkout. Causal mechanism reproduced hermetically; elimination of the3 actual SQL leftovers still requires next Job |
| Concurrent claims pool_busy | Direct stack from acquire while public pg idle reservation queue exists | Same narrow acquisition correction |
| Fresh owner denial sends1 | Suite retains previous rows. Concurrent case creates6 A+2 B; claim limits4 per account and a failing Promise.all leaves unfinished work. Following test revokes only B but counts sends across active A too. Even a successful capped claim can leave2 active A facts due, so global zero is wrong independently | Controller ruling approved exact B fact/tuple assertion below; no broad reset |
| Outbox lock-wait lease accepted | BEGIN freezes now();120ms lease expires during250ms wait, then completion still resolves | clock_timestamp postlock and exact final UPDATE owner/generation/token/state/live-expiry fence, raising lease loss on no write |
| Qualification lock-wait lease accepted | Same frozen transaction clock while waiting for native owner lock | Read locked job lease after owner locks; current clock recheck then, at idempotent return, and in INSERT predicate |

The three extra failures were investigated, not blanket-classified as expected
ACL/clock failures. The pool regression uses the actual installed pg Pool/Client
and a synthetic PostgreSQL protocol Duplex stream:4 warm idle connections and4
claims produced1 fulfillment+3 rejections before fix. All4 fulfill after fix;
fifth refuses while all idle capacity is reserved. No socket/server in this
hermetic proof. Existing tests cover no-idle pool capacity, pending reservation
with spare physical capacity, delayed checkout destruction, physical handshake
abort/deadline, expired ALS context isolation and unchanged business transactions.
No pg private queue mutation or new unbudgeted delayed constructor is introduced.

## Production change vs test correction

Production changes are only migrations/011_operational_outbox.sql and
src/lib/db/operational-sql-budget.ts. Existing budget/cancellation/factory code
from b6 remains; acquire now accepts waitingCount<idleCount because those
waiters reserve existing clients. waiting>=idle still refuses, even if physical
capacity remains, to avoid delayed new construction outside its budget context.
New immediate physical connections when no waiters/idle remain unchanged.

The two evidence tables revoke optional named-role and PUBLIC table privileges,
then app SELECT/worker function grants remain. Definer owner/search_path, forced
RLS, PUBLIC function execution revocation, exact native tuple/capture/pin,
12-fieldACK and native transaction paths are unchanged. SQL checks live lease
postlock and final write. Qualification holds SHARE locks on the matching owner/
job throughout, so its stored deadline cannot be extended/revoked under it; its
actual-clock checks still reject time expiry. Claim function itself is unchanged.

Test-only controller ruling: bind the exact newly created B fact to canonical
account-b/registry-b/install-b/tenant_native_b and event ID; require verification
exactly once, zero matching B sends, pending state/no ACK/no delivered time and
operational_source_denied. Native post-revocation write must still yield its
exact pending_authority fact. Active A sends use the receiver fixture and may
succeed; no assertion skip/reset/retry added. Cost if wrong: a mistaken identity
predicate could hide a denied-source send; explicit tuple/event assertions,
verified count and exact persisted fact/noACK assertions guard that risk.

The23 SQL cases remain23; two assertions' semantics are corrected within the
owner-denial case, others retained. New hermetic driver case increases budget
unit tests9->10 and affected focused total72->73. No imports/new file required
in the parent's31-file runtime/test closure: refresh these existing four paths:
- migrations/011_operational_outbox.sql
- src/lib/db/operational-sql-budget.ts
- test/operational-outbox.postgres.test.ts
- test/operational-sql-budget.test.ts
Documentation/evidence are outside that closure. Parent must regenerate source
manifest/bundle hashes/new immutable Job; old b6 snapshot is not this candidate.

## Verification and candid limits

Committed evidence docs/verification/task-3c3-fix1-resume:
- idle-checkout-red.log:9 existing pass, new actual-pg-driver case fails1/4 fulfill.
- idle-checkout-green.log:10/10 budget tests pass after production correction.
- affected-green.log:8 files/73 tests pass via node scripts/test-local-only.mjs
  selecting budget/outbox/source/workload/runtime-ticket-reader/voice-tools-route/
  managed-support-authority/managed-support-registration tests.
- negative-guard.log:3/3 selected blocks/inherits/denies cases pass; positive local
  listener case filtered1 explicitly. No live endpoint or local SQL fixture run.
- build.log: guarded controlled env Next production build passes on cached Node22.
- worker-bundle.log: guarded controlled env Temporal bundle passes1,664,998 bytes.
- typecheck.log: controlled env guarded Node22 tsc --noEmit passes after build.
  An earlier concurrently launched tsc failed TS6053 while Next regenerated
  .next/types. That invocation was invalid concurrent verification; after build,
  sequential fresh tsc passed. No source type errors were suppressed.
- git diff --check passes. No full998-suite repeat because production delta is
  narrow SQL plus acquisition predicate; native/workload/guard checks retained.

Commands (from Support worktree):
node scripts/test-local-only.mjs test/operational-sql-budget.test.ts
node scripts/test-local-only.mjs test/operational-sql-budget.test.ts test/operational-outbox.test.ts test/operational-source.test.ts test/operational-workload.test.ts test/runtime-ticket-reader.test.ts test/voice-tools-route.test.ts test/managed-support-authority.test.ts test/managed-support-registration.test.ts
node scripts/test-local-only.mjs test/local-only-network-guard.test.ts -t 'blocks|inherits|denies'
Controlled build/type/bundle use env -i, PATH to existing cached Node22.18.0 plus
/usr/bin:/bin, NODE_OPTIONS=--import=$PWD/test/local-only-network-guard.mjs;
Next adds NODE_ENV=production/NEXT_TELEMETRY_DISABLED=1. No dependency installation.
Then node node_modules/next/dist/bin/next build; after it completes,
node node_modules/typescript/bin/tsc --noEmit. Bundle uses @temporalio/worker
bundleWorkflowCode with src/lib/temporal/workflows.ts and logs code length.

R1/R2 remain OPEN until actual candidate SQL GREEN and independent re-review.
The supplied16 passing SQL tests establish prior b6 behavior only, including
actual voice/idempotency/rollback, blocked tables/local source/persistence,
pool exhaustion recovery and blocked completion. They do not establish candidate
ACLs, live leases, concurrency/retry recovery or corrected owner-denial assertions.
Next GitOps run must execute all23 with0skip/no suite or infrastructure errors,
verify effective privileges and clock-expired leases reject withoutACK, and
confirm retry/concurrent claims/denied B. Runtime paired receipt/publication,
owner-first mounted new011 migration, after-bootstrap table revokes, draft hold,
mixed writer convergence and closed activation gates remain unchanged.

# Support fix1 transitional idle-capacity candidate

2026-10-19. Supersedes5c802ef as the next source candidate, not an SQL GREEN
claim. Base5c802ef3fd3f46162891702ba6ffc8d523f1ff00. Candidate commit is recorded
in the shared SDD report after commit. Source remains held for parent immutable
GitOps SQL execution and original independent review. No localPG/Docker/live/
provider/API/DevOps/push/deploy/credential/certificate/flag actions in this round.

## Actual20PASS/3FAIL trace and root cause

Parent immutable Job support-outbox-5c802ef-qualified-v1, UID
cb2c3e93-1294-4306-966f-cb786d645f19, pod265620a4-6516-470c-90f2-5ab9f5d2f91f,
executed exact5c source31 files, bundle
f04ba0ae9f82135dcb8c444255eff6e976825d969980dce3d69cdace94ca107e,
PostgreSQL17.11:23 cases/20PASS/3FAIL/0SKIP,exit1,no infrastructure/suite errors.
Parent before/after controls07:27:15/07:27:51 and isolation acceptance remain
parent evidence; this implementer made no live check. Full original artifacts
are /tmp/olg-support-gitops-execution-20261019/{runner-fixed,postgres-fixed}.log;
actual-sql-fixed-review.json is copied here. Both actual ACL and both actual
clock-expired lease cases PASS at5c. Overall R1/R2 acceptance still needs the
complete candidate suite and independent review, not isolated passes alone.

Remaining failures individually:
1. Unknown-receipt retry: still3 undelivered. Completion rejection leaves a live
   lease; later valid drains claim4,3,0,0. Actual SQL persistence not yet repaired
   by the previous full-idle-only rule.
2. Concurrent claims: direct operational_sql_pool_busy stack at acquire63.
3. Exact revoked-B: verification count1 and zeroB sends pass; persisted state is
   pending/noACK/no delivered timestamp, but last_error_code actual null rather
   than operational_source_denied. Thus denial was exercised, while completion
   persistence failed. No authority predicate/assertion is weakened.

pg-pool schedules idle checkout via nextTick while its waitingCount reserves
existing idle clients. With totalCount<max, waiting>=idle can be transient: after
that already-scheduled work consumes idle clients, the same caller can construct
a new client immediately within its own budget. Our5c rule refused too early.
The previous4-warm/max4 proof never exercised spare physical capacity. Public
Pool/Client protocol-stream reproductions with1/2 warm clients now show failures
for both claims and retry(source_denied) finishes:1 or2 fulfill and3 or2 refuse.
These share the exact completion/claim path behind all3 real failures. Actual
elimination of all3 remains the next GitOps Job's obligation.

## Narrow correction and proof

Only production change is src/lib/db/operational-sql-budget.ts. When queued
reservations consume idle capacity AND totalCount<max, yield one setImmediate
turn with abort handler and deadline timer; clear both plus listener on settle.
Do not call connect or enqueue this caller during the yield. Re-read public
waiting/idle/total counts before connect. If checkout still needs a future
release or deferred new constructor, refuse. True full pool still refuses
without queueing. No loop, wait for client release, global option mutation,
private queue access, native business change or SQL timeout change. Physical
construction after recheck remains inside synchronous ALS budget scope.

Seven new hermetic regressions on top of10 prior cases:
- claim and retry/source_denied finish with1 or2 warm clients/max4, four
  simultaneous operations across3 repeated batches. Protocol replies deliberately
  cross an event-loop turn, keeping warm clients busy so new clients actually
  construct; totalCount reaches4, waitingCount returns0, every promise fulfills.
- cancellation during transitional recheck: deadline rejection,0connect calls,
  existing unrelated pending count unchanged.
- real pg physical handshake after the yield: explicit abort and wall deadline
  both destroy the new silent stream, leave0 pending waiters and only the
  deliberately held unrelated client. No late socket/borrow leak.

Final exact17-test regression against temporarily restored5c utility:7 fail,
10 pass,exit1 (driver-red.log); candidate bytes restored in finally and asserted
identical before final verification. Candidate17/17 driver-green. This is a
real pg public driver on synthetic streams, not a server or SQL persistence
proof; retry/source_denied arguments reach completion calls but only actual SQL
can prove the final stored code/ACK. Existing full-pool/fifth checkout refusal,
late checkout cleanup, deadline/abort, ALS isolation and normal native branch
assertions remain unchanged. The23-case SQL file is unchanged in this round,
including exact B persisted error/noACK assertions and retry delivery assertions.

## Available verification and next gates

Evidence in this directory:
- driver-red.log:7 fail/10 pass on5c utility with final regressions.
- driver-green.log:17/17 on candidate.
- affected-green.log:8 files/80 tests pass (same73 scope plus7 new driver cases).
- negative-guard.log:3 pass,1 explicitly filtered positive-loopback listener.
- build.log: controlled guarded cached Node22 production Next build PASS.
- worker-bundle.log: guarded Temporal bundle PASS1,664,998 bytes.
- typecheck.log: guarded controlled Node22 tsc --noEmit PASS, sequential after
  build so no .next/types race. Empty output is the actual successful tsc output.
- git diff --check passes. No broad full-suite rerun or dependency installation.

Tests use env -i PATH=<existing cached Node22.18.0 bin>:/usr/bin:/bin NODE_ENV=test
node scripts/test-local-only.mjs, selecting operational-sql-budget/outbox/source/
workload/runtime-ticket-reader/voice-tools-route/managed-support-authority/
managed-support-registration. Guard file uses -t 'blocks|inherits|denies'. Build
adds NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 and
NODE_OPTIONS=--import=$PWD/test/local-only-network-guard.mjs; invokes local
node_modules/next/dist/bin/next build. Typecheck after build invokes local
node_modules/typescript/bin/tsc --noEmit with guard. Bundle uses existing
@temporalio/worker bundleWorkflowCode for src/lib/temporal/workflows.ts.

Migration011 is unchanged from5c, SHA256
5d88cad8d8ac8f38dd31c2148c6c099587c6ebeac21613ca20c5277b2ec00b4b.
Parent31-file closure needs only existing budget utility and budget-test bytes
refreshed; no file/import additions. Parent must generate a new exact revision/
bundle hash and immutable Job. Next actual23-case run must pass retry recovery,
concurrent tenant progress and exact denied-B persisted source_denied in addition
to all20 passing cases. No actual candidate SQL GREEN claim is made. Draft,
owner-first mounted migration/revoke-after-broad-bootstrap, mixed-fleet,
independent review and activation holds stay. Historical incident limits remain
unchanged; no new external test requests occurred.

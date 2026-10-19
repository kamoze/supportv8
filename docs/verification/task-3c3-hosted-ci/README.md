# Support hosted CI correction and required native gate

2026-10-19. Base9d4d1a10f7a984115ef50de5d4c8f684b9cf2df2. Hosted CI candidate
commit recorded in the shared SDD after commit. No push, main merge, deployment,
production activation, provider/live/API calls, Docker or local SQL run. Parent
owns independent review, pushing the same DRAFT Support40 and observing GHA.

## Hosted failures and narrow changes

Fresh GHA39218707923/job117948647671 failed two files before migrations/build:
storefront test's Pool-only pg mock omitted Client, breaking the budget subclass
import; and GHA direct npx vitest bypassed the mandatory runner, so the child
guard test saw no NODE_OPTIONS. Only specific failure excerpts were inspected;
no full hosted secrets/config log was printed or copied into this evidence.

The storefront mock now partially imports actual pg, retaining Client and other
exports, while named/default Pool both remain mocked with query/connect spies.
No production fallback or extra production export was added. The other old pg
mock passed the full suite without edits.

GHA unit, four native workspace suites and standalone boundary now use
scripts/test-local-only.mjs. CircleCI already used that runner: no analogous
bypass remained, but its operational SQL step followed role-creating workspace
fixtures. Both CI configurations now run the required operational23 gate BEFORE
those fixtures, retaining the old four native suites, rehearsal/build/standalone
coverage and explicit fixture URLs. Existing PG17-alpine service, test-only
password, Redis service/opt-ins, Node/dependency setup, inherited npm-ci fallback,
release filters and image/GitOps jobs are unchanged.

New scripts/test-operational-sql-ci.mjs requires an explicit postgres admin
fixture on127.0.0.1:5432 or55489/postgres before dispatch. Missing/invalid env fails,
never silently skips. It creates a fresh unique report location and invokes
only the existing mandatory wrapper against the exact native test file, with
fixed reporter arguments and a reduced env. It preserves actual failed runner
exit, signal/error and hence hook/runtime failures BEFORE accepting JSON counts.
Successful exit also requires report success, exact23 total/passed, zero failed/
pending/todo, one exact passed native file with empty suite message,23 unique
correct-suite assertion names, every status passed and no assertion failures.
Missing/malformed/zero/skipped/duplicate/wrong-file/hook-failed reports fail.
A fabricated count can never override failed execution. No retry, optional flag,
continue-on-error or passWithNoTests. GHA step timeout3min, Circle no-output3min.
Reports are retained in the printed runner-temp directory for CI diagnostics;
actual hosted SQL execution remains pending this candidate's GHA run.

## Evidence and commands

Committed docs/verification/task-3c3-hosted-ci/:
- mock-red.log: original mock reproduces missing Client export before collection.
- wrapper-red.log: original direct invocation reproduces undefined NODE_OPTIONS
  in the inherits guard assertion, before child dispatch. Guard setup protected
  the parent; selected test initiated no network call.
- gate-contract-red.log:11 assertion failures with a no-op helper skeleton and
  old workflows; no DB was contacted. The initial missing-module collection
  diagnostic was replaced by this meaningful contract RED.
- focused-green.log:3files,18PASS/1explicit positive-loopback case filtered;
  mock4 + new gate11 + negative/child guard3 all pass.
- full-suite-summary.log: actual approved complete guarded run159filesPASS/
  14opt-in filesSKIP;1026PASS/59opt-inSKIP,total1085;exit0/no reported errors.
  Full actual controlled log remains /tmp/support-hosted-full-approved.log.
- qualified-closure.log: actual31 source path SHA checks all unchanged, and Git
  diff vs9d on those31 paths empty;011 SHA unchanged below.
- prior-qualified-sql-summary.json: parent GitOps23/23 proof, distinct from the
  default unit run or this new hosted gate. No new local SQL claim.

Commands use env -i PATH=<existing cached Node22.18.0 bin>:/usr/bin:/bin
NODE_ENV=test then:
node scripts/test-local-only.mjs test/storefront-guest-support-integration.test.ts
node node_modules/vitest/vitest.mjs run test/local-only-network-guard.test.ts -t inherits
(the second is the deliberately scoped original-bypass RED only).
node scripts/test-local-only.mjs test/hosted-native-sql-gate.test.ts
node scripts/test-local-only.mjs test/storefront-guest-support-integration.test.ts test/hosted-native-sql-gate.test.ts test/local-only-network-guard.test.ts -t 'recognizes|preserves|applies|ToolPlanner|native|requires|blocks|inherits|denies'
node scripts/test-local-only.mjs

The first ordinary focused/full attempts were invalid for the positive owned
HTTP fixture: sandbox listen127.0.0.1 EPERM,1timed-out test/1unhandled error;
full had1025PASS/1FAIL/59SKIP. A single normal require_escalated approved full
controlled rerun then passed1026/59 above, including the positive HTTP fixture.
No guard weakening/skip was used to get complete-suite GREEN. SQL env flags
were absent for both unit runs; the59 skips include intentionally opt-in native/
Redis suites and do not substitute for required native23 hosted execution.

New gate tests cover successful unique report, nonzero real exit, missing report,
7 invalid report shapes, missing/nonloopback env and actual child CLI absent-env
failure before any test dispatch. Workflow contracts cover wrapper/no direct
Vitest and native gate ordering/env in both CI files. Both YAML files parsed
with existing PyYAML, no dependency installed. git diff --check passes.
No typecheck/build repetition: no production TS/export/qualified source change.

## Qualified source proof and remaining gates

All31 paths in the actual9d transition-source-manifest.json match their recorded
SHA256 and Git9d bytes. Qualified bundle
0007251e15e22821fecc59620e6993dd869d365feb192b33f251f1ba0a3cfc0f remains the
same source bytes, though the CI commit HEAD changes. Migration011 remains
5d88cad8d8ac8f38dd31c2148c6c099587c6ebeac21613ca20c5277b2ec00b4b.
Neither production files, package/lock, native23 SQL file, wrapper/guard nor
Vitest config changed. Existing actual GitOps PG17.11 proof remains23PASS/
0FAIL/0SKIP/no infrastructure errors at9d (parent-owned artifact).

Parent must independently review this CI/mock/helper delta then publish only
to the same DRAFT40 and verify fresh hosted full-unit + required23 native +
old native + build + standalone steps. The new gate has been tested hermetically
for rejection/validation, not run against SQL locally. Both GitOps proof and
hosted qualification are required; neither replaces the other. Owner-first
immutable011/revokes-after-broad-bootstrap, mixed fleet convergence, source PR
main-merge hold and closed production activation remain unchanged. Historical
unintended-request incident limits remain unchanged; no new external requests.

Committed log whitespace is normalized (line ends/terminal blank lines only); substantive command output/counts are unchanged.

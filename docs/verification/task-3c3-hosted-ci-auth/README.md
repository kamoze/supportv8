# Support hosted CI disposable PostgreSQL authentication correction

2026-10-19. Baseed77db010892831b6e661d5dea06e548736245fc. Frozen follow-up
commit recorded in the shared SDD after commit. No production source, qualified
31-file closure, migration011 or actual native SQL assertions changed. Parent
owns independent review, push to the same DRAFT40 and fresh hosted execution.

Actual GHA39252496172/job118059500594: unitsPASS; mandatory native23 failed
22/1PASS plus afterAll hook timeout. Earliest restricted-app connection error is
password authentication failed for user supportv8_app. Qualified fixture creates
LOGIN roles without passwords and replaces only URL username, retaining the
synthetic admin password. Existing hosted PG17 service required password auth;
the isolated GitOps fixture uses loopback trust. Fact-dependent undefined-row
failures and cleanup timeout cascade after failed app connections; this is not
new evidence of a production budget defect, and no SQL success is inferred.
Only narrow auth/count/hook excerpts are copied from the private hosted log:
docs/verification/task-3c3-hosted-ci-auth/observed-hosted-failure.log. Full log and
secrets/env were not printed/copied. Existing GitOps9d23/23 proof is unchanged;
fresh hosted parity has not yet been established.

Minimal service-only change: POSTGRES_HOST_AUTH_METHOD=trust in the existing
GitHub Actions and CircleCI disposable PostgreSQL17-alpine service environments.
Comments explain passwordless restricted fixture roles. Existing test synthetic
POSTGRES_PASSWORD and exact admin URLs remain unchanged. GitHub exposed port is
explicit127.0.0.1:5432:5432, rather than all host interfaces. CircleCI service
stays in its isolated shared-loopback job network. No production auth setting,
role password, secret or app configuration changed. Required strict23 report
gate, local-only wrapper/guard, fresh-role ordering and all other suites/build
remain unchanged; no skip/retry/optional gate or SQL assertion weakening.

Focused contracts scope exact service blocks, requiring PostgreSQL17, fixture
trust env and GHA loopback binding. No generic whole-file trust match. Exact
final13-case test file against restored originaled77 workflow bytes:2FAIL/
11PASS/exit1. Candidate workflow bytes restored in finally; then13PASS/exit0.
An intermediate contract needed its end-of-service newline boundary corrected;
final RED was rerun against original workflows so evidence uses final assertions.

Command (controlled cached Node22.18.0; no SQL env flags):
env -i PATH=<cached Node22 bin>:/usr/bin:/bin NODE_ENV=test node scripts/test-local-only.mjs test/hosted-native-sql-gate.test.ts

Evidence: contracts-red.log, contracts-green.log, qualified-closure.log and
narrow observed-hosted-failure.log. Existing PyYAML parses both workflows;
git diff --check passes. No full-unit/typecheck/build repetition was needed for
this CI-service-only authentication change. No SQL, Docker, provider/API/live
calls, push, deploy or production activation occurred. No commands remain running.

Actual transition-source-manifest31-file SHA256 matches all current paths, and
Git diff vs qualified9d on every closure path is empty. Qualified source bundle:
0007251e15e22821fecc59620e6993dd869d365feb192b33f251f1ba0a3cfc0f.
Migration011 unchanged:
5d88cad8d8ac8f38dd31c2148c6c099587c6ebeac21613ca20c5277b2ec00b4b.
Changes are two CI YAML files, hosted CI contract test (outside closure), and
this evidence/report. No new GitOps source snapshot is implied by changed HEAD.

Pending: parent independent review, push only same DRAFT40, fresh hosted native
23 unique/unskippedPASS with successful cleanup, and remaining hosted gates.
Production migration owner-first/source main-merge/activation holds remain.
Historical unintended request incident and finite evidence limits unchanged.
Committed log whitespace is normalized only; assertions/counts are unchanged.

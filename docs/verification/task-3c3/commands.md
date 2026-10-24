# Task3c3 local verification commands

Run from the Support worktree. All SQL URLs below refer to explicitly task-owned
loopback fixtures; never substitute a live database. The local-only wrapper is
mandatory and clears inherited application configuration/credentials.

```sh
node scripts/test-local-only.mjs
SUPPORT_OPERATIONAL_TEST_ADMIN_URL=postgres://postgres@127.0.0.1:55489/postgres node scripts/test-local-only.mjs test/operational-outbox.postgres.test.ts
node scripts/test-local-only.mjs test/local-only-network-guard.test.ts test/operational-workload.test.ts
SUPPORTV8_REAL_POSTGRES=1 SUPPORTV8_WORKSPACE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:52996/support_runtime_rbac_test node scripts/test-local-only.mjs test/runtime-ticket-write.postgres.test.ts
SUPPORTV8_REAL_POSTGRES=1 SUPPORTV8_WORKSPACE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:52996/support_runtime_handoff_test node scripts/test-local-only.mjs test/runtime-support-access.postgres.test.ts
SUPPORTV8_REAL_POSTGRES=1 SUPPORTV8_WORKSPACE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:52996/support_runtime_handoff_test node scripts/test-local-only.mjs test/runtime-support-workspace.postgres.test.ts
SUPPORTV8_REAL_POSTGRES=1 SUPPORTV8_WORKSPACE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:52996/support_runtime_handoff_test node scripts/test-local-only.mjs test/runtime-support-handoff.postgres.test.ts
MANAGED_SUPPORT_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:53097/support_managed_bridge_test node scripts/test-local-only.mjs test/managed-support.postgres.test.ts
MANAGED_SUPPORT_SOURCE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:53097/support_managed_source_test node scripts/test-local-only.mjs test/managed-support-source.postgres.test.ts
SUPPORT_MANAGED_LIFECYCLE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:53097/support_managed_lifecycle_test node scripts/test-local-only.mjs test/managed-support-registration.postgres.test.ts
SUPPORT_MANAGED_PERMANENT_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:53097/support_managed_permanent_test node scripts/test-local-only.mjs test/managed-support-permanent.postgres.test.ts
SUPPORTV8_NEXT_STANDALONE_PROOF=1 SUPPORTV8_WORKSPACE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:52996/support_runtime_handoff_test node scripts/test-local-only.mjs test/runtime-support-next-standalone.test.ts
npm run typecheck
env -i PATH="$PATH" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--import=$PWD/test/local-only-network-guard.mjs" node node_modules/next/dist/bin/next build
node --import ./test/local-only-network-guard.mjs --input-type=module -e 'import {bundleWorkflowCode} from "@temporalio/worker"; import path from "node:path"; const result=await bundleWorkflowCode({workflowsPath:path.resolve("src/lib/temporal/workflows.ts")}); console.log("bundle_bytes",result.code.length);'
git diff --check
```

Full-suite/build evidence files named `*-summary.log` intentionally preserve the
actual final output summary, not all unrelated fixture console output. Other log
files preserve complete passing command output. SQL suites share cluster-global
fixture role names in older tests; run existing managed/workspace suites serially.
New outbox suite creates its own unique database/role and removes them.

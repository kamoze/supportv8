# Runtime workspace access projection

Source candidate on base `7807cd08fd92542db1eede459444b005e646d1dd`. Not deployed or CircleCI-qualified.

## Contract and scope

Support uses Registry's product-bound `/v1/workspace-access/:tenantId/read` and `/receipt` POST contracts. Every request includes the exact account, installation and `servicev8.service-app.supportv8` product. `support.standard-groups.v1` maps canonical Admin to `support:manage`, Member/Viewer to `support:read`; protected Owner remains a separate canonical role. Canonical ordinary groups must be one immutable UUID from Registry's mapped response. Unknown/missing mappings block. Suspended/removed membership revokes.

Existing immutable `runtime_support_workspaces` tuples identify eligible targets. No standalone workspace, external connection, new tenant or credential is provisioned. The projection key is installation plus exact identity subject, with tenant/account/native workspace RLS. Members need not be the original provisioning owner. Every protected operation still checks current Registry membership, installation entitlement and native binding; when enabled it also reads the current revisioned canonical group mapping using the dedicated workload, rejecting unavailable or unmapped authority. The projection can only reduce that authority. Stale revocation records remain restrictive until a newer revision is reconciled. Explicit local deny and capability ceilings are never overwritten.

A synced receipt states that the canonical projection revision was applied; it does not supersede local restrictions. PostgreSQL compares revisions before upsert; duplicate/older delivery preserves the current receipt. A fresh read is made per subject before applying. Registry acknowledgement precedes cursor advancement, so delivery failure retries the same page. Same-revision canonical receipts remain immutable at Registry.

## Activation and operation

Apply additive `migrations/014_runtime_access_projection.sql` using the existing migration owner/GitOps Job process before setting `SUPPORTV8_WORKSPACE_ACCESS_SYNC_ENABLED=true`. The flag defaults off, and the receiver does not query projection tables while off. The migration follows existing `supportv8_app` grants and migration-owner/BYPASSRLS worker function conventions.

Configure an existing dedicated workload identity through `SUPPORTV8_ACCESS_REGISTRY_CLIENT_ID`, `SUPPORTV8_ACCESS_REGISTRY_CLIENT_SECRET`, `SERVICEV8_OIDC_ISSUER` and `REGISTRY_URL`. Registry must allowlist the exact workload/client/product with `registry:workspace-access:read` and `registry:workspace-access:receipt`, audience `servicev8-registry`. There is no shared-secret or ordinary-reader credential fallback. No production identity or secret was created.

The existing Temporal worker starts `runtimeWorkspaceAccessWorkflow` when enabled. It scans at most four local Runtime installations per cycle, reconciles 25 subjects per installation page, sleeps 30 seconds, and continues as new after 100 cycles while retaining the inventory cursor. Member cursors and revision receipts are durable PostgreSQL records. Failures retry after exponential backoff from 30 seconds to one hour; eight failures hold the installation in dead letter. Successful pages clear failure state. App-down failure does not roll back Registry membership.

Use `SUPPORTV8_WORKSPACE_ACCESS_SYNC_WORKER_DISABLED=true` to pause reconciliation while keeping projection restrictions enforced. After activation, keep the enforcement flag enabled when pausing/rolling back the worker; disabling it returns to the pre-projection authorization path.

Operator repair for an already linked installation, with the same workload credentials:

```
npx tsx scripts/reconcile-runtime-access.ts ACCOUNT TENANT INSTALLATION NATIVE_WORKSPACE --retry
```

This resets only retry/backoff and runs one bounded page. It does not change roles, install an app or bypass canonical authority. No public retry route was added. Cursor failure counters, safe error codes and next-attempt/dead-letter fields are stored locally. Projection revisions append immutable accounting rows without credentials or message content. OLG event descriptor qualification and delivery remain pending; no unregistered event was invented.

## Verification on h5

All tests/build checks ran remotely under `/home/kamo/sv8-validation/support-user-sync`; no local test/build ran. Source copy excluded `.git`, dependency/build trees, environment files and secret/credential files. The PostgreSQL 18 fixture was created under that directory and bound to `127.0.0.1:52996`, with synthetic records only.

Hosted CI already runs all unit suites through `scripts/test-local-only.mjs`; the existing durable ticket PostgreSQL step now also exercises migration 014, worker inventory/backoff, receipts and Viewer restrictions. No extra build job was added.

Commands:

```
npm ci --ignore-scripts --no-audit --no-fund
SUPPORTV8_REAL_POSTGRES=1 SUPPORTV8_WORKSPACE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:52996/support_runtime_rbac_test npx vitest run test/runtime-ticket-write.postgres.test.ts test/runtime-access-projection.test.ts test/runtime-access-projection-client.test.ts test/runtime-access-reconciler.test.ts test/runtime-support-access.test.ts test/runtime-native-auth.test.ts test/runtime-support-handoff.test.ts test/runtime-ticket-reader.test.ts
SUPPORTV8_REAL_POSTGRES=1 SUPPORTV8_WORKSPACE_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:52996/support_runtime_access_test npx vitest run test/runtime-support-access.postgres.test.ts test/runtime-access-reconciler.test.ts
npx tsc --noEmit
```

The primary run passed 98 tests across eight suites, including genuine PostgreSQL RLS, duplicate/reordered revisions, local deny retention, immutable audit, cursor retry and Viewer domain create/update refusal. Native Viewer requests also reject customer chat intake and execution; existing Member customer intake behavior remains unchanged. Workload transport tests verify exact scope/product and missing-credential failure, using an injected transport rather than live Identity/Registry.

Expected red checks before implementation: Viewer access was null; Runtime Viewer launch rejected; Viewer native chat POST incorrectly succeeded; missing projection module; retry method absent. Qualification setup initially rejected a Docker fixture because its database server address was not loopback; the existing safety assertion was preserved and a native loopback fixture replaced it. A new `FOR SHARE` query needed excess fixture privileges and was removed: current access already rechecks installation, so cache writes need no workspace update grant. A temporary isolated Runtime launch test copy caused two typecheck missing-import errors; it was archived outside TypeScript source extensions, then typecheck passed.

Runtime's companion change is limited to `src/lib/support-handoff.ts` and its test on the Runtime candidate branch. Its exact copied unit suite passed eight tests after the receiver's no-write database proof. The flag-off original-schema PostgreSQL regression plus worker pause tests passed 10 tests. Typecheck passed with no output. Required CircleCI, deployed migration/configuration, real workload claims, live Registry integration, OLG delivery and end-to-end user acceptance remain separate qualification gates.

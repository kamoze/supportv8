# Support workspace access receipt verification

Support stores the exact request payload, receipt ID, positive receiver sequence and local policy snapshot in a scope-bound PostgreSQL row. The canonical projection and receipt update in one transaction. A same-revision local deny or effective ceiling yields Blocked without removing a permitted read. Reconciliation isolates member read, apply and receipt failures. It backs off the affected member for the current revision and keeps moving through the page. A new revision bypasses the old hold. An acknowledgement retry uses the same persisted payload.

On h5, five prepared unit assertions failed against the old receiver, and two restricted PostgreSQL regressions failed because the sequence was absent. The corrected source passed 102 checks across eight suites using the migrated PostgreSQL 18 fixture, 10 gate-off and worker checks, and TypeScript checking. The fixtures used only synthetic data and loopback connections.

The cross-service rehearsal ran the Support client and reconciler through Registry’s HTTP request handler and `PostgresWorkspaceAccess`, with both migrated stores on the same synthetic PostgreSQL fixture and the Support app restricted by RLS. It exercised admin application, exact duplicate acknowledgement, same-revision local ceiling, a lost acknowledgement, exact retry through a fresh Support store instance, Viewer downgrade, the deletion tombstone and foreign-account denial. Registry’s exact read schema required omitting `productId` from read bodies. The workload and installation still bind reads to Support.

Reproduce the cross-service rehearsal on h5 from `/home/kamo/sv8-validation/support-user-sync` with a fresh empty loopback `support_contract_test` database on port 52996, an unprivileged `supportv8_app` login, and the sibling `registry-user-sync` source and dependencies.

```sh
node --import ./test/local-only-network-guard.mjs --import tsx scripts/verify-workspace-access-contract.mjs
```

The rehearsal substituted in-process transport, fixture Identity tokens and a scoped fixture entitlement resolver. Hosted CI, production migration and runtime configuration, live workload claims, OLG delivery and end-to-end tenant acceptance remain unverified.

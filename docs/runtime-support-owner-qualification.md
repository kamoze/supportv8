# Runtime Support owner-boundary qualification

The Runtime workspace reservation now has a private, authenticated Support owner endpoint at `POST /internal/service-app/v1/provision`. It accepts only a dedicated, configured Registry workload credential and preserves the approved account, Registry tenant, installation, operation, subject, vertical, and domain scope. Missing workload configuration fails closed. This is a partial owner boundary, not full service-app qualification. It creates no employee, entitlement, charge, plan inclusion, pool binding, managed connection, login session, or capability grant.

## Verified persistence boundary

The disposable PostgreSQL rehearsal applies the existing email binding migration and migration 005 to a minimal native Support tenant schema that begins with the former account-wide unique index. It verifies exact concurrent retry and restart, every immutable scope field, operation reuse, domain and native-ID collision rollback, a successful retry after removing the collision, tombstone non-resurrection, physical mapping deletion denial, state rollback denial, wrong-native and absent-scope reads, cross-account and cross-Registry reads and writes, mapped native ownership immutability, and multiple Registry workspaces in one account.

The same database also exercises the production `PostgresTenantReservationBackend` and `ChatRepository.validateAndBindEmailChannel` implementations. A native signup tenant is reserved after migration 005, bound to an account already used by mapped Runtime workspaces, and its persisted email binding is read through the tenant-scoped session. This confirms replacement of the account unique index does not substitute tenant identity or break the existing native caller.

## Remaining owner contracts

These are release blockers for callable Support provisioning:

- **Registry caller and publication:** Support now verifies a short-lived, audience-bound Registry workload credential and calls the reservation store. Registry must still implement its caller after current plan and admin checks and register the product/version owner. Browser authentication cannot authorize provisioning, and the Support endpoint does not make acquisition decisions.
- **Shared-pool and managed connection:** Support has no verified Forge shared-pool binding and credit-settlement contract, or Action Gateway managed connector evidence contract. Knowledge's Forge `/v1/service-apps/knowledge/bind-pool` owner path is Knowledge-specific and is not a Support adapter. Future Support-specific owner responses must prove the exact account, metering tenant, external workspace, pool binding, and managed connection state. Reservation success cannot stand in for pool or connection readiness.
- **Replay-protected tenant SSO:** existing native login and handoff paths do not establish an installation-scoped Runtime-to-Support session with current Registry membership and entitlement rechecks. A future handoff must verify signed short-lived audience-bound claims, consume replay identity, map roles explicitly, and carry exact account/Registry tenant/installation/workspace scope through every request.
- **Durable ticket workspace:** the general issues UI still combines mock-backed data with chat-specific persistence and does not provide a qualified tenant-scoped list/detail/update path for all persisted Support issue sources. Callable provisioning cannot claim a usable home workspace until voice and Runtime handoff receipts resolve in the durable UI.
- **Capability enforcement:** current voice and order-handoff entry points have their own product and workload scopes. They are not Runtime service-app grants. Future managed operations need an explicit allowlist, exact installation/workspace target validation, fresh Registry authority, and existing idempotent admission for writes. The same employee requirement must be implemented as scoped identity continuity; it must not create a second hire or billing record.

Current commercial policy remains authoritative. A plan that excludes Support must continue to deny acquisition until Registry publication and the contracts above are implemented and verified.

# Runtime Support workspace reservation

This internal persistence boundary reserves a native Support workspace for an already-authorized Runtime installation. It does not expose an HTTP route and does not assert entitlement, plan inclusion, employee permission, shared-pool binding, managed connection, or service-app readiness. Its only successful state is `workspace_created`.

The immutable owner scope is the exact tuple `accountId`, `registryTenantId`, `installationId`, `operationId`, `tenantDomain`, `subject`, and `verticalId: runtime`, plus the optional display name. A SHA-256 scope identity produces a canonical native tenant identifier; the reservation and native tenant are inserted in one transaction. Existing tenant or domain collisions fail and roll back rather than adopting the existing workspace. Exact retry returns the stored mapping. Tombstones remain stored and cannot be reacquired.

## Account index audit

Migration 003's `uq_supportv8_tenants_servicev8_account` prevented two Registry tenants in one ServiceV8 account from owning distinct native Support workspaces. The migration replaces it with the nonunique `idx_supportv8_tenants_servicev8_account` lookup index.

Every existing account-sensitive tenant lookup remains keyed by exact native tenant ID:

- `support-voice-store.ts` and `order-handoff-store.ts` query `supportv8.tenants WHERE id=$1`, then compare the stored account at their domain boundary.
- the Sophia launch binding updates `WHERE id=$1` and refuses a different existing account;
- email channel binding in `chat-repository.ts` locks `supportv8.tenants WHERE id=$1`, rejects an account mismatch, and keys channel state by native `tenant_id`.

No application lookup selects a tenant by `servicev8_account_id` alone. Existing account associations are therefore preserved, while the new nonunique index retains efficient account-oriented diagnostics without making the account an interchangeable tenant identity.

## Database boundary

`runtime_support_workspaces` uses FORCE RLS with the exact native tenant, account, and Registry tenant transaction-local settings. A mapping trigger rejects identity changes, resurrection, invalid state transitions, and physical mapping deletion. A composite foreign key binds the mapping to the native tenant ID, domain, and account, so native ownership drift and native tenant deletion fail at the database boundary. Exact retries also re-read and verify that native owner tuple. The module reuses the existing PostgreSQL pool and transaction session; it has no in-memory fallback.

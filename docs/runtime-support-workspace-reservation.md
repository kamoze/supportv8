# Runtime Support workspace reservation

This internal persistence boundary reserves a native Support workspace for an already-authorized Runtime installation. The private `POST /internal/service-app/v1/provision` owner endpoint exposes it only to a dedicated configured Registry workload using a short-lived RS256 credential with audience `supportv8` and exact provision scope. The endpoint does not assert entitlement, plan inclusion, employee permission, shared-pool binding, managed connection, or service-app readiness. Its successful response reports `workspace_created` with `readiness: configuration_required`.

The endpoint authenticates before reading its bounded request body, rejects unknown fields and query parameters, and requires the exact immutable scope below. Optional account and Registry tenant JWT claims must match the body. Configuration uses `SUPPORTV8_PROVISION_WORKLOAD_ISSUER`, `SUPPORTV8_PROVISION_WORKLOAD_CLIENT_IDS`, and optionally `SUPPORTV8_PROVISION_WORKLOAD_JWKS_URL`; it does not fall back to a broader Runtime workload allowlist.

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

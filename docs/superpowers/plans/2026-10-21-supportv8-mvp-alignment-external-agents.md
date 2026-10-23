# SupportV8 MVP Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one production-grade, tenant-safe SupportV8 MVP path from a connected Zendesk source through normalized intelligence and Agentic Chat to an audited Action Gateway write-back.

**Architecture:** Zendesk credentials and provider effects remain in `servicev8-action-gateway`. Action Gateway verifies provider webhooks and forwards a signed, tenant-bound normalized envelope to SupportV8. SupportV8 persists raw expiring interactions and durable derived intelligence in PostgreSQL under forced RLS, computes Issues/Problems/Trends/Overview from those records, and submits every external mutation back through Action Gateway.

**Tech Stack:** Next.js 15, TypeScript, PostgreSQL 16 with forced RLS, Redis, Temporal, ServiceV8 Action Gateway, Zendesk Webhooks and Ticketing API, Kubernetes/Argo CD, Vitest.

**Spec:** `../docsv8/supportv8/supportV8_design_spec_v0.3.md` sections 28-31.

## Global Constraints

- Provider credentials never enter SupportV8, browser bundles, logs, database rows, or webhook payloads. Action Gateway exclusively owns Zendesk credentials.
- A tenant identifier from a query string or ordinary client header is never authorization. Tenant scope comes from a verified browser/runtime identity or a verified workload token.
- Every tenant-owned PostgreSQL table must use `tenant_id`, `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and an exact `USING` plus `WITH CHECK` policy based on `app.current_tenant_id`.
- New tenants return empty durable states. No mock, demo, or seeded fallback is permitted outside explicitly isolated test fixtures.
- Raw interaction payloads are expiring context. Issues, Problems, classifications, action audit receipts, and source references are durable derived intelligence.
- All external mutations traverse Action Gateway with deterministic idempotency keys. SupportV8 may not call Zendesk directly.
- The first supported connector is Zendesk. Intercom and Freshdesk stay out of this MVP.
- Schema changes deploy through a version-bumped Kubernetes Job in `servicev8-devops/apps/supportv8`; never edit an already-applied migration in place.
- Database and provider behavior must be proven against disposable PostgreSQL and a Zendesk sandbox. Mock-only tests cannot satisfy an MVP acceptance gate.
- Each pull request must contain one independently reviewable workstream and must not be merged before its dependencies in the merge-order table.

## External Agent Work Allocation

| Agent | Workstream | Repository ownership | May start | Depends on |
|---|---|---|---|---|
| A | API security boundary | `supportv8` routes/tests | Immediately | None |
| B | Durable MVP data plane | `supportv8` migrations/repository/tests | Immediately | None |
| C | Zendesk connector plane | `servicev8-action-gateway` | Immediately | None |
| D | Inbound interaction pipeline | `supportv8` connector/worker/tests | After B contracts freeze | B, C envelope contract |
| E | Intelligence projections | `supportv8` services/routes/tests | After B | B, D |
| F | Governed write-back | `supportv8` Action Gateway client/routes/tests | After C | A, C, E |
| G | Retention and observability | `supportv8` worker/routes/tests | After B | A, B |
| H | GitOps and acceptance | `servicev8-devops`, QA evidence | After contracts freeze | A-G |

Agents A, B, and C may work in parallel. Agents D-G must rebase after their listed dependencies merge. Agent H owns no application behavior and must reject deployment if any required evidence is missing.

## Merge Order

1. PR-A: route authentication and tenant isolation.
2. PR-B: forward-only schema plus tenant repository.
3. PR-C: Action Gateway Zendesk provider, setup, webhook verification, and outbound ticket update.
4. PR-D: SupportV8 private ingestion and durable processing.
5. PR-E: Issues, Problems, Trends, Overview, Sources, Policies, and Chat backed by PostgreSQL.
6. PR-F: governed write-back and durable action receipts.
7. PR-G: retention and production observability.
8. PR-H: GitOps deployment, sandbox connector, and acceptance evidence.

---

### Task 1: Freeze Executable MVP Acceptance Contracts

**Owner:** Agent A

**Files:**
- Create: `test/mvp-route-security.test.ts`
- Create: `test/mvp-acceptance-contract.test.ts`
- Modify: `test/request-tenant-context.test.ts`

**Interfaces:**
- Consumes: existing Next.js route handlers and `resolveRequestTenant`.
- Produces: failing tests for unauthorized access, cross-tenant access, clean tenant state, durable ingestion, and governed mutation.

- [ ] **Step 1: Add an unauthenticated route matrix test**

  Import the handlers for `/api/problems`, `/api/policies`, `/api/sources`, `/api/trends`, `/api/insights`, `/api/overview`, and `/api/observability/traces`. For each route, issue a production-mode request without a cookie or bearer token and assert status `401`. Mutating handlers must also assert that no repository method was called.

- [ ] **Step 2: Add a forged-tenant test**

  Authenticate as `tenant_acme`, pass `?tenant=meridian` plus `x-tenant-slug: meridian`, and assert the handler still calls its repository with `tenant_acme`. Repeat for one GET and one POST route.

- [ ] **Step 3: Add an MVP vertical-slice contract test**

  Define the expected sequence as typed test doubles:

  ```ts
  type MvpReceipt = {
    eventId: string;
    issueId: string;
    problemId?: string;
    actionExecutionId?: string;
  };

  // Duplicate provider delivery returns the same event/issue identifiers.
  // A second tenant cannot read the Issue, Problem, source, trace, or action receipt.
  // A connected-source update records an Action Gateway execution identifier.
  ```

- [ ] **Step 4: Run the tests and record the expected failure set**

  Run: `npx vitest run test/mvp-route-security.test.ts test/mvp-acceptance-contract.test.ts test/request-tenant-context.test.ts`

  Expected: failures demonstrate current unauthenticated access and mock-backed behavior. Commit the failing contract tests separately.

- [ ] **Step 5: Commit**

  ```bash
  git add test/mvp-route-security.test.ts test/mvp-acceptance-contract.test.ts test/request-tenant-context.test.ts
  git commit -m "test: define support mvp security and acceptance contracts"
  ```

---

### Task 2: Enforce Authentication and Tenant Scope on Every MVP Route

**Owner:** Agent A

**Files:**
- Create: `src/lib/auth/route-authorization.ts`
- Modify: `src/app/api/problems/route.ts`
- Modify: `src/app/api/policies/route.ts`
- Modify: `src/app/api/sources/route.ts`
- Modify: `src/app/api/trends/route.ts`
- Modify: `src/app/api/insights/route.ts`
- Modify: `src/app/api/overview/route.ts`
- Modify: `src/app/api/observability/traces/route.ts`
- Test: `test/mvp-route-security.test.ts`

**Interfaces:**
- Consumes: `resolveRequestTenant(request, { requireAuthentication: true })`.
- Produces: `authorizeMvpRead(request)` and `authorizeMvpManage(request)` returning `RequestTenantContext`.

- [ ] **Step 1: Add centralized role checks**

  Implement:

  ```ts
  export async function authorizeMvpRead(request: Request): Promise<RequestTenantContext>;
  export async function authorizeMvpManage(request: Request): Promise<RequestTenantContext>;
  export function requestAuthResponse(error: unknown): NextResponse | undefined;
  ```

  Read roles are `support_observer`, `support_operator`, and `support_cx_lead`. Manage roles are `support_operator` and `support_cx_lead`. An authenticated identity with no permitted role returns `403`.

- [ ] **Step 2: Remove query/header tenant selection from all listed routes**

  Every repository/service call receives only `context.tenantId`; `tenant`, `tenantId`, `x-tenant-id`, and `x-tenant-slug` must not alter the selected tenant. Filters may continue to select source, status, category, date range, or search terms.

- [ ] **Step 3: Require manage authorization for all mutations**

  Problems link/unlink/correlate/status, policy updates, source tests, and insight actions call `authorizeMvpManage`. Remove the `seed` and `simulate` mutation branches from production APIs.

- [ ] **Step 4: Make authorization failures explicit**

  Return `401` for missing/invalid authentication and `403` for tenant/role mismatch. Never catch authentication errors and continue with `acme`, `default`, or a query tenant.

- [ ] **Step 5: Run security tests**

  Run: `npx vitest run test/mvp-route-security.test.ts test/request-tenant-context.test.ts test/strict-tenant-domain-rls.test.ts`

  Expected: all pass; unauthenticated requests perform zero reads and zero mutations.

- [ ] **Step 6: Commit**

  ```bash
  git add src/lib/auth/route-authorization.ts src/app/api test/mvp-route-security.test.ts test/request-tenant-context.test.ts
  git commit -m "fix: enforce tenant identity on support intelligence routes"
  ```

---

### Task 3: Add the Durable MVP Schema and Repository

**Owner:** Agent B

**Files:**
- Create: `migrations/011_mvp_intelligence.sql`
- Create: `src/lib/db/support-intelligence-repository.ts`
- Create: `test/support-intelligence-repository.postgres.test.ts`
- Modify: `src/lib/types/index.ts`

**Interfaces:**
- Consumes: `pgClient.withTenantSession(tenantId, callback)`.
- Produces:

  ```ts
  export interface SourceConnectionRecord {
    id: string; tenantId: string; accountId: string; provider: "zendesk";
    connectionId: string; connectorKey: string; externalAccountId: string;
    baseUrl: string; status: "connected" | "degraded" | "disabled";
    lastEventAt?: string; createdAt: string; updatedAt: string;
  }

  export interface NormalizedInteractionInput {
    eventId: string; tenantId: string; accountId: string; connectionId: string;
    connectorKey: string; source: "zendesk"; sourceReference: string;
    customerReference: string; sourceUrl: string; text: string;
    sender: "customer" | "agent" | "system"; occurredAt: string;
    receivedAt: string; correlationId: string; raw: Record<string, unknown>;
  }

  export interface SupportIntelligenceRepository {
    recordInteraction(input: NormalizedInteractionInput): Promise<{ replayed: boolean; interactionId: string }>;
    claimInteractions(limit: number, workerId: string): Promise<NormalizedInteractionInput[]>;
    completeInteraction(tenantId: string, eventId: string, issueId: string): Promise<void>;
    failInteraction(tenantId: string, eventId: string, errorCode: string, retryAt: string): Promise<void>;
  }
  ```

- [ ] **Step 1: Write the PostgreSQL tests first**

  Use a disposable PostgreSQL database. Assert exact-tenant reads, blocked unscoped reads, blocked cross-tenant writes, idempotent `(tenant_id, source, event_id)` insertion, unique `(tenant_id, source, external_id)` Issues, and transaction rollback on processing failure.

- [ ] **Step 2: Create forward-only tables**

  `011_mvp_intelligence.sql` creates:

  - `supportv8.source_connections` for opaque Action Gateway connection references only;
  - `supportv8.interaction_events` with `raw_payload`, `expires_at`, processing state, lease and retry fields;
  - `supportv8.interaction_outbox` with deterministic event keys;
  - `supportv8.tenant_policies` with `raw_context_retention_hours` constrained to `1..168`;
  - `supportv8.action_receipts` keyed by `(tenant_id, idempotency_key)`;
  - indexes for due interaction claims, Issues by source/external ID, Problems by status, and expiry scans.

  Apply and force exact-tenant RLS on every new table. Grant the application only the required `SELECT`, `INSERT`, `UPDATE`, and claim-function execution rights. Do not grant `BYPASSRLS`.

- [ ] **Step 3: Implement repository mappings**

  All queries use qualified `supportv8.*` names and a tenant session. Claims use `FOR UPDATE SKIP LOCKED`; inserts use deterministic conflict handling; no module-level arrays, maps, or sets are allowed.

- [ ] **Step 4: Prove restart and isolation behavior**

  Instantiate two repository objects against the same database and show that the second sees the first object's committed event. Insert tenant A and tenant B rows, then prove each tenant session sees only its own row.

- [ ] **Step 5: Run tests**

  Run: `npx vitest run test/support-intelligence-repository.postgres.test.ts test/postgres-tenant-session.test.ts test/strict-tenant-domain-rls.test.ts`

- [ ] **Step 6: Commit**

  ```bash
  git add migrations/011_mvp_intelligence.sql src/lib/db/support-intelligence-repository.ts src/lib/types/index.ts test/support-intelligence-repository.postgres.test.ts
  git commit -m "feat: add tenant-safe support intelligence data plane"
  ```

---

### Task 4: Implement the Zendesk Connector in Action Gateway

**Owner:** Agent C

**Repository:** `servicev8-action-gateway`

**Files:**
- Create: `src/providers/zendesk.ts`
- Create: `src/providers/zendesk.test.ts`
- Modify: `src/action/contracts.ts`
- Modify: `src/action/providerCatalog.ts`
- Modify: `src/action/providerDispatcher.ts`
- Modify: `src/action/webhooks.ts`
- Test: `src/action/webhooks.test.ts`
- Test: `src/action/providerDispatcher.test.ts`

**Interfaces:**
- Consumes: Action Gateway connection secret bundle containing `ZENDESK_API_TOKEN`, `ZENDESK_EMAIL`, and `ZENDESK_WEBHOOK_SECRET`.
- Produces capabilities `support.ticket.read`, `support.ticket.update`, and `support.ticket.close`, plus a normalized Zendesk webhook envelope forwarded to SupportV8.

- [ ] **Step 1: Expand the Zendesk provider catalog entry**

  Zendesk must support ticket read/update/close in addition to its existing knowledge capabilities. Bind setup metadata to one HTTPS `{subdomain}.zendesk.com` origin and an allowlisted SupportV8 source app. Never accept an arbitrary provider base URL in an action payload.

- [ ] **Step 2: Add strict provider payloads**

  Implement these exact functions:

  ```ts
  export async function readZendeskTicket(input: ProviderInput): Promise<Record<string, unknown>>;
  export async function updateZendeskTicket(input: ProviderInput): Promise<Record<string, unknown>>;
  export async function closeZendeskTicket(input: ProviderInput): Promise<Record<string, unknown>>;
  export function verifyZendeskWebhook(request: Request, rawBody: string, secret: string): boolean;
  ```

  `updateZendeskTicket` accepts only `ticketId`, optional `status`, optional `priority`, optional `tags`, and optional `internalNote`. `closeZendeskTicket` accepts only `ticketId` and optional `resolutionSummary`. Provider calls use Action Gateway's idempotency key and return a bounded normalized receipt containing provider, ticket ID, status, audit ID when supplied, and update time.

- [ ] **Step 3: Verify Zendesk webhook authenticity and freshness**

  Validate `X-Zendesk-Webhook-Signature` as Base64 HMAC-SHA256 over `timestamp + rawBody`, use constant-time comparison, require `X-Zendesk-Webhook-Signature-Timestamp`, and reject timestamps more than five minutes from the gateway clock.

- [ ] **Step 4: Normalize and forward ticket events**

  Extend `WebhookProvider` with `zendesk`. Route the event to `sourceApp: "supportv8"` and forward only:

  ```ts
  type ZendeskSupportEvent = {
    eventId: string; accountId: string; tenantId: string; connectionId: string;
    connectorKey: string; source: "zendesk"; sourceReference: string;
    customerReference: string; sourceUrl: string; text: string;
    sender: "customer" | "agent" | "system"; occurredAt: string;
    receivedAt: string; correlationId: string; raw: Record<string, unknown>;
  };
  ```

  Enforce account/tenant/connection equality before forwarding. Duplicate invocation IDs produce the same `eventId`.

- [ ] **Step 5: Add provider and security tests**

  Cover valid signature, invalid signature, stale timestamp, wrong tenant binding, disabled connection, unknown payload field, SSRF-resistant origin validation, outbound idempotency replay, rate-limit response, and provider timeout.

- [ ] **Step 6: Run Action Gateway tests and commit**

  Run: `npm test -- src/providers/zendesk.test.ts src/action/webhooks.test.ts src/action/providerDispatcher.test.ts`

  ```bash
  git add src/providers/zendesk.ts src/providers/zendesk.test.ts src/action/contracts.ts src/action/providerCatalog.ts src/action/providerDispatcher.ts src/action/webhooks.ts src/action/webhooks.test.ts src/action/providerDispatcher.test.ts
  git commit -m "feat: add governed Zendesk support connector"
  ```

---

### Task 5: Build the Private Inbound Interaction Pipeline

**Owner:** Agent D

**Files:**
- Create: `src/app/api/private/interaction-events/route.ts`
- Create: `src/lib/service-app/interaction-ingress-auth.ts`
- Create: `src/lib/connectors/interaction-envelope.ts`
- Create: `src/lib/temporal/interaction-workflow.ts`
- Modify: `src/lib/temporal/worker.ts`
- Test: `test/interaction-ingress-security.test.ts`
- Test: `test/interaction-ingress.postgres.test.ts`
- Test: `test/interaction-workflow.test.ts`

**Interfaces:**
- Consumes: `ZendeskSupportEvent` from Task 4 and `SupportIntelligenceRepository` from Task 3.
- Produces: HTTP `202 { accepted: true, replayed, eventId }` after durable insertion; asynchronous issue derivation.

- [ ] **Step 1: Add workload authentication**

  Follow `managed-support-auth.ts`: validate RS256, issuer, audience `supportv8`, `azp=action-gateway-support`, token lifetime at most 120 seconds, required `jti`, and exactly one scope `supportv8:interactions:ingest`. Require token `account_id` and `tenant_id` to equal the event envelope and matching `x-servicev8-*` headers.

- [ ] **Step 2: Validate the normalized envelope**

  Reject unknown keys, missing identifiers, non-Zendesk source, invalid HTTPS Zendesk deep link, text over 100,000 characters, raw payload over 1 MiB, future timestamps, and events older than seven days.

- [ ] **Step 3: Persist before acknowledging**

  Call `recordInteraction` and return `202` only after the event and outbox rows commit. A duplicate event returns `200` with `replayed: true`. Do not classify or call an LLM in the HTTP request.

- [ ] **Step 4: Register the Temporal workflow**

  Add `processSupportInteraction(eventId, tenantId)` with deterministic workflow ID `support-interaction:${tenantId}:${eventId}`. Its activity loads the event, derives the Issue, completes the event, and retries transient failures with bounded exponential backoff. Validation failures become terminal with a typed error code.

- [ ] **Step 5: Prove restart, replay, and tenant isolation**

  The PostgreSQL integration test inserts an event, constructs a fresh repository/worker, processes it once, redelivers it, and asserts one interaction row and one Issue. A token for tenant B carrying tenant A's envelope must return `403` and create no row.

- [ ] **Step 6: Run tests and commit**

  Run: `npx vitest run test/interaction-ingress-security.test.ts test/interaction-ingress.postgres.test.ts test/interaction-workflow.test.ts`

  ```bash
  git add src/app/api/private/interaction-events src/lib/service-app/interaction-ingress-auth.ts src/lib/connectors/interaction-envelope.ts src/lib/temporal/interaction-workflow.ts src/lib/temporal/worker.ts test/interaction-*.test.ts test/interaction-ingress.postgres.test.ts
  git commit -m "feat: persist and process normalized support interactions"
  ```

---

### Task 6: Replace Mock Intelligence with Durable Projections

**Owner:** Agent E

**Files:**
- Modify: `src/lib/services/issue-service.ts`
- Modify: `src/lib/services/problem-service.ts`
- Modify: `src/lib/services/trend-anomaly-service.ts`
- Modify: `src/lib/services/business-impact-engine.ts`
- Modify: `src/lib/services/policy-engine.ts`
- Modify: `src/app/api/issues/route.ts`
- Modify: `src/app/api/problems/route.ts`
- Modify: `src/app/api/trends/route.ts`
- Modify: `src/app/api/insights/route.ts`
- Modify: `src/app/api/overview/route.ts`
- Modify: `src/app/api/sources/route.ts`
- Modify: `src/app/api/policies/route.ts`
- Test: `test/mvp-intelligence-projections.postgres.test.ts`
- Test: `test/problem-correlation.test.ts`
- Test: `test/trend-anomaly-service.test.ts`

**Interfaces:**
- Consumes: durable repository records and `triageEngine.classify(text, customerTier)`.
- Produces: tenant-bound Issue, Problem, Trend, Overview, Source, and Policy projections with no mock fallback.

- [ ] **Step 1: Convert Issue creation to an async repository operation**

  Replace `createFromInteraction` global mutation with:

  ```ts
  createFromInteraction(
    tenantId: string,
    input: NormalizedInteractionInput,
  ): Promise<Issue>;
  ```

  Use deterministic issue identity derived from tenant/source/source reference. Persist sentiment, category, intent/tag output, confidence, business impact, source URL, correlation ID, and an audit metadata object containing classifier version and classification time.

- [ ] **Step 2: Persist Problem correlation**

  `correlateIssues(tenantId, issueIds, title, suspectedCause)` must load every Issue within the same tenant session, reject a missing or foreign Issue, compute transparent affected-customer counts and business impact, then persist the Problem and Issue links in one transaction.

- [ ] **Step 3: Compute trends from durable Issues**

  Aggregate Issues into fixed time buckets by tenant, source, category, and sentiment. A trend result includes `windowStart`, `windowEnd`, `baselineCount`, `currentCount`, `changePct`, and confidence. Empty tenants return empty arrays.

- [ ] **Step 4: Persist and read tenant policies**

  Replace process-global policy mutation with repository reads/writes. Policy writes require the tenant from Task 2 and record actor ID, policy version, and audit timestamp.

- [ ] **Step 5: Rebuild Overview from durable records**

  Return real Needs Attention, AI Discovered, Active Problems, actionable Insights, issue volume, CSAT proxy, resolution rate, and business exposure. No hard-coded count, percentage, customer, employee, source, or activity is permitted.

- [ ] **Step 6: Remove production imports of `mock-data` from MVP paths**

  Run `rg -n "mock-data" src/app/api/{issues,problems,trends,insights,overview,sources,policies} src/lib/services/{issue-service,problem-service,trend-anomaly-service,business-impact-engine,policy-engine}.ts` and require zero matches.

- [ ] **Step 7: Run projection tests and commit**

  Run: `npx vitest run test/mvp-intelligence-projections.postgres.test.ts test/problem-correlation.test.ts test/trend-anomaly-service.test.ts test/cx-manager-cockpit.test.ts`

  ```bash
  git add src/lib/services src/app/api/issues src/app/api/problems src/app/api/trends src/app/api/insights src/app/api/overview src/app/api/sources src/app/api/policies test/mvp-intelligence-projections.postgres.test.ts test/problem-correlation.test.ts test/trend-anomaly-service.test.ts
  git commit -m "feat: project support intelligence from durable interactions"
  ```

---

### Task 7: Bind Agentic Chat to Durable Support Intelligence

**Owner:** Agent E

**Files:**
- Create: `src/lib/chat/support-intelligence-context.ts`
- Modify: `src/app/api/chat/route.ts`
- Test: `test/chat-durable-intelligence.test.ts`
- Test: `test/chat-operator-role-route.test.ts`

**Interfaces:**
- Consumes: authenticated `RequestTenantContext` and tenant-scoped Issue/Problem/Trend repositories.
- Produces: bounded read-only context with citations to internal Issue/Problem IDs and external source deep links.

- [ ] **Step 1: Add a bounded context builder**

  Implement `buildSupportIntelligenceContext(tenantId, query)` returning at most 20 Issues, 10 Problems, and 10 Trends. Each item includes ID, summary/title, confidence, updated time, and source URL where applicable. Exclude raw interaction payloads and customer PII not needed by the query.

- [ ] **Step 2: Remove mock context construction**

  Delete `db.getTenantData` usage from `/api/chat`. Chat must return a truthful empty-state response when a tenant has no durable intelligence.

- [ ] **Step 3: Keep the route read-only**

  The Ask/Chat path may recommend a governed action, but it cannot call provider APIs or mutate Issues/Problems. A recommended action contains only an operation ID and a user-visible explanation.

- [ ] **Step 4: Add tenant and citation tests**

  Assert tenant A cannot retrieve tenant B summaries through direct prompts, IDs, source references, or search terms. Assert returned citations resolve to records in the authenticated tenant.

- [ ] **Step 5: Run tests and commit**

  Run: `npx vitest run test/chat-durable-intelligence.test.ts test/chat-operator-role-route.test.ts test/ask-llm-path.test.ts`

  ```bash
  git add src/lib/chat/support-intelligence-context.ts src/app/api/chat/route.ts test/chat-durable-intelligence.test.ts test/chat-operator-role-route.test.ts
  git commit -m "feat: ground support chat in durable tenant intelligence"
  ```

---

### Task 8: Replace Simulated Actions with Governed Action Gateway Execution

**Owner:** Agent F

**Files:**
- Create: `src/lib/runtime/action-gateway-http-client.ts`
- Modify: `src/lib/runtime/action-gateway-client.ts`
- Create: `src/app/api/issues/[id]/source-action/route.ts`
- Test: `test/action-gateway-writeback.test.ts`
- Test: `test/action-gateway-writeback.postgres.test.ts`
- Modify: `test/runtime-loop.test.ts`

**Interfaces:**
- Consumes: `ACTION_GATEWAY_URL`, an execution-only workload token, tenant `accountId`, Issue source metadata, and a connected Zendesk connection reference.
- Produces: a durable `action_receipts` row correlated to the Action Gateway execution.

- [ ] **Step 1: Add an HTTP client for `/v1/actions/execute`**

  Implement:

  ```ts
  execute(input: {
    accountId: string; tenantId: string;
    capability: "support.ticket.update" | "support.ticket.close";
    connectorKey: string; idempotencyKey: string;
    actor: { id: string; type: "human" | "ai_employee"; name: string };
    policyDecision: { id: string; mode: "observe" | "copilot" | "autonomous"; decision: "allow" };
    payload: Record<string, unknown>;
  }): Promise<{ id: string; status: string; result?: Record<string, unknown>; error?: string }>;
  ```

  Use a five-second request timeout. Treat non-2xx, `failed`, malformed, or tenant-mismatched responses as failure. Never fall back to local simulated success.

- [ ] **Step 2: Delete process-local audits and simulated target execution**

  Remove `auditLog`, `pendingApprovals`, `executeTargetOperation`, and the `|| true` tenant filter. Read action history only from `supportv8.action_receipts` for the authenticated tenant.

- [ ] **Step 3: Add one MVP write-back route**

  `POST /api/issues/[id]/source-action` accepts either:

  ```ts
  { action: "update", status?: "open" | "pending" | "solved", priority?: "low" | "normal" | "high" | "urgent", internalNote?: string }
  { action: "close", resolutionSummary: string }
  ```

  Load the Issue in the authenticated tenant, require `source === "zendesk"`, derive the provider ticket ID from `externalId`, resolve the tenant's connected source, submit the action, and save the receipt. The deterministic idempotency key is `supportv8:${tenantId}:${issueId}:${action}:${sha256(canonicalPayload)}`.

- [ ] **Step 4: Enforce operating mode**

  Observe mode rejects mutation. Copilot requires an authenticated human request. Autonomous mode requires an AI employee actor plus an explicit durable policy decision. The browser cannot supply its own policy decision or AI actor.

- [ ] **Step 5: Test no-bypass and replay behavior**

  Assert zero direct `fetch` calls to Zendesk, repeated identical requests produce one Action Gateway execution/receipt, changed payload with reused key fails, foreign Issue ID returns `404`, and a provider failure does not change the local Issue state.

- [ ] **Step 6: Run tests and commit**

  Run: `npx vitest run test/action-gateway-writeback.test.ts test/action-gateway-writeback.postgres.test.ts test/runtime-loop.test.ts`

  ```bash
  git add src/lib/runtime/action-gateway-http-client.ts src/lib/runtime/action-gateway-client.ts src/app/api/issues test/action-gateway-writeback.test.ts test/action-gateway-writeback.postgres.test.ts test/runtime-loop.test.ts
  git commit -m "feat: execute Zendesk updates through Action Gateway"
  ```

---

### Task 9: Implement Enforceable Retention and Tenant-Safe Observability

**Owner:** Agent G

**Files:**
- Create: `src/lib/retention/retention-service.ts`
- Create: `src/lib/temporal/retention-workflow.ts`
- Modify: `src/lib/temporal/worker.ts`
- Modify: `src/lib/services/context-engine.ts`
- Modify: `src/lib/chatbot/observability/telemetry.ts`
- Modify: `src/app/api/observability/traces/route.ts`
- Create: `test/retention-policy.postgres.test.ts`
- Create: `test/observability-tenant-isolation.test.ts`

**Interfaces:**
- Consumes: `tenant_policies.raw_context_retention_hours`.
- Produces: purged raw context, preserved derived intelligence, and tenant-filtered metrics/traces.

- [ ] **Step 1: Make expiry derive from tenant policy**

  `recordInteraction` calculates `expires_at = received_at + raw_context_retention_hours`. `context-engine` must return the remaining TTL and must not create a fixed one-hour process-local expiry.

- [ ] **Step 2: Add a periodic purge workflow**

  Purge expired `raw_payload` and transient text by setting them to an empty JSON object and redacted marker, then delete expired ephemeral context rows. Do not delete Issue, Problem, classification, source reference, correlation ID, confidence, or action receipts.

- [ ] **Step 3: Replace the global telemetry buffer**

  Emit structured telemetry with `tenantId`, `correlationId`, operation, duration, outcome, and error code. The API queries only tenant-scoped durable audit/projection data and requires `authorizeMvpRead`. Do not expose prompt bodies, raw interactions, access tokens, provider credentials, email bodies, or phone numbers.

- [ ] **Step 4: Add retention and observability tests**

  Prove two policies produce different expiries; purge removes raw content but preserves the Issue; tenant A trace queries never contain tenant B correlation IDs; an unauthenticated trace request returns `401`.

- [ ] **Step 5: Run tests and commit**

  Run: `npx vitest run test/retention-policy.postgres.test.ts test/observability-tenant-isolation.test.ts`

  ```bash
  git add src/lib/retention src/lib/temporal src/lib/services/context-engine.ts src/lib/chatbot/observability/telemetry.ts src/app/api/observability/traces/route.ts test/retention-policy.postgres.test.ts test/observability-tenant-isolation.test.ts
  git commit -m "feat: enforce support context retention and tenant telemetry"
  ```

---

### Task 10: Deploy the Schema, Worker, Connector Secrets, and Scaling

**Owner:** Agent H

**Repository:** `servicev8-devops`

**Files:**
- Modify: `apps/supportv8/database.yaml`
- Modify: `apps/supportv8/database-verification.yaml`
- Modify: `apps/supportv8/deployment.yaml`
- Modify: `apps/supportv8/worker.yaml`
- Modify: `apps/supportv8/keda-scaledobject.yaml`
- Create: `apps/supportv8/externalsecret-action-gateway.yaml`
- Modify: `apps/action-gateway/deployment.yaml`
- Create: `docs/runbooks/supportv8-zendesk-mvp.md`

**Interfaces:**
- Consumes: merged application images and `011_mvp_intelligence.sql`.
- Produces: versioned migration Job, execution-only SupportV8 credential, Action Gateway-to-SupportV8 ingest identity, webhook forwarding configuration, and operational runbook.

- [ ] **Step 1: Version the database migration Job**

  Copy the exact reviewed migration into `database.yaml`, add its SHA-256 to the migration ledger, bump both ConfigMap and Job from `v16` to `v17`, and keep the migration forward-only. Never modify the recorded checksum of migrations 008 or 009.

- [ ] **Step 2: Extend the RLS conformance Job**

  Bump `supportv8-rls-conformance-v1` to `v2`. Verify unscoped reads return zero, tenant A cannot read/write tenant B, the app role lacks `BYPASSRLS`, raw-context purge cannot delete durable Issues, and the relay/scaler roles receive no access to the new tables.

- [ ] **Step 3: Add least-privilege runtime settings**

  SupportV8 receives `ACTION_GATEWAY_URL` and an execution-only credential capable of `support.ticket.update` and `support.ticket.close`. It receives no Action Gateway setup/control credential and no Zendesk secret. Action Gateway receives the SupportV8 forward URL and a workload identity scoped only to `supportv8:interactions:ingest`.

- [ ] **Step 4: Configure worker scaling**

  Register the interaction and retention workflows on `supportv8-spine`. Scale on pending interaction count with a bounded maximum. Keep the web Deployment and worker Deployment independently scalable.

- [ ] **Step 5: Write the runbook**

  Include connector setup, Zendesk webhook creation, signing-secret rotation, sandbox test, replay test, queue-depth query, failed-event retry, retention verification, rollback by image revision, and exact evidence to capture. Do not include secret values.

- [ ] **Step 6: Validate manifests and commit**

  Run the repository's manifest validation and policy checks, then:

  ```bash
  git add apps/supportv8 apps/action-gateway/deployment.yaml docs/runbooks/supportv8-zendesk-mvp.md
  git commit -m "feat: deploy SupportV8 Zendesk MVP data plane"
  ```

---

### Task 11: Execute the MVP Acceptance Gate

**Owner:** Agent H, witnessed by an independent reviewer

**Files:**
- Create: `docs/evidence/supportv8-mvp/<date>/README.md`
- Create: `docs/evidence/supportv8-mvp/<date>/tenant-isolation.json`
- Create: `docs/evidence/supportv8-mvp/<date>/zendesk-roundtrip.json`
- Create: `docs/evidence/supportv8-mvp/<date>/retention.json`
- Create: `docs/evidence/supportv8-mvp/<date>/observability.json`

**Interfaces:**
- Consumes: deployed SupportV8, Action Gateway, PostgreSQL, Temporal worker, and one non-production Zendesk account.
- Produces: release decision `MVP_ACCEPTED` or `CHANGES_REQUIRED` with immutable identifiers.

- [ ] **Step 1: Run all repository gates**

  SupportV8: `npm run typecheck`, `npm test`, `npm run build`.

  Action Gateway: typecheck, full test suite, and build using its repository scripts.

  DevOps: manifest rendering, schema Job success, RLS conformance Job success, Deployment availability, and worker readiness.

- [ ] **Step 2: Prove tenant isolation with two real tenants**

  Connect only tenant A to Zendesk. Deliver an event and verify tenant A sees one source and one Issue. Authenticate as tenant B and verify Sources, Issues, Problems, Trends, Overview, Chat, telemetry, and action receipts contain no tenant A identifiers. Attempt a tenant B write against tenant A's Issue and require `404` or `403` with no provider request.

- [ ] **Step 3: Prove the near-real-time inbound path**

  Create or update a sandbox Zendesk ticket. Capture Zendesk invocation ID, Action Gateway connection/execution correlation, SupportV8 event ID, Temporal workflow ID, Issue ID, source deep link, classifications, confidence, and elapsed time. The event must appear without ticket migration or manual refresh processing.

- [ ] **Step 4: Prove Problem, trend, Overview, and Chat behavior**

  Deliver at least three related tickets, correlate them into one Problem, verify the business-impact inputs and score, verify the trend window, confirm Overview sections use those records, and ask Chat a question whose answer cites the Issue and Problem IDs.

- [ ] **Step 5: Prove governed write-back**

  From Copilot mode, submit one ticket status update. Capture the human actor, policy decision, deterministic idempotency key, Action Gateway execution ID, Zendesk audit/update result, and SupportV8 receipt. Replay the same request and prove Zendesk was updated once. Attempt a direct SupportV8-to-Zendesk call path and prove none exists in code or network configuration.

- [ ] **Step 6: Prove retention separation**

  Set a short test retention policy, allow the purge workflow to run, and show raw interaction content removed while the Issue, Problem, classification confidence, source deep link, and action receipt remain.

- [ ] **Step 7: Record the decision**

  `MVP_ACCEPTED` requires all 15 acceptance criteria in the design spec, both tenant-isolation tests, the sandbox round trip, idempotent replay, retention proof, and green build/test gates. Any missing or mock-only evidence produces `CHANGES_REQUIRED` and blocks production promotion.

## Definition of Done

- No unauthenticated MVP route reads or mutates tenant data.
- No MVP route chooses tenancy from query strings or ordinary client headers.
- No production MVP path imports `src/lib/db/mock-data.ts`.
- A real Zendesk event becomes exactly one durable Issue after retries and process restarts.
- Related Issues become a durable, tenant-scoped Problem with transparent impact scoring.
- Overview and Chat use durable tenant intelligence and truthful empty states.
- A Zendesk update succeeds only through Action Gateway and produces a durable receipt.
- Raw context expires according to tenant policy without deleting durable intelligence.
- Two-tenant PostgreSQL and deployed QA prove no cross-tenant reads, writes, traces, or action receipts.
- CircleCI, Argo CD migration, RLS conformance, web readiness, worker readiness, and sandbox acceptance are green.

## Provider References

- Zendesk webhook signatures: `https://developer.zendesk.com/documentation/webhooks/verifying/`
- Zendesk webhook creation and monitoring: `https://developer.zendesk.com/documentation/webhooks/creating-and-monitoring-webhooks/`
- Zendesk ticket creation/update guidance: `https://developer.zendesk.com/documentation/ticketing/managing-tickets/creating-and-updating-tickets/`
- Zendesk API rate limits: `https://developer.zendesk.com/api-reference/introduction/rate-limits/`

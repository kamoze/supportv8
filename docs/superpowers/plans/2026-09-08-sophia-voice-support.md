# Sophia Voice Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a SupportV8 tenant hire Sophia — Customer Support Lead AI and configure, provision, validate, activate, and test her voice capability through the existing Vivian/Voice Agents architecture.

**Architecture:** MarketplaceV8 and Registry remain the acquisition and installation authorities, Forge Gateway mints the exact `role × vertical × tenant` hire, SupportV8 only projects that hire and mints a click-time Studio handoff, and Studio configures the shared Voice Agents runtime. Voice Agents owns durable voice state and calls SupportV8 through a narrow workload-authenticated Domain API; Action Gateway exclusively owns Vapi/Twilio credentials and provider effects.

**Tech Stack:** TypeScript, Next.js, Vitest, PostgreSQL/RLS, Keycloak OIDC workload JWTs, Registry, MarketplaceV8, Forge Gateway, StudioV8, Voice Agents, Action Gateway, Temporal, Kubernetes/ArgoCD.

**Spec:** `/Users/inigodwin/Developer/GitCode/servicev8-voice-agents/docs/orderv8-reference-implementation.md`; `/Users/inigodwin/Developer/GitCode/docsv8/servicev8/docs/agenticos/service-app-architecture-migration-plan.md`; `/Users/inigodwin/Developer/GitCode/docsv8/servicev8/docs/agenticos/service-app-connector-employee-implementation-guide.md`

## Global Constraints

- The exact hired instance is the authorization and metering unit; names and URL tenant segments are never authority.
- The customer-facing identity is `Sophia — Customer Support Lead AI`, target `supportv8`.
- The purchased employee product is `servicev8.ai-support-agent`; the runtime remains `servicev8.voice-agents`; never manufacture a second runtime entitlement.
- SupportV8 must not store provider credentials, provider assistant payloads, phone bindings, or authoritative voice deployment state.
- Provider effects and verification remain behind Action Gateway.
- Voice configuration creates a draft; readiness and explicit activation remain separate gates.
- Every service call uses a short-lived audience-bound workload JWT and immutable acting-user subject.
- SupportV8 Domain API authorization is tenant-bound and performs the final authorization for ticket and knowledge operations.
- Unknown, missing, stale, cross-tenant, or ambiguous authority fails closed.
- Existing local seeded workforce, phone configuration, session simulation, and direct provisioning paths are removed from customer-visible behavior.

---

### Task 1: Publish Sophia as a canonical exact-hire product

**Files:**
- Modify: `servicev8-registry/src/index.ts`
- Test: `servicev8-registry/test/sophia-support-agent-catalog.test.ts`
- Modify: `servicev8-forge-gateway/src/gateway/roleRegistry.ts`
- Test: `servicev8-forge-gateway/test/roleRegistry.test.ts`

**Interfaces:**
- Produces Registry manifest `servicev8.ai-support-agent@1.0.0`, active demo offer, target `supportv8`, and required support/voice capabilities.
- Produces Forge role `customer-support-lead` available only in `supportv8`, with conservative grants and tuning schema.

- [ ] Write catalog tests proving Sophia appears only for `supportv8`, has `productKind=ai_employee`, and targets the exact canonical product version.
- [ ] Run the focused tests and verify they fail because the manifest and role do not exist.
- [ ] Add the manifest, offer, durable seed publication, and role template without modifying unrelated personal-assistant work.
- [ ] Run focused Registry and Forge tests, then each repository's full test suite and typecheck.
- [ ] Commit the Registry and Forge changes independently.

### Task 2: Generalize the Vivian exact-hire boundary for Sophia

**Files:**
- Modify: `servicev8-voice-agents/src/api/workforce-deployments.ts`
- Modify: `servicev8-voice-agents/src/integrations/registry-workforce.ts`
- Create: `servicev8-voice-agents/src/domain/workforce-profile.ts`
- Modify: `servicev8-voice-agents/src/domain/reference-tools.ts`
- Modify: `servicev8-voice-agents/src/domain/company-context.ts`
- Create: `servicev8-voice-agents/src/integrations/support-voice-tools.ts`
- Modify: `servicev8-voice-agents/src/integrations/company-context-router.ts`
- Modify: `servicev8-voice-agents/src/api/server.ts`
- Test: `servicev8-voice-agents/test/workforce-deployments.test.ts`
- Create: `servicev8-voice-agents/test/support-workforce.test.ts`
- Create: `servicev8-voice-agents/test/support-voice-tools.test.ts`

**Interfaces:**
- Consumes exact Registry bindings for either Vivian/OrderV8 or Sophia/SupportV8.
- Produces a closed profile mapping: `servicev8.ai-receptionist + orderv8 -> reception/order tools`; `servicev8.ai-support-agent + supportv8 -> support/support tools`.
- Produces SupportV8 tool names `support_ticket_lookup`, `support_ticket_create`, `support_knowledge_search`, and `support_escalation_create` with bounded schemas.

- [ ] Write tests proving SupportV8/Sophia is accepted, wrong product/vertical pairs are rejected, and Vivian behavior is unchanged.
- [ ] Run the tests and verify the current `unsupported_vertical`/unsupported-product failures.
- [ ] Implement the closed workforce-profile mapping and derive purpose, persona, operations, and readiness label from it.
- [ ] Write tool contract tests for argument validation, result minimization, verified-customer requirements, cross-tenant denial, and durable idempotency.
- [ ] Run the tool tests and verify they fail before adding the SupportV8 adapter.
- [ ] Implement the SupportV8 workload client and route it through the existing company-context router without adding provider code.
- [ ] Run all Voice Agents tests, typecheck, and build.
- [ ] Commit Voice Agents changes.

### Task 3: Expose the SupportV8 Domain API

**Files:**
- Create: `supportv8-workdesk-account/src/lib/voice/workload-auth.ts`
- Create: `supportv8-workdesk-account/src/lib/voice/domain-tools.ts`
- Create: `supportv8-workdesk-account/src/app/api/v1/voice/tools/route.ts`
- Create: `supportv8-workdesk-account/test/voice-domain-tools.test.ts`
- Create: `supportv8-workdesk-account/test/voice-workload-auth.test.ts`

**Interfaces:**
- Consumes `aud=supportv8`, allowlisted Voice Agents client, scopes `supportv8:voice:read` and `supportv8:voice:escalate`, exact binding, session ID, tool-call ID, and typed parameters.
- Produces minimized ticket/knowledge/escalation results and stable idempotent ticket creation through SupportV8's tenant-scoped repositories.

- [ ] Write authentication tests for issuer, audience, client allowlist, expiry, scope, and tenant mismatch.
- [ ] Run them and verify failure because the authenticator does not exist.
- [ ] Implement workload JWT verification with no human-session or static-token fallback.
- [ ] Write operation tests for lookup, create, knowledge search, escalation, duplicate calls, and cross-tenant entity references.
- [ ] Run them and verify failure because the Domain API does not exist.
- [ ] Implement the typed Domain API using verified tenant context and RLS repositories; reject unsupported fields and operations.
- [ ] Run focused tests, SupportV8 full tests, typecheck, and build.
- [ ] Commit the Domain API changes.

### Task 4: Replace SupportV8's local hire and voice control plane

**Files:**
- Create: `supportv8-workdesk-account/src/lib/platform/registry-projection.ts`
- Create: `supportv8-workdesk-account/src/lib/platform/marketplace-handoff.ts`
- Create: `supportv8-workdesk-account/src/lib/platform/studio-handoff.ts`
- Create: `supportv8-workdesk-account/src/lib/voice/workforce-projection.ts`
- Modify: `supportv8-workdesk-account/src/app/api/workforce/route.ts`
- Modify: `supportv8-workdesk-account/src/app/api/marketplace/route.ts`
- Create: `supportv8-workdesk-account/src/app/api/platform/launch/route.ts`
- Modify: `supportv8-workdesk-account/src/app/page.tsx`
- Delete: `supportv8-workdesk-account/src/app/api/voice/provision/route.ts`
- Delete: `supportv8-workdesk-account/src/app/api/voice/session/route.ts`
- Delete: `supportv8-workdesk-account/src/lib/voice/voice-service.ts`
- Test: `supportv8-workdesk-account/test/voice-provisioning.test.ts`
- Create: `supportv8-workdesk-account/test/sophia-acquisition.test.ts`
- Create: `supportv8-workdesk-account/test/sophia-studio-handoff.test.ts`
- Create: `supportv8-workdesk-account/test/sophia-workforce-projection.test.ts`

**Interfaces:**
- Consumes authenticated SupportV8 tenant ID/slug, parent account ID from Registry, immutable identity subject, Registry installation projection, and Forge hire projection.
- Produces click-time Marketplace and Studio handoffs with max-60-second signed tokens and exact `accountId`, `tenantId`, `verticalId=supportv8`, `installationId`, and `hireId` selection.

- [ ] Replace the provisioning regression test with assertions that local provider provisioning, arbitrary tenant IDs, and seeded phone/session data are unavailable.
- [ ] Run it and verify the current endpoints fail the desired assertions.
- [ ] Add Registry/Marketplace/Studio clients by copying the OrderV8 contract shapes and adapting only issuer, vertical, return path, and tenant resolver.
- [ ] Add tests proving a foreign hire returns 404, malformed instance IDs fail, handoffs are minted at click time, and the verified identity subject cannot be overridden.
- [ ] Run them and verify expected failures.
- [ ] Replace local workforce and marketplace hire mutations with central catalog/acquisition projections, and render only actual tenant hires.
- [ ] Replace provider-edit modals with a single `Configure Sophia` Studio launch plus read-only status/call-history projection.
- [ ] Remove the local voice provisioning/session service and any customer-visible seeded phone lines or calls.
- [ ] Run focused tests, full SupportV8 tests, typecheck, and build.
- [ ] Commit the SupportV8 integration changes.

### Task 5: Wire least-privilege workload infrastructure

**Files:**
- Modify: `servicev8-devops/apps/voice-reference-identity/bootstrap.mjs`
- Modify: `servicev8-devops/apps/voice-reference-identity/external-secrets.yaml`
- Modify: `servicev8-devops/apps/voice-reference-identity/job.yaml`
- Modify: `servicev8-devops/apps/servicev8-voice-agents/kustomization.yaml`
- Modify: `servicev8-devops/apps/supportv8/deployment.yaml`
- Create: `servicev8-devops/apps/supportv8/externalsecret-voice-workload.yaml`
- Modify: `servicev8-devops/apps/supportv8/kustomization.yaml`
- Modify: `servicev8-devops/ops/voice-reference/identity.test.mjs`
- Create: `servicev8-devops/ops/voice-reference/supportv8-contract.test.mjs`

**Interfaces:**
- Produces `supportv8-voice-reference` with `voice:workforce:read`, and extends `voice-agents-reference` with audiences/scopes `supportv8`, `supportv8:voice:read`, and `supportv8:voice:escalate`.
- Injects SupportV8 Studio/Marketplace/Registry/Voice endpoints and secrets only from SSM/External Secrets.

- [ ] Write identity/manifest tests for exact audiences, scopes, 120-second access tokens, and absence of provider secrets in SupportV8.
- [ ] Run them and verify failure against current manifests.
- [ ] Extend the existing identity bootstrap and External Secrets resources; do not create another identity architecture.
- [ ] Wire SupportV8 and Voice Agents environment variables and allowlists, preserving RLS/PgBouncer and existing resources.
- [ ] Run Node manifest tests, `kubectl kustomize` for all changed apps, policy checks, and secret scans.
- [ ] Commit DevOps changes.

### Task 6: End-to-end contract and release evidence

**Files:**
- Create: `supportv8-workdesk-account/docs/runbooks/sophia-voice-demo.md`
- Modify: affected repository READMEs only where runtime ownership or environment contracts changed.

**Interfaces:**
- Produces reproducible demo steps: hire Sophia, observe Registry projection, open exact Studio workspace, save draft, provision governed connection, run readiness, activate with consent, start browser test call, create/lookup a SupportV8 ticket, inspect audit/call history.

- [ ] Run every changed repository's full tests, typecheck, and build from clean worktrees.
- [ ] Run cross-repository contract tests and negative tenant/product/identity cases.
- [ ] Verify no customer-facing SupportV8 code can select a provider, send provider credentials, invent a hire, or return seeded voice state.
- [ ] Verify CircleCI configurations build immutable images and update only the intended GitOps tags.
- [ ] Record the exact commands, expected statuses, rollback flag, and live canary steps in the runbook.
- [ ] Review diffs against this plan and the Vivian reference before proposing merge/deployment.

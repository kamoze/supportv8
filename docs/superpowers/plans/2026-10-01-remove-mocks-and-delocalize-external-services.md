# Remove Mocks and De-localize External Services Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all fake data, mock seed stores, and localized fake catalogs/simulators across SupportV8, aligning the app with real database state and external platform surfaces (runtime.servicev8.com, studio.servicev8.com, marketplace.servicev8.com).

**Architecture:** Connect Studio, Marketplace, Connectors, and Installed Products to external platform authorities (`studio.servicev8.com`, `marketplace.servicev8.com`, Action Gateway, and Registry projections) using clean empty states when unprovisioned, matching the standard in `carev8` and `orderv8`. Replace static mock data in Issues, Overview, Knowledge, and Problems APIs with real durable database queries (`chatRepository`, `ragIngestion`) so fresh workspaces start clean without fake pre-seeded records.

**Tech Stack:** Next.js (App Router), TypeScript, React, Tailwind CSS, PostgreSQL / pgvector (`chatRepository`, `ragIngestion`), Vitest, Playwright.

**Spec:** `docsv8/Architecture-essentials.md`, `sv8-deploy` skill standard.

## Global Constraints

- Lines 1831–2033 in `src/app/page.tsx` must **NEVER** be modified.
- Strict label constraint: All UI titles and labels must be $\le 2$ words.
- Git push rule: Do not push to `origin/main` without explicit instruction from the user.
- No seeded domain employees, capabilities, connectors, installations, demo business records, activity, or credit balances into a new tenant. Empty is a valid domain state.

---

### Task 1: De-localize Studio, Marketplace, Connectors, and Installed Products Views

**Files:**
- Modify: `src/components/views/AutonomousStudioView.tsx`
- Modify: `src/components/views/StudioMarketplaceHubView.tsx`
- Modify: `src/components/views/MarketplaceConnectorsView.tsx`
- Modify: `src/components/views/MarketplaceWorkforceView.tsx`
- Test: `test/studio-marketplace-hub.test.tsx`
- Test: `test/marketplace-workforce-studio-linkages.test.tsx`

**Interfaces:**
- Studio links: `https://studio.servicev8.com/?tenant=${tenantSlug}&vertical=supportv8`
- Marketplace links: `https://marketplace.servicev8.com`
- Buttons: "Open Studio ↗", "Browse Marketplace ↗", "Manage in Studio ↗"
- All titles & labels: $\le 2$ words

- [ ] **Step 1: Update StudioMarketplaceHubView.tsx**
  Remove hardcoded fake package list (`pkg_triage`, `pkg_ecom_refund`, `pkg_stale_sweeper` with fake execution metrics). Replace with authoritative discovery cards, clear explanation that acquisition occurs in MarketplaceV8, external launch buttons to `https://marketplace.servicev8.com` and `https://studio.servicev8.com`, and retain the canonical Sophia hire card with `/api/voice/sophia/launch`. Ensure all labels are $\le 2$ words.

- [ ] **Step 2: Update AutonomousStudioView.tsx**
  Remove hardcoded fake candidates (`stale_01`, `TICK-4091`) and local mock simulators. Present an authoritative Studio management view explaining that autonomous workflows, prompt policies, and multi-vertical DAGs are governed in ServiceV8 Studio, with primary button "Open Studio ↗" and secondary "Browse Marketplace ↗". Ensure all labels are $\le 2$ words.

- [ ] **Step 3: Update MarketplaceConnectorsView.tsx**
  Remove fake localized connector toggles and mock simulated payloads. Align with `carev8` / `orderv8` standard: display authoritative active connectors, or when empty display: "No Connectors Configured. Zero external connectors or hardware bridges are active for this workspace. Connectors are enabled when you install capabilities from the Marketplace and integrate them via the Action Gateway, unless configured in default settings." Include "Manage in Studio ↗" and "Browse Marketplace ↗" actions. Ensure all labels are $\le 2$ words.

- [ ] **Step 4: Update MarketplaceWorkforceView.tsx**
  Remove fake hardcoded packages with fake execution counts. Display authoritative Registry installation projections or clean empty state ("No Products Installed. Zero external packages or custom solutions are installed for this workspace. Browse Marketplace to acquire capabilities.") with external launch actions. Ensure all labels are $\le 2$ words.

- [ ] **Step 5: Run tests to verify linkages and update test assertions if needed**
  Run: `npx vitest run test/studio-marketplace-hub.test.tsx test/marketplace-workforce-studio-linkages.test.tsx`
  Verify tests pass.

---

### Task 2: Eliminate Fake Mock Issues Injection from Issues API

**Files:**
- Modify: `src/app/api/issues/route.ts:111-136`
- Test: `test/runtime-ticket-reader.test.ts`
- Test: `test/chat-to-workdesk-routing-and-clean-tenant.test.ts`

**Interfaces:**
- Consumes: `chatRepository.listChatIssues(tenantId)`, `chatRepository.listWorkspaceIssues(tenantId)`
- Produces: `GET /api/issues` returning real durable issues, or `[]` if no issues exist. Zero mock injection.

- [ ] **Step 1: Update GET handler in src/app/api/issues/route.ts**
  When `hasDurableDatabase()` is true, return ONLY `filteredChatIssues`. Do NOT merge `mockIssues`. If 0 tickets exist in durable storage, return `count: 0, data: []`.
  When `!hasDurableDatabase()`, do not inject mock issues for clean tenants.

- [ ] **Step 2: Run ticket reader and workdesk tests**
  Run: `npx vitest run test/runtime-ticket-reader.test.ts test/chat-to-workdesk-routing-and-clean-tenant.test.ts`
  Verify tests pass.

---

### Task 3: Real Overview Metrics Aggregation in Overview API

**Files:**
- Modify: `src/app/api/overview/route.ts`
- Modify: `src/lib/services/reporting-service.ts`
- Test: `test/cx-manager-cockpit.test.ts`

**Interfaces:**
- Consumes: `chatRepository.listChatIssues` or durable chat issues
- Produces: `GET /api/overview` returning real calculated metrics:
  - If 0 issues: `totalVolume: 0, autonomousResolved: 0, csatAverage: 0, varr: 0, slaAttainmentPct: 0`
  - If issues exist: dynamically computed from real issue records.

- [ ] **Step 1: Update src/app/api/overview/route.ts**
  Derive overview metrics from real durable tickets (`chatRepository.listChatIssues`) when durable database is present. Return clean 0-state when no tickets exist instead of hardcoded 1240 volume and 94.2% CSAT.

- [ ] **Step 2: Update src/lib/services/reporting-service.ts**
  Ensure calculations handle 0 tickets cleanly without throwing or defaulting to fake numbers.

- [ ] **Step 3: Run cockpit & reporting tests**
  Run: `npx vitest run test/cx-manager-cockpit.test.ts`
  Verify tests pass.

---

### Task 4: Purge Mock Articles and Documents from Knowledge API

**Files:**
- Modify: `src/app/api/knowledge/route.ts:16-40`
- Test: `test/knowledge-rag-query.test.ts`
- Test: `test/knowledge-intelligence.test.ts`

**Interfaces:**
- Consumes: `ragIngestion.getDurableArticles(tenantId)`, `ragIngestion.getDurableDocuments(tenantId)`
- Produces: `GET /api/knowledge` returning only real durable articles & documents (or `[]` if empty).

- [ ] **Step 1: Update GET handler in src/app/api/knowledge/route.ts**
  Remove `mockArticles` and `mockDocs` fallback/merging. Return only durable articles and documents from `ragIngestion`. If none exist, return `articles: []`, `documents: []`, `gaps: []`, `proposals: []`.

- [ ] **Step 2: Run knowledge tests**
  Run: `npx vitest run test/knowledge-rag-query.test.ts test/knowledge-intelligence.test.ts`
  Verify tests pass.

---

### Task 5: Fix Problems API and Remove Mock Problem Fallbacks

**Files:**
- Modify: `src/app/api/problems/route.ts`
- Modify: `src/lib/services/problem-service.ts`
- Modify: `src/app/page.tsx:1365-1398`
- Test: `test/problem-correlation.test.ts`
- Test: `test/problem-matrix-empty-state.test.tsx`

**Interfaces:**
- Consumes: Real correlated problems or empty list
- Produces: `GET /api/problems` returning real problems or clean `[]`. `handleSimulateProblems` never injects hardcoded `INITIAL_PROBLEMS`.

- [ ] **Step 1: Update src/app/api/problems/route.ts & problem-service.ts**
  Ensure clean tenants return `[]` unless real problems are correlated.

- [ ] **Step 2: Update handleSimulateProblems in src/app/page.tsx**
  Remove lines 1365-1398 falling back to `INITIAL_PROBLEMS.filter(...)`. Set clean empty state or real correlated problems. Keep lines 1831–2033 strictly untouched.

- [ ] **Step 3: Run problem matrix tests**
  Run: `npx vitest run test/problem-correlation.test.ts test/problem-matrix-empty-state.test.tsx`
  Verify tests pass.

---

### Task 6: Clean Up Context Panel Mock Data & Miscellaneous Mocks

**Files:**
- Modify: `src/components/workspace/AsunPalaceContextPanel.tsx`
- Modify: `src/components/views/WorkforceApprovalsView.tsx`
- Test: `test/asun-palace-store-cockpit-context.test.ts`

**Interfaces:**
- Consumes: `issue` context
- Produces: Dynamic order lookup or clean empty state ("No Orders", "No store orders found for this customer or reference.")

- [ ] **Step 1: Update AsunPalaceContextPanel.tsx**
  Remove hardcoded `MOCK_ASUN_ORDERS` array. If an order matches the issue's customerRef/orderId, display it; otherwise display clean empty state.

- [ ] **Step 2: Update WorkforceApprovalsView.tsx**
  Ensure empty state when no pending approvals exist instead of pre-seeded mock approvals.

- [ ] **Step 3: Run asun palace context tests**
  Run: `npx vitest run test/asun-palace-store-cockpit-context.test.ts`
  Verify tests pass.

---

### Task 7: Comprehensive Verification & Visual QA

**Files:**
- All modified files above

- [ ] **Step 1: Run TypeScript compiler check**
  Run: `npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 2: Run complete test suite**
  Run: `npm test`
  Expected: All tests pass

- [ ] **Step 3: Visual QA with Playwright**
  Run browser test against `http://localhost:3005` to verify:
  - Studio view renders with external launch actions and no fake tickets.
  - Marketplace view renders with external launch actions and canonical Sophia card.
  - Connectors view renders clean empty state or active connections with external Studio management.
  - Installed Products view renders clean empty state with external launch actions.
  - Issues, Overview, Knowledge, and Problems views render clean real/empty states.
  - All labels are $\le 2$ words.

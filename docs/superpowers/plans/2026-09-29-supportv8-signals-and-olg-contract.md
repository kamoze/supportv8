# Implementation Plan: SupportV8 Signals Outbox and OLG Context Integration

**Target Repository**: `supportv8`  
**Date**: September 29, 2026  
**Invariant**: Every ServiceV8 Service App must both **contribute** domain signals and **consume** context from the Operational Learning Graph (OLG).

---

## 1. Architectural Scope

Under Section 5 of `Architecture-essentials.md`, SupportV8 adheres to the Four-Part Service App Contract:
1. **Capabilities**: Declared in ServiceV8 Registry manifests.
2. **Signals**: Emitted via app-local Signal Agent outbox to Runtime Signals (CloudEvents 1.0 envelope).
3. **Actions**: Brokered via Action Gateway and target Domain APIs.
4. **OLG Invariant**:
   - **Contribute**: Emit support tickets, customer escalations, resolutions, and satisfaction outcomes.
   - **Consume**: Query OLG context (active situations, cross-vertical order/patient context, epistemic nodes) to enrich support operations.

---

## 2. SupportV8 Implementation Deliverables

### A. Signal Publisher & Agent Outbox (`src/lib/signals/signal-agent.ts`)
- CloudEvents 1.0 emitter targeting `${RUNTIME_URL}/api/signals/intake`.
- Supports the core SupportV8 business signal types:
  - `com.servicev8.business.support.ticket-created.v1` (facet: `context`, epistemicClass: `domain_fact`)
  - `com.servicev8.business.support.ticket-escalated.v1` (facet: `evidence`, epistemicClass: `reputed_claim` -> triggers `customer_escalation`)
  - `com.servicev8.business.support.ticket-resolved.v1` (facet: `outcomes`, epistemicClass: `verified_receipt`)
  - `com.servicev8.business.support.csat-recorded.v1` (facet: `outcomes`, epistemicClass: `verified_receipt`)
- Fail-soft and non-blocking with retry logic.

### B. Wire into Ticket Lifecycle
1. `src/lib/service-app/runtime-ticket-reader.ts`:
   - Emit `ticket.created` on ticket creation.
   - Emit `ticket.escalated` when priority is `urgent` or status is `escalated`.
   - Emit `ticket.resolved` when status is `resolved` or `closed`.
2. `src/lib/services/issue-service.ts`:
   - Emit `ticket.created` on interaction intake.
   - Emit `ticket.escalated` on high/urgent severity triage.
   - Emit `ticket.resolved` on issue resolution.

### C. OLG Context Consumer (`src/lib/signals/olg-consumer.ts`)
- Fetches active situations and graph intelligence from `servicev8-agentic-runtime`.
- Detects situations matching a ticket, customer, or referenced entity (e.g. order delivery delays or clinical appointments).
- Surfaces live OLG alerts in the Support workspace (`RuntimeWorkspace` / ticket details).

---

## 3. Test-Driven Verification Strategy
1. Unit test `test/signal-agent.test.ts` with mocked fetch and CloudEvents envelope verification.
2. Unit test `test/olg-consumer.test.ts` verifying situation retrieval and cross-entity correlation.
3. Run full test suite in `supportv8` (`npm test`) to guarantee zero regressions.
4. Strict local commits on `main`. No git pushes to origin.

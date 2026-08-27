# supportV8 — Product Design Specification

**Version:** 0.3  
**Date:** August 2026  
**Platform:** ServiceV8  
**Status:** Implementation Design

> **Product principle:** Resolve the customer's problem, not merely answer the customer's question.

---

# 1. Product Definition

supportV8 is an **AI Customer Support Intelligence, Interaction, and Automation Layer**.

It is **not** intended to rebuild Zendesk, Intercom, Freshdesk, ServiceNow, Salesforce Service Cloud, or other mature helpdesk/contact-center systems.

supportV8 connects to the systems a customer already uses, adds real-time intelligence to customer interactions, correlates support activity into business-level Problems and Insights, and enables governed AI Employees to take action through the ServiceV8 Action Gateway.

supportV8 may also provide native customer contact surfaces where required, such as a ServiceV8 chat widget or ServiceV8-managed voice endpoint, but those surfaces exist to provide intelligent interaction — not to recreate a full helpdesk.

---

# 2. Core Value Proposition

Traditional support platforms primarily help teams:

- receive customer contacts;
- assign work;
- manage tickets;
- communicate with customers;
- report on support activity.

supportV8 focuses on a different question:

> **What is happening across customer support, what is causing it, what is the business impact, and what should AI or humans do next?**

Primary outcomes:

- intelligent real-time customer interaction;
- real-time copilot assistance for human agents;
- autonomous support for approved use cases;
- sentiment-aware and confidence-aware routing;
- issue trend detection;
- cross-interaction Problem correlation;
- business-impact analysis;
- proactive customer communication;
- actionable operational Insights;
- support-quality and AI-performance reporting;
- continuous knowledge-base improvement;
- stale-work cleanup and support operations automation.

---

# 3. Operating Modes

supportV8 supports three progressive runtime modes.

## 3.1 Observe

The existing helpdesk/contact system remains unchanged.

```text
Customer
   |
   v
Existing Support System
   |
   +-------> supportV8
                |
                +--> Trends
                +--> Problems
                +--> Sentiment
                +--> Business Impact
                +--> Knowledge Gaps
                +--> Insights
```

Use Observe when the customer wants intelligence without changing agent workflow.

### Observe capabilities

- ingest support events;
- classify issues;
- infer sentiment;
- detect trends;
- correlate Problems;
- identify knowledge gaps;
- calculate business impact;
- generate Insights;
- recommend actions.

---

## 3.2 Copilot

supportV8 observes the live interaction and assists the human agent in real time.

```text
Customer <----> Human Agent
                    ^
                    |
              supportV8 Copilot
                    |
          +---------+---------+
          |         |         |
       Context   Knowledge  Actions
```

### Copilot capabilities

- real-time customer context;
- conversation summarization;
- recommended next response;
- known-Problem detection;
- account/business context;
- knowledge retrieval;
- recommended troubleshooting;
- suggested escalation;
- suggested Action Gateway actions;
- confidence and business-impact warnings;
- automatic tags and notes.

Mutating actions require Action Gateway execution.

---

## 3.3 Autonomous

AI Employees directly handle approved classes of interactions.

```text
Customer
   |
   v
AI Employee
   |
   +--> Real-Time Context
   +--> Knowledge
   +--> Problem Intelligence
   +--> Reasoning / Policy
   |
   v
Action Gateway
   |
   v
Business / Support / Operations Systems
```

### Autonomous capabilities

- answer questions;
- investigate issues;
- execute approved actions;
- update source systems;
- communicate status;
- verify resolution;
- escalate when confidence/risk thresholds require it.

---

# 4. Product Surfaces

supportV8 has three deployment surfaces.

## 4.1 Existing-System Integration

Examples:

- Zendesk;
- Intercom;
- Freshdesk;
- Salesforce Service Cloud;
- ServiceNow;
- HubSpot Service Hub;
- custom support platforms.

These remain systems of record.

supportV8 stores source references and derived intelligence rather than duplicating the complete helpdesk data model.

---

## 4.2 Native Intelligent Contact Surface

Where required, supportV8 can provide:

- ServiceV8 web chat widget;
- ServiceV8 authenticated in-app support;
- ServiceV8 voice endpoint;
- API/webhook interaction endpoint.

This provides direct AI-powered customer interaction without requiring supportV8 to become a traditional helpdesk.

---

## 4.3 Embedded/API Surface

A SaaS application can embed supportV8 and provide authenticated context:

- tenant;
- user;
- account;
- subscription/service tier;
- current screen/module;
- resource ID;
- application state;
- permitted actions.

This allows supportV8 to start the interaction with relevant context already resolved.

---

# 5. High-Level Architecture

```text
                         CUSTOMER CONTACT POINTS
              +-------------+------------+------------+
              |             |            |            |
            Chat          Voice        Email       Existing
                                                   Helpdesk
              |             |            |            |
              +-------------+------------+------------+
                            |
                            v
                  INTERACTION GATEWAY
                            |
                  normalize + stream
                            |
                            v
                REAL-TIME CONTEXT ENGINE
                            |
          +-----------------+-----------------+
          |                 |                 |
       Customer           Issue             Business
       Context            Context           Context
          |                 |                 |
          +-----------------+-----------------+
                            |
                            v
                  supportV8 INTELLIGENCE
                            |
       +--------------------+----------------------+
       |                    |                      |
     Triage              Problems                Insights
     Routing             Correlation             Trends
     Sentiment           Impact                  Knowledge
     Confidence          Verification            Reporting
       |                    |                      |
       +--------------------+----------------------+
                            |
                            v
                      AI EMPLOYEES
                            |
                            v
                      ACTION GATEWAY
                            |
          +-----------------+------------------+
          |                 |                  |
       Helpdesk        Business Systems    Dominion/Warden
```

---

# 6. Interaction Gateway

The **Interaction Gateway** is a ServiceV8 platform component responsible for receiving and normalizing real-time customer interaction events.

supportV8 should not implement channel-specific logic throughout the intelligence stack.

## 6.1 Supported inputs

- ServiceV8 web chat;
- Zendesk Messaging;
- Intercom conversations;
- email;
- Twilio voice;
- ElevenLabs voice;
- WhatsApp;
- SMS;
- custom webhooks;
- application SDK/API;
- other contact-center streams.

## 6.2 Responsibilities

- channel normalization;
- tenant resolution;
- customer/session correlation;
- authentication context;
- real-time streaming;
- conversation-event sequencing;
- deduplication;
- source references;
- correlation IDs;
- retention classification;
- handoff to supportV8 intelligence.

## 6.3 Normalized event

```json
{
  "event": "interaction.message.received",
  "tenant_id": "tenant_123",
  "interaction_id": "int_456",
  "session_id": "session_789",
  "channel": "chat",
  "source": "zendesk",
  "source_reference": "zd_conv_884233",
  "customer_reference": "cust_192",
  "timestamp": "2026-08-26T14:30:00Z",
  "content": {
    "type": "text",
    "text": "My payment keeps failing."
  }
}
```

---

# 7. Real-Time Context Engine

The **Real-Time Context Engine** assembles temporary support context for an active customer interaction.

```text
REAL-TIME SUPPORT CONTEXT

Customer
- identity
- account
- support tier
- prior contacts
- open issues
- sentiment history

Current Interaction
- intent
- sentiment
- urgency
- product
- likely issue
- AI confidence

Business
- account value
- SLA
- subscription
- transactions
- business exposure

Knowledge
- procedures
- policies
- known fixes
- similar successful resolutions

Problems
- active known Problems
- correlated customer reports
- incident state

Systems
- orders
- billing
- identity
- application state
- operational telemetry
```

Most real-time context should be ephemeral.

After the interaction, supportV8 should retain only policy-approved derived state such as:

- summary;
- classification;
- sentiment;
- confidence;
- outcome;
- actions;
- Problem association;
- source reference;
- verification evidence.

---

# 8. ServiceV8 Action Gateway

The **Action Gateway is mandatory for mutating operations**.

AI Employees, automations, Insights, and UI actions must not independently mutate customer systems.

```text
AI Employee / Automation / UI
             |
             v
        Action Request
             |
             v
        ACTION GATEWAY
             |
     +-------+-------+
     |       |       |
   Policy  Approval  Auth
     |       |       |
     +-------+-------+
             |
        Idempotency
             |
             v
      Connector / Tool
             |
             v
       Target System
             |
             v
        Action Result
             |
             v
    supportV8 Audit/Timeline
```

## 8.1 Action Gateway responsibilities

- capability registry;
- typed action schemas;
- tenant authorization;
- RBAC;
- AI Employee authorization;
- policy evaluation;
- human approval gates;
- idempotency;
- retry/timeout control;
- secret isolation;
- execution audit;
- correlation IDs;
- normalized results/errors;
- rollback/compensation hooks where supported.

## 8.2 Example actions

```text
zendesk.ticket.add_tag
zendesk.ticket.update_priority
zendesk.ticket.add_internal_note
zendesk.ticket.close

intercom.conversation.tag
intercom.conversation.assign

account.unlock
account.reset_mfa

customer.refund
subscription.change
subscription.cancel

order.lookup
order.cancel
shipment.lookup

customer.send_email
customer.send_sms
customer.send_whatsapp

knowledge.publish

problem.notify_customers

dominion.investigate
warden.execute_remediation
```

Read-only retrieval may use registered read tools without creating a mutating Action Gateway transaction, but must remain authorized and auditable where required.

---

# 9. Intelligent Triage & Routing

supportV8 calculates routing recommendations in real time.

## 9.1 Sentiment-Based Routing

Detect:

- frustration;
- anger;
- urgency;
- confusion;
- churn language;
- repeated dissatisfaction;
- sentiment deterioration.

Sentiment alone must not determine routing.

---

## 9.2 Priority-Based Routing

Potential inputs:

- explicit source priority;
- severity;
- SLA;
- customer tier;
- affected population;
- Problem association;
- business impact.

---

## 9.3 Confidence-Based Routing

```text
High confidence + low action risk
    -> autonomous

Medium confidence / medium risk
    -> Copilot or approval

Low confidence / high risk
    -> human/specialist escalation
```

Thresholds are tenant-configurable.

---

## 9.4 Resolution Risk Score

Possible inputs:

- sentiment;
- issue severity;
- business impact;
- customer value/tier;
- confidence;
- SLA risk;
- historical reopen rate;
- action risk;
- Problem confidence;
- repeat-contact count.

The resulting score determines:

- autonomous eligibility;
- queue/routing recommendation;
- escalation;
- approval requirement;
- proactive management attention.

---

# 10. Automatic Conversation Intelligence

supportV8 should automatically derive:

- intent;
- topic;
- issue category;
- product;
- version;
- language;
- sentiment;
- urgency;
- severity;
- customer tier;
- likely root cause;
- escalation risk;
- Problem candidate;
- confidence score;
- recommended next action.

Where appropriate, derived tags may be pushed back to the source support system through the Action Gateway.

---

# 11. Issue Intelligence

An **Issue** in supportV8 is an intelligence representation of a customer-support interaction or external case.

It is **not a replacement ticket record**.

Example:

```json
{
  "source": "zendesk",
  "external_id": "884233",
  "customer_ref": "C-192",
  "summary": "SSO authentication failure",
  "sentiment": "frustrated",
  "priority": "high",
  "confidence": 0.94,
  "business_impact": "high",
  "problem_id": "PRB-218",
  "source_status": "open"
}
```

The detailed conversation remains in the source system unless supportV8 itself owns the contact surface.

---

# 12. Trend Spotting

supportV8 detects meaningful changes across:

- issue categories;
- products;
- versions;
- channels;
- customer segments;
- geography;
- sentiment;
- CSAT;
- escalation;
- reopen rate;
- contact volume;
- error strings;
- knowledge usage;
- actions;
- resolution outcomes.

Examples:

- MFA contacts increased 217%;
- refund-related CSAT declined 11%;
- enterprise-account negative sentiment rose sharply;
- checkout failures are concentrated on version 4.18;
- AI-only refund conversations reopen 2.8x more often.

---

# 13. Problem Correlation

supportV8 correlates multiple Issues into underlying **Problems**.

```text
"Checkout keeps spinning"
"Payment will not complete"
"Cannot buy"
"Credit card page freezes"
         |
         v
Problem: Payment API timeout
```

Correlation can use:

- semantic similarity;
- time proximity;
- product/version;
- geography;
- error code;
- infrastructure dependency;
- customer environment;
- telemetry;
- action failure patterns;
- source tags.

Each proposed correlation must have a confidence score.

Tenant policy determines whether Issues can be linked automatically or require review.

---

# 14. Business Impact Analysis

supportV8 should rank Problems by business effect, not merely ticket count.

Potential inputs:

- affected customers;
- affected accounts;
- customer tier;
- ARR/account value;
- revenue/transaction exposure;
- SLA exposure;
- churn risk;
- duration;
- geography;
- product/service;
- dependency criticality.

Example:

```text
Problem: Checkout failure
Affected customers: 126
Enterprise accounts: 7
Linked Issues: 187
Estimated revenue exposure: $84K
Impact: CRITICAL
Confidence: 91%
```

Business impact feeds:

- prioritization;
- escalation;
- routing;
- proactive communication;
- executive dashboards;
- Actionable Insights.

---

# 15. Proactive Communication

When supportV8 identifies a confirmed/high-confidence Problem:

```text
Problem detected
  -> affected population identified
  -> impact calculated
  -> communication drafted
  -> policy / approval
  -> Action Gateway
  -> customer communication
```

Potential messages:

- incident acknowledgement;
- workaround;
- status update;
- expected recovery;
- recovery notification;
- post-incident follow-up.

supportV8 should measure:

- customers proactively contacted;
- duplicate contacts avoided;
- CSAT impact;
- reopen/contact rate after communication.

---

# 16. Actionable Insights

Reports explain **what happened**.

Insights explain:

- what changed;
- why it likely changed;
- who is affected;
- what the business impact is;
- what action is recommended.

Example:

```text
Billing CSAT fell 94% -> 82%.

73% of the decline is associated with refund requests.
AI-only refund Issues reopen 2.8x more frequently.

Recommendation:
Increase autonomous refund confidence threshold
from 72% to 85%.

[Review Issues] [Update Policy]
```

`Update Policy` is a governed mutating operation and must be auditable.

---

# 17. Knowledge Intelligence

supportV8 should **connect to knowledge systems**, not necessarily replace them.

Possible sources:

- Zendesk Guide;
- Confluence;
- SharePoint;
- Notion;
- Google Drive;
- public documentation;
- internal APIs;
- KnowledgeV8.

## 17.1 Knowledge Refresh AI Employee

Detect:

- missing content;
- stale articles;
- contradictory guidance;
- repeated agent rewrites;
- articles associated with poor CSAT;
- new recurring Problems without documentation;
- successful resolutions containing reusable procedures.

Workflow:

```text
Knowledge gap detected
  -> inspect trusted sources
  -> inspect successful outcomes
  -> draft proposed update
  -> attach provenance + confidence
  -> approval policy
  -> Action Gateway
  -> publish to source KB
  -> measure effectiveness
```

---

## 17.2 Call Transcript -> KB

Do not publish transcripts directly.

```text
Call
  -> transcript
  -> extract candidate facts/procedures
  -> compare to existing knowledge
  -> identify reusable knowledge
  -> draft update
  -> provenance + confidence
  -> review/approval
  -> Action Gateway
  -> publish
```

Raw audio/transcripts follow retention policy.

---

# 18. Stale Work Sweep

supportV8 can analyze external ticket/conversation systems for stale work.

Detect:

- no customer response beyond policy;
- no agent update;
- resolved but not closed;
- waiting on third party beyond SLA;
- likely duplicates;
- customer already confirmed resolution;
- ticket superseded by known Problem.

Suggested actions:

- request customer response;
- remind owner;
- escalate;
- add source-system note;
- link to Problem;
- close when policy permits.

All mutations execute through Action Gateway.

---

# 19. Metrics

## North Star

**Verified Autonomous Resolution Rate (VARR)**

## Customer

- CSAT;
- sentiment trajectory;
- customer effort;
- repeat-contact rate.

## Service

- first response time;
- time to resolution;
- SLA attainment;
- backlog;
- escalation rate;
- reopen rate.

## AI

- autonomous resolution rate;
- confidence distribution;
- human handoff rate;
- AI resolution quality;
- verification rate;
- action failure rate.

## Problems

- time to detection;
- affected customers;
- linked Issues;
- time to mitigation;
- business exposure;
- recurrence.

## Economics

- cost per resolution;
- AI cost per resolution;
- human minutes saved;
- interactions per AI Employee;
- estimated support-contact avoidance.

## Knowledge

- knowledge-gap rate;
- stale-content rate;
- knowledge-assisted resolution;
- article effectiveness;
- post-refresh outcome improvement.

---

# 20. Data & Retention

> **Store state and evidence of what happened, not every byte involved in making it happen.**

| Store | Purpose | Examples |
|---|---|---|
| PostgreSQL | durable derived intelligence | Issues, Problems, Insights, action records, metrics, source references |
| Redis | transient runtime state | active context, session state, locks, rate limits |
| S3 | temporary/heavy artifacts | optional transcripts, attachments, diagnostics, exports |
| Source system | primary customer interaction record | Zendesk ticket, Intercom conversation, email/call record |

Retention is tenant-policy controlled.

Recommended default posture:

- raw real-time context: ephemeral;
- raw transcripts/audio: short-lived unless explicitly required;
- source messages: source-system owned;
- derived summaries/classification: operational retention;
- Action Gateway audit: policy/compliance retention;
- aggregate metrics: long-lived.

---

# 21. ServiceV8 Global Menu

```text
SERVICEV8

Home
Workspace

PINNED
  supportV8
  Dominion
  ...

Apps
Automations

Settings
```

### Home

Cross-platform operational view.

### Workspace

Multi-turn AI Employee interaction.

Users can talk to Support Employees, Support Analysts, Knowledge Employees, Incident Employees, etc., without entering a specific product.

### Apps

Application switcher.

### Automations

Cross-product automation view.

### Settings

Organization/platform configuration.

---

# 22. supportV8 Application Menu

Keep the product menu intelligence-focused.

```text
supportV8

Overview

INTELLIGENCE
  Issues
  Problems
  Trends
  Insights

KNOWLEDGE
  Knowledge

ANALYZE
  Reports

CONFIGURE
  Sources
  Policies
```

Optional future addition:

```text
OPERATIONS
  Automations
```

if support-specific automation volume warrants a dedicated page.

---

# 23. Landing Page / Admin Overview

The Overview is a **Customer Support Intelligence Command Center**, not a ticket dashboard.

## 23.1 Header

```text
supportV8 — Customer Support Intelligence

[Ask supportV8...]            [Date Range] [Customize]
```

Controls:

- Agentic Chat;
- date range;
- saved views;
- dashboard customization;
- notifications;
- account/help.

---

## 23.2 KPI Strip

Recommended defaults:

```text
CSAT
Issue Volume
Active Problems
Verified Autonomous Resolution
Business Impact at Risk
```

Optional:

- average resolution time;
- reopen rate;
- handoff rate;
- SLA attainment;
- cost per resolution.

---

## 23.3 Needs Attention

Example:

```text
CRITICAL
Checkout failures
187 customers affected
$126K estimated revenue exposure
+284% over baseline
[Investigate]

WARNING
Refund CSAT
82% -> 71%
[View Insight]

KNOWLEDGE
MFA contacts increased sharply
Likely documentation gap
[Review]
```

---

## 23.4 AI Discovered

Examples:

- 3 emerging Problems;
- 6 knowledge gaps;
- 43 stale external Issues potentially safe to close;
- 187 interactions likely related to one incident;
- 12 high-value customers showing severe negative sentiment;
- 2 automation policies producing elevated reopen rates.

Every discovery should expose an actionable next step.

---

## 23.5 Active Problems

Columns:

- Problem;
- status;
- impact;
- affected customers;
- linked Issues;
- business exposure;
- confidence;
- owner/AI Employee;
- source systems;
- trend.

---

## 23.6 Trends

Show:

- issue volume;
- Problem creation;
- CSAT;
- sentiment;
- autonomous resolution;
- reopen;
- escalation.

The Overview should show only top-level trends; detailed analysis belongs in Trends.

---

## 23.7 AI Workforce

Optional panel showing Support Employees operating on connected systems:

- Employee;
- role;
- state;
- active assignment;
- actions completed;
- CSAT/outcome metrics;
- escalations;
- autonomous-resolution rate.

Employee configuration remains in global Workspace.

---

## 23.8 Recent Activity

Examples:

- Problem detected;
- Issues correlated;
- action executed;
- proactive communication sent;
- routing recommendation changed;
- knowledge proposal generated;
- KB change published;
- stale Issue closed;
- high-impact escalation created.

---

# 24. Page Details

## 24.1 Issues

Purpose: intelligence view over external interactions.

Columns/filters:

- source;
- external reference;
- customer;
- summary;
- category;
- sentiment;
- priority;
- confidence;
- business impact;
- Problem;
- source status;
- AI recommendation.

Clicking an Issue should provide intelligence and a deep link to the source system.

---

## 24.2 Problems

Purpose: identify underlying systemic causes across individual customer contacts.

Problem detail:

- summary;
- suspected cause;
- confidence;
- affected population;
- linked Issues;
- source systems;
- trend;
- business impact;
- customer segments;
- owner;
- recommended actions;
- communications;
- remediation;
- verification/recovery.

---

## 24.3 Trends

Views:

- issue/category trends;
- sentiment;
- CSAT;
- contact volume;
- Problem trends;
- product/version;
- customer segment;
- channel;
- source system;
- reopen/escalation;
- knowledge usage;
- AI outcome quality.

---

## 24.4 Insights

Each Insight:

- finding;
- evidence;
- confidence;
- affected segment;
- business impact;
- likely driver;
- recommended action;
- Action Gateway action where applicable;
- status/outcome.

---

## 24.5 Knowledge

Shows connected knowledge intelligence:

- sources;
- gaps;
- stale items;
- conflicts;
- proposed updates;
- source effectiveness;
- knowledge/outcome correlation;
- publish approvals.

---

## 24.6 Reports

Report families:

- executive/customer experience;
- support operations;
- AI performance;
- Problem management;
- business impact;
- economics;
- knowledge effectiveness;
- source/channel performance.

Reports can be scheduled/exported.

---

## 24.7 Sources

Configure integrations to:

- helpdesks;
- messaging platforms;
- voice providers;
- email;
- CRM;
- billing;
- commerce;
- identity;
- product APIs;
- telemetry/operations;
- knowledge systems.

Each source should declare:

- read capabilities;
- event/webhook capabilities;
- real-time capabilities;
- Action Gateway capabilities;
- retention classification;
- health/sync state.

---

## 24.8 Policies

Configure:

- confidence thresholds;
- sentiment escalation;
- business-impact thresholds;
- autonomous-operation eligibility;
- approval requirements;
- prohibited actions;
- customer-tier treatment;
- Problem-linking policy;
- proactive communication;
- stale-work behavior;
- knowledge publication policy;
- retention policy;
- Resolution verification.

---

# 25. Backend Architecture

Recommended foundation:

| Layer | Implementation |
|---|---|
| APIs | FastAPI or existing ServiceV8 service standard |
| Runtime | ECS/Fargate initially; EKS where platform-standard |
| Workflow | Temporal |
| Database | PostgreSQL + PgBouncer |
| Cache | Redis |
| Artifacts | S3 |
| Events | EventBridge/SQS initially |
| Vector retrieval | pgvector initially |
| Search | PostgreSQL first; OpenSearch when justified |
| AI runtime | shared ServiceV8 Employee/model runtime |
| Mutation plane | ServiceV8 Action Gateway |
| Observability | OpenTelemetry + ServiceV8 observability |

---

# 26. Suggested Services

```text
support-api
interaction-gateway
context-service
intelligence-service
issue-service
problem-service
insights-service
knowledge-intelligence-service
source-connector-workers
realtime-workers
temporal-workers
```

The Action Gateway remains a shared platform service and should not be reimplemented in supportV8.

---

# 27. Event Model

Shared ServiceV8 envelope:

```json
{
  "event": "problem.detected",
  "tenant_id": "tenant_123",
  "entity_id": "prb_789",
  "source": "supportv8",
  "timestamp": "2026-08-26T14:30:00Z",
  "correlation_id": "corr_abc",
  "data": {}
}
```

Key events:

```text
interaction.started
interaction.message.received
interaction.completed

issue.created
issue.classified
issue.sentiment_updated
issue.confidence_updated

problem.detected
problem.issue_linked
problem.impact_updated
problem.resolved

insight.created
insight.action_recommended

action.requested
action.approval_required
action.executed
action.failed
action.verified

knowledge.gap_detected
knowledge.update_proposed
knowledge.published

csat.received
trend.detected
```

---

# 28. Implementation Strategy

The implementation priority is:

```text
Connect
  -> Observe
  -> Understand
  -> Correlate
  -> Assist
  -> Act
  -> Verify
  -> Automate
```

Do not start by recreating ticket workflow, agent inboxes, or helpdesk administration.

---

# 29. MVP

The MVP should prove that supportV8 can create meaningful intelligence from existing support systems and participate in real-time interactions.

## Required

- source connector framework;
- first helpdesk integration;
- Interaction Gateway;
- real-time event normalization;
- derived Issue model;
- sentiment classification;
- topic/intent/tag classification;
- confidence scoring;
- basic trend detection;
- Problem correlation;
- basic business-impact scoring;
- Overview;
- Issues;
- Problems;
- Trends;
- Sources;
- Policies;
- Agentic read-only Chat;
- Action Gateway integration;
- at least one governed write-back action;
- retention controls;
- metrics/observability.

## Next

- Copilot recommendations;
- knowledge-gap detection;
- stale-work sweep;
- proactive communication;
- enhanced business impact;
- Actionable Insights;
- autonomous interaction for selected use cases;
- voice real-time support;
- Knowledge Refresh Employee.

---

# 30. Acceptance Criteria

supportV8 is ready for initial launch when:

1. A tenant can connect an external support source without migrating tickets.
2. supportV8 can receive new interactions in near real time.
3. supportV8 can classify sentiment, issue type and confidence.
4. supportV8 creates derived Issues referencing the source rather than duplicating the source record.
5. supportV8 can correlate multiple Issues into a Problem.
6. Problems receive a transparent business-impact score.
7. Agentic Chat can query support intelligence.
8. A governed Action Gateway action can update a connected source system.
9. Mutating AI/automation operations cannot bypass the Action Gateway.
10. Real-time context can be discarded independently of durable derived intelligence.
11. Retention policies are tenant configurable.
12. The Overview surfaces Needs Attention, AI Discovered, Active Problems and actionable Insights.
13. Source-system deep links work from Issues/Problems.
14. All AI classifications/actions include confidence and audit metadata.
15. A customer can begin in Observe mode and later enable Copilot or Autonomous mode without replatforming.

---

# 31. Non-Goals

supportV8 V1 is **not**:

- a Zendesk replacement;
- a complete ticketing platform;
- a full agent workforce-management suite;
- a contact-center PBX;
- a permanent archive of all customer conversations;
- a replacement CRM;
- a replacement for every external knowledge system.

Its job is to provide **real-time intelligence, AI assistance, autonomous action, correlation, and continuous operational improvement across the customer's existing support ecosystem**.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SupportV8 serves customer-support operators, tenant administrators, and their end customers. Operators manage conversations and tickets in Work Desk. Administrators configure the tenant, workforce, channels, knowledge, governance, and public support experience. End customers use the tenant domain to find verified help, start a conversation, and track requests.

## Product Purpose

SupportV8 gives each organization an isolated support workspace that combines human operators, optional AI employees, multi-channel conversations, ticket operations, and grounded knowledge. Success means a customer can get a trustworthy answer or reach the right operator without exposing another tenant's data, while staff retain control over consequential actions.

## Positioning

The product joins a tenant-scoped public support portal directly to the same governed Work Desk, KnowledgeV8 retrieval, routing, and audited action infrastructure used by support staff. Public self-service must hand off into a real conversation or ticket without losing context.

## Operating Context

- Each tenant has a branded support domain and an authenticated operator workspace.
- Customer conversations may arrive through web chat and configured communication channels.
- Knowledge is uploaded, crawled, curated, published, retrieved with citations, and separated by tenant and audience.
- New tenants start empty: no subscriptions, employees, analytics, tickets, presence, or published knowledge unless explicitly created.
- Human operators remain available independently of whether an AI employee is subscribed.

## Capabilities and Constraints

- PostgreSQL is the durable system of record; Redis supports transient chat delivery and presence.
- Tenant data is protected by strict row-level security and server-resolved tenant identity.
- The public portal may expose only published, customer-facing knowledge. Internal tickets, operator notes, Ask context, prompts, source identifiers, and tenant identifiers are never public retrieval inputs.
- Portal customization uses controlled, accessible blocks rather than arbitrary HTML or JavaScript.
- RAG actions are published tenant resources addressed by opaque slugs. The server resolves their prompt templates and retrieval filters.
- AI may draft portal content and support actions, but a tenant administrator previews and publishes changes.
- Public AI usage requires rate limits, budget enforcement, citations, and an honest unavailable/human-handoff state when retrieval or generation fails.

## Brand Commitments

The product name is SupportV8. In-product surfaces use the established dark enterprise interface, high-contrast text, teal primary actions, flat icons, and concise operational language. Customers must never be redirected to or shown Keycloak.

## Evidence on Hand

- The existing product and public tenant portal are implemented under `src/app` and `src/components`.
- Tenant-aware PostgreSQL repositories and RLS migrations are under `src/lib/db` and `migrations`.
- Knowledge ingestion and the KnowledgeV8 service adapter exist, but the current public portal search and several local retrieval paths still contain mock or hard-coded behavior that must not be represented as live evidence.
- There are no approved customer testimonials or benchmark claims available; future interfaces must not invent them.

## Product Principles

1. Resolve tenant identity on the server and fail closed on ambiguity.
2. Start empty and show honest zero states instead of seeded operational data.
3. Preserve customer context from self-service through chat, ticket, and operator resolution.
4. Keep AI grounded, cited, metered, and subordinate to human publishing and action controls.
5. Prefer controlled configuration over arbitrary code in customer-facing surfaces.

## Accessibility & Inclusion

Public support and administrative controls must be keyboard operable, responsive, labeled for assistive technology, and maintain readable contrast and visible focus states.

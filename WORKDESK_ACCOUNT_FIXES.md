# Workdesk and account fixes — 2026-09-03

Release candidate: implementation and local validation complete. Production behavior
must be verified after the normal CircleCI / GitOps rollout; see the release pull
requests and their deployment checks for the current rollout status.

App branch: `codex/workdesk-account-fixes`, based on `a126d70`.
Companion DevOps branch: `codex/supportv8-account-profile`, based on `258cd78a`.
The separate, unfinished flat-icon work was left untouched.

## Root causes and changes

1. **Manual tickets:** Workdesk previously created a browser-only issue using
   `tenant_default`; it never sent a save request. It now waits for an authenticated
   API response backed by the existing tenant-scoped Postgres transaction. The
   ticket, conversation, operator-authored intake, creation history, Workdesk item,
   and outbox event are saved together. Failure preserves the form and customer
   details. There is no in-memory success fallback. Communication-channel controls
   remain available.
2. **Operator name:** The menu linked to the external Keycloak account site. The
   in-app profile now updates only the authenticated operator's first name and
   nickname through the internal identity API, preserving tenant/security
   attributes. Token refresh applies the name to subsequent replies. If refresh
   fails after saving, the UI explicitly asks for another sign-in.
3. **Live routing presence:** The screen previously read seeded browser-memory
   staff and fake online toggles. It now reads tenant-isolated Redis presence
   maintained by signed staff heartbeats, with 90-second expiry and logout cleanup.
   Only currently hired AI employees from the tenant's existing workforce catalog
   appear alongside staff. The exact reported "3 Online" roster (Ini, Alex, Elena,
   Sarah) and its fabricated active-chat counts were traced to the legacy
   `activeStaffPresence` array, not real logins. That array is now removed as well;
   the legacy read returns an empty list and unsigned local online toggles reject.
   Legacy human chat routing falls back to the queue, never those fixture people.
   No real user or production database records were deleted.
4. **Account RBAC:** The globally seeded member endpoint is replaced by real
   Keycloak accounts and server-side permission checks. Owners and CX leads can
   manage permitted accounts in their own tenant; only owners can manage leadership
   roles. Ordinary operators, observers, and demo identities cannot manage members.
   Self-demotion and changes to existing owner access are rejected. The actor's
   current permissions and the target's tenant are rechecked in Keycloak for each
   management request. Invitations report email delivery failures and can be resent.
5. **First-party account setup:** Invitations now use SupportV8 email links and an
   in-app password setup page, not Keycloak action emails or account pages. Random,
   single-use tokens are hashed in the existing Redis service, tenant-bound, and
   expire after 24 hours. Resends replace older links with a 60-second cooldown.
   Merely opening an email link does not consume it; only submitting the setup form
   does. Tokens are removed from the browser address bar and are not persisted in
   browser storage. Activation uses the internal identity API and never accepts
   tenant, user, role, or redirect destinations from the browser.
6. **Authentication navigation:** Signup constructs the tenant SupportV8 address
   locally instead of trusting a response redirect. Authentication requests reject
   redirects. Signup and invitation pages restrict connections/forms to their own
   origin and disable caching/referrers. The standalone `/signup` prototype now
   uses the real verification/provisioning flow. Customer-facing provider labels
   and the external profile link are removed; Keycloak remains server-side.

The UI-hardening pass removed misleading local-only controls and added explicit
loading, empty, error, retry, and save-in-progress states. The former custom-group
editor did not enforce authorization; its mutation API now directs callers to
Members instead of pretending to implement RBAC.

## Validation

- Unit/regression suite: 396 passing; 12 integration tests skipped in the default run.
- Fresh release run with CircleCI's Redis integration flag: 404 passing; the 4
  identity/Postgres-only tests were skipped in that combined run.
- All 7 database/Redis integration tests also passed in a separate run against
  disposable local PostgreSQL 16 and Redis 7 instances. The Postgres schema came
  from the current DevOps manifest and used `supportv8_app` without BYPASSRLS.
- Real-database checks cover manual ticket persistence across connections,
  creation history, resolve/close, and denied cross-tenant reads/updates.
- Real-Redis checks cover cross-instance visibility, tenant separation, expiry,
  name updates, and logout removal.
- Five additional invitation integration tests passed against disposable local
  Redis 7 and Keycloak 26: concurrent submission, replay, expiry, token hashing,
  replacement links, cross-tenant rejection, and real invitation acceptance followed
  by password login. The test identity service account had only the production
  `manage-users` and `view-realm` roles. Only email delivery was mocked.
- Four legacy-presence regression assertions failed against the old seeded roster
  before its removal, including routing a demo chat to a hard-coded person. The
  updated tests require no legacy roster, no unsigned toggles, and queue fallback.
- API tests cover unauthenticated access, insufficient roles, cross-tenant edits,
  stale manager claims, protected owners, profile field isolation, and browser
  origin checks behind TLS ingress.
- Desktop and 390px mobile browser checks used actual UI components with isolated
  synthetic API fixtures: member edit, empty AI presence, nickname save, and ticket
  save failure with retained inputs. Invitation checks covered fragment removal,
  expired-link feedback, success, local sign-in, and the real signup page. Scoped
  invitation controls were corrected to 16px text and at least 48px touch targets.
  This was not a production end-to-end test. Temporary fixture routes were removed
  before the production build.
- TypeScript check and production build passed. DevOps YAML/profile JSON and
  embedded job shell syntax passed local validation.

## Deployment order and remaining checks

1. Merge the companion DevOps profile ConfigMap and the narrowly scoped
   `keycloak-supportv8-account-profile-v1` Job. Verify the Job completes and the
   nickname profile attribute and access-token mapper exist. It does not create
   users, change passwords, or replay the realm/demo bootstrap.
2. Merge the app branch through the normal CircleCI pipeline and GitOps image
   update. No new database, Redis deployment, or schema migration is required.
3. With approved non-demo test accounts, verify first-name/nickname save and the
   resulting chat sender name, invitation email delivery and acceptance, owner/CX
   lead/operator permissions, ticket reload/history, presence across replicas, and
   an empty newly provisioned tenant.

Invitation delivery requires the existing Resend configuration; there is no provider
email fallback. An invitation is consumed before credential writes to prevent replay.
If setup is interrupted or the provider response is ambiguous, the user must request
a replacement invitation or sign in if setup completed. The page explains this.

Important limits: Keycloak role/status changes end renewable sessions, but already
issued access tokens remain usable until their configured expiry. Management
endpoints additionally recheck live authority. Immediate global JWT revocation is
not implemented here. Custom routing-group RBAC is not implemented. AI hiring
entitlement persistence is unchanged; the presence view uses the existing catalog
as its source. Actual Keycloak/email integration still needs post-deployment checks.

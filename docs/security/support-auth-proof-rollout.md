# Support Cloudflare proof and registered workspace routing

This change replaces the local arithmetic check with the official Cloudflare
Turnstile widget and Gateway's strict v1 verification. Global sign-in asks only
for a workspace slug. Registry resolves its explicit registered HTTPS origin;
credentials are entered only on that tenant host, with its current company name.
Both `/api/auth/login` and the retained `/login` POST require the same proof.
`GET /login` redirects into the native form without a middleware loop.

## Authority and replay boundaries

The server issues a five-minute Redis transaction containing only hashes of the
host/action/email/slug binding and a random cookie secret. Its host-only Secure,
HttpOnly, SameSite=Strict cookie and cdata must match; atomic consumption precedes
provider verification. Wrong binding, expired or replayed proof cannot trigger
credential verification or signup/recovery email. A provider rejection or uncertain
response requires a new transaction. There is no memory fallback or public test
site/secret key in production. Redis also bounds public discovery requests.

Gateway v1 validates exact hostname/action/cdata and provider challenge age.
Support explicitly requests `bot:verify` for audience `servicev8-action-gateway`,
rejects legacy responses, and bounds token/provider body bytes and elapsed time.
Only Gateway holds the provider secret. Client rendering follows the official
[Cloudflare widget configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/),
using compact size where a 300px widget cannot fit.

Registry resolver dependency: merged `2185fec8b898ae230d0f80b5d9252bcfa45c2b38`.
Gateway strict verifier dependency: merged `1c0e4c60760a6143d3ca0f9ab9edf6eecd558c87`.
Registry discovery uses the existing allowlisted membership reader, explicit
`registry:memberships:read`, and its exact versioned response. Canonical account
and tenant IDs stay on the server. No hostname is synthesized on discovery failure.

After password verification, the issuer's access token is cryptographically
verified. Its subject, tenant_id and account_id must match the consumed Registry
binding; the current registered host, current exact membership and actual local
`supportv8.tenants` ID/domain/account row are checked before issuing cookies.
No role or account is inferred from the email, hostname, app admin name or slug.
Existing Support role policy remains separate from Registry membership.

## Compatibility and rollout hold

**Do not merge/roll out this mandatory gate until the prerequisite review below
is complete.** Main's existing CircleCI publisher automatically updates the
Support GitOps image after a successful main build; this is not an inert source
merge. This branch does not disable that pipeline or add an authentication bypass.

| Identity condition | Result |
| --- | --- |
| Verified claims, canonical Registry ID, native persisted ID/domain/account and current membership already exactly agree; existing native ID parser resolves the same slug | Eligible for the existing Support role check |
| Canonical tenant ID is opaque/different from the legacy native ID, even if email or slug matches | 503 mapping-not-ready; no session, alias or new owner fabricated |
| Missing/foreign canonical account/tenant claim or subject, inactive membership, revoked/reassigned host | 403; no session |
| Native persisted mapping missing, Registry/Redis/provider unavailable | Fail closed; no synthetic success |

Current native `resolveRequestTenant` and refresh still use the legacy native ID
representation. This PR does not migrate all native identities or introduce a
canonical mapping table. Every real existing workspace mapping remains unknown
until compared with owner records. The existing password grant remains a migration
boundary; this is not authorization-code-flow qualification. Canonical first-owner
onboarding, invitation lifecycle and local group authority are separate work.

## Nonsecret deployment handoff

Read-only source inventory at DevOps `4923e16d2af6c4c102d8ec876489bbc697a65931`
and live deployment metadata observed during this review:

- Support image `web-33abb68`: Redis and Registry reader configured; no
  `SUPPORT_AUTH_BOT_*` names observed.
- Gateway image `agw-1c0e4c6`: strict v1 source deployed; provider configuration
  reference exists. This observation is not a successful provider qualification.
- Registry image `reg-b988207`: no `REGISTRY_WORKSPACE_HOSTS_JSON` observed at
  that snapshot. The newer resolver merge still needs its deployment and inventory.

| Required setting | Existing evidence / exact remaining prerequisite |
| --- | --- |
| `REDIS_URL` | Existing Support auth Redis and `AUTH_REDIS_PASSWORD` reference. Keep durable Redis/AOF; cross-instance atomic test required. |
| `REGISTRY_URL`, `SERVICEV8_OIDC_ISSUER`, `SUPPORTV8_RUNTIME_REGISTRY_CLIENT_ID` | Existing Registry service URL, public issuer, client `supportv8-runtime-registry`. |
| `SUPPORTV8_RUNTIME_REGISTRY_CLIENT_SECRET` | Existing Secret `supportv8-runtime-support-handoff`, key `registry_client_secret`; already allowlisted by `REGISTRY_MEMBERSHIP_WORKLOAD_CLIENT_IDS`. No credential change proposed. |
| `SUPPORT_AUTH_BOT_GATEWAY_URL` | Exact existing Gateway service origin, reviewed configuration required. |
| `SUPPORT_AUTH_BOT_TOKEN_URL` | Exact existing issuer token endpoint, reviewed configuration required. |
| `SUPPORT_AUTH_BOT_CLIENT_ID` | Existing `supportv8-execution` already has Gateway audience and is in `ACTION_GATEWAY_EXECUTION_WORKLOAD_CLIENT_IDS`. Its reviewed bootstrap currently grants only `action:execute`; `bot:verify` is missing and must be reconciled by the Identity owner before use. Do not borrow another app's client. |
| `SUPPORT_AUTH_BOT_CLIENT_SECRET_FILE` | If that existing caller is approved for reuse, mount existing Secret `managed-support-supportv8-execution`, key `client_secret`, read-only at a reviewed absolute file path. ESO already maps `/servicev8/managed-support-workloads/supportv8-execution`, property `client_secret`. No new value or rotation needed/proposed. |
| `SUPPORT_AUTH_BOT_SITE_KEY` | No Support site-key reference exists. Runtime references `/servicev8/propv8-captcha` property `turnstile_site_key`; Prop's Secret `propv8-captcha` key `TURNSTILE_SITE_KEY` has the same reference. This is a candidate shared public-key source only: verify it is paired with Gateway's actual managed verifier secret and authorized for global and exact Support tenant hosts before adding an ESO reference. No value was read or assumed. |
| Gateway provider secret | Existing `ACTION_GATEWAY_TURNSTILE_SECRET_REF=eso://servicev8/action-gateway/managed/turnstile`. Its match to the candidate site key remains unverified; do not regenerate it. |
| `REGISTRY_WORKSPACE_HOSTS_JSON` | Reviewed canonical tenant/account/slug records, exact ingress/TLS host registration and active status are required. DNS wildcard or app-local IDs alone are insufficient. Also prove the exact persisted Support identity/claim compatibility above. |

Ordering: first review canonical registrations/mappings and the existing caller's
minimal scope reconciliation; then reconcile owner configuration and verify
Gateway/Registry readiness. Add the reviewed Support public key, existing Secret
mount and endpoint references before the mandatory Support image is released.
Qualify real company-host discovery, current-user signin, denied foreign/revoked
membership, and one-use signup/recovery email proof on the approved environment.
Keep this PR draft while any mapping/configuration prerequisite remains unknown.
No live Secret values, records, DNS, Identity clients or deployments were changed
by this work.

## Validation evidence

- Full local suite with task-owned disposable Redis: 1,362 passed, zero failures,
  99 existing optional SQL/standalone fixtures skipped. Hosted mandatory SQL gates
  remain unchanged and must pass at the exact final revision.
- Required Redis lane explicitly exercises independent clients, process replacement
  and exactly one winning proof consumption; no CI skip fallback.
- Mounted routes cover both credential POSTs, exact strict Gateway payload, safe
  return path/cookies, replay, global credential denial, signup proof before email
  and revocation during credential verification with no session.
- Actual RSA/JWKS fixture verifies signature and client before password claims are
  exposed. Canonical opaque-ID, foreign subject/account, current membership and
  native mapping denials are explicit regressions.
- `scripts/auth-turnstile-browser-qa.ts` runs real Chrome against the native Next
  application and actual mounted handlers using controlled external owners. It
  covers desktop/mobile global-to-tenant navigation, credential rejection after
  proof, company greeting and signup email gating. It does not claim live provider,
  delivery, account provisioning or successful canonical native signin qualification.

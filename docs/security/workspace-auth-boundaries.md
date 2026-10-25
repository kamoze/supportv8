# Bounded workspace auth corrections

This change removes false success and closes server-validation gaps found during
`servicev8.workspace-aaa.v1` adoption. It does not qualify the full standard.

Runtime-linked sessions no longer obtain a synthetic owner roster from local
Marketplace state. Member list/invite/update/resend return an explicit unavailable
response without creating an in-memory user, assigning a role or claiming an email
was sent. Runtime profile reads remain projections of the authenticated session;
profile writes return unavailable because no authoritative write contract exists.
The native Keycloak-backed member path is retained, including current identity
role checks, tenant filtering, leadership restrictions and real delivery results.

Signup now requires bounded company/full-name/email fields and exact password
confirmation on the server before OTP receipt lookup, tenant reservation or
identity effects. The browser sends both exact password strings without trimming
credentials. Existing proof, failed-provisioning reservation and retry tests stay
in place.

| Standard row | Status of this change |
|---|---|
| HOST | Existing host/origin and cross-tenant tests retained. No new routing contract. |
| SIGNUP | Required field and password confirmation denials exercise the actual route before proof/provision effects; exact confirmed password reaches identity unchanged. |
| LOGIN | Unchanged; private code-flow and server-side interactive bot proof migration remain open. |
| SESSION | Existing authenticated Runtime/native context retained; no fabricated local membership. |
| MEMBERS | Runtime synthetic administration is unavailable honestly. Real canonical Registry invitation/member lifecycle remains implementation work; native Keycloak roles are not relabeled as Registry workspace ownership. |
| GROUPS | No canonical group projection is invented; current group API remains unavailable for mutation. |
| INSTALL | Owner-only acquisition remains a separate shared-owner repair. |
| AUDIT | Existing native records retained; complete shared AAA audit adoption remains open. |
| UI | Signup transport carries exact confirmation; no visual redesign or full browser conformance claimed. |

Support still uses arithmetic browser CAPTCHA and lacks a server Turnstile
proof/OTP-continuation contract. The native signup path still has legacy local
tenant reservation/Keycloak provisioning and creates a CX lead, not a canonical
Registry owner. These are explicit remaining gaps, not completed or silently
substituted flows. No production secret/configuration, migration or deployment is
changed here. Full CircleCI, including existing SQL/Redis gates, remains required.

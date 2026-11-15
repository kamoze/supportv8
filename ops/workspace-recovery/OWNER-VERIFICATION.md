# Legacy workspace owner verification

Decision: user explicitly required owner verification before linking on2026-10-25.
The four exact slug/native-ID pairs in `owner-verification-required.json` remain
held. This is a denial policy, not a registration, ownership grant or proof receipt.
The current recovery import contains only the separately confirmed Acme and
Runtime acceptance workspace tuples and cannot resolve these legacy identities.

## Evidence needed to complete a case

Open one governed recovery/audit case per native workspace. Preserve the existing
native ID and data throughout. Record the case identifier, reviewer, timestamps,
expiry and outcome; keep raw credentials, OTPs, tokens and private user details
out of Git, application logs and public discovery responses.

1. Establish the original legacy workspace and original owner from authoritative
   signup/administrative records. An app role named `support_superadmin`, a generic
   admin/lead role, a display name, matching email or possession of the slug alone
   cannot establish ownership. If original owner provenance is unavailable,
   escalate the case; do not substitute a guessed owner or create an account.
2. Verify the original human through the identity owner with the exact legacy
   issuer and subject and a current authentication/email verification step as
   required by that owner. Existing password-recovery OTP only establishes access
   to the recovery channel; it does not independently establish workspace ownership.
   No existing identity password or credential is copied or reset by this migration.
3. Identify the exact target canonical Registry account and tenant. Verify the
   target human through the shared issuer, and require current active Registry
   role exactly `owner` on that account/tenant. Preserve legacy/shared subjects
   separately. Do not merge them solely because their strings/emails match.
4. Obtain an authenticated, scoped approval of the exact native-to-canonical tuple
   through the owning administrative process, with the required recent auth/step-up.
   Bind the approval to this case, both issuer/subject pairs and exact target
   account/tenant. Record safe immutable evidence references and a bounded expiry.
   Recheck original authority, current canonical ownership and absence of conflicting
   bindings immediately before applying a reviewed migration. Deny revoked,
   expired, ambiguous or replayed approval.
5. Prepare a new reviewed, versioned GitOps migration and explicit Registry host
   registration for the verified tuple, with an auditable outcome. Preserve IDs,
   existing permissions and final-owner protections. Changing the local crosswalk
   does not create human membership or authorize a new installation. If a canonical
   owner/account or identity-link operation does not yet exist, leave the case open.
6. Release only the completed workspace's hold in a new source policy revision,
   paired with the approved migration and current owner records. Pass the required
   SQL/host/session/revocation checks and real successful owner qualification before
   enabling access. Other holds remain active. A rename cannot release a hold:
   both original slug and native ID are checked.

## What this release implements

Discovery and tenant-page/login paths show an actionable owner-verification state
without credential fields. Login authority and native-ID resolution reject held
identities even if an arbitrary current registration or a renamed crosswalk appears.
Runtime services cannot write the crosswalk. Verification does not automatically
link, promote a role, enroll an identity or install any package.

No self-service ownership-claim or approval endpoint is introduced by this change.
The verified identity/owner steps above are real outstanding case work, not a
synthetic pass based on email OTP or an operator-provided boolean. Public UI gives
instructions only; it does not claim that verification was started or completed.

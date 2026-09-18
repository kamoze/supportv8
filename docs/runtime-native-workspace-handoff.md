# Runtime handoff into the native SupportV8 application

The destination is the existing SupportV8 application at `/?view=cockpit&handoff=runtime`. Do not build a second `/runtime` cockpit or copy native menus into an integration shell. The original signed, single-use handoff verification and host-only HttpOnly session remain the authority.

## Session and permissions

- The native application hydrates its display session through `GET /api/auth/workspace-session`. This response contains no credential. Expiry is the original server-session expiry; hydration does not renew it.
- Native APIs recognize the Runtime session through `resolveRequestTenant`, which calls the existing live membership/installation/workspace authorization. An invalid or revoked presented Runtime session fails closed, including when another Keycloak browser cookie exists.
- Use the verified `workspaceId` as the native database tenant ID. Never derive it from a slug or accept tenant overrides from browser state.
- `support:manage` maps to native `support_cx_lead`; it does not confer platform/global superadmin rights. `support:read` displays as observer, has operator read access, and cannot issue non-safe requests except logout. The existing Sophia launch GET is also denied for readers because it updates account linkage.
- Expired display metadata is discarded locally. It must not call logout during bootstrap and erase a newly issued SSO cookie. Explicit logout clears both native and Runtime session cookies.
- Native member management retains its own Keycloak identity checks. This release does not fabricate a local account or bypass those checks for a Registry subject.

Native ticket reads and updates use the existing Postgres/RLS repository with all workspace sources, including `runtime_manual`. Linked workspaces do not merge seeded mock tickets or fall back to mock updates. Manual creation uses the existing durable workdesk path. Website chat intake and operator message interactions (`/api/chat/session`, `/api/chat/message`, `/api/chat/draft`, `/api/chat/stream`) write to the linked workspace's Postgres tenant storage through the audited `chatRepository` and `resolveRequestTenant`.

## Legacy storage boundary

Opening the native application does not make every pre-existing native module tenant-ready. Some policy and knowledge mutation handlers still use global/demo stores and do not call the native authorization resolver. Middleware blocks Runtime-cookie mutations outside the audited resolver routes or dedicated Runtime APIs. This includes policy changes, knowledge publication/upload, legacy workforce delegation, local credit changes, marketplace mutations and voice-session writes. These require real tenant storage integration before activation; removing the guard alone is not an implementation.

The middleware check is deny-only. Cookie presence never proves authorization; allowed native handlers still verify signature, exact host, current membership and installation. Stale demo-token metadata must not override the verified Runtime session path.

## Acceptance

Verify from Runtime Applications → Open Support, not by manually setting browser storage. Expected: native cockpit at `/`, mapped tenant role, native ticket list showing the linked workspace's records, navigation through real application sections, reload continuity and logout invalidation. Also test revoked membership, read-only mutations, another tenant host, forged session cookies, and expired browser display state.

Automated checks for this change: 692 tests passed and 36 environment-dependent tests skipped locally. Production acceptance must be recorded separately after deployment.

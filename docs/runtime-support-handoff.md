# Runtime → Support handoff contract

Runtime signs an HS256 JWT with `SUPPORTV8_SERVICE_APP_RUNTIME_SECRET` (at least 32 bytes). Support accepts exactly these claims: `version` (`servicev8.support-handoff.v1`), `iss` (`runtime`), `aud` (`supportv8-service-app`), `sub`, `accountId`, `tenantId`, `verticalId` (`runtime`), `installationId`, `externalWorkspaceId` (`tenant_rt_` plus 48 lowercase hexadecimal characters), canonical `tenantDomain`, `role` (`support:read` or `support:manage`), exact `destination`, integer `iat`, integer `exp`, and UUID `jti`. Lifetime is at most 60 seconds.

The destination is `https://<tenantDomain>.support.servicev8.com/auth/runtime/handoff`. Send one `token` query parameter and no other query parameters. Tokens must not contain email, phone, provider credentials, or upstream secrets. Support verifies the active Registry installation, member authority, plan readiness, and durable native workspace mapping before consuming the single-use token and issuing its own host-only session.

See [`runtime-support-handoff.synthetic.json`](./fixtures/runtime-support-handoff.synthetic.json) for the public synthetic payload shape. It is documentation only and is not a usable token.

## Version 2: the tenant's Runtime URL

| Version | Claims |
| --- | --- |
| `servicev8.support-handoff.v1` | the claims above (plus the optional `planId`, `plan`, `tier`, `credits`, `boundApps`, `poolAccountId`) |
| `servicev8.support-handoff.v2` | exactly v1 plus a required `runtimeUrl` |

Every version rejects any field it does not list. A v1 token carrying `runtimeUrl` is refused, and so is a v2 token without it. Runtime sends v2 only after its `SUPPORTV8_HANDOFF_RUNTIME_URL` switch is turned on (kamoze/servicev8-agentic-runtime#187).

`runtimeUrl` is the tenant's Runtime workspace. SupportV8 accepts exactly two shapes:

- `https://<runtime host>/workspace/<slug>`
- `https://<slug>.<runtime host>/workspace/<slug>` (Runtime tenant hosts; the host label must equal the path slug)

The URL must also:

- use `https`, in canonical form, with no credentials, port, query or fragment;
- have a `<slug>` that follows Runtime's rule `^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$`;
- have `<slug>` equal to the token's `tenantDomain`.

If any check fails, the whole hand-off is refused with the usual `401` response, before any access lookup or replay consumption (`src/lib/service-app/runtime-url.ts`, `runtime-handoff-claims.ts`). This mirrors KnowledgeV8's receiver (kamoze/knowledgev8#191).

### Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `SUPPORTV8_RUNTIME_ORIGIN` | `https://runtime.servicev8.com` | The Runtime origin this deployment trusts. It must be a bare `https://host` with no path, port, query or credentials. Any other value refuses every v2 hand-off; v1 hand-offs are unaffected. |

### Use

The validated URL is stored in the Runtime session cookie (`runtimeUrl`) and is checked again each time the cookie is read. `/api/auth/workspace-session` returns it to the page, which renders `<sv8-shell mode="embedded" runtime-url="…">`: "Back to Runtime" at the top of the sidebar, Marketplace pointing at `<Runtime origin>/auth/marketplace` and Plan at `runtimeUrl + /settings/plan`, while Members, API keys and Settings stay in SupportV8. A v1 session keeps the embedded shell without Runtime links (the shell hides Marketplace and Plan). Standalone pages never render `runtime-url`. The URL is used for presentation only; it grants no access.

# Runtime → Support handoff contract

Runtime signs an HS256 JWT with `SUPPORTV8_SERVICE_APP_RUNTIME_SECRET` (at least 32 bytes). Support accepts exactly these claims: `version` (`servicev8.support-handoff.v1`), `iss` (`runtime`), `aud` (`supportv8-service-app`), `sub`, `accountId`, `tenantId`, `verticalId` (`runtime`), `installationId`, `externalWorkspaceId` (`tenant_rt_` plus 48 lowercase hexadecimal characters), canonical `tenantDomain`, `role` (`support:read` or `support:manage`), exact `destination`, integer `iat`, integer `exp`, and UUID `jti`. Lifetime is at most 60 seconds.

The destination is `https://<tenantDomain>.support.servicev8.com/auth/runtime/handoff`. Send one `token` query parameter and no other query parameters. Tokens must not contain email, phone, provider credentials, or upstream secrets. Support verifies the active Registry installation, member authority, plan readiness, and durable native workspace mapping before consuming the single-use token and issuing its own host-only session.

See [`runtime-support-handoff.synthetic.json`](./fixtures/runtime-support-handoff.synthetic.json) for the public synthetic payload shape. It is documentation only and is not a usable token.

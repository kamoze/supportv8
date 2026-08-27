/**
 * THE OPERATION GATEWAY — effects and configuration. `GATEWAY_URL`.
 *
 * ⚠️ THIS IS NOT THE FORGE GATEWAY. See `./forge-gateway.ts` for the other one.
 *
 *   ./forge-gateway.ts   FORGE_GATEWAY_URL   hires, model completions, outcomes
 *   this file            GATEWAY_URL         POST /api/operations/{id},
 *                                            /api/studio/customizations/*
 *
 * Both serve paths under `/api/studio/…`, so the path prefix is NOT a hint,
 * and both clients are fail-closed, so a wrong-gateway call renders an empty
 * feature rather than raising. The `kind` brand below makes the mistake a
 * compile error instead of a support ticket.
 *
 * ── The wire contract (verified against services/gateway/main.go) ─────────
 *
 * There is no generic `POST /v1/operations/{id}`. The Go gateway registers
 * ONE STATIC ROUTE PER OPERATION, named by its dotted id:
 *
 *     POST /api/operations/ticket.create
 *     POST /api/operations/invoice.pay
 *     …
 *
 * The request body is the operation input FLAT — no envelope, no
 * `{"input": …}`. A 200 response is the operation output, also flat. Errors
 * are `{"error": "…"}` with 400/401/403/500.
 *
 * This is exactly the surface the registry exists to guard. estatev8 maps 27
 * operation ids to this gateway and only TWO of them are registered routes;
 * the other 25 404. Because this client is fail-closed, those 404s would look
 * like "nothing happened" rather than "your agent is proposing operations
 * that do not exist" — so the runtime checks the registry BEFORE it ever gets
 * here, and this client reports the status when it does.
 *
 * ── Auth ──────────────────────────────────────────────────────────────────
 *
 * `Authorization: Bearer <token>`, and the gateway derives the tenant FROM
 * THE TOKEN unless the token's `azp` is a verified service principal — in
 * which case the trusted-proxy headers below override it. A vertical running
 * this kit is such a principal, which is why the tenant headers are sent;
 * they are ignored (not honoured, not an error) for a non-principal token, so
 * a weak token cannot use them to reach another tenant.
 */

import type { TenantRef } from "../tenant/identity";
import type { JsonRecord } from "./forge-gateway";

export type OperationDispatchResult =
  | {
      readonly ok: true;
      readonly output: JsonRecord;
      readonly status: number;
      /**
       * The gateway served this from its idempotency store rather than running
       * the handler — i.e. an identical earlier dispatch already applied, and
       * this one did NOT. Read from the `Idempotency-Replayed` response header.
       *
       * Surfaced rather than swallowed because "the ticket exists" and "this
       * run created the ticket" are different facts, and an outcome metric that
       * counts replays as work is a metric that rewards retry storms.
       */
      readonly replayed: boolean;
    }
  | { readonly ok: false; readonly status: number; readonly error: string };

export type OperationGatewayConfig = {
  readonly baseUrl: string;
  readonly token: string;
  /**
   * Role asserted via `X-ServiceV8-Role`, an OPA policy input. Defaults to
   * `PLATFORM_OPS`, the value the estate's existing service-principal clients
   * send. A vertical that has a narrower service role should pass it — this
   * header is an assertion the gateway trusts from a principal, so a
   * needlessly wide one is a needlessly wide blast radius.
   */
  readonly role?: string;
  readonly fetchImpl?: typeof fetch;
  readonly onError?: (message: string, detail: unknown) => void;
};

/** Config from the environment, or `null` when incomplete. Absence never means allow. */
export function operationGatewayConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): OperationGatewayConfig | null {
  const baseUrl = env.GATEWAY_URL?.trim();
  const token = env.SERVICEV8_GATEWAY_TOKEN?.trim() || env.GATEWAY_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  const role = env.SERVICEV8_GATEWAY_ROLE?.trim();
  return role ? { baseUrl, token, role } : { baseUrl, token };
}

export type DispatchRequest = {
  readonly tenant: TenantRef;
  readonly vertical: string;
  /** Registry operation id — also the route segment. */
  readonly operationId: string;
  /** Validated input. Sent flat as the request body. */
  readonly input: Readonly<Record<string, unknown>>;
  /** The hire acting, sent as `X-ServiceV8-Actor-ID`. */
  readonly actorId: string;
  readonly idempotencyKey?: string;
};

/**
 * The Operation Gateway client. FAIL-CLOSED: any non-2xx, network error or
 * unparseable body returns `{ok:false}` with the status. It never throws, and
 * it never falls back to a local write path — the entire point of the
 * operation layer is that there is no path around it.
 */
export class OperationGateway {
  /** Brand: passing this where a ForgeGateway is wanted is a type error. */
  readonly kind = "operation-gateway" as const;

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly role: string;
  private readonly fetchImpl: typeof fetch;
  private readonly onError: (message: string, detail: unknown) => void;

  constructor(config: OperationGatewayConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.role = config.role ?? "PLATFORM_OPS";
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.onError = config.onError ?? ((message, detail) => console.error(message, detail));
  }

  private headers(tenant: TenantRef, vertical: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
      // The trusted-proxy set. Honoured only for a verified service principal.
      "X-StudioV8-Proxy": "true",
      "X-ServiceV8-Tenant-ID": tenant.tenantId,
      "X-ServiceV8-Tenant-Domain": tenant.tenantDomain,
      "X-ServiceV8-Role": this.role,
      "X-ServiceV8-Vertical-ID": vertical,
    };
  }

  /**
   * `POST /api/operations/{operationId}` — the single write path.
   *
   * IDEMPOTENCY — this comment previously said the header was inert. IT IS
   * NOT, AND HAS NOT BEEN SINCE `services/gateway/idempotency.go` LANDED.
   * Corrected here rather than left to rot, because a stale "no guarantee"
   * note is how a caller ends up hand-rolling a second dedupe layer.
   *
   * What the deployed gateway actually does (verified against
   * `services/gateway/idempotency.go` and `dispatch.go`, which composes
   * `IdempotencyMiddleware` between metering and the handler for every
   * operation whose declared strategy is not `none`):
   *
   *   · Idempotency is OPT-IN PER REQUEST. No header, no dedupe — so a
   *     proposal that omits `idempotencyKey` genuinely can double-apply.
   *   · The dedupe identity is (tenant, operation, key). A key is never shared
   *     across tenants or operations.
   *   · The first claimer executes. A replay inside the declared window
   *     returns the STORED response with `Idempotency-Replayed: true`, which
   *     this client surfaces as `replayed: true`.
   *   · A concurrent claim, or a replay after a crash between "handler
   *     committed" and "response stored", is 409 — fail closed, never a second
   *     application.
   *   · Reusing a key with a DIFFERENT body is 409, not a silent replay of an
   *     unrelated result. So the key must be derived from the same facts the
   *     input is.
   *   · Only a 2xx is stored; a 4xx/5xx releases the key so a retry may run.
   *   · Past the declared window (300s for `ticket.create`) the key is
   *     reusable and a retry WILL execute again. The window is the guarantee's
   *     boundary — it is not "forever".
   *
   * The key still travels as a HEADER and is never injected into the body: the
   * body is the operation's flat input, and adding a field to it would corrupt
   * the payload of every operation that does not declare one.
   */
  async dispatch(request: DispatchRequest): Promise<OperationDispatchResult> {
    if (!request.operationId?.trim()) {
      return { ok: false, status: 0, error: "empty operationId" };
    }
    if (!request.tenant?.tenantDomain || !request.tenant?.tenantId) {
      // A dispatch with an absent tenant scope is the shape every isolation
      // defect in the audit started as. Never send it.
      return { ok: false, status: 0, error: "dispatch requires a complete TenantRef" };
    }
    try {
      const url = new URL(
        `/api/operations/${encodeURIComponent(request.operationId)}`,
        this.baseUrl,
      );
      const headers = this.headers(request.tenant, request.vertical);
      headers["X-ServiceV8-Actor-ID"] = request.actorId;
      if (request.idempotencyKey) headers["Idempotency-Key"] = request.idempotencyKey;

      const response = await this.fetchImpl(url, {
        method: "POST",
        cache: "no-store",
        headers,
        // FLAT. No envelope — see the wire contract note above.
        body: JSON.stringify(request.input),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        this.onError("operation-gateway: dispatch failed", {
          operationId: request.operationId,
          status: response.status,
        });
        return {
          ok: false,
          status: response.status,
          error: detail || response.statusText || `HTTP ${response.status}`,
        };
      }
      const output = (await response.json().catch(() => ({}))) as JsonRecord;
      return {
        ok: true,
        output: output ?? {},
        status: response.status,
        // Absent header → not replayed. That direction is the safe one: it
        // over-reports work rather than under-reporting an application.
        replayed: response.headers.get("Idempotency-Replayed") === "true",
      };
    } catch (error) {
      this.onError("operation-gateway: dispatch threw", error);
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "network error",
      };
    }
  }

  /**
   * `GET /api/studio/customizations/effective?vertical_id&module_key&scope`
   * — per-tenant tuning from the customization system-of-record.
   *
   * This lives HERE, on the Operation Gateway, not on the Forge gateway, even
   * though orderv8 exposes it from its Forge-gateway client module
   * (`workforce-kit/client.ts#getEffectiveTuning`, which delegates to
   * `lib/forge-customizations.ts` and its `GATEWAY_URL`). Keeping the
   * delegation invisible is exactly how a call ends up on the wrong gateway,
   * so the kit puts each method on the client that actually reaches it.
   *
   * `null` on any failure. The runtime treats a missing tuning row as "use
   * defaults" (an unconfigured tenant is a normal state), NOT as a reason to
   * widen anything — no tuning value ever grants a scope.
   */
  async getEffectiveTuning(input: {
    tenant: TenantRef;
    vertical: string;
    moduleKey: string;
    scope: string;
  }): Promise<JsonRecord | null> {
    try {
      const url = new URL("/api/studio/customizations/effective", this.baseUrl);
      url.searchParams.set("vertical_id", input.vertical);
      url.searchParams.set("module_key", input.moduleKey);
      url.searchParams.set("scope", input.scope);

      const response = await this.fetchImpl(url, {
        method: "GET",
        cache: "no-store",
        headers: this.headers(input.tenant, input.vertical),
      });
      if (!response.ok) {
        if (response.status !== 404) {
          this.onError("operation-gateway: getEffectiveTuning failed", {
            status: response.status,
          });
        }
        return null;
      }
      const payload = (await response.json().catch(() => null)) as JsonRecord | null;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
      // Defense in depth: never apply a row whose tenant disagrees with ours.
      const rowTenant = payload.tenant_id;
      if (
        typeof rowTenant === "string" &&
        rowTenant !== input.tenant.tenantId &&
        rowTenant !== input.tenant.tenantDomain
      ) {
        this.onError("operation-gateway: tuning tenant mismatch — dropping row", {
          expected: input.tenant.tenantId,
          got: rowTenant,
        });
        return null;
      }
      return payload;
    } catch (error) {
      this.onError("operation-gateway: getEffectiveTuning threw", error);
      return null;
    }
  }
}

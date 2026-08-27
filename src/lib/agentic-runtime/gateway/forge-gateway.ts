/**
 * THE FORGE GATEWAY — money and model. `FORGE_GATEWAY_URL`.
 *
 * ⚠️ THERE ARE TWO GATEWAYS AND THE PATH PREFIX DOES NOT TELL YOU WHICH.
 *
 *   this file   Forge gateway   FORGE_GATEWAY_URL   hires, /v1/model/complete,
 *                                                   outcomes, usage — i.e. money
 *   ../gateway/operation-gateway.ts
 *               Operation GW    GATEWAY_URL         POST /api/operations/{id},
 *                                                   customization SoR — i.e. effects
 *
 * BOTH serve paths under `/api/studio/…`. Auth differs completely: the Forge
 * gateway takes `Bearer` + `x-servicev8-tenant-domain` and nothing else; the
 * Operation Gateway takes `Bearer` + the trusted-proxy header set. Because
 * both clients are fail-closed, a call sent to the wrong one does not error —
 * it returns `null` and the feature silently renders empty. That failure mode
 * is why these are two separate classes with a `kind` brand (below) rather
 * than one client with a base-URL argument: sending a Forge call to the
 * Operation Gateway is a TYPE error here, not a production mystery.
 *
 * Ported from the proven client at
 * `orderv8/src/workforce-kit/client.ts`. Two deliberate differences:
 *
 *  1. NO `"service-token"` DEFAULT. orderv8 falls back to a literal
 *     `"service-token"` string when no token env is set, which turns a missing
 *     credential into a 401 at the far end instead of a refusal here. In this
 *     kit an absent credential yields `null` config and the runtime refuses
 *     `not_configured` — absence never means allow, and never means "try it
 *     and see".
 *  2. `complete()` REQUIRES a non-empty `instanceId` and drops the call
 *     without one. Omitting it makes the spend bill as a plain tenant call
 *     that never appears in burn-by-hire — unmetered work that looks free.
 *     The kit owns the model call precisely so a vertical cannot opt out of
 *     metering by accident, so an unmetered call is refused, not sent.
 */

export type JsonRecord = Record<string, unknown>;

export type InstanceBudget = {
  monthlyAllowance: number;
  creditBalance: number;
  usedThisPeriod: number;
  remaining: number;
  exhausted: boolean;
};

/** A hire: `role × vertical × tenant`. The atomic unit of workforce state. */
export type HiredInstance = {
  instanceId: string;
  /** The gateway keys hires by tenant DOMAIN — this field carries the domain. */
  tenantId: string;
  vertical: string;
  role: string;
  displayName: string;
  name: string;
  status: string;
  subscription: string;
  budget: InstanceBudget;
  /** Scopes this employee holds. Empty means it may do nothing. */
  grants: string[];
  outcomeKey: string;
  createdAt: string;
};

export type Outcome = {
  instanceId: string;
  period: string;
  metric: string;
  value: number;
  unit?: string;
  detail?: string;
  creditsUsed?: number;
  recordedAt: string;
};

export type OutcomeInput = {
  period: string;
  metric: string;
  value: number;
  unit?: string;
  detail?: string;
  creditsUsed?: number;
};

export type CompletionMessage = {
  role: string;
  content: string;
};

export type CompletionResult = JsonRecord;

export type ForgeGatewayConfig = {
  readonly baseUrl: string;
  readonly token: string;
  /** Injectable for tests. Defaults to global `fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Where non-fatal client errors go. Defaults to `console.error`. */
  readonly onError?: (message: string, detail: unknown) => void;
};

/**
 * Resolve config from the environment, or `null` when it is incomplete.
 *
 * `FORGE_GATEWAY_MODEL_TOKEN` is read BEFORE `FORGE_GATEWAY_TOKEN`: in the
 * deployed estate the latter is declared in the manifest but maps to a secret
 * key that does not exist, so it resolves empty and 401s, while the former is
 * the name the secret actually carries. Verified live (orderv8 client.ts).
 */
export function forgeGatewayConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): ForgeGatewayConfig | null {
  const baseUrl = env.FORGE_GATEWAY_URL?.trim();
  const token =
    env.FORGE_GATEWAY_MODEL_TOKEN?.trim() ||
    env.FORGE_GATEWAY_TOKEN?.trim() ||
    env.SERVICEV8_GATEWAY_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
}

/**
 * The Forge gateway client. Every method is FAIL-CLOSED: any non-2xx, network
 * error, or malformed body yields `null` / `[]` / `{ok:false}`. It never
 * throws to the caller and never retries onto an unauthenticated path.
 */
export class ForgeGateway {
  /** Brand: makes passing this where an OperationGateway is wanted a type error. */
  readonly kind = "forge-gateway" as const;

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly onError: (message: string, detail: unknown) => void;

  constructor(config: ForgeGatewayConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch;
    this.onError = config.onError ?? ((message, detail) => console.error(message, detail));
  }

  private headers(tenantDomain: string): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
      // The ONLY tenant signal this gateway accepts. Never a Prisma-style id.
      "x-servicev8-tenant-domain": tenantDomain,
    };
  }

  private async request(
    path: string,
    tenantDomain: string,
    init: { method: string; searchParams?: Record<string, string | undefined>; body?: JsonRecord },
  ): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    for (const [key, value] of Object.entries(init.searchParams ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    return this.fetchImpl(url, {
      method: init.method,
      cache: "no-store",
      headers: this.headers(tenantDomain),
      // Spread rather than `body: … : undefined`. Under
      // exactOptionalPropertyTypes an explicit `undefined` is not the same as
      // an absent key, and RequestInit.body does not accept it.
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  }

  /**
   * `GET /api/studio/hires/{id}` — the ownership check.
   *
   * `null` on 404, on any other failure, AND on a record whose `tenantId`
   * disagrees with the domain we asked for. That last check is not paranoia:
   * a hire owned by another tenant is answered 404 (not 403, which would leak
   * that the id is real), but a gateway bug or misroute that returned one
   * anyway would otherwise be trusted. Callers must never trust a hire they
   * did not re-fetch themselves.
   */
  async getHire(tenantDomain: string, instanceId: string): Promise<HiredInstance | null> {
    if (!tenantDomain || !instanceId) return null;
    try {
      const response = await this.request(
        `/api/studio/hires/${encodeURIComponent(instanceId)}`,
        tenantDomain,
        { method: "GET" },
      );
      if (!response.ok) {
        if (response.status !== 404) {
          this.onError("forge-gateway: getHire failed", { status: response.status });
        }
        return null;
      }
      const hire = (await response.json()) as HiredInstance;
      if (!hire || typeof hire !== "object" || hire.tenantId !== tenantDomain) {
        if (hire) {
          this.onError("forge-gateway: hire tenant mismatch — dropping record", {
            expected: tenantDomain,
            got: hire.tenantId,
          });
        }
        return null;
      }
      return hire;
    } catch (error) {
      this.onError("forge-gateway: getHire threw", error);
      return null;
    }
  }

  /**
   * `POST /v1/model/complete` — the ONE metered model call.
   *
   * `tenantId` in the body is the tenant DOMAIN (same value as the header),
   * matching this gateway's auth convention. `instanceId` is mandatory: it is
   * what makes the spend meter against the hire's allowance and show up in
   * burn-by-hire. A blank one is refused here rather than sent.
   */
  async complete(
    tenantDomain: string,
    input: {
      instanceId: string;
      feature: string;
      messages: CompletionMessage[];
      maxTokens?: number;
      grantToken?: string;
    },
  ): Promise<CompletionResult | null> {
    if (!tenantDomain) return null;
    if (!input.instanceId?.trim()) {
      this.onError("forge-gateway: refusing an unmetered completion (no instanceId)", {
        feature: input.feature,
      });
      return null;
    }
    try {
      const headers = this.headers(tenantDomain);
      if (input.grantToken) {
        // A short-lived grant token narrows the call to the hire's own scopes.
        headers.Authorization = `Bearer ${input.grantToken}`;
      }
      const response = await this.fetchImpl(new URL("/v1/model/complete", this.baseUrl), {
        method: "POST",
        cache: "no-store",
        headers,
        body: JSON.stringify({
          tenantId: tenantDomain,
          instanceId: input.instanceId,
          feature: input.feature,
          request: { messages: input.messages, maxTokens: input.maxTokens },
        }),
      });
      if (!response.ok) {
        this.onError("forge-gateway: complete failed", { status: response.status });
        return null;
      }
      return (await response.json()) as CompletionResult;
    } catch (error) {
      this.onError("forge-gateway: complete threw", error);
      return null;
    }
  }

  /** `POST /api/studio/hires/{id}/outcomes` — needs the narrow `outcome:write` scope. */
  async recordOutcome(
    tenantDomain: string,
    instanceId: string,
    input: OutcomeInput,
  ): Promise<Outcome | null> {
    if (!tenantDomain || !instanceId) return null;
    try {
      const response = await this.request(
        `/api/studio/hires/${encodeURIComponent(instanceId)}/outcomes`,
        tenantDomain,
        { method: "POST", body: { ...input } },
      );
      if (!response.ok) {
        this.onError("forge-gateway: recordOutcome failed", { status: response.status });
        return null;
      }
      return (await response.json()) as Outcome;
    } catch (error) {
      this.onError("forge-gateway: recordOutcome threw", error);
      return null;
    }
  }

  /** `GET /api/studio/hires/{id}/usage` — live budget, when a fresher read than the hire's is wanted. */
  async getUsage(tenantDomain: string, instanceId: string): Promise<InstanceBudget | null> {
    if (!tenantDomain || !instanceId) return null;
    try {
      const response = await this.request(
        `/api/studio/hires/${encodeURIComponent(instanceId)}/usage`,
        tenantDomain,
        { method: "GET" },
      );
      if (!response.ok) {
        this.onError("forge-gateway: getUsage failed", { status: response.status });
        return null;
      }
      const payload = (await response.json().catch(() => ({}))) as { budget?: InstanceBudget };
      return payload.budget ?? null;
    } catch (error) {
      this.onError("forge-gateway: getUsage threw", error);
      return null;
    }
  }

  /** `GET /api/studio/hires?vertical=` — the roster. Foreign records are filtered out. */
  async listHires(tenantDomain: string, vertical: string): Promise<HiredInstance[]> {
    if (!tenantDomain) return [];
    try {
      const response = await this.request("/api/studio/hires", tenantDomain, {
        method: "GET",
        searchParams: { vertical },
      });
      if (!response.ok) {
        this.onError("forge-gateway: listHires failed", { status: response.status });
        return [];
      }
      const payload = (await response.json().catch(() => ({}))) as { hires?: unknown };
      if (!Array.isArray(payload.hires)) return [];
      return (payload.hires as HiredInstance[]).filter((hire) => hire?.tenantId === tenantDomain);
    } catch (error) {
      this.onError("forge-gateway: listHires threw", error);
      return [];
    }
  }
}

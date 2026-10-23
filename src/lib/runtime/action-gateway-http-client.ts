/**
 * Action Gateway HTTP Client
 *
 * Exclusively dispatches governed external mutations to Action Gateway's
 * `/v1/actions/execute` endpoint.
 *
 * Enforces:
 * - 5-second request timeout
 * - Rejection of non-2xx, failed, malformed, or tenant-mismatched responses
 * - Zero fallback to local simulated execution
 */

export interface ActionGatewayExecuteInput {
  accountId: string;
  tenantId: string;
  capability: "support.ticket.update" | "support.ticket.close";
  connectorKey: string;
  idempotencyKey: string;
  actor: {
    id: string;
    type: "human" | "ai_employee";
    name: string;
  };
  policyDecision?: {
    id: string;
    mode: "observe" | "copilot" | "autonomous" | "advisory" | "strict";
    decision: "allow" | "deny" | "approval_required";
    evaluatedAt?: string;
  };
  payload: Record<string, unknown>;
}

export interface ActionGatewayExecuteOutput {
  id: string;
  status: string;
  result?: Record<string, unknown>;
  error?: string;
}

export interface ActionGatewayHttpClientOptions {
  baseUrl?: string;
  token?: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  audience?: string;
  scope?: string;
  fetcher?: typeof fetch;
}

export function validateTokenUrl(raw: string): URL {
  const url = new URL(raw);
  const isLocal = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const isCluster = url.hostname.endsWith(".svc.cluster.local");
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && (isLocal || isCluster))) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("unsafe token URL");
  }
  return url;
}

export class ActionGatewayHttpClient {
  private baseUrl: string;
  private staticToken?: string;
  private tokenUrl?: string;
  private clientId: string;
  private clientSecret?: string;
  private audience: string;
  private scope: string;
  private fetcher: typeof fetch;
  private cachedToken?: { token: string; refreshAt: number };

  constructor(options?: ActionGatewayHttpClientOptions) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.ACTION_GATEWAY_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    this.staticToken =
      options?.token ||
      process.env.ACTION_GATEWAY_API_TOKEN ||
      process.env.ACTION_GATEWAY_WORKLOAD_TOKEN;
    this.tokenUrl =
      options?.tokenUrl ||
      process.env.ACTION_GATEWAY_TOKEN_URL;
    this.clientId =
      options?.clientId ||
      process.env.SUPPORTV8_EXECUTION_CLIENT_ID ||
      "supportv8-execution";
    this.clientSecret =
      options?.clientSecret ||
      process.env.SUPPORTV8_EXECUTION_CLIENT_SECRET;
    this.audience =
      options?.audience ||
      process.env.ACTION_GATEWAY_AUDIENCE ||
      "servicev8-action-gateway";
    this.scope =
      options?.scope ||
      process.env.ACTION_GATEWAY_EXECUTION_SCOPE ||
      "action:execute";
    this.fetcher = options?.fetcher || fetch;
  }

  public async getAuthToken(): Promise<string | undefined> {
    if (this.tokenUrl && this.clientSecret) {
      if (this.cachedToken && this.cachedToken.refreshAt > Date.now()) {
        return this.cachedToken.token;
      }
      const endpoint = validateTokenUrl(this.tokenUrl);
      const res = await this.fetcher(endpoint.toString(), {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
          audience: this.audience,
          scope: this.scope,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        throw new Error(
          `failed to acquire Action Gateway execution token: HTTP ${res.status}`
        );
      }

      const data = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) {
        throw new Error("Action Gateway token response missing access_token");
      }

      const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 60;
      this.cachedToken = {
        token: data.access_token,
        refreshAt: Date.now() + Math.max(1, expiresIn - 15) * 1000,
      };
      return this.cachedToken.token;
    }

    return this.staticToken;
  }

  public async execute(
    input: ActionGatewayExecuteInput
  ): Promise<ActionGatewayExecuteOutput> {
    const url = new URL("/v1/actions/execute", this.baseUrl);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-servicev8-tenant-id": input.tenantId,
      "x-servicev8-account-id": input.accountId,
    };

    const token = await this.getAuthToken();
    if (token) {
      headers["authorization"] = `Bearer ${token}`;
    }

    const gatewayMode =
      input.policyDecision?.mode === "copilot" || input.policyDecision?.mode === "observe"
        ? "advisory"
        : input.policyDecision?.mode === "autonomous"
        ? "strict"
        : input.policyDecision?.mode || "advisory";

    const normalizedPolicyDecision = input.policyDecision
      ? {
          id: input.policyDecision.id,
          mode: gatewayMode,
          decision: input.policyDecision.decision || "allow",
          evaluatedAt:
            input.policyDecision.evaluatedAt ||
            new Date().toISOString(),
        }
      : undefined;

    const requestBody = {
      accountId: input.accountId,
      tenantId: input.tenantId,
      sourceApp: "supportv8",
      capability: input.capability,
      connectorKey: input.connectorKey || "zendesk",
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      policyDecision: normalizedPolicyDecision,
      payload: input.payload,
    };

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
        throw new Error("Action Gateway execution request timed out after 5000ms");
      }
      throw new Error(`Action Gateway execution network failure: ${err.message || String(err)}`);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let parsedError: string | undefined;
      try {
        const json = JSON.parse(errorText);
        parsedError = json.error || json.message;
      } catch {
        parsedError = errorText;
      }
      throw new Error(
        `Action Gateway returned HTTP ${response.status}: ${parsedError || response.statusText}`
      );
    }

    let body: any;
    try {
      body = await response.json();
    } catch (err: any) {
      throw new Error(`Action Gateway returned invalid JSON response: ${err.message}`);
    }

    if (!body || typeof body !== "object") {
      throw new Error("Action Gateway returned malformed non-object response");
    }

    const executionId = body.id || body.executionId || body.auditId;
    if (!executionId || typeof executionId !== "string") {
      throw new Error("Action Gateway returned malformed response: missing execution ID");
    }

    // Verify tenant scope if echoed back by Action Gateway
    if (body.tenantId && body.tenantId !== input.tenantId) {
      throw new Error(
        `Action Gateway tenant mismatch: requested ${input.tenantId}, received ${body.tenantId}`
      );
    }

    if (body.status === "failed") {
      return {
        id: executionId,
        status: "failed",
        error: body.error || "Action execution failed in provider",
        result: body.result,
      };
    }

    return {
      id: executionId,
      status: body.status || "completed",
      result: body.result,
      error: body.error,
    };
  }
}

export const actionGatewayHttpClient = new ActionGatewayHttpClient();

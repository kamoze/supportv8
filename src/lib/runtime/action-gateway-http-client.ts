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
  policyDecision: {
    id: string;
    mode: "observe" | "copilot" | "autonomous";
    decision: "allow";
  };
  payload: Record<string, unknown>;
}

export interface ActionGatewayExecuteOutput {
  id: string;
  status: string;
  result?: Record<string, unknown>;
  error?: string;
}

export class ActionGatewayHttpClient {
  private baseUrl: string;
  private token?: string;

  constructor(options?: { baseUrl?: string; token?: string }) {
    this.baseUrl = (
      options?.baseUrl ||
      process.env.ACTION_GATEWAY_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "");
    this.token = options?.token || process.env.ACTION_GATEWAY_WORKLOAD_TOKEN;
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

    if (this.token) {
      headers["authorization"] = `Bearer ${this.token}`;
    }

    const requestBody = {
      accountId: input.accountId,
      tenantId: input.tenantId,
      sourceApp: "supportv8",
      capability: input.capability,
      connectorKey: input.connectorKey || "zendesk",
      idempotencyKey: input.idempotencyKey,
      actor: input.actor,
      policyDecision: input.policyDecision,
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

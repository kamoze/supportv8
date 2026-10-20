import {
  type CloudEventV1,
  type WorkIntakeV1,
  type WorkIntakeReceipt,
} from "./contracts";
import { signWorkloadToken } from "./auth";

export class Tasksv8ClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = "Tasksv8ClientError";
  }
}

export interface Tasksv8ClientOptions {
  baseUrl?: string;
  jwtSecret?: string;
  fetchImpl?: typeof fetch;
}

export class Tasksv8Client {
  private readonly baseUrl: string;
  private readonly jwtSecret: string | undefined;
  private readonly fetchFn: typeof fetch;

  constructor(options: Tasksv8ClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.TASKSV8_BASE_URL ??
      "http://127.0.0.1:3000"
    ).replace(/\/+$/, "");
    this.jwtSecret =
      options.jwtSecret ??
      process.env.TASKSV8_JWT_SECRET ??
      process.env.TASK_WORKLOAD_SECRET;
    this.fetchFn = options.fetchImpl ?? globalThis.fetch;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  async publishIntakeEvent(
    event: CloudEventV1<WorkIntakeV1>,
    scope: { tenantId: string; accountId?: string }
  ): Promise<WorkIntakeReceipt> {
    const tenantId = scope.tenantId;
    const accountId = scope.accountId ?? `${tenantId}-account`;
    const url = `${this.baseUrl}/v1/work-intake/events`;

    const token = await signWorkloadToken(
      {
        tenantId,
        accountId,
        audience: "servicev8-tasks",
        scope: "tasks:work-intake",
        purpose: "event_publish",
        client: "supportv8",
      },
      this.jwtSecret
    );

    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "x-tenant-id": tenantId,
      "x-account-id": accountId,
      "x-workload-client": "supportv8",
      "x-workload-scope": "tasks:work-intake",
      "x-workload-purpose": "event_publish",
      "x-calling-service": "supportv8",
      "x-actor-type": "system",
      "x-actor-id": "supportv8",
      "x-scopes": "tasks:work-intake",
      "x-purpose": "event_publish",
    };

    const res = await this.fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
    });

    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      throw new Tasksv8ClientError(
        `TaskV8 intake event publish failed with HTTP ${res.status}`,
        res.status,
        body
      );
    }

    const data = (await res.json()) as any;
    return {
      receiptId: data.receiptId,
      workId: data.workId ?? null,
      state: data.state,
      sourceRevision: data.sourceRevision ?? event.data.source.revision,
      taskUri:
        data.taskUri ??
        (data.workId ? `${this.baseUrl}/app/work/${data.workId}` : undefined),
    };
  }
}

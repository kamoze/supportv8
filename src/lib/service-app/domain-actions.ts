import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { pgClient, type PostgresClient } from "@/lib/db/pg-client";
import {
  managedSupportAuthenticatorFromEnv,
  type ManagedSupportAuthenticator,
} from "./managed-support-auth";
import {
  emitSupportTicketCreatedSignal,
  type SignalEmitResult,
} from "@/lib/signals/signal-agent";

export type DelegatedCommandClaims = {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  tenant_id: string;
  account_id: string;
  origin_app: string;
  calling_service: string;
  actor_type?: string;
  actor_id?: string;
  actor?: { type?: string; id?: string };
  capabilities: string[];
  scope: string;
  action?: { name?: string; idempotency_key?: string };
  purpose: string;
};

export type SupportDomainActionDependencies = {
  client?: PostgresClient;
  env?: Readonly<Record<string, string | undefined>>;
  authenticateWorkload?: ManagedSupportAuthenticator;
  emitSignal?: typeof emitSupportTicketCreatedSignal;
};

const ID_PATTERN = /^[A-Za-z0-9_:@.-]{1,192}$/;
const WORKSPACE_PATTERN = /^tenant_[a-z0-9_]{1,56}$/;

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function deriveRuntimeWorkspaceId(input: {
  accountId: string;
  registryTenantId: string;
  installationId: string;
}): string {
  const digest = createHash("sha256")
    .update(`${input.accountId}\0${input.registryTenantId}\0${input.installationId}`)
    .digest("hex");
  return `tenant_rt_${digest.slice(0, 48)}`;
}

export function mintTestDelegatedToken(input: {
  secret: string;
  targetApp: string;
  capability: string;
  accountId: string;
  tenantId: string;
  idempotencyKey: string;
  actorId?: string;
  ttlSeconds?: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (input.ttlSeconds ?? 120);
  const payload: DelegatedCommandClaims = {
    iss: "servicev8-identity",
    sub: "service:action-gateway",
    aud: input.targetApp,
    exp,
    nbf: now,
    iat: now,
    jti: `tok_cmd_${randomUUID()}`,
    tenant_id: input.tenantId,
    account_id: input.accountId,
    origin_app: "assistant",
    calling_service: "action-gateway",
    actor_type: "ai_employee",
    actor_id: input.actorId ?? "arthur",
    actor: { type: "ai_employee", id: input.actorId ?? "arthur" },
    capabilities: [input.capability],
    scope: input.capability,
    action: { name: input.capability, idempotency_key: input.idempotencyKey },
    purpose: "cross_app_command",
  };
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", input.secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function decodeDelegatedClaims(
  token: string,
  secret: string | undefined,
): DelegatedCommandClaims | null {
  try {
    if (!secret) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, signatureB64] = parts as [string, string, string];
    const expectedSig = createHmac("sha256", secret)
      .update(`${headerB64}.${bodyB64}`)
      .digest("base64url");
    const left = Buffer.from(signatureB64, "utf8");
    const right = Buffer.from(expectedSig, "utf8");
    if (left.byteLength !== right.byteLength || !timingSafeEqual(left, right)) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(bodyB64, "base64url").toString("utf8"),
    ) as DelegatedCommandClaims;
    const now = Math.floor(Date.now() / 1000);
    if (
      (payload.iss !== "servicev8-identity" &&
        payload.iss !== "servicev8-action-gateway") ||
      (payload.aud !== "supportv8" &&
        payload.aud !== "servicev8-supportv8") ||
      payload.purpose !== "cross_app_command" ||
      typeof payload.exp !== "number" ||
      typeof payload.nbf !== "number" ||
      now >= payload.exp + 5 ||
      now + 5 < payload.nbf ||
      typeof payload.tenant_id !== "string" ||
      !ID_PATTERN.test(payload.tenant_id) ||
      typeof payload.account_id !== "string" ||
      !ID_PATTERN.test(payload.account_id)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function normalizePriority(raw: unknown): "low" | "medium" | "normal" | "high" | "urgent" {
  const val = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (val === "low") return "low";
  if (val === "medium") return "medium";
  if (val === "normal") return "normal";
  if (val === "high") return "high";
  if (val === "urgent" || val === "critical") return "urgent";
  return "medium";
}

type IssueRow = {
  id: string;
  external_id: string;
  customer_ref: string;
  customer_name: string;
  source_status: string;
  priority: string;
  summary: string;
  source: string;
  source_url: string;
  tags: string[];
  recommended_action: string | null;
  created_at: string;
  updated_at: string;
};

export async function executeSupportDomainAction(
  request: Request,
  deps: SupportDomainActionDependencies = {},
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  const env = deps.env ?? process.env;
  const client = deps.client ?? pgClient;
  const emitSignal = deps.emitSignal ?? emitSupportTicketCreatedSignal;

  const authHeader = request.headers.get("authorization") ?? "";
  const delegatedHeader = request.headers.get("x-servicev8-delegated-token") ?? "";
  const workloadHeader = request.headers.get("x-servicev8-workload-token") ?? "";
  const rawDelegatedToken = delegatedHeader.trim()
    ? delegatedHeader.trim().replace(/^Bearer\s+/i, "")
    : authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";
  if (!rawDelegatedToken) {
    return jsonResponse({ error: "unauthorized_domain_action" }, 401);
  }

  const workloadAuthenticator =
    deps.authenticateWorkload ?? managedSupportAuthenticatorFromEnv(env);
  if (workloadAuthenticator && workloadHeader.trim()) {
    const tokenValue = workloadHeader.trim().replace(/^Bearer\s+/i, "");
    const synthRequest = new Request(request.url, {
      method: "POST",
      headers: { authorization: `Bearer ${tokenValue}` },
    });
    const actor = await workloadAuthenticator(synthRequest, "connection.verify");
    if (!actor || actor.clientId !== "action-gateway-support") {
      return jsonResponse({ error: "unauthorized_domain_action" }, 401);
    }
  }

  const sharedSecret =
    env.SERVICEV8_TOKEN_SECRET?.trim() ||
    env.ASSISTANT_RUNTIME_ASSERTION_SECRET?.trim() ||
    (env.NODE_ENV === "test" ? "servicev8-dev-secret-key-32chars!" : undefined);

  const claims = decodeDelegatedClaims(rawDelegatedToken, sharedSecret);

  if (!claims) {
    return jsonResponse({ error: "unauthorized_domain_action" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonResponse({ error: "invalid_request_body" }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "invalid_request_body" }, 400);
  }

  const capability = typeof body.capability === "string" ? body.capability.trim() : "";
  if (capability !== "support.ticket.create") {
    return jsonResponse({ error: "unsupported_capability" }, 400);
  }

  if (
    claims.scope !== capability &&
    !(Array.isArray(claims.capabilities) && claims.capabilities.includes(capability))
  ) {
    return jsonResponse({ error: "delegated_scope_mismatch" }, 403);
  }

  const headerTenantId = request.headers.get("x-tenant-id")?.trim();
  const headerIdempotencyKey = request.headers.get("x-idempotency-key")?.trim();
  const bodyIdempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined;
  const claimIdempotencyKey = claims.action?.idempotency_key?.trim();
  const idempotencyKey =
    headerIdempotencyKey || bodyIdempotencyKey || claimIdempotencyKey || "";

  if (
    !idempotencyKey ||
    !ID_PATTERN.test(idempotencyKey) ||
    (headerTenantId && headerTenantId !== claims.tenant_id) ||
    (claimIdempotencyKey && claimIdempotencyKey !== idempotencyKey) ||
    (headerIdempotencyKey && headerIdempotencyKey !== idempotencyKey) ||
    (bodyIdempotencyKey && bodyIdempotencyKey !== idempotencyKey)
  ) {
    return jsonResponse({ error: "delegated_scope_mismatch" }, 403);
  }

  const rawPayload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : {};
  const rawTarget =
    body.target && typeof body.target === "object" && !Array.isArray(body.target)
      ? (body.target as Record<string, unknown>)
      : rawPayload.target &&
          typeof rawPayload.target === "object" &&
          !Array.isArray(rawPayload.target)
        ? (rawPayload.target as Record<string, unknown>)
        : {};

  const accountId = claims.account_id;
  const registryTenantId = claims.tenant_id;
  if (
    (typeof rawTarget.accountId === "string" && rawTarget.accountId !== accountId) ||
    (typeof rawTarget.tenantId === "string" && rawTarget.tenantId !== registryTenantId)
  ) {
    return jsonResponse({ error: "delegated_scope_mismatch" }, 403);
  }

  const installationId =
    typeof rawTarget.installationId === "string" && ID_PATTERN.test(rawTarget.installationId)
      ? rawTarget.installationId
      : typeof rawPayload.installationId === "string" && ID_PATTERN.test(rawPayload.installationId)
        ? rawPayload.installationId
        : undefined;

  let workspaceId =
    typeof rawTarget.workspaceId === "string" && WORKSPACE_PATTERN.test(rawTarget.workspaceId)
      ? rawTarget.workspaceId
      : typeof rawPayload.workspaceId === "string" && WORKSPACE_PATTERN.test(rawPayload.workspaceId)
        ? rawPayload.workspaceId
        : undefined;

  if (!workspaceId && installationId) {
    workspaceId = deriveRuntimeWorkspaceId({
      accountId,
      registryTenantId,
      installationId,
    });
  }
  if (!workspaceId && WORKSPACE_PATTERN.test(registryTenantId)) {
    workspaceId = registryTenantId;
  }
  if (!workspaceId) {
    return jsonResponse({ error: "support_workspace_not_active" }, 403);
  }

  const customerName = String(
    rawPayload.customerName ??
      rawPayload.customer_name ??
      rawPayload.requesterName ??
      rawPayload.customerEmail ??
      "",
  ).trim();
  const customerEmail =
    typeof rawPayload.customerEmail === "string" && rawPayload.customerEmail.trim()
      ? rawPayload.customerEmail.trim()
      : undefined;
  const summary = String(
    rawPayload.summary ?? rawPayload.subject ?? rawPayload.title ?? "",
  ).trim();
  const description = String(
    rawPayload.description ?? rawPayload.body ?? rawPayload.details ?? "",
  ).trim();
  const priority = normalizePriority(rawPayload.priority);

  if (
    !customerName ||
    customerName.length > 160 ||
    !summary ||
    summary.length > 500 ||
    description.length > 4000
  ) {
    return jsonResponse({ error: "invalid_support_ticket_payload" }, 400);
  }

  const keyHash = createHash("sha256")
    .update(`${workspaceId}:${idempotencyKey}`)
    .digest("hex");
  const ticketId = `iss_cmd_${keyHash.slice(0, 24)}`;
  const ticketRef = `SV8-TKT-${keyHash.slice(0, 12).toUpperCase()}`;
  const payloadDigest = createHash("sha256")
    .update(
      JSON.stringify({
        customerName,
        customerEmail: customerEmail ?? "",
        summary,
        description,
        priority,
      }),
    )
    .digest("hex")
    .slice(0, 24);
  const digestTag = `cmd_digest:${payloadDigest}`;
  const actorId = claims.actor_id ?? claims.actor?.id ?? "arthur";

  try {
    const outcome = await client.withWorkspaceProvisioningSession(
      {
        tenantId: workspaceId,
        accountId,
        registryTenantId,
      },
      async (db) => {
        const wsRows = await db.query<{
          installation_id: string;
          native_tenant_id: string;
          native_domain: string;
        }>(
          `SELECT w.installation_id,w.native_tenant_id,w.native_domain
             FROM supportv8.runtime_support_workspaces w
             JOIN supportv8.tenants t
               ON t.id=w.native_tenant_id
              AND t.domain=w.native_domain
              AND t.servicev8_account_id=w.account_id
            WHERE w.native_tenant_id=$1
              AND w.account_id=$2
              AND w.registry_tenant_id=$3
              AND w.vertical_id='runtime'
              AND w.state='workspace_created'
              AND w.deleted_at IS NULL
            LIMIT 1`,
          [workspaceId, accountId, registryTenantId],
        );

        const activeWorkspace = wsRows[0];
        if (!activeWorkspace) {
          throw new Error("support_workspace_not_active");
        }

        await db.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))",
          [workspaceId, idempotencyKey],
        );

        const existingRows = await db.query<IssueRow>(
          `SELECT id,external_id,customer_ref,customer_name,source_status,priority,summary,source,source_url,tags,recommended_action,created_at::text AS created_at,updated_at::text AS updated_at
             FROM supportv8.issues
            WHERE tenant_id=$1 AND id=$2
            LIMIT 1`,
          [workspaceId, ticketId],
        );
        const existing = existingRows[0];
        if (existing) {
          const tags = Array.isArray(existing.tags) ? existing.tags : [];
          if (!tags.includes(digestTag)) {
            throw new Error("ticket_idempotency_conflict");
          }
          return {
            row: existing,
            replayed: true,
            domain: activeWorkspace.native_domain,
          };
        }

        const sourceUrl = `https://${activeWorkspace.native_domain}.support.servicev8.com/runtime?ticket=${encodeURIComponent(ticketId)}`;
        const customerRef = customerEmail ?? `cust_${keyHash.slice(0, 12)}`;
        const tags = ["governed_action", digestTag];
        const insertedRows = await db.query<IssueRow>(
          `INSERT INTO supportv8.issues
            (id,tenant_id,source,external_id,source_url,customer_ref,customer_name,summary,category,product,version,sentiment,priority,business_impact,resolution_risk_score,source_status,tags,recommended_action,timeline)
           VALUES
            ($1,$2,'governed_action',$3,$4,$5,$6,$7,'governed_support','SupportV8','1.0','neutral',$8,'medium',0.2,'open',$9::text[],$10,jsonb_build_array(jsonb_build_object('timestamp',NOW(),'actor',$11::text,'actorType','ai_employee','action','Governed support ticket created')))
           RETURNING id,external_id,customer_ref,customer_name,source_status,priority,summary,source,source_url,tags,recommended_action,created_at::text AS created_at,updated_at::text AS updated_at`,
          [
            ticketId,
            workspaceId,
            ticketRef,
            sourceUrl,
            customerRef,
            customerName,
            summary,
            priority,
            tags,
            description || null,
            actorId,
          ],
        );
        const inserted = insertedRows[0];
        if (!inserted) {
          throw new Error("ticket_write_failed");
        }

        await db
          .query(
            `INSERT INTO supportv8.action_audit_records
              (id,tenant_id,actor_id,actor_type,operation_id,risk,status,idempotency_key,input,output,reasoning,confidence)
             VALUES ($1,$2,$3,'ai_employee','support.ticket.create','medium','executed',$4,$5::jsonb,$6::jsonb,'Governed action approved and executed via Action Gateway',1.0)
             ON CONFLICT (id) DO NOTHING`,
            [
              `aud_${keyHash.slice(0, 24)}`,
              workspaceId,
              actorId,
              idempotencyKey,
              JSON.stringify({ customerName, customerEmail, summary, description, priority }),
              JSON.stringify({ ticketId: inserted.id, ticketRef: inserted.external_id }),
            ],
          )
          .catch(() => undefined);

        return {
          row: inserted,
          replayed: false,
          domain: activeWorkspace.native_domain,
        };
      },
    );

    const signalId = `evt_supportv8_ticket_created_${outcome.row.id}`;
    const currentTags = Array.isArray(outcome.row.tags) ? outcome.row.tags : [];
    const alreadyEmitted = currentTags.includes("signal_emitted");
    let signalReceipt: SignalEmitResult | undefined;
    if (!alreadyEmitted) {
      signalReceipt = await emitSignal({
        id: signalId,
        tenantId: registryTenantId,
        accountId,
        ticket: {
          id: outcome.row.id,
          ticketRef: outcome.row.external_id,
          customerName: outcome.row.customer_name,
          customerRef: outcome.row.customer_ref,
          summary: outcome.row.summary,
          priority: outcome.row.priority,
          category: "governed_support",
          status: outcome.row.source_status,
        },
      }).catch((err: unknown) => ({
        ok: false as const,
        error: err instanceof Error ? err.message : "signal_emit_failed",
      }));

      if (!signalReceipt.ok) {
        return jsonResponse(
          {
            error: "signal_emission_failed",
            message: signalReceipt.error ?? "Failed to emit support ticket created signal",
          },
          502,
        );
      }

      await client.withWorkspaceProvisioningSession(
        {
          tenantId: workspaceId,
          accountId,
          registryTenantId,
        },
        async (db) => {
          await db.query(
            `UPDATE supportv8.issues
                SET tags = CASE
                  WHEN 'signal_emitted' = ANY(tags) THEN tags
                  ELSE array_append(tags, 'signal_emitted')
                END
              WHERE tenant_id = $1 AND id = $2`,
            [workspaceId, outcome.row.id],
          );
        },
      );
    }

    return jsonResponse({
      ok: true,
      id: outcome.row.id,
      ticketId: outcome.row.id,
      ticketRef: outcome.row.external_id,
      ticketNumber: outcome.row.external_id,
      customerName: outcome.row.customer_name,
      ...(customerEmail ? { customerEmail } : {}),
      customerRef: outcome.row.customer_ref,
      summary: outcome.row.summary,
      ...(description ? { description } : {}),
      priority: outcome.row.priority,
      status: outcome.row.source_status,
      sourceUrl: outcome.row.source_url,
      ticketUrl: outcome.row.source_url,
      workspaceId,
      signalId,
      ...(signalReceipt?.ok && signalReceipt.receiptId
        ? { signalReceiptId: signalReceipt.receiptId }
        : {}),
      replayed: outcome.replayed,
      createdAt: outcome.row.created_at,
      updatedAt: outcome.row.updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "domain_action_failed";
    if (message === "support_workspace_not_active") {
      return jsonResponse({ error: "support_workspace_not_active" }, 403);
    }
    if (message === "ticket_idempotency_conflict") {
      return jsonResponse({ error: "ticket_idempotency_conflict" }, 409);
    }
    return jsonResponse({ error: message }, 500);
  }
}

import { createHash, randomUUID } from "node:crypto";
import { pgClient, type PostgresClient } from "@/lib/db/pg-client";
import {
  resolveOperationalSupportAccess,
  type OperationalSupportAccess,
  type SupportRuntimeScope,
} from "./runtime-access";

export type SupportTicketSummary = {
  ticketRef: string;
  id: string;
  customerRef: string;
  customerName: string;
  status: string;
  priority: string;
  summary: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};
export type SupportTicketPage = {
  tickets: SupportTicketSummary[];
  nextCursor?: string;
};
export type CreateSupportTicket = {
  customerName: string;
  summary: string;
  priority: "low" | "normal" | "high" | "urgent";
};
export type UpdateSupportTicket = {
  summary?: string;
  priority?: CreateSupportTicket["priority"];
  status?: "open" | "in_progress" | "escalated" | "resolved" | "closed";
};
type Row = {
  id: string;
  external_id: string;
  customer_ref: string;
  customer_name: string;
  source_status: string;
  priority: string;
  summary: string;
  source: string;
  created_at: string;
  updated_at: string;
};
type ListInput = { limit?: number; cursor?: string };
type Cursor = { v: 1; scope: string; updatedAt: string; id: string };
type Deps = {
  client?: PostgresClient;
  resolve?: (
    scope: SupportRuntimeScope,
  ) => Promise<OperationalSupportAccess | null>;
};
const idPattern = /^[A-Za-z0-9_:@.-]{1,192}$/;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/;
const cursorPattern = /^[A-Za-z0-9_-]+$/;
const maxEncodedCursorLength = 512;
function scopeKey(scope: SupportRuntimeScope): string {
  return createHash("sha256")
    .update(
      [
        scope.accountId,
        scope.tenantId,
        scope.installationId,
        scope.workspaceId,
      ].join("\0"),
    )
    .digest("base64url");
}
function decodeCursor(raw: string, scope: SupportRuntimeScope): Cursor {
  try {
    if (
      typeof raw !== "string" ||
      raw.length < 1 ||
      raw.length > maxEncodedCursorLength ||
      raw.length % 4 === 1 ||
      !cursorPattern.test(raw)
    )
      throw new Error();
    const decoded = Buffer.from(raw, "base64url");
    if (decoded.toString("base64url") !== raw || decoded.byteLength > 384)
      throw new Error();
    const value = JSON.parse(decoded.toString("utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    const item = value as Record<string, unknown>;
    if (
      Object.keys(item).length !== 4 ||
      !["v", "scope", "updatedAt", "id"].every((key) =>
        Object.hasOwn(item, key),
      ) ||
      item.v !== 1 ||
      item.scope !== scopeKey(scope) ||
      typeof item.updatedAt !== "string" ||
      !timestampPattern.test(item.updatedAt) ||
      !Number.isFinite(Date.parse(item.updatedAt)) ||
      typeof item.id !== "string" ||
      !idPattern.test(item.id)
    )
      throw new Error();
    return item as Cursor;
  } catch {
    throw new Error("invalid_ticket_cursor");
  }
}
function encodeCursor(row: Row, scope: SupportRuntimeScope): string {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      scope: scopeKey(scope),
      updatedAt: row.updated_at,
      id: row.id,
    } satisfies Cursor),
  ).toString("base64url");
}
function ticket(row: Row): SupportTicketSummary {
  return {
    ticketRef: row.external_id,
    id: row.id,
    customerRef: row.customer_ref,
    customerName: row.customer_name,
    status: row.source_status,
    priority: row.priority,
    summary: row.summary,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
const selection = `id,external_id,customer_ref,customer_name,source_status,priority,summary,source,created_at::text AS created_at,updated_at::text AS updated_at`;

export class RuntimeSupportTicketReader {
  private readonly client: PostgresClient;
  private resolve: (
    scope: SupportRuntimeScope,
  ) => Promise<OperationalSupportAccess | null>;
  constructor(deps: Deps = {}) {
    this.client = deps.client ?? pgClient;
    this.resolve =
      deps.resolve ?? ((scope) => resolveOperationalSupportAccess(scope));
  }
  private async authorize(
    scope: SupportRuntimeScope,
  ): Promise<OperationalSupportAccess> {
    const access = await this.resolve(scope);
    if (!access) throw new Error("support_access_denied");
    return access;
  }
  async list(
    scope: SupportRuntimeScope,
    input: ListInput = {},
  ): Promise<SupportTicketPage> {
    const access = await this.authorize(scope);
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("invalid_ticket_query");
    const cursor =
      input.cursor === undefined
        ? undefined
        : decodeCursor(input.cursor, scope);
    const rows = await this.client.withTenantSession(
      access.workspaceId,
      (db) =>
        cursor
          ? db.query<Row>(
              `SELECT ${selection} FROM supportv8.issues WHERE tenant_id=$1 AND (updated_at,id)<($2::timestamptz,$3) ORDER BY updated_at DESC,id DESC LIMIT $4`,
              [access.workspaceId, cursor.updatedAt, cursor.id, limit + 1],
            )
          : db.query<Row>(
              `SELECT ${selection} FROM supportv8.issues WHERE tenant_id=$1 ORDER BY updated_at DESC,id DESC LIMIT $2`,
              [access.workspaceId, limit + 1],
            ),
    );
    const visible = rows.slice(0, limit),
      last = visible.at(-1);
    return {
      tickets: visible.map(ticket),
      ...(rows.length > limit && last
        ? { nextCursor: encodeCursor(last, scope) }
        : {}),
    };
  }
  async get(
    scope: SupportRuntimeScope,
    id: string,
  ): Promise<SupportTicketSummary | null> {
    if (!idPattern.test(id)) throw new Error("invalid_ticket_query");
    const access = await this.authorize(scope);
    const rows = await this.client.withTenantSession(access.workspaceId, (db) =>
      db.query<Row>(
        `SELECT ${selection} FROM supportv8.issues WHERE tenant_id=$1 AND id=$2 LIMIT 1`,
        [access.workspaceId, id],
      ),
    );
    return rows[0] ? ticket(rows[0]) : null;
  }
  private async manage(
    scope: SupportRuntimeScope,
  ): Promise<OperationalSupportAccess> {
    const access = await this.authorize(scope);
    if (access.capability !== "support:manage")
      throw new Error("support_manage_denied");
    return access;
  }
  async create(
    scope: SupportRuntimeScope,
    input: CreateSupportTicket,
  ): Promise<SupportTicketSummary> {
    const access = await this.manage(scope),
      suffix = randomUUID().replaceAll("-", "");
    const id = `iss_runtime_${suffix}`,
      reference = `SV8-RUNTIME-${suffix.slice(0, 12).toUpperCase()}`;
    const rows = await this.client.withTenantSession(access.workspaceId, (db) =>
      db.query<Row>(
        `INSERT INTO supportv8.issues
      (id,tenant_id,source,external_id,source_url,customer_ref,customer_name,summary,category,product,version,sentiment,priority,business_impact,resolution_risk_score,source_status,tags,recommended_action,timeline)
      VALUES ($1,$2,'runtime_manual',$3,$4,$5,$6,$7,'runtime_support','SupportV8','1.0','neutral',$8,'low',0.1,'open',ARRAY['runtime_manual'],NULL,jsonb_build_array(jsonb_build_object('timestamp',NOW(),'actor',$9::text,'actorType','runtime_member','action','Ticket created')))
      RETURNING ${selection}`,
        [
          id,
          access.workspaceId,
          reference,
          `https://${access.domain}.support.servicev8.com/runtime?ticket=${encodeURIComponent(id)}`,
          `runtime:${suffix.slice(0, 16)}`,
          input.customerName,
          input.summary,
          input.priority,
          scope.subject,
        ],
      ),
    );
    if (!rows[0]) throw new Error("ticket_write_failed");
    return ticket(rows[0]);
  }
  async update(
    scope: SupportRuntimeScope,
    id: string,
    input: UpdateSupportTicket,
  ): Promise<SupportTicketSummary | null> {
    if (!idPattern.test(id)) throw new Error("invalid_ticket_query");
    const access = await this.manage(scope);
    const rows = await this.client.withTenantSession(access.workspaceId, async (db) => {
      const owned = await db.query<{source:string}>("SELECT source FROM supportv8.issues WHERE tenant_id=$1 AND id=$2 LIMIT 1",[access.workspaceId,id]);
      if (!owned[0]) return [];
      if (owned[0].source !== "runtime_manual") throw new Error("unsupported_ticket_source");
      return db.query<Row>(
        `UPDATE supportv8.issues SET
      summary=COALESCE($3,summary),priority=COALESCE($4,priority),source_status=COALESCE($5,source_status),updated_at=NOW(),
      timeline=timeline||jsonb_build_array(jsonb_build_object('timestamp',NOW(),'actor',$6::text,'actorType','runtime_member','action','Ticket updated'))
      WHERE tenant_id=$1 AND id=$2 RETURNING ${selection}`,
        [
          access.workspaceId,
          id,
          input.summary ?? null,
          input.priority ?? null,
          input.status ?? null,
          scope.subject,
        ],
      );
    });
    return rows[0] ? ticket(rows[0]) : null;
  }
}
export const runtimeSupportTicketReader = new RuntimeSupportTicketReader();

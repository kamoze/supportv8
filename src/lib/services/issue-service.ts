/**
 * supportV8 Issue Intelligence Service
 * Backed by durable PostgreSQL schema supportv8.issues under forced RLS.
 */

import crypto from "node:crypto";
import { pgClient, PostgresClient } from "../db/pg-client";
import type {
  Issue,
  SourceType,
  SentimentClass,
  NormalizedInteractionInput,
} from "../types";
import { triageEngine } from "./triage-engine";

function normalizeTenantId(tenant?: string): string {
  if (!tenant) return "tenant_default";
  const clean = tenant.toLowerCase().trim();
  const slug = clean.startsWith("tenant_") ? clean.slice(7) : clean;
  return `tenant_${slug.replace(/[^a-z0-9_]/g, "_")}`;
}

export function safeParseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function mapRowToIssue(row: any): Issue {
  const sentimentScore =
    typeof row.sentiment_score === "number"
      ? row.sentiment_score
      : parseFloat(row.sentiment_score ?? "0");
  const confidence =
    typeof row.confidence === "number"
      ? row.confidence
      : parseFloat(row.confidence ?? "0.85");
  const resolutionRiskScore =
    typeof row.resolution_risk_score === "number"
      ? row.resolution_risk_score
      : parseFloat(row.resolution_risk_score ?? "0.1");

  return {
    id: row.id,
    tenantId: row.tenant_id,
    source: row.source,
    externalId: row.external_id,
    sourceUrl: row.source_url || "",
    customerRef: row.customer_ref || "",
    customerName: row.customer_name || "",
    customerTier: row.customer_tier || "standard",
    summary: row.summary || "",
    title: row.summary || "",
    category: row.category || "",
    product: row.product || "",
    version: row.version || "",
    sentiment: row.sentiment || "neutral",
    sentimentScore,
    sentimentTrajectory: row.sentiment_trajectory || "stable",
    priority: row.priority || "normal",
    confidence,
    businessImpact: row.business_impact || "low",
    resolutionRiskScore,
    problemId: row.problem_id || undefined,
    sourceStatus: row.source_status || "open",
    status: row.source_status || "open",
    assignedTo: row.assigned_to || undefined,
    assignedAgent: row.assigned_agent || undefined,
    recommendedAction: row.recommended_action || undefined,
    tags: Array.isArray(row.tags) ? row.tags : [],
    timeline: safeParseJson(row.timeline, []),
    messages: safeParseJson(row.messages, []),
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

export class IssueService {
  private client: PostgresClient;

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  public async createFromInteraction(
    tenantIdOrParams:
      | string
      | {
          source: SourceType;
          externalId: string;
          customerRef: string;
          customerName: string;
          customerTier?: "standard" | "pro" | "enterprise";
          text: string;
          product?: string;
          version?: string;
          tenant?: string;
          sourceUrl?: string;
          correlationId?: string;
        },
    maybeInput?: Partial<NormalizedInteractionInput>
  ): Promise<Issue> {
    let tenantId: string;
    let input: NormalizedInteractionInput;

    if (typeof tenantIdOrParams === "string" && maybeInput) {
      tenantId = normalizeTenantId(tenantIdOrParams);
      input = {
        eventId: maybeInput.eventId || `evt_${crypto.randomUUID().slice(0, 12)}`,
        tenantId,
        accountId: maybeInput.accountId || "acc_default",
        connectionId: maybeInput.connectionId || "conn_default",
        connectorKey: maybeInput.connectorKey || (maybeInput.source as string) || "zendesk",
        source: maybeInput.source || "zendesk",
        sourceReference: maybeInput.sourceReference || `ref_${crypto.randomUUID().slice(0, 8)}`,
        customerReference: maybeInput.customerReference || "",
        sourceUrl: maybeInput.sourceUrl || "",
        text: maybeInput.text || "",
        sender: maybeInput.sender || "customer",
        occurredAt: maybeInput.occurredAt || new Date().toISOString(),
        receivedAt: maybeInput.receivedAt || new Date().toISOString(),
        correlationId: maybeInput.correlationId || `corr_${crypto.randomUUID().slice(0, 8)}`,
        raw: maybeInput.raw || {},
      };
    } else if (typeof tenantIdOrParams === "object") {
      const p = tenantIdOrParams;
      tenantId = normalizeTenantId(p.tenant);
      input = {
        eventId: `evt_${crypto.randomUUID().slice(0, 12)}`,
        tenantId,
        accountId: "acc_default",
        connectionId: "conn_default",
        connectorKey: p.source,
        source: p.source as "zendesk",
        sourceReference: p.externalId,
        customerReference: p.customerRef,
        sourceUrl: p.sourceUrl || `https://support.internal/tickets/${p.externalId}`,
        text: p.text,
        sender: "customer",
        occurredAt: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        correlationId: p.correlationId || `corr_${crypto.randomUUID().slice(0, 8)}`,
        raw: {
          customerName: p.customerName,
          customerTier: p.customerTier || "standard",
          product: p.product,
          version: p.version,
        },
      };
    } else {
      throw new Error("Invalid parameters to createFromInteraction");
    }

    const customerTier =
      (input.raw?.customerTier as "standard" | "pro" | "enterprise") || "standard";
    const triage = triageEngine.classify(input.text, customerTier);

    const idHash = crypto
      .createHash("sha256")
      .update(`${tenantId}:${input.source}:${input.sourceReference}`)
      .digest("hex")
      .slice(0, 32);
    const deterministicIssueId = `iss_${idHash}`;

    const firstLine = input.text.split("\n")[0]?.trim() || "";
    const summary =
      firstLine.length > 0
        ? firstLine.slice(0, 200)
        : `Issue from ${input.source} ${input.sourceReference}`;

    const customerName =
      (input.raw?.customerName as string) ||
      (input.raw?.requesterName as string) ||
      input.customerReference ||
      "Customer";

    const product = (input.raw?.product as string) || "Core Platform";
    const version = (input.raw?.version as string) || "1.0.0";

    const tags = [triage.category, `sent:${triage.sentiment}`, `tier:${customerTier}`];
    if (triage.intent) tags.push(`intent:${triage.intent}`);
    if (Array.isArray(input.raw?.tags)) {
      for (const t of input.raw.tags) {
        if (typeof t === "string" && !tags.includes(t)) tags.push(t);
      }
    }

    const auditMetadata = {
      classifierVersion: "supportv8-triage-v1",
      classificationTime: new Date().toISOString(),
      correlationId: input.correlationId,
    };

    const timeline = [
      {
        id: `tl_${crypto.randomUUID().slice(0, 8)}`,
        timestamp: new Date().toISOString(),
        actor: "system",
        actorType: "system" as const,
        action: "interaction_ingested",
        details: `Derived from ${input.source} event ${input.eventId}`,
        audit: auditMetadata,
      },
    ];

    const messages = [
      {
        id: `msg_${crypto.randomUUID().slice(0, 8)}`,
        timestamp: input.occurredAt || new Date().toISOString(),
        sender: input.sender === "agent" ? ("operator" as const) : ("customer" as const),
        senderName: customerName,
        content: input.text,
      },
    ];

    const savedRow = await this.client.withTenantSession(tenantId, async (session) => {
      const rows = await session.query<any>(
        `INSERT INTO supportv8.issues (
           id, tenant_id, source, external_id, source_url, customer_ref,
           customer_name, customer_tier, summary, category, product, version,
           sentiment, sentiment_score, sentiment_trajectory, priority, confidence,
           business_impact, resolution_risk_score, source_status, tags,
           recommended_action, timeline, messages, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12,
           $13, $14, $15, $16, $17,
           $18, $19, 'open', $20,
           $21, $22, $23, NOW(), NOW()
         )
         ON CONFLICT (tenant_id, source, external_id) DO UPDATE SET
           source_url = EXCLUDED.source_url,
           customer_name = CASE WHEN EXCLUDED.customer_name <> '' THEN EXCLUDED.customer_name ELSE supportv8.issues.customer_name END,
           summary = CASE WHEN supportv8.issues.summary = '' THEN EXCLUDED.summary ELSE supportv8.issues.summary END,
           category = CASE WHEN EXCLUDED.category <> '' THEN EXCLUDED.category ELSE supportv8.issues.category END,
           sentiment = EXCLUDED.sentiment,
           sentiment_score = EXCLUDED.sentiment_score,
           sentiment_trajectory = EXCLUDED.sentiment_trajectory,
           priority = EXCLUDED.priority,
           confidence = EXCLUDED.confidence,
           business_impact = EXCLUDED.business_impact,
           resolution_risk_score = EXCLUDED.resolution_risk_score,
           recommended_action = EXCLUDED.recommended_action,
           tags = supportv8.issues.tags || EXCLUDED.tags,
           timeline = supportv8.issues.timeline || EXCLUDED.timeline,
           messages = supportv8.issues.messages || EXCLUDED.messages,
           updated_at = NOW()
         RETURNING *`,
        [
          deterministicIssueId,
          tenantId,
          input.source,
          input.sourceReference,
          input.sourceUrl || "",
          input.customerReference || "",
          customerName || "",
          customerTier || "standard",
          summary || "",
          triage.category || "",
          product || "",
          version || "",
          triage.sentiment || "neutral",
          triage.sentimentScore ?? 0.0,
          triage.sentimentTrajectory || "stable",
          triage.priority || "normal",
          triage.confidence ?? 0.85,
          triage.businessImpact || "low",
          triage.resolutionRiskScore ?? 0.1,
          tags || [],
          triage.rationale || null,
          JSON.stringify(timeline),
          JSON.stringify(messages),
        ]
      );
      return rows[0];
    });

    const newIssue = mapRowToIssue(savedRow);

    // Migration 011 captures operational facts in this same native SQL transaction.
    return newIssue;
  }

  public async getAll(options?: {
    tenant?: string;
    tenantId?: string;
    category?: string;
    status?: string;
    search?: string;
    sentiment?: SentimentClass;
    source?: SourceType;
    problemId?: string;
  }): Promise<Issue[]> {
    const tenantParam = options?.tenantId || options?.tenant;
    if (!tenantParam) return [];
    const tenantId = normalizeTenantId(tenantParam);

    return this.client.withTenantSession(tenantId, async (session) => {
      const clauses: string[] = ["tenant_id = $1"];
      const params: unknown[] = [tenantId];
      let idx = 2;

      if (options?.category) {
        clauses.push(`category = $${idx++}`);
        params.push(options.category);
      }
      if (options?.status) {
        clauses.push(`source_status = $${idx++}`);
        params.push(options.status);
      }
      if (options?.sentiment) {
        clauses.push(`sentiment = $${idx++}`);
        params.push(options.sentiment);
      }
      if (options?.source) {
        clauses.push(`source = $${idx++}`);
        params.push(options.source);
      }
      if (options?.problemId) {
        clauses.push(`problem_id = $${idx++}`);
        params.push(options.problemId);
      }
      if (options?.search) {
        const q = `%${options.search}%`;
        clauses.push(
          `(summary ILIKE $${idx} OR customer_name ILIKE $${idx} OR external_id ILIKE $${idx} OR $${idx + 1} = ANY(tags))`
        );
        params.push(q);
        params.push(options.search);
        idx += 2;
      }

      const sql = `SELECT * FROM supportv8.issues WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`;
      const rows = await session.query<any>(sql, params);
      return rows.map(mapRowToIssue);
    });
  }

  public async getById(id: string, tenantId?: string): Promise<Issue | null> {
    if (tenantId) {
      const canonicalTenantId = normalizeTenantId(tenantId);
      return this.client.withTenantSession(canonicalTenantId, async (session) => {
        const rows = await session.query<any>(
          `SELECT * FROM supportv8.issues WHERE tenant_id = $1 AND id = $2`,
          [canonicalTenantId, id]
        );
        if (!rows || rows.length === 0) return null;
        return mapRowToIssue(rows[0]);
      });
    }

    return this.client.withSystemSession(async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.issues WHERE id = $1`,
        [id]
      );
      if (!rows || rows.length === 0) return null;
      return mapRowToIssue(rows[0]);
    });
  }

  public async update(
    id: string,
    updates: Partial<Issue>,
    tenantId?: string
  ): Promise<Issue | null> {
    let resolvedTenantId = tenantId ? normalizeTenantId(tenantId) : undefined;
    if (!resolvedTenantId) {
      const existing = await this.getById(id);
      if (!existing) return null;
      resolvedTenantId = existing.tenantId;
    }

    const setClauses: string[] = [];
    const params: unknown[] = [resolvedTenantId, id];
    let idx = 3;

    if (updates.summary !== undefined) {
      setClauses.push(`summary = $${idx++}`);
      params.push(updates.summary);
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${idx++}`);
      params.push(updates.category);
    }
    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${idx++}`);
      params.push(updates.priority);
    }
    if (updates.sentiment !== undefined) {
      setClauses.push(`sentiment = $${idx++}`);
      params.push(updates.sentiment);
    }
    if (updates.sourceStatus !== undefined || updates.status !== undefined) {
      setClauses.push(`source_status = $${idx++}`);
      params.push(updates.sourceStatus || updates.status);
    }
    if (updates.problemId !== undefined) {
      setClauses.push(`problem_id = $${idx++}`);
      params.push(updates.problemId || null);
    }
    if (updates.assignedTo !== undefined) {
      setClauses.push(`assigned_to = $${idx++}`);
      params.push(updates.assignedTo || null);
    }
    if (updates.assignedAgent !== undefined) {
      setClauses.push(`assigned_agent = $${idx++}`);
      params.push(updates.assignedAgent || null);
    }
    if (updates.recommendedAction !== undefined) {
      setClauses.push(`recommended_action = $${idx++}`);
      params.push(updates.recommendedAction || null);
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${idx++}`);
      params.push(updates.tags);
    }
    if (updates.timeline !== undefined) {
      setClauses.push(`timeline = $${idx++}`);
      params.push(JSON.stringify(updates.timeline));
    }
    if (updates.messages !== undefined) {
      setClauses.push(`messages = $${idx++}`);
      params.push(JSON.stringify(updates.messages));
    }

    setClauses.push("updated_at = NOW()");

    const updatedRow = await this.client.withTenantSession(resolvedTenantId, async (session) => {
      const sql = `UPDATE supportv8.issues
                   SET ${setClauses.join(", ")}
                   WHERE tenant_id = $1 AND id = $2
                   RETURNING *`;
      const rows = await session.query<any>(sql, params);
      return rows[0] || null;
    });

    if (!updatedRow) return null;
    const updated = mapRowToIssue(updatedRow);

    // Native SQL trigger owns transition capture; no post-commit legacy sender.
    return updated;
  }

  public async updateIssue(
    id: string,
    updates: Partial<Issue>,
    tenantId?: string
  ): Promise<Issue | null> {
    return this.update(id, updates, tenantId);
  }
}

export const issueService = new IssueService();

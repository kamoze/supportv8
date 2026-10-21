/**
 * supportV8 Problem Correlation Service
 * Backed by durable PostgreSQL tables supportv8.problems and supportv8.issues under forced RLS.
 */

import crypto from "node:crypto";
import { pgClient, PostgresClient } from "../db/pg-client";
import type { Problem, ProblemStatus, Issue, SourceType } from "../types";
import { businessImpactEngine } from "./business-impact-engine";
import { mapRowToIssue } from "./issue-service";

function normalizeTenantId(tenant: string): string {
  if (!tenant) return "tenant_default";
  const clean = tenant.toLowerCase().trim();
  const slug = clean.startsWith("tenant_") ? clean.slice(7) : clean;
  return `tenant_${slug.replace(/[^a-z0-9_]/g, "_")}`;
}

export function mapRowToProblem(row: any): Problem {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    summary: row.summary || "",
    suspectedCause: row.suspected_cause || "",
    status: row.status as ProblemStatus,
    confidence:
      typeof row.confidence === "number"
        ? row.confidence
        : parseFloat(row.confidence ?? "0.9"),
    impact: row.impact,
    severity: row.impact,
    affectedCustomerCount: Number(row.affected_customer_count || 0),
    affectedEnterpriseCount: Number(row.affected_enterprise_count || 0),
    linkedIssueIds: Array.isArray(row.linked_issue_ids) ? row.linked_issue_ids : [],
    estimatedRevenueExposure:
      typeof row.estimated_revenue_exposure === "number"
        ? row.estimated_revenue_exposure
        : parseFloat(row.estimated_revenue_exposure ?? "0"),
    firstSeen:
      row.first_seen instanceof Date
        ? row.first_seen.toISOString()
        : String(row.first_seen),
    lastSeen:
      row.last_seen instanceof Date
        ? row.last_seen.toISOString()
        : String(row.last_seen),
    trend: row.trend || "stable",
    owner: row.owner || "Support Intelligence Engine",
    recommendedActions: Array.isArray(row.recommended_actions)
      ? row.recommended_actions
      : [],
    communicationsCount: Number(row.communications_count || 0),
    verificationState: row.verification_state || "unverified",
    sourceSystems: Array.isArray(row.source_systems)
      ? row.source_systems
      : ["zendesk"],
  };
}

export class ProblemService {
  private client: PostgresClient;

  constructor(client: PostgresClient = pgClient) {
    this.client = client;
  }

  public async getAll(tenantId: string): Promise<Problem[]> {
    const canonicalTenantId = normalizeTenantId(tenantId);
    return this.client.withTenantSession(canonicalTenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.problems
         WHERE tenant_id = $1
         ORDER BY created_at DESC`,
        [canonicalTenantId]
      );
      return rows.map(mapRowToProblem);
    });
  }

  public async getById(id: string, tenantId: string): Promise<Problem | null> {
    const canonicalTenantId = normalizeTenantId(tenantId);
    return this.client.withTenantSession(canonicalTenantId, async (session) => {
      const rows = await session.query<any>(
        `SELECT * FROM supportv8.problems
         WHERE tenant_id = $1 AND id = $2`,
        [canonicalTenantId, id]
      );
      if (!rows || rows.length === 0) return null;
      return mapRowToProblem(rows[0]);
    });
  }

  public async correlateIssues(
    tenantId: string,
    issueIds: string[],
    title: string,
    suspectedCause: string = ""
  ): Promise<Problem> {
    const canonicalTenantId = normalizeTenantId(tenantId);

    return this.client.withTenantSession(canonicalTenantId, async (session) => {
      // 1. Load every Issue within the tenant session
      const issueRows = await session.query<any>(
        `SELECT * FROM supportv8.issues
         WHERE tenant_id = $1 AND id = ANY($2)`,
        [canonicalTenantId, issueIds]
      );

      // 2. Reject if any Issue is missing or foreign to the tenant
      if (issueRows.length !== issueIds.length) {
        throw new Error(
          `Cannot correlate: expected ${issueIds.length} issues for tenant ${canonicalTenantId}, but found ${issueRows.length}`
        );
      }

      const issues: Issue[] = issueRows.map(mapRowToIssue);
      const impactCalc = businessImpactEngine.calculate(issues);
      const uniqueSources = Array.from(new Set(issues.map((i) => i.source))) as SourceType[];

      const problemId = `PRB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const summary = `Automated correlation of ${issues.length} customer issues with common pattern: ${title}`;
      const recommendedActions = [
        "Investigate root cause and apply infrastructure mitigation",
        "Broadcast proactive status notification to affected customers",
      ];

      // 3. Persist Problem in supportv8.problems
      const insertRows = await session.query<any>(
        `INSERT INTO supportv8.problems (
           id, tenant_id, title, summary, suspected_cause, status, confidence,
           impact, affected_customer_count, affected_enterprise_count,
           estimated_revenue_exposure, linked_issue_ids, first_seen, last_seen,
           trend, owner, recommended_actions, communications_count, verification_state,
           source_systems, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, 'active', 0.93,
           $6, $7, $8,
           $9, $10, NOW(), NOW(),
           'increasing', 'Support Intelligence Engine', $11, 0, 'unverified',
           $12, NOW(), NOW()
         )
         RETURNING *`,
        [
          problemId,
          canonicalTenantId,
          title,
          summary,
          suspectedCause,
          impactCalc.impact,
          issues.length,
          impactCalc.affectedEnterpriseCount,
          impactCalc.estimatedRevenueExposure,
          issueIds,
          recommendedActions,
          uniqueSources.length > 0 ? uniqueSources : ["zendesk"],
        ]
      );

      // 4. Update linked issues in the same transaction
      await session.query(
        `UPDATE supportv8.issues
         SET problem_id = $1, updated_at = NOW()
         WHERE tenant_id = $2 AND id = ANY($3)`,
        [problemId, canonicalTenantId, issueIds]
      );

      return mapRowToProblem(insertRows[0]);
    });
  }

  public async linkIssue(
    tenantId: string,
    problemId: string,
    issueId: string
  ): Promise<Problem | null> {
    const canonicalTenantId = normalizeTenantId(tenantId);

    return this.client.withTenantSession(canonicalTenantId, async (session) => {
      const probRows = await session.query<any>(
        `SELECT * FROM supportv8.problems WHERE tenant_id = $1 AND id = $2`,
        [canonicalTenantId, problemId]
      );
      if (!probRows || probRows.length === 0) return null;

      const issueRows = await session.query<any>(
        `SELECT * FROM supportv8.issues WHERE tenant_id = $1 AND id = $2`,
        [canonicalTenantId, issueId]
      );
      if (!issueRows || issueRows.length === 0) return null;

      const existingLinked: string[] = probRows[0].linked_issue_ids || [];
      if (!existingLinked.includes(issueId)) {
        const nextLinked = [...existingLinked, issueId];

        // Fetch all linked issues to recalculate impact
        const allLinkedRows = await session.query<any>(
          `SELECT * FROM supportv8.issues WHERE tenant_id = $1 AND id = ANY($2)`,
          [canonicalTenantId, nextLinked]
        );
        const issues = allLinkedRows.map(mapRowToIssue);
        const calc = businessImpactEngine.calculate(issues);

        // Update problem
        const updatedProb = await session.query<any>(
          `UPDATE supportv8.problems
           SET linked_issue_ids = $1,
               affected_customer_count = $2,
               affected_enterprise_count = $3,
               estimated_revenue_exposure = $4,
               impact = $5,
               updated_at = NOW()
           WHERE tenant_id = $6 AND id = $7
           RETURNING *`,
          [
            nextLinked,
            nextLinked.length,
            calc.affectedEnterpriseCount,
            calc.estimatedRevenueExposure,
            calc.impact,
            canonicalTenantId,
            problemId,
          ]
        );

        // Update issue
        await session.query(
          `UPDATE supportv8.issues
           SET problem_id = $1, updated_at = NOW()
           WHERE tenant_id = $2 AND id = $3`,
          [problemId, canonicalTenantId, issueId]
        );

        return mapRowToProblem(updatedProb[0]);
      }

      return mapRowToProblem(probRows[0]);
    });
  }

  public async unlinkIssue(
    tenantId: string,
    problemId: string,
    issueId: string
  ): Promise<Problem | null> {
    const canonicalTenantId = normalizeTenantId(tenantId);

    return this.client.withTenantSession(canonicalTenantId, async (session) => {
      const probRows = await session.query<any>(
        `SELECT * FROM supportv8.problems WHERE tenant_id = $1 AND id = $2`,
        [canonicalTenantId, problemId]
      );
      if (!probRows || probRows.length === 0) return null;

      const existingLinked: string[] = probRows[0].linked_issue_ids || [];
      const nextLinked = existingLinked.filter((id) => id !== issueId);

      const allLinkedRows = nextLinked.length > 0
        ? await session.query<any>(
            `SELECT * FROM supportv8.issues WHERE tenant_id = $1 AND id = ANY($2)`,
            [canonicalTenantId, nextLinked]
          )
        : [];
      const issues = allLinkedRows.map(mapRowToIssue);
      const calc = businessImpactEngine.calculate(issues);

      const updatedProb = await session.query<any>(
        `UPDATE supportv8.problems
         SET linked_issue_ids = $1,
             affected_customer_count = $2,
             affected_enterprise_count = $3,
             estimated_revenue_exposure = $4,
             impact = $5,
             updated_at = NOW()
         WHERE tenant_id = $6 AND id = $7
         RETURNING *`,
        [
          nextLinked,
          nextLinked.length,
          calc.affectedEnterpriseCount,
          calc.estimatedRevenueExposure,
          calc.impact,
          canonicalTenantId,
          problemId,
        ]
      );

      await session.query(
        `UPDATE supportv8.issues
         SET problem_id = NULL, updated_at = NOW()
         WHERE tenant_id = $1 AND id = $2 AND problem_id = $3`,
        [canonicalTenantId, issueId, problemId]
      );

      return mapRowToProblem(updatedProb[0]);
    });
  }

  public async updateStatus(
    tenantId: string,
    problemId: string,
    status: ProblemStatus
  ): Promise<Problem | null> {
    const canonicalTenantId = normalizeTenantId(tenantId);

    return this.client.withTenantSession(canonicalTenantId, async (session) => {
      const rows = await session.query<any>(
        `UPDATE supportv8.problems
         SET status = $1,
             verification_state = CASE WHEN $1 = 'resolved' THEN 'verified' ELSE verification_state END,
             trend = CASE WHEN $1 = 'resolved' THEN 'decreasing' ELSE trend END,
             updated_at = NOW()
         WHERE tenant_id = $2 AND id = $3
         RETURNING *`,
        [status, canonicalTenantId, problemId]
      );
      if (!rows || rows.length === 0) return null;
      return mapRowToProblem(rows[0]);
    });
  }
  public seedDemoProblems(_tenantSlug?: string): Problem[] {
    return [];
  }
}

export const problemService = new ProblemService();

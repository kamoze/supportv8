import { PostgresClient, type DatabaseSession, type SystemDatabaseSession } from "@/lib/db/pg-client";
import { db } from "@/lib/db/mock-data";

function normalizeTenantId(tenant?: string): string {
  if (!tenant) return "tenant_default";
  const clean = tenant.toLowerCase().trim();
  const slug = clean.startsWith("tenant_") ? clean.slice(7) : clean;
  return `tenant_${slug.replace(/[^a-z0-9_]/g, "_")}`;
}

export class MockPostgresClient extends PostgresClient {
  public issues: any[] = [];
  public problems: any[] = [];
  public policies: Map<string, any> = new Map();
  public receipts: any[] = [];
  public sourceConnections: any[] = [];

  constructor() {
    super(undefined, {
      connect: async () => ({
        query: (async () => ({ rows: [], command: "", rowCount: 0, oid: 0, fields: [] })) as any,
        release: () => {},
      }),
    });
  }

  public reset() {
    this.issues = [];
    this.problems = [];
    this.policies.clear();
    this.receipts = [];
    this.sourceConnections = [];
  }

  public override async withTenantSession<T>(
    tenantId: string,
    callback: (session: DatabaseSession) => Promise<T>
  ): Promise<T> {
    const session: DatabaseSession = {
      tenantId,
      query: async (sql: string, params: unknown[] = []) => {
        return this.handleQuery(tenantId, sql, params);
      },
    };
    return callback(session);
  }

  public override async withSystemSession<T>(
    callback: (session: SystemDatabaseSession) => Promise<T>
  ): Promise<T> {
    const session: SystemDatabaseSession = {
      query: async (sql: string, params: unknown[] = []) => {
        return this.handleQuery(undefined, sql, params);
      },
    };
    return callback(session);
  }

  private handleQuery(tenantId: string | undefined, sql: string, params: unknown[]): any[] {
    const lowerSql = sql.toLowerCase();

    // 1. ISSUES QUERIES
    if (lowerSql.includes("from supportv8.issues") || lowerSql.includes("into supportv8.issues") || lowerSql.includes("update supportv8.issues")) {
      if (lowerSql.startsWith("insert into supportv8.issues")) {
        const id = params[0] as string;
        const tenant_id = params[1] as string;
        const source = params[2] as string;
        const external_id = params[3] as string;
        const source_url = (params[4] as string) || "";
        const customer_ref = (params[5] as string) || "";
        const customer_name = (params[6] as string) || "";
        const customer_tier = (params[7] as string) || "standard";
        const summary = (params[8] as string) || "";
        const category = (params[9] as string) || "";
        const product = (params[10] as string) || "";
        const version = (params[11] as string) || "";
        const sentiment = (params[12] as string) || "neutral";
        const sentiment_score = params[13] ?? 0;
        const sentiment_trajectory = (params[14] as string) || "stable";
        const priority = (params[15] as string) || "normal";
        const confidence = params[16] ?? 0.85;
        const business_impact = (params[17] as string) || "low";
        const resolution_risk_score = params[18] ?? 0.1;
        const tags = Array.isArray(params[19]) ? params[19] : [];
        const recommended_action = (params[20] as string) || undefined;
        const timeline = params[21] || [];
        const messages = params[22] || [];

        const existingIdx = this.issues.findIndex(
          (i) => i.tenant_id === tenant_id && i.source === source && i.external_id === external_id
        );

        const row = {
          id: existingIdx !== -1 ? this.issues[existingIdx].id : id,
          tenant_id,
          source,
          external_id,
          source_url,
          customer_ref,
          customer_name,
          customer_tier,
          summary,
          category,
          product,
          version,
          sentiment,
          sentiment_score,
          sentiment_trajectory,
          priority,
          confidence,
          business_impact,
          resolution_risk_score,
          source_status: "open",
          tags,
          recommended_action,
          timeline,
          messages,
          created_at: existingIdx !== -1 ? this.issues[existingIdx].created_at : new Date(),
          updated_at: new Date(),
        };

        if (existingIdx !== -1) {
          this.issues[existingIdx] = { ...this.issues[existingIdx], ...row };
          return [this.issues[existingIdx]];
        } else {
          this.issues.unshift(row);
          return [row];
        }
      }

      if (lowerSql.startsWith("update supportv8.issues")) {
        let updated: any[] = [];
        if (lowerSql.includes("problem_id = $1") && lowerSql.includes("id = any($3)")) {
          const problemId = params[0] as string;
          const tid = params[1] as string;
          const ids = params[2] as string[];
          for (const iss of this.issues) {
            if (iss.tenant_id === tid && ids.includes(iss.id)) {
              iss.problem_id = problemId;
              iss.updated_at = new Date();
              updated.push(iss);
            }
          }
          return updated;
        }

        if (lowerSql.includes("problem_id = null")) {
          const tid = params[0] as string;
          const issueId = params[1] as string;
          for (const iss of this.issues) {
            if (iss.tenant_id === tid && iss.id === issueId) {
              iss.problem_id = undefined;
              iss.updated_at = new Date();
              updated.push(iss);
            }
          }
          return updated;
        }

        if (lowerSql.includes("problem_id = $1") && lowerSql.includes("id = $3")) {
          const problemId = params[0] as string;
          const tid = params[1] as string;
          const issueId = params[2] as string;
          for (const iss of this.issues) {
            if (iss.tenant_id === tid && iss.id === issueId) {
              iss.problem_id = problemId;
              iss.updated_at = new Date();
              updated.push(iss);
            }
          }
          return updated;
        }

        // Generic update
        const tid = params[0] as string;
        const id = params[1] as string;
        const iss = this.issues.find((i) => i.id === id && (!tid || i.tenant_id === tid));
        if (iss) {
          // Parse set clauses from SQL
          iss.updated_at = new Date();
          // Map values from params
          let pIdx = 2;
          if (lowerSql.includes("summary = $")) iss.summary = params[pIdx++];
          if (lowerSql.includes("category = $")) iss.category = params[pIdx++];
          if (lowerSql.includes("priority = $")) iss.priority = params[pIdx++];
          if (lowerSql.includes("sentiment = $")) iss.sentiment = params[pIdx++];
          if (lowerSql.includes("source_status = $")) iss.source_status = params[pIdx++];
          if (lowerSql.includes("problem_id = $")) iss.problem_id = params[pIdx++];
          if (lowerSql.includes("assigned_to = $")) iss.assigned_to = params[pIdx++];
          if (lowerSql.includes("assigned_agent = $")) iss.assigned_agent = params[pIdx++];
          if (lowerSql.includes("recommended_action = $")) iss.recommended_action = params[pIdx++];
          if (lowerSql.includes("tags = $")) iss.tags = params[pIdx++];
          if (lowerSql.includes("timeline = $")) iss.timeline = params[pIdx++];
          if (lowerSql.includes("messages = $")) iss.messages = params[pIdx++];
          return [iss];
        }
        return [];
      }

      // SELECT from supportv8.issues
      let matched = [...this.issues];
      for (const dbi of db.issues) {
        const rawTid = (dbi as any).tenantDomain || dbi.tenantId;
        const dbiTenantId = normalizeTenantId(rawTid);
        if (!matched.some((m) => m.id === dbi.id)) {
          matched.push({
            id: dbi.id,
            tenant_id: dbiTenantId,
            source: dbi.source,
            external_id: dbi.externalId,
            source_url: dbi.sourceUrl,
            customer_ref: dbi.customerRef,
            customer_name: dbi.customerName,
            customer_tier: dbi.customerTier,
            summary: dbi.summary,
            category: dbi.category,
            product: dbi.product,
            version: dbi.version,
            sentiment: dbi.sentiment,
            sentiment_score: dbi.sentimentScore,
            sentiment_trajectory: dbi.sentimentTrajectory,
            priority: dbi.priority,
            confidence: dbi.confidence,
            business_impact: dbi.businessImpact,
            resolution_risk_score: dbi.resolutionRiskScore,
            source_status: dbi.status || dbi.sourceStatus || "open",
            tags: dbi.tags || [],
            recommended_action: dbi.recommendedAction,
            timeline: dbi.timeline || [],
            messages: dbi.messages || [],
            assigned_to: dbi.assignedTo,
            assigned_agent: dbi.assignedAgent,
            created_at: dbi.createdAt ? new Date(dbi.createdAt) : new Date(),
            updated_at: dbi.updatedAt ? new Date(dbi.updatedAt) : new Date(),
          });
        }
      }

      if (tenantId) {
        const slug = tenantId.replace(/^tenant_/, "").replace(/_/g, "-");
        const tenantData = db.getTenantData(slug);
        if (tenantData?.issues) {
          for (const dbi of tenantData.issues) {
            if (!matched.some((m) => m.id === dbi.id)) {
              matched.push({
                id: dbi.id,
                tenant_id: tenantId,
                source: dbi.source,
                external_id: dbi.externalId,
                source_url: dbi.sourceUrl,
                customer_ref: dbi.customerRef,
                customer_name: dbi.customerName,
                customer_tier: dbi.customerTier,
                summary: dbi.summary,
                category: dbi.category,
                product: dbi.product,
                version: dbi.version,
                sentiment: dbi.sentiment,
                sentiment_score: dbi.sentimentScore,
                sentiment_trajectory: dbi.sentimentTrajectory,
                priority: dbi.priority,
                confidence: dbi.confidence,
                business_impact: dbi.businessImpact,
                resolution_risk_score: dbi.resolutionRiskScore,
                source_status: dbi.status || dbi.sourceStatus || "open",
                tags: dbi.tags || [],
                recommended_action: dbi.recommendedAction,
                timeline: dbi.timeline || [],
                messages: dbi.messages || [],
                assigned_to: dbi.assignedTo,
                assigned_agent: dbi.assignedAgent,
                created_at: dbi.createdAt ? new Date(dbi.createdAt) : new Date(),
                updated_at: dbi.updatedAt ? new Date(dbi.updatedAt) : new Date(),
              });
            }
          }
        }
        matched = matched.filter((i) => i.tenant_id === tenantId);
      }

      if (lowerSql.includes("id = any($2)")) {
        const ids = params[1] as string[];
        return matched.filter((i) => ids.includes(i.id));
      }

      if (lowerSql.includes(" and id = $2")) {
        const id = params[1] as string;
        return matched.filter((i) => i.id === id);
      }

      if (lowerSql.includes("where id = $1")) {
        const id = params[0] as string;
        return matched.filter((i) => i.id === id);
      }

      if (lowerSql.includes("external_id = $2")) {
        const ext = params[1] as string;
        return matched.filter((i) => i.external_id === ext);
      }

      return matched;
    }

    // 2. PROBLEMS QUERIES
    if (lowerSql.includes("supportv8.problems")) {
      if (lowerSql.startsWith("insert into supportv8.problems")) {
        const id = params[0] as string;
        const tid = params[1] as string;
        const title = params[2] as string;
        const summary = (params[3] as string) || "";
        const suspected_cause = (params[4] as string) || "";
        const impact = (params[5] as string) || "low";
        const affected_customer_count = Number(params[6] || 0);
        const affected_enterprise_count = Number(params[7] || 0);
        const estimated_revenue_exposure = Number(params[8] || 0);
        const linked_issue_ids = Array.isArray(params[9]) ? params[9] : [];
        const recommended_actions = Array.isArray(params[10]) ? params[10] : [];
        const source_systems = Array.isArray(params[11]) ? params[11] : ["zendesk"];

        const row = {
          id,
          tenant_id: tid,
          title,
          summary,
          suspected_cause,
          status: "active",
          confidence: 0.93,
          impact,
          affected_customer_count,
          affected_enterprise_count,
          estimated_revenue_exposure,
          linked_issue_ids,
          first_seen: new Date(),
          last_seen: new Date(),
          trend: "increasing",
          owner: "Support Intelligence Engine",
          recommended_actions,
          communications_count: 0,
          verification_state: "unverified",
          source_systems,
          created_at: new Date(),
          updated_at: new Date(),
        };
        this.problems.unshift(row);
        return [row];
      }

      if (lowerSql.startsWith("update supportv8.problems")) {
        if (lowerSql.includes("linked_issue_ids = $1")) {
          const nextLinked = params[0] as string[];
          const affCust = Number(params[1] || 0);
          const affEnt = Number(params[2] || 0);
          const revExp = Number(params[3] || 0);
          const impact = params[4] as string;
          const tid = params[5] as string;
          const probId = params[6] as string;

          const p = this.problems.find((pr) => pr.id === probId && pr.tenant_id === tid);
          if (p) {
            p.linked_issue_ids = nextLinked;
            p.affected_customer_count = affCust;
            p.affected_enterprise_count = affEnt;
            p.estimated_revenue_exposure = revExp;
            p.impact = impact;
            p.updated_at = new Date();
            return [p];
          }
          return [];
        }

        if (lowerSql.includes("status = $1")) {
          const status = params[0] as string;
          const tid = params[1] as string;
          const probId = params[2] as string;
          const p = this.problems.find((pr) => pr.id === probId && pr.tenant_id === tid);
          if (p) {
            p.status = status;
            if (status === "resolved") {
              p.verification_state = "verified";
              p.trend = "decreasing";
            }
            p.updated_at = new Date();
            return [p];
          }
          return [];
        }
      }

      // SELECT from problems
      let matched = [...this.problems];
      if (tenantId) {
        matched = matched.filter((p) => p.tenant_id === tenantId);
      }
      if (lowerSql.includes("id = $2")) {
        const id = params[1] as string;
        return matched.filter((p) => p.id === id);
      }
      return matched;
    }

    // 3. TENANT POLICIES QUERIES
    if (lowerSql.includes("supportv8.tenant_policies")) {
      if (lowerSql.startsWith("insert into supportv8.tenant_policies")) {
        const tid = params[0] as string;
        const retention = Number(params[1] || 72);
        const mode = (params[2] as string) || "observe";
        const pol = {
          tenant_id: tid,
          raw_context_retention_hours: retention,
          mode,
          updated_at: new Date(),
        };
        this.policies.set(tid, pol);
        return [pol];
      }

      const tid = (params[0] as string) || tenantId;
      const pol = tid ? this.policies.get(tid) : undefined;
      return pol ? [pol] : [];
    }

    // 4. SOURCE CONNECTIONS
    if (lowerSql.includes("supportv8.source_connections")) {
      let matched = [...this.sourceConnections];
      if (tenantId) {
        matched = matched.filter((s) => s.tenant_id === tenantId);
      }
      return matched;
    }

    // 5. ACTION RECEIPTS
    if (lowerSql.includes("supportv8.action_receipts")) {
      if (lowerSql.startsWith("insert")) {
        const row = {
          id: params[0],
          tenant_id: params[1],
          idempotency_key: params[2],
          action: params[3],
          status: "completed",
          created_at: new Date(),
        };
        this.receipts.push(row);
        return [row];
      }
      return this.receipts;
    }

    return [];
  }
}

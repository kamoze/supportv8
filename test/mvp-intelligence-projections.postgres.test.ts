import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { PostgresClient } from "@/lib/db/pg-client";
import { issueService } from "@/lib/services/issue-service";
import { problemService } from "@/lib/services/problem-service";
import { trendAnomalyService } from "@/lib/services/trend-anomaly-service";
import { policyEngine } from "@/lib/services/policy-engine";
import { GET as getOverview } from "@/app/api/overview/route";
import { GET as getIssues } from "@/app/api/issues/route";
import { GET as getProblems } from "@/app/api/problems/route";

describe("MVP Intelligence Projections & PostgreSQL RLS Integration", () => {
  const adminBaseUrl =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.USER || "postgres"}@127.0.0.1:5432/postgres`;

  const dbName = `support_intelligence_test_${Math.floor(Math.random() * 1000000)}`;
  const appRole = `support_intelligence_app_${Math.floor(Math.random() * 1000000)}`;
  const appPassword = "test_intelligence_pwd_secure";

  let adminPool: Pool;
  let appPool: Pool;
  let client: PostgresClient;

  const tenantAlpha = "tenant_alpha";
  const tenantBeta = "tenant_beta";

  beforeAll(async () => {
    // 1. Connect as admin to create test database
    adminPool = new Pool({ connectionString: adminBaseUrl });
    await adminPool.query(`CREATE DATABASE ${dbName}`);

    // 2. Connect to test database as admin to run migrations and setup roles
    const parsed = new URL(adminBaseUrl);
    parsed.pathname = `/${dbName}`;
    const dbAdminUrl = parsed.toString();
    const dbAdminPool = new Pool({ connectionString: dbAdminUrl });

    try {
      // Create non-superuser application role without BYPASSRLS
      await dbAdminPool.query(
        `CREATE ROLE ${appRole} WITH LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOBYPASSRLS`
      );

      // Read and execute migration 011_mvp_intelligence.sql
      const migrationPath = resolve(__dirname, "../migrations/011_mvp_intelligence.sql");
      const migrationSql = await readFile(migrationPath, "utf8");
      await dbAdminPool.query(migrationSql);

      // Seed tenants for foreign key references
      await dbAdminPool.query(
        `INSERT INTO supportv8.tenants (id, domain, name, operating_mode)
         VALUES
           ('${tenantAlpha}', 'alpha.support.servicev8.com', 'Tenant Alpha', 'autonomous'),
           ('${tenantBeta}', 'beta.support.servicev8.com', 'Tenant Beta', 'autonomous')
         ON CONFLICT (id) DO NOTHING`
      );

      // Grant schema and table access to the non-superuser application role
      await dbAdminPool.query(
        `GRANT USAGE ON SCHEMA supportv8 TO ${appRole};
         GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA supportv8 TO ${appRole};
         GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA supportv8 TO ${appRole};
         GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA supportv8 TO ${appRole};`
      );
    } finally {
      await dbAdminPool.end();
    }

    // 3. Connect as application user to guarantee strict non-superuser RLS enforcement
    parsed.username = appRole;
    parsed.password = appPassword;
    const appConnectionUrl = parsed.toString();

    appPool = new Pool({ connectionString: appConnectionUrl });
    client = new PostgresClient(undefined, appPool);

    // Plug real test database into global services via testClientInstance hook
    PostgresClient.setTestClient(client);
  });

  afterAll(async () => {
    PostgresClient.setTestClient(null);

    try {
      await appPool?.end();
    } catch {}

    try {
      await adminPool.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName]
      );
      await adminPool.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await adminPool.query(`DROP ROLE IF EXISTS ${appRole}`);
      await adminPool.end();
    } catch {}
  });

  describe("1. Clean Tenant Zero-State Projections", () => {
    it("returns zero counts and empty arrays for a fresh tenant with zero mock data leakage", async () => {
      // 1. Issues service empty
      const alphaIssues = await issueService.getAll({ tenant: tenantAlpha });
      expect(alphaIssues).toEqual([]);

      // 2. Problem service empty
      const alphaProblems = await problemService.getAll(tenantAlpha);
      expect(alphaProblems).toEqual([]);

      // 3. Trend anomaly service empty
      const alphaTrends = await trendAnomalyService.getTrendSeries(tenantAlpha);
      expect(alphaTrends).toEqual([]);
      const alphaAnomalies = await trendAnomalyService.getAnomalies(tenantAlpha);
      expect(alphaAnomalies).toEqual([]);

      // 4. Policy engine returns empty rules for unconfigured tenant
      const alphaPolicy = await policyEngine.getPolicy(tenantAlpha);
      expect(alphaPolicy.rules).toEqual([]);

      // 5. Overview API route returns strict zero state
      const req = new NextRequest("https://alpha.support.servicev8.com/api/overview", {
        headers: {
          authorization: "Bearer sv8_tk_alpha",
          "x-servicev8-tenant-domain": "alpha",
        },
      });
      const res = await getOverview(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      const overviewData = json.data;
      expect(overviewData.issueVolume).toBe(0);
      expect(overviewData.activeProblems).toBe(0);
      expect(overviewData.businessExposure).toBe(0);
      expect(overviewData.needsAttention).toEqual([]);
      expect(overviewData.recentActivity).toEqual([]);
      expect(overviewData.aiDiscovered).toEqual([]);
      expect(overviewData.aiWorkforce).toEqual([]);
    });
  });

  describe("2. Durable Issue Projections from Ingress", () => {
    let issueAlpha1Id: string;
    let issueAlpha2Id: string;
    let issueAlpha3Id: string;

    it("persists and projects durable issues with classification, sentiment, and audit history", async () => {
      // Ingest Issue 1 (Enterprise Billing/Checkout outage)
      const issue1 = await issueService.createFromInteraction("tenant_alpha", {
        source: "zendesk",
        sourceReference: "ticket-alpha-101",
        customerReference: "cust-enterprise-alpha",
        text: "CRITICAL: Stripe checkout API failing with HTTP 504 gateway timeout for all checkout orders!",
        raw: {
          customerName: "Alpha Enterprise Lead",
          customerTier: "enterprise",
          product: "Payment Gateway",
          version: "v4.2.0",
        },
      });

      expect(issue1).toBeDefined();
      expect(issue1.id).toMatch(/^iss_[a-f0-9]{32}$/);
      expect(issue1.tenantId).toBe("tenant_alpha");
      expect(issue1.source).toBe("zendesk");
      expect(issue1.externalId).toBe("ticket-alpha-101");
      expect(issue1.customerName).toBe("Alpha Enterprise Lead");
      expect(issue1.customerTier).toBe("enterprise");
      expect(issue1.category).toBe("checkout_failure");
      expect(["urgent", "frustrated"]).toContain(issue1.sentiment);
      expect(issue1.priority).toBe("urgent");
      expect(issue1.confidence).toBeGreaterThanOrEqual(0.8);
      expect(["high", "critical"]).toContain(issue1.businessImpact);
      expect((issue1.timeline || []).length).toBeGreaterThanOrEqual(1);

      issueAlpha1Id = issue1.id;

      // Ingest Issue 2 (Enterprise Checkout Timeout)
      const issue2 = await issueService.createFromInteraction("tenant_alpha", {
        source: "zendesk",
        sourceReference: "ticket-alpha-102",
        customerReference: "cust-enterprise-beta",
        text: "Payment processing failed on subscription renewals due to timeout error.",
        raw: {
          customerName: "Beta Corp VP",
          customerTier: "enterprise",
          product: "Payment Gateway",
        },
      });

      expect(issue2.id).toMatch(/^iss_[a-f0-9]{32}$/);
      expect(issue2.tenantId).toBe("tenant_alpha");
      expect(issue2.category).toBe("checkout_failure");
      issueAlpha2Id = issue2.id;

      // Ingest Issue 3 (Standard Auth Issue)
      const issue3 = await issueService.createFromInteraction("tenant_alpha", {
        source: "zendesk",
        sourceReference: "ticket-alpha-103",
        customerReference: "cust-standard-user",
        text: "Cannot log in, MFA SMS verification code is not being delivered to my phone.",
        raw: {
          customerName: "Jane Smith",
          customerTier: "standard",
          product: "Auth Portal",
        },
      });

      expect(issue3.id).toMatch(/^iss_[a-f0-9]{32}$/);
      expect(issue3.tenantId).toBe("tenant_alpha");
      expect(issue3.category).toBe("mfa_sms");
      expect(issue3.customerTier).toBe("standard");
      issueAlpha3Id = issue3.id;

      // Verify all 3 issues exist in tenant_alpha
      const allAlpha = await issueService.getAll({ tenant: tenantAlpha });
      expect(allAlpha.length).toBe(3);
      expect(allAlpha.map((i) => i.id)).toEqual(
        expect.arrayContaining([issueAlpha1Id, issueAlpha2Id, issueAlpha3Id])
      );

      // Verify individual lookup by id
      const retrieved = await issueService.getById(issueAlpha1Id, tenantAlpha);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(issueAlpha1Id);
      expect(retrieved?.summary).toContain("CRITICAL: Stripe checkout");
    });

    it("enforces idempotency when updating an existing interaction", async () => {
      // Ingest same ticket-alpha-101 again with updated message
      const updated = await issueService.createFromInteraction("tenant_alpha", {
        source: "zendesk",
        sourceReference: "ticket-alpha-101",
        customerReference: "cust-enterprise-alpha",
        text: "CRITICAL: Stripe checkout API still down, 15 more enterprise transactions failed.",
        raw: {
          customerName: "Alpha Enterprise Lead",
          customerTier: "enterprise",
        },
      });

      expect(updated.id).toBe(issueAlpha1Id);
      expect((updated.messages || []).length).toBeGreaterThanOrEqual(2);

      const allAlpha = await issueService.getAll({ tenant: tenantAlpha });
      expect(allAlpha.length).toBe(3); // Count remains 3, not duplicated
    });

    it("supports updating issue status and timeline in database", async () => {
      const updatedIssue = await issueService.updateIssue(
        issueAlpha3Id,
        {
          status: "pending",
          recommendedAction: "Escalate to telecom carrier for SMS delivery",
        },
        tenantAlpha
      );

      expect(updatedIssue).toBeDefined();
      expect(updatedIssue?.sourceStatus).toBe("pending");
      expect(updatedIssue?.recommendedAction).toBe("Escalate to telecom carrier for SMS delivery");

      const reRead = await issueService.getById(issueAlpha3Id, tenantAlpha);
      expect(reRead?.sourceStatus).toBe("pending");
    });
  });

  describe("3. Problem Correlation & Exposure Calculations", () => {
    let createdProblemId: string;

    it("correlates issues into a durable problem and updates affected metrics", async () => {
      const alphaIssues = await issueService.getAll({ tenant: tenantAlpha });
      const billingIssues = alphaIssues.filter((i) => i.category === "checkout_failure");
      expect(billingIssues.length).toBe(2);

      const problem = await problemService.correlateIssues(
        tenantAlpha,
        billingIssues.map((i) => i.id),
        "Payment Gateway 504 Timeout Outage",
        "Stripe EU Gateway timeout spike during peak renewal window"
      );

      expect(problem).toBeDefined();
      expect(problem.id).toMatch(/^PRB-[A-Z0-9]+$/);
      expect(problem.tenantId).toBe("tenant_alpha");
      expect(problem.title).toBe("Payment Gateway 504 Timeout Outage");
      expect(problem.status).toBe("active");
      expect(problem.affectedCustomerCount).toBe(2);
      expect(problem.affectedEnterpriseCount).toBe(2);
      expect(problem.estimatedRevenueExposure).toBeGreaterThan(0);
      expect(problem.linkedIssueIds.length).toBe(2);

      createdProblemId = problem.id;

      // Verify linked issues in database have problem_id updated
      for (const issue of billingIssues) {
        const check = await issueService.getById(issue.id, tenantAlpha);
        expect(check?.problemId).toBe(createdProblemId);
      }
    });

    it("unlinks an issue from problem and recalculates problem metrics", async () => {
      const alphaIssues = await issueService.getAll({ tenant: tenantAlpha });
      const billingIssues = alphaIssues.filter((i) => i.category === "checkout_failure");
      const unlinkedIssue = billingIssues[0];

      const updatedProblem = await problemService.unlinkIssue(
        tenantAlpha,
        createdProblemId,
        unlinkedIssue.id
      );

      expect(updatedProblem).toBeDefined();
      expect(updatedProblem?.linkedIssueIds).not.toContain(unlinkedIssue.id);
      expect(updatedProblem?.affectedCustomerCount).toBe(1);

      // Verify issue in DB has problem_id cleared
      const checkIssue = await issueService.getById(unlinkedIssue.id, tenantAlpha);
      expect(checkIssue?.problemId).toBeUndefined();

      // Relink it back
      const relinkedProblem = await problemService.linkIssue(
        tenantAlpha,
        createdProblemId,
        unlinkedIssue.id
      );
      expect(relinkedProblem?.linkedIssueIds).toContain(unlinkedIssue.id);
      expect(relinkedProblem?.affectedCustomerCount).toBe(2);
    });
  });

  describe("4. Strict Row-Level Security (RLS) Isolation Across Tenants", () => {
    it("ensures Tenant Beta cannot read or modify Tenant Alpha's issues or problems", async () => {
      // 1. Beta gets 0 issues
      const betaIssues = await issueService.getAll({ tenant: tenantBeta });
      expect(betaIssues.length).toBe(0);

      // 2. Beta gets 0 problems
      const betaProblems = await problemService.getAll(tenantBeta);
      expect(betaProblems.length).toBe(0);

      // 3. Attempting to look up Alpha's issue from Beta returns null
      const allAlpha = await issueService.getAll({ tenant: tenantAlpha });
      const alphaIssueId = allAlpha[0].id;

      const crossTenantLookup = await issueService.getById(alphaIssueId, tenantBeta);
      expect(crossTenantLookup).toBeNull();

      // 4. Attempting to update Alpha's issue from Beta returns null
      const crossTenantUpdate = await issueService.updateIssue(
        alphaIssueId,
        { status: "closed" },
        tenantBeta
      );
      expect(crossTenantUpdate).toBeNull();

      // 5. Direct SQL query under Beta's tenant session returns 0 rows due to RLS
      await client.withTenantSession(tenantBeta, async (session) => {
        const issues = await session.query(`SELECT * FROM supportv8.issues`);
        expect(issues.length).toBe(0);

        const problems = await session.query(`SELECT * FROM supportv8.problems`);
        expect(problems.length).toBe(0);
      });
    });

    it("allows Tenant Beta to ingest its own isolated dataset without cross-pollution", async () => {
      const betaIssue = await issueService.createFromInteraction(tenantBeta, {
        source: "zendesk",
        sourceReference: "ticket-beta-001",
        customerReference: "cust-beta-999",
        text: "Warehouse label printer disconnected on packing line 4.",
        raw: {
          customerName: "Logistics Manager",
          customerTier: "standard",
        },
      });

      expect(betaIssue.tenantId).toBe(tenantBeta);

      // Beta has 1 issue
      const betaIssues = await issueService.getAll({ tenant: tenantBeta });
      expect(betaIssues.length).toBe(1);
      expect(betaIssues[0].id).toBe(betaIssue.id);

      // Alpha still has exactly 3 issues and cannot see Beta's issue
      const alphaIssues = await issueService.getAll({ tenant: tenantAlpha });
      expect(alphaIssues.length).toBe(3);
      expect(alphaIssues.some((i) => i.id === betaIssue.id)).toBe(false);
    });
  });

  describe("5. Overview Metrics Calculation from Durable Data", () => {
    it("computes accurate aggregate overview metrics for Alpha", async () => {
      const req = new NextRequest("https://alpha.support.servicev8.com/api/overview", {
        headers: {
          authorization: "Bearer sv8_tk_alpha",
          "x-servicev8-tenant-domain": "alpha",
        },
      });

      const res = await getOverview(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      const overview = json.data;
      expect(overview.issueVolume).toBe(3);
      expect(overview.activeProblems).toBe(1);
      expect(overview.businessExposure).toBeGreaterThan(0);
      expect(overview.recentActivity.length).toBeGreaterThanOrEqual(1);
      expect(overview.needsAttention.length).toBeGreaterThanOrEqual(1);
      expect(["critical", "warning"]).toContain(overview.needsAttention[0].severity);
    });

    it("computes isolated overview metrics for Beta without leaking Alpha's exposure", async () => {
      const req = new NextRequest("https://beta.support.servicev8.com/api/overview", {
        headers: {
          authorization: "Bearer sv8_tk_beta",
          "x-servicev8-tenant-domain": "beta",
        },
      });

      const res = await getOverview(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      const overview = json.data;
      expect(overview.issueVolume).toBe(1);
      expect(overview.activeProblems).toBe(0);
      expect(overview.businessExposure).toBe(0);
    });
  });

  describe("6. API Routes Live Integration", () => {
    it("GET /api/issues returns Alpha issues with filter support", async () => {
      const req = new NextRequest("https://alpha.support.servicev8.com/api/issues?category=checkout_failure", {
        headers: {
          authorization: "Bearer sv8_tk_alpha",
          "x-servicev8-tenant-domain": "alpha",
        },
      });

      const res = await getIssues(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      const issues = json.data;
      expect(issues.length).toBe(2);
      issues.forEach((i: any) => {
        expect(i.category).toBe("checkout_failure");
      });
    });

    it("GET /api/problems returns Alpha correlated problems", async () => {
      const req = new NextRequest("https://alpha.support.servicev8.com/api/problems", {
        headers: {
          authorization: "Bearer sv8_tk_alpha",
          "x-servicev8-tenant-domain": "alpha",
        },
      });

      const res = await getProblems(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      const problems = json.data;
      expect(problems.length).toBe(1);
      expect(problems[0].title).toBe("Payment Gateway 504 Timeout Outage");
    });
  });

  describe("7. Zero Mock Fallback Guarantees", () => {
    it("strictly returns null / empty when entities do not exist in DB", async () => {
      const nonExistentIssue = await issueService.getById("iss_nonexistent_xyz", tenantAlpha);
      expect(nonExistentIssue).toBeNull();

      const nonExistentProblem = await problemService.getById("prb_nonexistent_xyz", tenantAlpha);
      expect(nonExistentProblem).toBeNull();

      const demoProblems = await problemService.seedDemoProblems(tenantAlpha);
      expect(demoProblems).toEqual([]);
    });
  });
});

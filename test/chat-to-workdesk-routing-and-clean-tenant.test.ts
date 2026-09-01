import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../src/lib/db/mock-data";
import { ChatWorkflowService } from "../src/lib/services/chat-workflow-service";
import { issueService } from "../src/lib/services/issue-service";
import { queueLoadBalancer } from "../src/lib/services/queue-load-balancer-service";
import { slaEngine } from "../src/lib/services/sla-engine-service";
import { customerHealth } from "../src/lib/services/customer-health-service";
import { qaSynthesizer } from "../src/lib/services/qa-scorecard-service";
import { vocDigest } from "../src/lib/services/voc-digest-service";
import { staleWorkSweeper } from "../src/lib/services/stale-work-sweeper";
import { trendAnomalyService } from "../src/lib/services/trend-anomaly-service";

describe("SupportV8 Clean Tenant Isolation & Live Chat-to-Workdesk Routing", () => {
  const testTenant = "qa-lexi-planthouse";

  beforeEach(() => {
    db.setTenant(testTenant, {
      name: "Lexi's Planthouse",
      adminName: "Alexis Akpabio",
      mode: "copilot",
    });
  });

  it("1. should strictly return a clean workspace (0 demo tickets) for new tenant", () => {
    const tenantData = db.getTenantData(testTenant);
    expect(tenantData.tenant.name).toBe("Lexi's Planthouse");
    expect(tenantData.issues.length).toBe(0);
    expect(tenantData.problems.length).toBe(0);
    expect(tenantData.sources.length).toBe(0);

    const overview = db.getOverviewMetrics(testTenant);
    expect(overview.issueVolume).toBe(0);
    expect(overview.activeProblems).toBe(0);
    expect(overview.businessExposure).toBe(0);
    expect(overview.needsAttention.length).toBe(0);
  });

  it("2. should return clean zero-state metrics across CX and monitoring services for new tenant", () => {
    const queue = queueLoadBalancer.getQueueMetrics(testTenant);
    expect(queue.totalActiveConversations).toBe(0);
    expect(queue.overallCapacityPercentage).toBe(0);

    const sla = slaEngine.getSlaOverview(testTenant);
    expect(sla.totalTracked).toBe(0);
    expect(sla.healthyCount).toBe(0);
    expect(sla.atRiskCount).toBe(0);
    expect(sla.breachedCount).toBe(0);
    expect(sla.tickets.length).toBe(0);

    const health = customerHealth.getHealthRadar(testTenant);
    expect(health.totalArrAtRisk).toBe(0);
    expect(health.accounts.length).toBe(0);

    const qa = qaSynthesizer.getQaMetrics(testTenant);
    expect(qa.scorecards.length).toBe(0);

    const voc = vocDigest.getVocOverview(testTenant);
    expect(voc.clusters.length).toBe(0);

    const stale = staleWorkSweeper.getCandidates(testTenant);
    expect(stale.length).toBe(0);

    const trends = trendAnomalyService.getTrendSeries(testTenant);
    expect(trends.length).toBe(0);
  });

  it("3. should route inbound chat intake directly to the Work Desk issue queue in real-time", () => {
    // Customer submits chat intake on Lexi's Planthouse
    const session = ChatWorkflowService.startSession({
      tenantDomain: testTenant,
      stream: "customers",
      customerName: "Eleanor Vance",
      customerEmail: "eleanor@rareplants.com",
      intakeData: {
        issueType: "Order & Plant Shipping Inquiry",
        urgency: "High Impact (P2)",
        details: "My Monstera Albo arrived with wilted leaves, need replacement or care guide immediately.",
      },
    });

    expect(session).toBeDefined();
    expect(session.tenantDomain).toBe(testTenant);
    expect(session.messages.length).toBeGreaterThanOrEqual(2);

    // Verify issue now exists in the tenant's Work Desk issues list
    const tenantIssues = issueService.getAll({ tenant: testTenant });
    expect(tenantIssues.length).toBe(1);

    const createdIssue = tenantIssues[0];
    expect(createdIssue.customerName).toBe("Eleanor Vance");
    expect(createdIssue.summary).toContain("Monstera Albo");
    expect(createdIssue.status).toBe("open");
    expect(createdIssue.source).toBe("chat");
    expect(createdIssue.externalId).toMatch(/^SV8-CHAT-\d+/);
  });

  it("4. should dynamically transfer chat ticket to workspace supervisor when human is requested", () => {
    const session = ChatWorkflowService.startSession({
      tenantDomain: testTenant,
      stream: "customers",
      customerName: "George Miller",
      customerEmail: "george@urbanplants.com",
      intakeData: {
        issueType: "Wholesale Invoice Discrepancy",
        urgency: "Normal",
        details: "Invoice INV-9041 has an incorrect VAT charge.",
      },
    });

    // Customer requests human supervisor
    const sendResult = ChatWorkflowService.sendMessage({
      sessionId: session.id,
      sender: "customer",
      senderName: "George Miller",
      content: "I would like to speak directly with a human supervisor please.",
    });

    expect(sendResult.session.status).toBe("escalated");
    expect(sendResult.session.assignedType).toBe("human");
    expect(sendResult.session.assignedName).toContain("Alexis Akpabio");

    // Verify issue in Work Desk is updated to urgent with supervisor assignment
    const tenantIssues = issueService.getAll({ tenant: testTenant });
    const escalatedIssue = tenantIssues.find((i) => i.customerName === "George Miller");
    expect(escalatedIssue).toBeDefined();
    expect(escalatedIssue?.priority).toBe("urgent");
    expect(escalatedIssue?.assignedTo).toContain("Alexis Akpabio");
  });
});

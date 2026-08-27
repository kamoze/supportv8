import { describe, it, expect } from "vitest";
import { slaEngine } from "@/lib/services/sla-engine-service";
import { customerHealth } from "@/lib/services/customer-health-service";
import { qaSynthesizer } from "@/lib/services/qa-scorecard-service";
import { vocDigest } from "@/lib/services/voc-digest-service";
import { queueLoadBalancer } from "@/lib/services/queue-load-balancer-service";

describe("CX Manager Cockpit — 6-Pillar Enterprise Operations Suite", () => {
  describe("1. ⏱️ SLA Engine & Real-Time Breach Predictor", () => {
    it("tracks SLA attainment rate and flags at-risk tickets before breach", () => {
      const overview = slaEngine.getSlaOverview();
      expect(overview.attainmentRate).toBeGreaterThanOrEqual(70);
      expect(overview.totalTracked).toBeGreaterThanOrEqual(1);

      const atRiskTicket = overview.tickets.find((t) => t.riskLevel === "at_risk");
      expect(atRiskTicket).toBeDefined();
      expect(atRiskTicket?.remainingMinutes).toBeLessThanOrEqual(15);
    });

    it("escalates at-risk tickets with priority override and updates risk status", () => {
      const result = slaEngine.escalateAtRiskTicket("t_sla_001");
      expect(result.success).toBe(true);
      expect(result.ticket.assignedAgent).toContain("Escalations Lead");
      expect(result.ticket.riskLevel).toBe("healthy");
    });
  });

  describe("2. 🛡️ 360° Customer Health Score & Churn Risk Radar", () => {
    it("computes portfolio health score and tracks total ARR exposure at risk", () => {
      const healthRadar = customerHealth.getHealthRadar();
      expect(healthRadar.avgHealthScore).toBeGreaterThanOrEqual(0);
      expect(healthRadar.totalArrAtRisk).toBeGreaterThan(0);
      expect(healthRadar.accounts.length).toBeGreaterThanOrEqual(1);

      const criticalAccount = healthRadar.accounts.find((a) => a.riskLevel === "critical_at_risk");
      expect(criticalAccount).toBeDefined();
      expect(criticalAccount?.churnProbability).toBeGreaterThan(0.5);
      expect(criticalAccount?.lifetimeTicketVolume).toBeGreaterThan(0);
    });

    it("detects real-time VIP Churn Risk Alerts for enterprise accounts with >= 2 frustrated interactions in 48h", () => {
      const healthRadar = customerHealth.getHealthRadar();
      expect(healthRadar.activeVipChurnAlerts.length).toBeGreaterThanOrEqual(1);

      const alert = healthRadar.activeVipChurnAlerts[0];
      expect(alert.tier).toBe("enterprise");
      expect(alert.frustratedInteractions48h).toBeGreaterThanOrEqual(2);
      expect(alert.arrExposure).toBeGreaterThan(0);
    });

    it("triggers VIP CSM outreach with HMAC-signed handoff token and incident timeline payload", () => {
      const outreach = customerHealth.triggerVipOutreach("acc_acme_01");
      expect(outreach.success).toBe(true);
      expect(outreach.handoffPayload.accountName).toBe("Acme Cloud Infrastructure");
      expect(outreach.handoffPayload.csm).toBeDefined();
      expect(outreach.handoffToken).toContain(".");
    });
  });

  describe("3. 🎯 Automated QA & AI Compliance Scorecards", () => {
    it("grades conversations across 4 dimensions and monitors AI hallucination/drift", () => {
      const qa = qaSynthesizer.getQaMetrics();
      expect(qa.overallQaAverage).toBeGreaterThan(80);
      expect(qa.aiEmployeeAverage).toBeGreaterThan(80);
      expect(qa.humanAgentAverage).toBeGreaterThan(80);
      expect(qa.hallucinationRate).toBeDefined();
      expect(qa.fcrAverage).toBeGreaterThan(70);

      const sample = qa.scorecards[0];
      expect(sample.technicalAccuracyScore).toBeDefined();
      expect(sample.toneEmpathyScore).toBeDefined();
      expect(sample.policyComplianceScore).toBeDefined();
      expect(sample.resolutionCompletenessScore).toBeDefined();
    });

    it("audits live conversations and appends new scorecard", () => {
      const initialCount = qaSynthesizer.getQaMetrics().scorecards.length;
      const audited = qaSynthesizer.auditConversation("conv_test_99", "Perfect compliance");
      expect(audited.overallScore).toBe(98);
      expect(qaSynthesizer.getQaMetrics().scorecards.length).toBe(initialCount + 1);
    });
  });

  describe("4. 📊 VoC Driver Analytics & CES Breakdown", () => {
    it("clusters customer sentiment drivers into discontent and delight factors", () => {
      const voc = vocDigest.getVocOverview();
      expect(voc.overallCsat).toBe(91.4);
      expect(voc.customerEffortScore).toBe(4.6);
      expect(voc.netPromoterScore).toBe(54);
      expect(voc.topDiscontentDriver).toBeDefined();
      expect(voc.topDelightDriver).toBeDefined();
      expect(voc.clusters.length).toBeGreaterThanOrEqual(2);
      expect(voc.csatDistribution.length).toBe(5);
      expect(voc.topDelightArticles.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("5. 🔄 Omnichannel Live Queue Load Balancer & Skill Routing", () => {
    it("monitors real-time channel concurrency loads and active routing rules", () => {
      const metrics = queueLoadBalancer.getQueueMetrics();
      expect(metrics.channels.length).toBe(4);

      const email = metrics.channels.find((c) => c.channel === "email");
      expect(email?.loadPercentage).toBe(38);

      const liveChat = metrics.channels.find((c) => c.channel === "live_chat");
      expect(liveChat?.loadPercentage).toBe(72);

      expect(metrics.rules.length).toBeGreaterThanOrEqual(3);
    });

    it("rebalances overloaded live chat traffic across autonomous AI employees", () => {
      const rebalance = queueLoadBalancer.rebalanceQueues();
      expect(rebalance.success).toBe(true);
      expect(rebalance.metrics.channels.find((c) => c.channel === "live_chat")?.loadPercentage).toBe(54);
    });
  });

  describe("6. 🌅 AI Shift Handoff & Morning Standup Digest", () => {
    it("generates comprehensive shift handoff briefing with executive summary, overnight pain points, and focus areas", () => {
      const digest = vocDigest.generateShiftDigest();
      expect(digest.shiftName).toBe("Morning Standup & CX Operations Briefing");
      expect(digest.executiveSummary).toContain("supportV8 autonomous operations");
      expect(digest.keyMetrics.varrRate).toBeDefined();
      expect(digest.topOvernightPainPoints.length).toBe(3);
      expect(digest.recommendedFocusAreas.length).toBeGreaterThanOrEqual(1);
    });
  });
});

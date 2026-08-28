import { describe, it, expect } from "vitest";
import { WorkforceGovernance } from "../src/lib/workforce-spine/governance";
import { WorkforceSpine } from "../src/lib/workforce-spine/orchestrator";
import { WarmVoiceTransferEngine } from "../src/lib/workforce-spine/voice-transfer";

describe("ServiceV8 Workforce Spine — 4-Pillar LLM Action Orchestration", () => {
  // Pillar 1: Identity & Governance
  describe("Pillar 1: Identity & Governance", () => {
    it("should load employee identities with quotas, supervisors, and acoustic profiles", () => {
      const sophia = WorkforceGovernance.getEmployee("employee_sophia");
      expect(sophia.name).toContain("Sophia");
      expect(sophia.supervisorEmail).toBe("inigodwin@redoo.solutions");
      expect(sophia.maxAutonomousRefundUsd).toBe(500.0);
      expect(sophia.voiceGender).toBe("female");
      expect(sophia.acousticPitchShift).toBe(1.15);

      const alex = WorkforceGovernance.getEmployee("employee_alex");
      expect(alex.name).toContain("Alex");
      expect(alex.voiceGender).toBe("male");
      expect(alex.acousticPitchShift).toBe(0.85);
    });

    it("should evaluate autonomy thresholds and enforce financial ceiling holds", () => {
      // 1. Within $500 autonomous limit -> auto_allowed
      const checkUnder = WorkforceGovernance.evaluateAutonomy("employee_sophia", "orderv8.refund", {
        amountUsd: 150.0,
      });
      expect(checkUnder.tier).toBe("auto_allowed");

      // 2. Exceeds $500 limit -> requires_supervisor_approval
      const checkOver = WorkforceGovernance.evaluateAutonomy("employee_sophia", "orderv8.refund", {
        amountUsd: 1200.0,
      });
      expect(checkOver.tier).toBe("requires_supervisor_approval");
      expect(checkOver.reason).toContain("Ini Godwin");

      // 3. Lockbox PIN -> auto_allowed
      const checkPin = WorkforceGovernance.evaluateAutonomy("employee_alex", "contractor.site_pin", {
        siteId: "SITE-01",
      });
      expect(checkPin.tier).toBe("auto_allowed");

      // 4. Destructive operation -> requires_supervisor_approval
      const checkDelete = WorkforceGovernance.evaluateAutonomy("employee_sophia", "account.terminate", {});
      expect(checkDelete.tier).toBe("requires_supervisor_approval");
    });

    it("should meter tokens and decrement employee balance", () => {
      const meter1 = WorkforceGovernance.meterTokens("employee_sophia", 500);
      expect(meter1.allowed).toBe(true);
      expect(meter1.remainingBudget).toBeGreaterThan(0);
    });
  });

  // Pillar 2 & 4: Orchestration & Knowledge Bi-Directional Sync
  describe("Pillar 2 & 4: Orchestration Engine & Bi-Directional Knowledge Sync", () => {
    it("should orchestrate an autonomous refund action through the Workforce Spine", async () => {
      const res = await WorkforceSpine.orchestrateAction({
        actionId: "act_test_refund_1",
        tenantId: "tenant_acme",
        employeeId: "employee_sophia",
        stream: "customers",
        operation: "orderv8.refund",
        payload: { amountUsd: 150.0, customerEmail: "customer@acme.com" },
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("executed_autonomously");
      expect(res.autonomyTier).toBe("auto_allowed");
      expect(res.workflowId).toBeDefined();
      expect(res.tokensDeducted).toBeGreaterThan(0);
      expect(res.knowledgeV8SummaryLogged).toBe(true);
    });

    it("should hold actions exceeding autonomy thresholds for human supervisor approval", async () => {
      const res = await WorkforceSpine.orchestrateAction({
        actionId: "act_test_high_refund",
        tenantId: "tenant_acme",
        employeeId: "employee_sophia",
        stream: "customers",
        operation: "orderv8.refund",
        payload: { amountUsd: 2500.0, customerEmail: "vip@acme.com" },
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("held_for_human_approval");
      expect(res.autonomyTier).toBe("requires_supervisor_approval");
      expect(res.output.status).toBe("pending_human_approval");
    });
  });

  // Pillar 3: Omnichannel Ingress & Warm Voice Transfer
  describe("Pillar 3: Omnichannel Ingress & Warm Voice Transfer", () => {
    it("should generate warm voice transfer packets with whisper metadata and SIP headers", () => {
      const packet = WarmVoiceTransferEngine.buildTransferPacket({
        callSid: "CA_test_call_12345",
        callerNumber: "+18005550199",
        customerName: "Elena Rostova",
        employeeId: "employee_sophia",
        sentimentScore: 0.38,
        issueSummary: "Disputed recurring invoice charges",
        suggestedAction: "Issue $150 credit voucher and explain plan renewal date",
      });

      expect(packet.callSid).toBe("CA_test_call_12345");
      expect(packet.summaryWhisper).toContain("Elena Rostova");
      expect(packet.summaryWhisper).toContain("38%");
      expect(packet.sipHeaders["X-ServiceV8-CallSid"]).toBe("CA_test_call_12345");
      expect(packet.sipHeaders["X-ServiceV8-Supervisor"]).toBe("inigodwin@redoo.solutions");
      expect(packet.sipHeaders["X-ServiceV8-PitchShift"]).toBe("1.15");
    });
  });
});

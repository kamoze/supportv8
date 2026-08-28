import { describe, it, expect } from "vitest";
import { AgentPlatform } from "../src/lib/chatbot/platform/agent-platform";
import { InteractiveRunner } from "../src/lib/chatbot/platform/interactive-runner";
import { AutonomousRunner } from "../src/lib/chatbot/platform/autonomous-runner";

describe("Dual-Modal Agent Platform: Interactive vs Autonomous Architecture", () => {
  // 1. Taxonomy & Registry Tests
  describe("Taxonomy & Platform Registry", () => {
    it("should register all 3 Interactive Agent roles: Chatbot, Copilot, Assistant", () => {
      const interactive = AgentPlatform.listByClass("interactive");
      expect(interactive.length).toBe(3);

      const roles = interactive.map((a) => a.role);
      expect(roles).toContain("chatbot");
      expect(roles).toContain("copilot");
      expect(roles).toContain("assistant");
    });

    it("should register all 3 Autonomous Agent roles: AI Employee, AI Intern, Background Agent", () => {
      const autonomous = AgentPlatform.listByClass("autonomous");
      expect(autonomous.length).toBeGreaterThanOrEqual(3);

      const roles = autonomous.map((a) => a.role);
      expect(roles).toContain("ai_employee");
      expect(roles).toContain("ai_intern");
      expect(roles).toContain("background_agent");
    });

    it("should map agents to correct execution engines and tools", () => {
      const chatbot = AgentPlatform.getAgent("agent_chatbot_omni");
      expect(chatbot?.executionEngine).toBe("realtime_sse");
      expect(chatbot?.tools).toContain("order_refund");

      const employee = AgentPlatform.getAgent("agent_employee_alex");
      expect(employee?.executionEngine).toBe("temporal_workflow");
      expect(employee?.tools).toContain("site_access_pin");

      const sweeper = AgentPlatform.getAgent("agent_bg_sweeper");
      expect(sweeper?.executionEngine).toBe("scheduled_cron");
      expect(sweeper?.tools).toContain("stale_work_sweep");
    });
  });

  // 2. Interactive Agent Runner Tests
  describe("Interactive Agents Execution (Chatbot, Copilot, Assistant)", () => {
    it("should execute Copilot assistance with sentiment cues and recommended tool actions", async () => {
      const copilot = await InteractiveRunner.runCopilot({
        sessionId: "sess_copilot_1",
        stream: "customers",
        customerName: "Elena Rostova",
        latestCustomerMessage: "I was charged twice and want an immediate refund credit!",
      });

      expect(copilot.suggestedDraft).toBeDefined();
      expect(copilot.suggestedDraft).toContain("credit voucher");
      expect(copilot.sentimentAssessment.churnRisk).toBe("medium");
      expect(copilot.recommendedActions.length).toBeGreaterThan(0);
      expect(copilot.recommendedActions[0].toolName).toBe("order_refund");
    });

    it("should execute Assistant self-service portal search with quick links", async () => {
      const assistant = await InteractiveRunner.runAssistant({
        query: "How do I download monthly invoices?",
      });

      expect(assistant.assistantReply).toContain("self-service");
      expect(assistant.quickLinks.length).toBeGreaterThan(0);
      expect(assistant.quickLinks[0].href).toBe("/billing/invoices");
    });
  });

  // 3. Autonomous Agent Runner Tests
  describe("Autonomous Agents Execution (AI Employee, AI Intern, Background Agent)", () => {
    it("should dispatch AI Employee objective through Temporal workflow spine", async () => {
      const res = await AutonomousRunner.runAiEmployee({
        agentId: "agent_employee_sophia",
        tenantId: "tenant_acme",
        stream: "customers",
        objective: "Enforce VIP SLA compliance and audit overdue invoices",
      });

      expect(res.success).toBe(true);
      expect(res.workflowId).toBeDefined();
      expect(res.triageStatus).toBe("autonomous_resolved");
    });

    it("should execute AI Intern ticket auto-tagging and draft generation", async () => {
      const intern = await AutonomousRunner.runAiIntern({
        tenantId: "tenant_acme",
        ticketId: "TICK-902",
        ticketTitle: "SAML 2.0 Okta SSO Integration Failure",
        ticketBody: "Users are seeing identity certificate expired error upon Okta redirect.",
      });

      expect(intern.suggestedTags).toContain("auth_sso");
      expect(intern.suggestedTags).toContain("security_tier2");
      expect(intern.requiresHumanSignoff).toBe(true);
      expect(intern.proposedDraft).toContain("TICK-902");
    });

    it("should trigger Background Agent sweeps backed by Temporal", async () => {
      const sweep = await AutonomousRunner.runBackgroundAgent({
        sweepType: "stale_work",
        tenantId: "tenant_acme",
      });

      expect(sweep.success).toBe(true);
      expect(sweep.workflowId).toBeDefined();
    });
  });
});

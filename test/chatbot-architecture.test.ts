import { describe, it, expect } from "vitest";
import { ChannelAdapters } from "../src/lib/chatbot/experience/channel-adapters";
import { EdgeGateway } from "../src/lib/chatbot/api-edge/edge-gateway";
import { PromptManager } from "../src/lib/chatbot/agent-runtime/prompt-manager";
import { ContextBuilder } from "../src/lib/chatbot/agent-runtime/context-builder";
import { LlmRouter } from "../src/lib/chatbot/agent-runtime/llm-router";
import { ToolPlanner } from "../src/lib/chatbot/agent-runtime/tool-planner";
import { Guardrails } from "../src/lib/chatbot/agent-runtime/guardrails";
import { AgentRuntimeCore } from "../src/lib/chatbot/agent-runtime/agent-runtime-core";
import { ChatbotTelemetry } from "../src/lib/chatbot/observability/telemetry";

describe("Expected Chatbot Architecture — 6-Layer Full Stack", () => {
  // 1. Experience Layer
  describe("Layer 1: Experience Layer", () => {
    it("should normalize Web Chat and Mobile payloads", () => {
      const web = ChannelAdapters.normalizeWebChat({
        sessionId: "sess_web_1",
        stream: "customers",
        customerName: "Elena",
        customerEmail: "elena@acme.com",
        content: "Need help with invoice",
      });
      expect(web.channel).toBe("web_chat");
      expect(web.stream).toBe("customers");

      const mobile = ChannelAdapters.normalizeWebChat({
        sessionId: "sess_mob_1",
        stream: "contractors",
        customerName: "David",
        content: "Lockbox access",
        isMobile: true,
      });
      expect(mobile.channel).toBe("mobile");
    });

    it("should normalize WhatsApp Business webhook payloads", () => {
      const waPayload = {
        object: "whatsapp_business_account",
        entry: [
          {
            id: "wa_biz_1",
            changes: [
              {
                value: {
                  messaging_product: "whatsapp",
                  metadata: { display_phone_number: "+18005550199", phone_number_id: "phone_123" },
                  contacts: [{ profile: { name: "Marcus Vance" }, wa_id: "14155552671" }],
                  messages: [{ id: "wam_99", from: "14155552671", text: { body: "Need status on order refund" }, type: "text" }],
                },
              },
            ],
          },
        ],
      };

      const normalized = ChannelAdapters.normalizeWhatsApp(waPayload);
      expect(normalized).toBeDefined();
      expect(normalized?.channel).toBe("whatsapp");
      expect(normalized?.senderPhone).toBe("14155552671");
      expect(normalized?.content).toBe("Need status on order refund");
    });

    it("should normalize Email incoming payloads and format channel-specific outbound", () => {
      const email = ChannelAdapters.normalizeEmail({
        from: "Marcus <marcus@meridian.com>",
        to: "sales@servicev8.com",
        subject: "Enterprise Pricing Inquiry",
        textBody: "Please send pricing for 50 seats.",
      });

      expect(email.channel).toBe("email");
      expect(email.senderEmail).toBe("marcus@meridian.com");
      expect(email.stream).toBe("enquiries");

      const voiceOut = ChannelAdapters.formatOutbound("voice", "# Hello! **Your code** is `8891`.");
      expect(voiceOut).not.toContain("#");
      expect(voiceOut).not.toContain("**");
      expect(voiceOut).toContain("Hello! Your code is 8891");
    });
  });

  // 2. API Edge Layer
  describe("Layer 2: API Edge Layer", () => {
    it("should authenticate and extract tenant from headers or subdomain", () => {
      const headers = new Headers();
      headers.set("x-tenant-id", "acme-corp");
      headers.set("authorization", "Bearer test-token");

      const url = new URL("https://support.servicev8.com/api/chat/stream");
      const auth = EdgeGateway.authenticateRequest(headers, url);

      expect(auth.tenantId).toBe("acme-corp");
      expect(auth.isAuthorized).toBe(true);
      expect(auth.rateLimitRemaining).toBeGreaterThan(0);
    });

    it("should format Server-Sent Events (SSE) data frames", () => {
      const sseFrame = EdgeGateway.formatSse("token", { text: "Hello World" });
      expect(sseFrame).toContain("event: token\n");
      expect(sseFrame).toContain('data: {"type":"token","payload":{"text":"Hello World"}');
    });
  });

  // 3. Agent Runtime Layer
  describe("Layer 3: Agent Runtime Layer", () => {
    it("should assemble stream-specific system prompts via PromptManager", () => {
      const contractorPrompt = PromptManager.buildSystemPrompt("contractors");
      expect(contractorPrompt).toContain("Contractor & Vendor Dispatch Lead");
      expect(contractorPrompt).toContain("W9 compliance");

      const customerPrompt = PromptManager.buildSystemPrompt("customers");
      expect(customerPrompt).toContain("Customer Success Lead");
      expect(customerPrompt).toContain("$500 limit");
    });

    it("should route queries across LLM model tiers via LlmRouter", () => {
      const context = {
        tenantId: "acme",
        sessionId: "sess_1",
        stream: "customers" as const,
        customer: { name: "Elena", arrValueUsd: 420000, sentimentScore: 0.8 },
        conversationHistory: [{ role: "user" as const, content: "We need architectural review of data retention policy" }],
        retrievedCitations: [],
      };

      const routing = LlmRouter.selectModel(context);
      expect(routing.tier).toBe("reasoning");
      expect(routing.modelName).toContain("claude-3-5-sonnet");
    });

    it("should plan and execute tools through Action Gateway and Temporal via ToolPlanner", async () => {
      const context = {
        tenantId: "acme",
        sessionId: "sess_refund",
        stream: "customers" as const,
        customer: { name: "Marcus", sentimentScore: 0.8 },
        conversationHistory: [{ role: "user" as const, content: "Can you issue an automated refund for order #9021?" }],
        retrievedCitations: [],
      };

      const tools = ToolPlanner.planTools(context);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].name).toBe("order_refund");

      const execResult = await ToolPlanner.executeTool(tools[0], context);
      expect(execResult.success).toBe(true);
      expect(execResult.toolName).toBe("order_refund");
    });

    it("should enforce safety guardrails: PII redaction, financial limits, and keyword triggers", () => {
      const context = {
        tenantId: "acme",
        sessionId: "sess_guard",
        stream: "customers" as const,
        customer: { name: "Test User", sentimentScore: 0.9 },
        conversationHistory: [],
        retrievedCitations: [],
      };

      // 1. PII Redaction
      const piiEval = Guardrails.evaluateInbound("My card number is 4532-1234-5678-9012 please charge it", context);
      expect(piiEval.sanitizedContent).toContain("[REDACTED_CC]");

      // 2. Financial Cap
      const finCheckOk = Guardrails.validateFinancialAction(450);
      expect(finCheckOk.allowed).toBe(true);

      const finCheckExceeded = Guardrails.validateFinancialAction(1200);
      expect(finCheckExceeded.allowed).toBe(false);
      expect(finCheckExceeded.reason).toContain("exceeds maximum autonomous limit ($500)");

      // 3. Escalation Keyword
      const escEval = Guardrails.evaluateInbound("I am going to speak with my lawyer about this dispute", context);
      expect(escEval.action).toBe("escalate_to_human");
    });

    it("should execute end-to-end AgentRuntimeCore with streaming events and telemetry", async () => {
      const payload = ChannelAdapters.normalizeWebChat({
        sessionId: "sess_e2e_test",
        stream: "customers",
        customerName: "Elena Rostova",
        customerEmail: "elena@acme.com",
        content: "Need $150 refund credit voucher",
      });

      const events: string[] = [];
      const result = await AgentRuntimeCore.processMessage(payload, (event) => {
        events.push(event);
      });

      expect(result.responseContent).toBeDefined();
      expect(result.responseContent).toContain("refund");
      expect(events).toContain("start");
      expect(events).toContain("token");
      expect(events).toContain("done");

      // Verify Telemetry recorded
      const metrics = ChatbotTelemetry.getMetricsSummary();
      expect(metrics.totalTraces).toBeGreaterThan(0);
    });
  });
});

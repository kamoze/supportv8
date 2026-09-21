import { describe, it, expect, vi } from "vitest";

vi.mock("pg", () => ({
  Pool: class {
    query = vi.fn();
    connect = vi.fn();
  },
  default: {
    Pool: class {
      query = vi.fn();
      connect = vi.fn();
    },
  },
}));

import { ChatWorkflowService, isAsunPalaceTenant } from "../src/lib/services/chat-workflow-service";
import { ToolPlanner } from "../src/lib/chatbot/agent-runtime/tool-planner";
import type { AgentContext } from "../src/lib/chatbot/types";

describe("Tenant Isolation: Corporate Default vs Asun Palace Storefront", () => {
  it("recognizes Asun Palace store tenant identifiers accurately", () => {
    expect(isAsunPalaceTenant("asun-palace-store")).toBe(true);
    expect(isAsunPalaceTenant("apalace")).toBe(true);
    expect(isAsunPalaceTenant("asun-palace-store.support.servicev8.com")).toBe(true);
    expect(isAsunPalaceTenant("acme")).toBe(false);
    expect(isAsunPalaceTenant("meridian")).toBe(false);
    expect(isAsunPalaceTenant("support.servicev8.com")).toBe(false);
    expect(isAsunPalaceTenant(undefined)).toBe(false);
  });

  it("preserves strict corporate B2B workflow for standard and other tenants (e.g. Acme, Meridian)", () => {
    const corporateWorkflows = ChatWorkflowService.getWorkflows("acme");
    const enquiries = corporateWorkflows.enquiries;
    expect(enquiries).toBeDefined();

    // Corporate enquiries REQUIRE company name
    const companyField = enquiries.intakeFields.find((f) => f.name === "company");
    expect(companyField).toBeDefined();
    expect(companyField?.required).toBe(true);
    expect(companyField?.label).toBe("Company / Organization");

    // Corporate enquiry options are B2B only
    const enquiryTypeField = enquiries.intakeFields.find((f) => f.name === "enquiryType");
    expect(enquiryTypeField?.options).toContain("Platform Demo & Architecture Deep-Dive");
    expect(enquiryTypeField?.options).toContain("Pricing & Enterprise Volume Licensing");
    expect(enquiryTypeField?.options).not.toContain("Store Menu, Hours & General Inquiries");
  });

  it("applies shopper-friendly workflow strictly for Asun Palace Store", () => {
    const asunWorkflows = ChatWorkflowService.getWorkflows("asun-palace-store");
    const enquiries = asunWorkflows.enquiries;
    expect(enquiries).toBeDefined();

    // Asun Palace shoppers do NOT have mandatory company requirement
    const companyField = enquiries.intakeFields.find((f) => f.name === "company");
    expect(companyField).toBeDefined();
    expect(companyField?.required).toBe(false);

    // Asun Palace options include food, menu, delivery & returns
    const enquiryTypeField = enquiries.intakeFields.find((f) => f.name === "enquiryType");
    expect(enquiryTypeField?.options).toContain("Store Menu, Hours & General Inquiries");
    expect(enquiryTypeField?.options).toContain("Order Status, Delivery & Tracking");
    expect(enquiryTypeField?.options).toContain("Returns, Refunds & Policies");

    // Customers workflow does not enforce mandatory Order ID
    const customers = asunWorkflows.customers;
    const accountField = customers.intakeFields.find((f) => f.name === "accountOrOrderId");
    expect(accountField?.required).toBe(false);
  });

  it("ToolPlanner isolates order_lookup strictly to Asun Palace / retail tenants", () => {
    const corporateContext: AgentContext = {
      tenantId: "acme",
      sessionId: "sess_corp",
      stream: "customers",
      customer: { name: "Corp Exec", email: "exec@acme.com", sentimentScore: 0.9 },
      conversationHistory: [
        { role: "user", content: "Can you check on my order delivery status?" },
      ],
      retrievedCitations: [],
    };

    // Corporate context should NOT plan order_lookup
    const corpTools = ToolPlanner.planTools(corporateContext);
    expect(corpTools.some((t) => t.name === "order_lookup")).toBe(false);

    const asunContext: AgentContext = {
      tenantId: "apalace",
      sessionId: "sess_store",
      stream: "customers",
      customer: { name: "Valued Shopper", email: "shopper@example.com", sentimentScore: 0.8 },
      intakeData: { accountOrOrderId: "ORD-99182" },
      conversationHistory: [
        { role: "user", content: "Can you check the delivery status of my food order please?" },
      ],
      retrievedCitations: [],
    };

    // Asun Palace context DOES plan order_lookup
    const asunTools = ToolPlanner.planTools(asunContext);
    const lookupTool = asunTools.find((t) => t.name === "order_lookup");
    expect(lookupTool).toBeDefined();
    expect(lookupTool?.arguments.orderId).toBe("ORD-99182");
    expect(lookupTool?.arguments.email).toBe("shopper@example.com");
    expect(lookupTool?.arguments.tenantId).toBe("apalace");
  });
});
